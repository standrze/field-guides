# Abliteration Methods Guide

This folder is a completely static website. It uses only HTML, CSS, and a small amount of
browser-side JavaScript.

The published folder does not require AI, a backend, Swift, Node.js, a database, API keys, or a
build step. Progress is stored locally in the visitor's browser with `localStorage`. External
research links require internet access, but the guide itself does not.

The editable lesson sources live in `Content/abliterate/*.md`. From the repository root, run
`swift run site-builder` to regenerate this folder and the Hummingbird-served copy.

## GitHub Pages

- To publish the guide at the root of a Pages site, use the contents of this folder as the publishing source.
- To keep it inside an existing Pages site, publish the repository root and visit `/abliterate/`
  beneath the repository's Pages URL.

All site assets use relative URLs, so repository and project-page base paths both work.
