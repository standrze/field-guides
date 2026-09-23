"""Plain-text Gemma preprocessing, deliberately independent of torch."""
import json
from pathlib import Path

# Minimal native text format. No image, tool, or system-role support.
CHAT_TEMPLATE = """{{ bos_token }}{% for message in messages %}{{ '<start_of_turn>' + ('model' if message['role'] == 'assistant' else 'user') + '\n' + message['content'].strip() + '<end_of_turn>\n' }}{% endfor %}{% if add_generation_prompt %}{{ '<start_of_turn>model\n' }}{% endif %}"""
CONTROL_TOKENS = ("<bos>", "<eos>", "<pad>", "<start_of_turn>", "<end_of_turn>", "<start_of_image>", "<image_soft_token>")


def read_jsonl(path):
    rows = []
    for number, line in enumerate(Path(path).read_text().splitlines(), 1):
        if line.strip():
            row = json.loads(line)
            if not isinstance(row, dict):
                raise ValueError(f"{path}:{number}: expected an object")
            rows.append(row)
    if not rows:
        raise ValueError(f"Empty dataset: {path}")
    return rows


def validate_text(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Expected nonempty plain text")
    if any(token in text for token in CONTROL_TOKENS):
        raise ValueError("Raw Gemma control tokens are not supported inside content")


def check_disjoint(train, evaluation):
    def key(row):
        return json.dumps(row, sort_keys=True, ensure_ascii=False)
    if set(map(key, train)) & set(map(key, evaluation)):
        raise ValueError("Exact record overlap between training and evaluation")


def sft_example(row, tokenizer, max_length):
    messages = row.get("messages")
    if not isinstance(messages, list) or len(messages) < 2 or len(messages) % 2:
        raise ValueError("SFT needs alternating user/assistant messages ending in assistant")
    for index, message in enumerate(messages):
        expected = "user" if index % 2 == 0 else "assistant"
        if not isinstance(message, dict) or message.get("role") != expected:
            raise ValueError(f"Message {index} must have role {expected}")
        validate_text(message.get("content"))
    full = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=False)
    prefix = tokenizer.apply_chat_template(messages[:-1], tokenize=True, add_generation_prompt=True)
    if full[:len(prefix)] != prefix:
        raise ValueError("Chat template prefix mismatch: refusing an incorrect loss mask")
    if len(full) > max_length:
        raise ValueError(f"SFT example has {len(full)} tokens, exceeds {max_length}; shorten/split explicitly")
    if len(full) <= len(prefix):
        raise ValueError("SFT example has no supervised answer tokens")
    return {"input_ids": full, "labels": [-100] * len(prefix) + full[len(prefix):]}


def cpt_examples(row, tokenizer, max_length):
    text = row.get("text")
    validate_text(text)
    ids = [tokenizer.bos_token_id] + tokenizer.encode(text, add_special_tokens=False) + [tokenizer.eos_token_id]
    result = []
    for start in range(0, len(ids), max_length):
        block = ids[start:start + max_length]
        if len(block) > 1:
            result.append({"input_ids": block, "labels": [-100] + block[1:]})
    return result


def prepare(rows, tokenizer, objective, max_length):
    if objective not in ("cpt", "sft") or max_length < 8:
        raise ValueError("Expected cpt/sft objective and max_length >= 8")
    output = []
    for index, row in enumerate(rows):
        try:
            output.extend(cpt_examples(row, tokenizer, max_length) if objective == "cpt"
                          else [sft_example(row, tokenizer, max_length)])
        except ValueError as error:
            raise ValueError(f"Record {index + 1}: {error}") from error
    return output


def pad_batch(features, pad_token_id):
    length = max(len(item["input_ids"]) for item in features)
    batch = {"input_ids": [], "attention_mask": [], "labels": []}
    for item in features:
        n = len(item["input_ids"])
        batch["input_ids"].append(item["input_ids"] + [pad_token_id] * (length - n))
        batch["attention_mask"].append([1] * n + [0] * (length - n))
        batch["labels"].append(item["labels"] + [-100] * (length - n))
    return batch
