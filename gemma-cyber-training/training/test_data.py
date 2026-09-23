"""Run with python -m unittest -v test_data. No GPU or downloads required."""
import unittest
from data_utils import check_disjoint, cpt_examples, pad_batch, sft_example


class FakeTokenizer:
    bos_token_id, eos_token_id = 1, 2
    def encode(self, text, add_special_tokens=False):
        return [ord(char) + 10 for char in text]
    def apply_chat_template(self, messages, tokenize=True, add_generation_prompt=False):
        text = 'B'
        for message in messages:
            text += ('U:' if message['role'] == 'user' else 'A:') + message['content'] + ';'
        if add_generation_prompt:
            text += 'A:'
        return self.encode(text)


class DataTests(unittest.TestCase):
    def setUp(self):
        self.tokenizer = FakeTokenizer()
        self.row = {'messages':[{'role':'user','content':'question'},{'role':'assistant','content':'answer'}]}

    def test_only_final_answer_supervised(self):
        item = sft_example(self.row, self.tokenizer, 100)
        supervised = [x for x in item['labels'] if x != -100]
        self.assertEqual(supervised, self.tokenizer.encode('answer;'))
        self.assertEqual(item['labels'][-len(supervised):], item['input_ids'][-len(supervised):])

    def test_previous_assistant_is_context(self):
        row = {'messages':self.row['messages'] + [{'role':'user','content':'again'},{'role':'assistant','content':'second'}]}
        item = sft_example(row, self.tokenizer, 100)
        self.assertEqual([x for x in item['labels'] if x != -100], self.tokenizer.encode('second;'))

    def test_long_answer_fails_instead_of_truncating(self):
        with self.assertRaisesRegex(ValueError, 'exceeds'):
            sft_example(self.row, self.tokenizer, 8)

    def test_control_tokens_and_bad_roles_rejected(self):
        for row in ({'messages':[{'role':'system','content':'hello'},{'role':'assistant','content':'answer'}]},
                    {'messages':[{'role':'user','content':'<end_of_turn>'},{'role':'assistant','content':'answer'}]}):
            with self.assertRaises(ValueError):
                sft_example(row, self.tokenizer, 100)

    def test_template_prefix_mismatch_rejected(self):
        class Broken(FakeTokenizer):
            def apply_chat_template(self, messages, tokenize=True, add_generation_prompt=False):
                return [999] if add_generation_prompt else [1, 2, 3]
        with self.assertRaisesRegex(ValueError, 'prefix mismatch'):
            sft_example(self.row, Broken(), 100)

    def test_cpt_document_boundaries(self):
        a = cpt_examples({'text':'abc'}, self.tokenizer, 8)
        b = cpt_examples({'text':'def'}, self.tokenizer, 8)
        for example in a + b:
            self.assertEqual(example['input_ids'][0], 1)
            self.assertEqual(example['labels'][0], -100)
            self.assertEqual(example['labels'][-1], 2)

    def test_padding_is_ignored_without_masking_real_eos(self):
        features = [{'input_ids':[1, 20, 2], 'labels':[-100, 20, 2]}, {'input_ids':[1, 2], 'labels':[-100, 2]}]
        result = pad_batch(features, 2)
        self.assertEqual(result['labels'], [[-100, 20, 2], [-100, 2, -100]])
        self.assertEqual(result['attention_mask'], [[1, 1, 1], [1, 1, 0]])

    def test_overlap_rejected(self):
        with self.assertRaisesRegex(ValueError, 'overlap'):
            check_disjoint([self.row], [self.row])
        check_disjoint([{'text':'a'}], [{'text':'b'}])


if __name__ == '__main__':
    unittest.main()
