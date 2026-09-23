import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderMarkdown} from './markdown-engine.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
const metadata = [
  ['orientation', 'Design a Gemma 3 specialist with domain knowledge, useful problem-solving habits, and a consistent voice.'],
  ['training-map', 'Understand which training stage changes knowledge, behavior, or preferences.'],
  ['gemma', 'Choose the exact pretrained checkpoint and understand its practical constraints.'],
  ['cyber-corpus', 'Prepare a reliable corpus for defensive security knowledge.'],
  ['sft-data', 'Teach a repeatable approach through grounded tasks and checked answers.'],
  ['personality', 'Make tone, judgment, and interaction style consistent without losing competence.'],
  ['data-scale', 'Budget unique data, processed tokens, and instruction coverage.'],
  ['rounds', 'Understand epochs, steps, checkpoints, and repeated training.'],
  ['hyperparameters', 'Connect the training controls to learning, memory, and stability.'],
  ['adapters', 'Compare full tuning, LoRA, and QLoRA for a 27B model.'],
  ['evaluation', 'Measure domain skill, general ability, behavior, and practical reliability.'],
  ['recipe', 'Run a staged experiment and use the results to decide what to scale.'],
  ['training-script', 'Build, configure, validate, resume, and export a text-only Gemma QLoRA training project.'],
  ['runpod', 'Plan storage, GPU rental, training, and checkpoints on Runpod.'],
  ['hugging-face', 'Use the Hugging Face tools and Jobs workflow for training.'],
  ['export', 'Preserve the model lineage and publish a usable training artifact.'],
  ['field-reports', 'Read published Gemma 3 training reports with their evidence and limitations.'],
  ['sources', 'Primary references for the model, training methods, and practical workflows.'],
  ['prices', 'Compare published rental prices with the assumptions attached.'],
  ['budget', 'Turn a measured token rate into an experiment budget.']
];
const headings = [...source.matchAll(/^## (\d+)\. (.+)$/gm)];
if (headings.length !== metadata.length) {
  throw new Error(`Expected ${metadata.length} numbered chapters in guide.md; found ${headings.length}.`);
}
const chapters = headings.map((heading, index) => {
  const [id, summary] = metadata[index];
  const title = heading[2].trim();
  const bodyStart = heading.index + heading[0].length;
  const body = source.slice(bodyStart, headings[index + 1]?.index ?? source.length).trim();
  if (!body) throw new Error(`Chapter ${id} has no content.`);
  if (/<\/template\b/i.test(body)) throw new Error(`Chapter ${id} contains an unsupported closing template tag.`);
  const group = index < 6 ? 'Knowledge and behavior' : index < 11 ? 'Training decisions' : index < 16 ? 'Rented GPU practice' : 'Reference and cost';
  const html = renderMarkdown(body).replaceAll('<table>', '<div class="table-wrap"><table>').replaceAll('</table>', '</table></div>');
  return `<!-- CHAPTER ${id}|${group}|${title.replaceAll('|', '—')}|${summary} -->\n${html}\n`;
}).join('\n');
fs.writeFileSync(path.join(dir, 'chapters.html'), chapters);
await import('./render.mjs');
