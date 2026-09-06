# Cyber Model Distillation Field Guide

A source-grounded, 21-chapter guide to Minitron-style compression and domain adaptation for legitimate defensive cybersecurity use. Covers same-size and smaller students, Laguna MoE, Qwen and GPT-OSS architecture tradeoffs, a lean-model decision rule, the Midnight/training-project boundary, new knowledge, data, evaluation, refusal behavior, hardware, time, continual learning, CODI, and from-scratch training.

Live: https://standrze.github.io/field-guides/cyber-distillation/

The normal Field Guide shell retains chapter navigation, search, local progress, library appearance preferences, and the library-home link. Body text is 18 px; all guide labels are at least 14 px at default browser settings. The default accent is Light Green.

## Authoring

- Edit `chapters.html` for chapter content and metadata.
- Run `node cyber-distillation/build.mjs` from the repository root to regenerate `index.html` and `read-all.html`.
- Edit `styles.css` for guide-specific presentation; `base.css` is retained from the existing Field Guide template.
- `evidence.json` contains selected local measurements, with limitations, not a claim of independently validated model quality.

Serving needs no build system, backend, model, credentials, or package installation. `read-all.html` is a complete static fallback and printable edition. Runtime JavaScript only handles navigation and browser-local preferences/progress.

Research checked 2026-09-06. No new model training or structural pruning was performed to publish this guide. All proposed schedules and capacity bands are estimates or illustrative calculations; no Laguna 33B-to-8B result is claimed.
