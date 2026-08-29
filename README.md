# Field Guide Library

This repository is the static publishing output for a growing collection of technical training
guides. Each guide lives in its own folder, while the repository root is a shared library page.

Live library: <https://standrze.github.io/field-guides/>

## Published guides

| Guide | Folder | Live path | Lessons |
|---|---|---|---:|
| Abliteration Methods Guide | abliteration/ | <https://standrze.github.io/field-guides/abliteration/> | 23 |
| MLX Swift Field Guide | mlx/ | <https://standrze.github.io/field-guides/mlx/> | 26 |

The MLX Sources lesson serves fifteen downloaded academic papers from mlx/papers/. The published
guides use relative asset URLs, so they remain portable across GitHub Pages project paths.

## Hosting model

- GitHub Pages publishes the root of the main branch.
- The site is static HTML, CSS, JavaScript, audio manifests, and local PDF sources.
- No backend, database, API key, AI service, Swift runtime, or Node.js process is required.
- Lesson progress and appearance choices are stored only in the visitor's browser.
- The root .nojekyll file keeps the generated directory structure unchanged.

To publish another training, add its generated static folder, add one project entry to the library
page and admin script, then push to main.
