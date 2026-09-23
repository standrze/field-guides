#!/usr/bin/env python3
"""Single-CUDA-GPU text-only Gemma 3 4B/12B/27B QLoRA teaching starter.
CPU preprocessing tests pass; GPU training/export/resume are NOT qualified yet.
Paths in JSON configs are relative to the config file.
"""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path

from data_utils import CHAT_TEMPLATE, check_disjoint, pad_batch, prepare, read_jsonl


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--prepare-only", action="store_true", help="Download tokenizer/config only; validate data")
    parser.add_argument("--max-steps", type=int, help="Override epoch budget; positive optimizer-step count")
    parser.add_argument("--output-dir", help="Override output directory, relative to current directory")
    parser.add_argument("--resume", help="Full checkpoint directory for this SAME stage/config")
    args = parser.parse_args()
    config_path = Path(args.config).resolve()
    config = json.loads(config_path.read_text())
    allowed = {"model", "revision", "objective", "train_file", "eval_file", "output_dir", "initial_adapter", "max_length", "learning_rate", "epochs", "micro_batch", "gradient_accumulation", "rank", "alpha", "dropout", "weight_decay", "warmup_ratio", "eval_steps", "save_steps", "seed"}
    if set(config) - allowed:
        raise ValueError(f"Unknown config keys: {sorted(set(config) - allowed)}")
    if config["model"] not in {f"google/gemma-3-{size}-{kind}" for size in ("4b", "12b", "27b") for kind in ("pt", "it")}:
        raise ValueError("This starter supports official Gemma 3 4B/12B/27B checkpoints only")
    if args.max_steps is not None and args.max_steps < 1:
        raise ValueError("--max-steps must be positive")
    for key in ("max_length", "micro_batch", "gradient_accumulation", "rank", "alpha", "eval_steps", "save_steps"):
        if not isinstance(config[key], int) or config[key] < 1:
            raise ValueError(f"{key} must be a positive integer")
    if config["learning_rate"] <= 0 or config["epochs"] <= 0:
        raise ValueError("learning_rate and epochs must be positive")
    if not 0 <= config["dropout"] < 1 or not 0 <= config["warmup_ratio"] <= 1 or config["weight_decay"] < 0:
        raise ValueError("Invalid dropout, warmup ratio, or weight decay")
    if int(os.environ.get("WORLD_SIZE", "1")) != 1:
        raise ValueError("This starter supports one GPU, not torchrun/distributed launches")
    def path(key):
        return (config_path.parent / config[key]).resolve()
    output = Path(args.output_dir).resolve() if args.output_dir else path("output_dir")
    train_rows, eval_rows = read_jsonl(path("train_file")), read_jsonl(path("eval_file"))
    check_disjoint(train_rows, eval_rows)

    from transformers import AutoConfig, AutoTokenizer
    from huggingface_hub import model_info
    # Resolve 'main' once, then use the immutable commit for every load.
    revision = model_info(config["model"], revision=config.get("revision", "main")).sha
    base_config = AutoConfig.from_pretrained(config["model"], revision=revision)
    tokenizer = AutoTokenizer.from_pretrained(config["model"], revision=revision)
    tokenizer.chat_template = CHAT_TEMPLATE
    tokenizer.padding_side = "right"
    if any(value is None for value in (tokenizer.bos_token_id, tokenizer.eos_token_id, tokenizer.pad_token_id)):
        raise ValueError("Required Gemma special tokens missing")
    for token in ("<start_of_turn>", "<end_of_turn>"):
        ids = tokenizer.encode(token, add_special_tokens=False)
        if len(ids) != 1 or ids[0] == tokenizer.unk_token_id:
            raise ValueError(f"Unexpected tokenizer encoding for {token}")
    train_data = prepare(train_rows, tokenizer, config["objective"], config["max_length"])
    eval_data = prepare(eval_rows, tokenizer, config["objective"], config["max_length"])
    summary = {}
    for name, data in (("train", train_data), ("eval", eval_data)):
        summary[name] = {"sequences": len(data), "input_tokens": sum(len(x["input_ids"]) for x in data),
                         "supervised_tokens": sum(sum(t != -100 for t in x["labels"][1:]) for x in data),
                         "max_length": max(len(x["input_ids"]) for x in data)}
    print(json.dumps({"base_revision": revision, "data": summary}, indent=2))
    if args.prepare_only:
        return
    if output.exists() and any(output.iterdir()) and not args.resume:
        raise ValueError("Output directory is nonempty; choose a new run directory or --resume")
    manifest = {"config": config, "base_revision": revision, "max_steps": args.max_steps,
                "train_sha256": hashlib.sha256(path("train_file").read_bytes()).hexdigest(),
                "eval_sha256": hashlib.sha256(path("eval_file").read_bytes()).hexdigest(), "data": summary}
    if args.resume:
        checkpoint = Path(args.resume).resolve()
        old = json.loads((output / "run_manifest.json").read_text())
        if checkpoint.parent != output or not (checkpoint / "trainer_state.json").exists() or not (checkpoint / "optimizer.pt").exists():
            raise ValueError("Resume requires a full Trainer checkpoint within this output directory")
        for key in ("config", "base_revision", "max_steps", "train_sha256", "eval_sha256"):
            if old[key] != manifest[key]:
                raise ValueError(f"Resume mismatch: {key}. A new experiment needs a new directory.")
    initial = path("initial_adapter") if config.get("initial_adapter") else None
    if initial:
        previous = json.loads((initial / "run_manifest.json").read_text())
        if previous["base_revision"] != revision or previous["config"]["model"] != config["model"]:
            raise ValueError("Initial adapter must use the SAME original base model and revision")

    import torch
    from peft import LoraConfig, PeftModel, get_peft_model, prepare_model_for_kbit_training
    from transformers import BitsAndBytesConfig, Gemma3ForConditionalGeneration, Trainer, TrainingArguments, set_seed
    if not torch.cuda.is_available() or not torch.cuda.is_bf16_supported():
        raise RuntimeError("Use a CUDA GPU with BF16 support (e.g. A100/H100); this is not a Mac/CPU trainer")
    set_seed(config["seed"])
    quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4",
                                     bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16)
    model = Gemma3ForConditionalGeneration.from_pretrained(
        config["model"], revision=revision, config=base_config, torch_dtype=torch.bfloat16,
        quantization_config=quantization, device_map={"": 0}, attn_implementation="sdpa")
    model.config.use_cache = False
    model.config.text_config.use_cache = False
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True,
                                            gradient_checkpointing_kwargs={"use_reentrant": False})
    if initial:
        model = PeftModel.from_pretrained(model, str(initial), is_trainable=True)
        adapter = model.peft_config["default"]
        if (adapter.r, adapter.lora_alpha, adapter.lora_dropout) != (config["rank"], config["alpha"], config["dropout"]):
            raise ValueError("A continued adapter retains its rank/alpha/dropout; match its original configuration")
    else:
        suffixes = {"q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"}
        targets = [name for name, _ in model.named_modules()
                   if "language_model" in name.split(".") and name.split(".")[-1] in suffixes]
        if not targets:
            raise ValueError("No language-only adapter targets found; inspect model architecture")
        model = get_peft_model(model, LoraConfig(task_type="CAUSAL_LM", r=config["rank"],
                lora_alpha=config["alpha"], lora_dropout=config["dropout"], target_modules=targets,
                bias="none", revision=revision))
    trainable = [name for name, parameter in model.named_parameters() if parameter.requires_grad]
    if not trainable or any("lora_" not in name or "language_model" not in name for name in trainable):
        raise ValueError("Expected only language-model LoRA weights to be trainable")
    model.print_trainable_parameters()
    output.mkdir(parents=True, exist_ok=True)
    manifest["trainable_parameters"] = trainable
    manifest["versions"] = {name: importlib.metadata.version(name) for name in
                             ("torch", "transformers", "peft", "accelerate", "bitsandbytes", "huggingface-hub")}
    (output / "run_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    def collate(features):
        return {key: torch.tensor(values, dtype=torch.long)
                for key, values in pad_batch(features, tokenizer.pad_token_id).items()}
    training_args = TrainingArguments(
        output_dir=str(output), num_train_epochs=config["epochs"], max_steps=args.max_steps or -1,
        learning_rate=config["learning_rate"], per_device_train_batch_size=config["micro_batch"],
        per_device_eval_batch_size=1, gradient_accumulation_steps=config["gradient_accumulation"],
        bf16=True, optim="adamw_torch", weight_decay=config["weight_decay"], max_grad_norm=1.0,
        warmup_ratio=config["warmup_ratio"], lr_scheduler_type="cosine", seed=config["seed"],
        gradient_checkpointing=True, gradient_checkpointing_kwargs={"use_reentrant": False},
        eval_strategy="steps", eval_steps=config["eval_steps"], save_strategy="steps",
        save_steps=config["save_steps"], save_total_limit=2, logging_steps=1,
        report_to="none", remove_unused_columns=False, label_names=["labels"],
        prediction_loss_only=True, dataloader_num_workers=0)
    trainer = Trainer(model=model, args=training_args, train_dataset=train_data,
                      eval_dataset=eval_data, data_collator=collate, processing_class=tokenizer)
    # Gemma 3 conditional generation in this pinned version computes its own
    # mean CE and does not normalize by num_items_in_batch. Tell Trainer to
    # scale accumulation correctly. Microbatches receive equal weight.
    trainer.model_accepts_loss_kwargs = False
    result = trainer.train(resume_from_checkpoint=str(Path(args.resume).resolve()) if args.resume else None)
    trainer.save_metrics("train", result.metrics)
    trainer.save_metrics("eval", trainer.evaluate())
    # Final adapter export is NOT a full resumable training checkpoint.
    export = output / "adapter-final"
    model.save_pretrained(export, safe_serialization=True)
    tokenizer.save_pretrained(export)
    (export / "run_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Final (not automatically best) adapter exported to {export}")


if __name__ == "__main__":
    main()
