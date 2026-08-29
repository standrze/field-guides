# Abliteration Methods Guide

This folder is a completely static website. It uses only HTML, CSS, and a small amount of
browser-side JavaScript.

The published folder does not require AI, a backend, Swift, Node.js, a database, API keys, or a
build step. Progress is stored locally in the visitor's browser with `localStorage`. External
research links require internet access, but the guide itself does not.

This repository is the generated publishing output. The Markdown authoring sources and Swift
generator are intentionally not required to host or browse it.

## GitHub Pages

- Live guide: <https://standrze.github.io/llm-abliteration/>
- MLX Swift training: <https://standrze.github.io/llm-abliteration/mlx/>
- Pages publishes the root of the `main` branch.

All site assets use relative URLs, so repository and project-page base paths both work.

The MLX training is kept in its own `mlx/` subtree. Its Sources lesson serves fifteen downloaded
academic papers locally from `mlx/papers/`; no external research link is required while reading
the guide.
