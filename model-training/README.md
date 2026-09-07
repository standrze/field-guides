# Model Training Field Guide

Fifteen chapters on full fine-tuning, PEFT, LoRA, QLoRA, dense and MoE models, Liquid's hybrid backbone, gpt-oss, Qwen, memory, evaluation, and deployment.

`guide.md` is the editable source, using the local Field Guide Studio front matter. `course.md` supplies course identity. `markdown-engine.mjs` is the existing local Studio renderer. The publishing shell and assets reuse the library's chapter-guide format.

Run `node build.mjs` in this directory to regenerate `chapters.html`, `index.html`, and `read-all.html`. No package installation is required. Published model facts were checked September 7, 2026; sources are linked beside the corresponding claims. Hardware arithmetic is illustrative, not benchmark evidence.
