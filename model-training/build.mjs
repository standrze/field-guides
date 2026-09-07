import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderMarkdown} from './markdown-engine.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(dir, 'guide.md'), 'utf8');
const sections = source.split(/^## (\d+)\. (.+)$/m);
const ids = ['orientation','inside-model','training-objectives','full-tuning','lora','qlora','dense-moe','model-families','recurrent-depth','read-checkpoint','memory-time','experiment','deployment','glossary','self-test'];
const summaries = ['Separate architecture, learning objective, and parameter updates.','Understand embeddings, attention, feed-forward networks, and training state.','Distinguish scratch pretraining, CPT, SFT, preferences, and distillation.','What changes when you update the whole network.','Understand rank, adapter targets, and merging with a worked matrix example.','How quantized frozen weights make adapter training more memory-efficient.','Understand routers, experts, and total versus active parameters.','Compare specific Liquid, OpenAI, and Qwen checkpoints.','How repeated computation differs from additional parameters.','Read the configuration before choosing training software.','Calculate memory and time from a measured workload.','Design a small, useful adaptation comparison.','Preserve the exact base, tokenizer, adapters, and tested exports.','A compact reference for the terms in model training.','Check your understanding with common misconceptions.'];
if ((sections.length - 1) / 3 !== ids.length) throw new Error('Unexpected chapter count');
let chapters = '';
for (let i=0;i<ids.length;i++) {
  const title = sections[2+i*3];
  const body = sections[3+i*3];
  const group = i<3 ? 'Foundations' : i<6 ? 'Adaptation' : i<9 ? 'Architectures' : 'Practice and reference';
  const html = renderMarkdown(body).replaceAll('<table>', '<div class="table-wrap"><table>').replaceAll('</table>', '</table></div>');
  chapters += `<!-- CHAPTER ${ids[i]}|${group}|${title}|${summaries[i]} -->\n${html}\n`;
}
fs.writeFileSync(path.join(dir, 'chapters.html'), chapters);
await import('./render.mjs');
