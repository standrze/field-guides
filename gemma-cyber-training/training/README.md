# Gemma 3 training starter

**Teaching implementation, not GPU-qualified.** Local checks cover Python syntax and preprocessing invariants with a fake tokenizer. Actual Gemma tokenization, model loading, CUDA memory, training, export/reload and checkpoint resume still require a rented-GPU smoke test. No training has been run for this guide.

Scope: one BF16-capable NVIDIA GPU, Linux x86_64, Python 3.11, plain text, official Gemma 3 4B/12B/27B PT or IT, NF4 QLoRA. The complete conditional-generation checkpoint is loaded; only language-model LoRA parameters train. The vision tower remains present and frozen. This is not a 1B, multimodal, distributed, full-weight or DPO trainer.

## Files

- `train_gemma.py`: model, adapters, Trainer, checkpoints, manifest and export.
- `reload_adapter.py`: fresh-process generation acceptance check.
- `data_utils.py`: JSONL validation, native text formatting, loss masks and padding.
- `configs/cpt.json`: PT + text objective.
- `configs/sft-after-cpt.json`: continue the saved CPT adapter on the same PT base, with a new optimizer/scheduler.
- `configs/personality.json`: fresh adapter on IT for personality/task SFT without CPT.
- `examples/`: invented **format fixtures**, far too small for meaningful training or evaluation.
- `test_data.py`: dependency-free preprocessing unit tests.

## Install on a rental

Accept the Google Gemma license/access conditions for your selected repositories on Hugging Face. Use a read-scoped token for model access. Keep credentials out of Git.

```bash
# In persistent storage on the rental, after confirming its mount lifecycle:
git clone https://github.com/standrze/field-guides.git
cd field-guides/gemma-cyber-training/training
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
hf auth login
nvidia-smi
python -m pip check
python -m unittest -v test_data
```

Requirements select a fixed starting stack, not the latest packages or a complete lock. Use a fresh environment so incompatible preinstalled torchvision packages do not interfere. The NVIDIA driver must support the CUDA runtime in the installed PyTorch wheel. After the GPU acceptance checks, save `python -m pip freeze > requirements-lock.txt` alongside the run manifest and record the container/image and driver version.

## Prepare your data and config

JSON config paths are relative to the config file; CLI `--output-dir` and `--resume` paths are relative to your shell directory. Replace the example file paths with separate reviewed training and evaluation datasets. `revision: "main"` is resolved to a commit at startup and recorded; **replace main with that exact SHA** before the real experiments and before proceeding to the next stage. Do not change it between CPT and SFT.

```bash
python train_gemma.py --config configs/personality.json --prepare-only
```

This needs tokenizer/config access but downloads no model weights. Inspect the reported input versus supervised token counts. It rejects overlong SFT records, bad role order, raw control tokens, and exact record overlap. It does **not** detect semantic duplicates or certify data quality; split by document/source/time before tokenization.

The script overrides the tokenizer's chat template with a minimal Gemma text template and saves it with the adapter. Supply alternating `user` / `assistant` strings; put any instruction in the first user message. Only the **last assistant response** and its turn ending are supervised. Earlier assistant turns are context. To train on every reply, create separate conversation prefixes ending at each desired assistant answer, keeping the entire conversation in one split. For deployment, load the exported tokenizer and use the same template; do not silently substitute a server's different default.

CPT trains next-token prediction within each document. Long documents become independent blocks; short documents are not packed together. The last fragment of fewer than two tokens is dropped. This simple implementation keeps tokenized data in RAM and is intended for a pilot. Large corpora need a tested streaming/Arrow preprocessing pipeline, token-level accounting, and explicit packing semantics.

## Five-update smoke test

Copy a config to `configs/smoke.json`. Set `eval_steps` and `save_steps` to **2**, reduce `max_length` to **512**, and use a small, real, disjoint dataset. You can first test 4B by changing only the supported model ID; a successful 4B run does not prove 27B fits. A100 80 GB is a candidate to measure, not a memory guarantee.

```bash
python train_gemma.py --config configs/smoke.json \
  --max-steps 5 --output-dir runs/smoke
```

Confirm finite loss/gradients, expected language-only trainable parameters, nonzero supervised tokens, peak memory and export contents. Five updates validate plumbing, not quality. With saving every two updates, checkpoint-4 is a resumable checkpoint. Test recovery in the same run:

```bash
python train_gemma.py --config configs/smoke.json \
  --max-steps 5 --output-dir runs/smoke --resume runs/smoke/checkpoint-4
```

The strict resume check requires identical config, file hashes, base revision and total step budget. It is recovery, not an instruction to train five more updates. Confirm the logs start at the saved step. Checkpoints contain optimizer state and should be loaded only from trusted runs.

## Run a stage

After smoke testing, use your real data and tuned configuration:

```bash
python train_gemma.py --config configs/cpt.json
# Verify CPT evaluations and select the adapter before continuing.
python train_gemma.py --config configs/sft-after-cpt.json
# Independent alternative: personality tuning from IT, no CPT:
python train_gemma.py --config configs/personality.json
```

The SFT-after-CPT example points at the **final** CPT export for simplicity, not an automatically selected best checkpoint. Use evaluation to select your checkpoint, export its adapter/tokenizer/manifest together, and set `initial_adapter` accordingly. The script requires a matching manifest. It continues the same adapter: do not swap the base to IT, stack an unrelated fresh adapter, or merge a 4-bit base in place. Rank/alpha/dropout must match when continuing an existing adapter.

Each new experiment needs a fresh output directory. `--max-steps` overrides epochs. At microbatch 1 × accumulation 16 × one GPU, one full optimizer update covers 16 sequences; a partial final accumulation group can be smaller. Input token counts and supervised token counts are different quantities. The saved Trainer metrics do not constitute a carefully measured steady-state tokens/second benchmark.

## Outputs and mandatory reload check

`checkpoint-N/` is a periodic resumable Trainer checkpoint, including optimizer/scheduler state. `adapter-final/` is an inference adapter plus tokenizer and manifest; it is not a complete standalone 27B model or resumable training state. Checkpoint retention is two. The final adapter is not automatically the best model. `run_manifest.json` records the original base revision, data hashes, settings, package versions and trainable parameter names.

Run `python reload_adapter.py runs/smoke/adapter-final` for the included generation check. In a **new process**, load the same original base and exact revision using the same quantization settings, attach the export with `PeftModel.from_pretrained(base, adapter_path)`, and load the tokenizer from the adapter directory. Set the model to eval mode. For generation use left padding, `add_generation_prompt=True`, and stop on both the tokenizer EOS and `<end_of_turn>` token IDs. Test deterministic answers with `do_sample=False` on held-out tasks. Compare original IT against personality adapters and PT/SFT against CPT/SFT using identical prompts.

No automatic uploads or GPU provisioning happen in this script. Publish source/configuration to GitHub, adapter weights to a model repository, and resumable checkpoints to private persistent storage. Inspect manifests for private file paths before sharing them.

## Known limits

- GPU integration, memory capacity and exported generation are unverified here.
- Training loss alone does not measure usefulness, factual retention or personality consistency.
- A tiny SFT corpus does not replicate Google's full instruction tuning.
- Eager data loading and document-local chunks prioritize inspectability over large-corpus efficiency.
- No image training, cross-document packing, distributed launch, automated model selection, DPO, or training-throughput instrumentation.
- Version pins are a starting point. Qualify upgrades with the same mask/load/train/resume/reload checks.

Sources: [Gemma 3 model API](https://huggingface.co/docs/transformers/v4.57.1/en/model_doc/gemma3), [Trainer API](https://huggingface.co/docs/transformers/v4.57.1/en/main_classes/trainer), [PEFT quantized training](https://huggingface.co/docs/peft/v0.17.0/en/developer_guides/quantization), [Gemma formatting](https://ai.google.dev/gemma/docs/core/prompt-structure).
