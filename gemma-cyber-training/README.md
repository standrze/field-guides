# LLM Training Field Guide

A tropical edition of the shared Field Guide template, covering model-independent fine-tuning theory, batches, optimizer dynamics, personality, evaluation, and Gemma 3 implementation examples, GPU rental, and experiment costs.

## Edit and build

Edit `guide.md`, then run:

```sh
node build.mjs
```

Numbered `## N. Title` headings become the guide's 23 chapters. The builder maps their order to stable chapter IDs and groups in `build.mjs`. It writes `chapters.html`, `index.html`, and `read-all.html`.

The page reuses the library's navigation, progress, search, base styles, and Markdown renderer. `../layout.css` controls shared geometry; `tropical.css` supplies the turquoise, coral, mango, and deep teal theme.

`calculator.js` updates the budget calculator on both the chapter view and read-all page. Enter aggregate throughput and the price of the entire GPU job. Defaults are hypothetical examples, not performance measurements.

Serve the library root to retain shared assets and library links:

```sh
python3 -m http.server 8000 --directory ..
```

Open `http://localhost:8000/gemma-cyber-training/`.

## Training implementation

The `training/` folder contains the Python starter, three JSON configs, format fixtures, preprocessing tests and a reload script. Read its README for validation status; GPU training has not been executed.
