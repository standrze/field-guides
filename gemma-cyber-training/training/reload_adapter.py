#!/usr/bin/env python3
"""Fresh-process, deterministic text generation acceptance check. GPU unverified."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('adapter', help='adapter-final directory from the starter')
    parser.add_argument('--prompt', default='What should a backup restoration test verify?')
    args = parser.parse_args()
    from data_utils import validate_text
    validate_text(args.prompt)
    import torch
    from peft import PeftModel
    from transformers import AutoTokenizer, BitsAndBytesConfig, Gemma3ForConditionalGeneration
    manifest = json.loads((Path(args.adapter) / 'run_manifest.json').read_text())
    quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4',
        bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16)
    base = Gemma3ForConditionalGeneration.from_pretrained(
        manifest['config']['model'], revision=manifest['base_revision'],
        quantization_config=quantization, torch_dtype=torch.bfloat16,
        device_map={'': 0}, attn_implementation='sdpa')
    model = PeftModel.from_pretrained(base, args.adapter).eval()
    tokenizer = AutoTokenizer.from_pretrained(args.adapter, padding_side='left')
    inputs = tokenizer.apply_chat_template([{'role':'user', 'content':args.prompt}],
        tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors='pt').to('cuda:0')
    with torch.inference_mode():
        output = model.generate(**inputs, max_new_tokens=256, do_sample=False,
            eos_token_id=[tokenizer.eos_token_id, tokenizer.convert_tokens_to_ids('<end_of_turn>')],
            pad_token_id=tokenizer.pad_token_id)
    print(tokenizer.decode(output[0, inputs['input_ids'].shape[1]:], skip_special_tokens=True))


if __name__ == '__main__':
    main()
