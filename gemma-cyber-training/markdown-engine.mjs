export const COURSE_REQUIRED_FIELDS = [
  "slug",
  "title",
  "description",
  "tag",
  "color",
  "brand-title",
  "brand-subtitle",
  "sidebar-footer",
  "search-placeholder",
  "storage-key",
  "practice-storage-key",
  "appearance-storage-key",
];

export const LESSON_REQUIRED_FIELDS = [
  "order",
  "id",
  "group",
  "title",
  "time",
  "level",
  "terms",
  "summary",
];

export const COLOR_PRESETS = [
  { name: "Baltic Blue", color: "#72a7e8", soft: "#dceafb" },
  { name: "Mint", color: "#79e0bd", soft: "#d9f7ed" },
  { name: "Aqua", color: "#6fe7ff", soft: "#c9f6ff" },
  { name: "Amber", color: "#ffcb42", soft: "#fff0bd" },
  { name: "Coral", color: "#ff9a62", soft: "#ffe2d2" },
  { name: "Pink", color: "#ff86b6", soft: "#ffe0ed" },
  { name: "Violet", color: "#bca9ff", soft: "#ece6ff" },
  { name: "Lavender", color: "#e5a6ff", soft: "#f4ddff" },
  { name: "Lime", color: "#baff63", soft: "#dfffba" },
  { name: "Copper", color: "#e59b5a", soft: "#f7dfca" },
  { name: "Sky", color: "#74c7ec", soft: "#d9f1fb" },
  { name: "Sage", color: "#9bd3ae", soft: "#e0f1e6" },
];

const COURSE_OPTIONAL_FIELDS = new Set();
const LESSON_OPTIONAL_FIELDS = new Set(["format"]);

export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function diagnostic(severity, message, line = null, code = "") {
  return { severity, message, line, code };
}

function normalizeSource(source) {
  const original = String(source ?? "");
  const hadBOM = original.charCodeAt(0) === 0xfeff;
  const withoutBOM = hadBOM ? original.slice(1) : original;
  const hadCRLF = /\r/.test(withoutBOM);
  return {
    source: withoutBOM.replace(/\r\n?/g, "\n"),
    hadBOM,
    hadCRLF,
  };
}

export function parseFieldGuideDocument(source, kind = "lesson") {
  const normalized = normalizeSource(source);
  const diagnostics = [];
  const lines = normalized.source.split("\n");
  const metadata = {};
  const metadataLines = {};

  if (normalized.hadBOM) {
    diagnostics.push(diagnostic("warning", "Remove the UTF-8 byte-order mark before the production build.", 1, "bom"));
  }
  if (normalized.hadCRLF) {
    diagnostics.push(diagnostic("warning", "Use LF line endings; the current Swift parser expects exact LF front-matter fences.", 1, "crlf"));
  }

  if (lines[0] !== "---") {
    diagnostics.push(diagnostic("error", "The document must begin with an exact --- line.", 1, "opening-fence"));
    return { kind, metadata, body: normalized.source, diagnostics, normalizedSource: normalized.source, bodyStartLine: 1 };
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closingIndex === -1) {
    diagnostics.push(diagnostic("error", "Add a closing --- line after the front matter.", lines.length, "closing-fence"));
    return { kind, metadata, body: "", diagnostics, normalizedSource: normalized.source, bodyStartLine: lines.length };
  }

  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (line.trim() === "") {
      diagnostics.push(diagnostic("error", "Blank lines are not allowed inside field-guide front matter.", lineNumber, "blank-metadata"));
      continue;
    }
    const separator = line.indexOf(":");
    if (separator === -1) {
      diagnostics.push(diagnostic("error", "Front matter must use one key: value pair per line.", lineNumber, "metadata-pair"));
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!key) {
      diagnostics.push(diagnostic("error", "A front-matter key cannot be empty.", lineNumber, "empty-key"));
      continue;
    }
    if (Object.hasOwn(metadata, key)) {
      diagnostics.push(diagnostic("warning", `Duplicate “${key}”; the production parser keeps the last value.`, lineNumber, "duplicate-key"));
    }
    metadata[key] = value;
    metadataLines[key] = lineNumber;
  }

  const required = kind === "course" ? COURSE_REQUIRED_FIELDS : LESSON_REQUIRED_FIELDS;
  const allowed = new Set([...required, ...(kind === "course" ? COURSE_OPTIONAL_FIELDS : LESSON_OPTIONAL_FIELDS)]);
  for (const field of required) {
    if (!metadata[field]) {
      diagnostics.push(diagnostic("error", `Missing required “${field}” value.`, closingIndex + 1, "missing-field"));
    }
  }
  for (const field of Object.keys(metadata)) {
    if (!allowed.has(field)) {
      diagnostics.push(diagnostic("warning", `Unknown field “${field}” is ignored by this template.`, metadataLines[field], "unknown-field"));
    }
  }

  if (kind === "lesson") {
    if (metadata.order && !/^\d+$/.test(metadata.order)) {
      diagnostics.push(diagnostic("error", "order must be a non-negative integer.", metadataLines.order, "bad-order"));
    }
    if (metadata.id && !/^[A-Za-z0-9-]+$/.test(metadata.id)) {
      diagnostics.push(diagnostic("error", "id may contain only ASCII letters, numbers, and hyphens.", metadataLines.id, "bad-id"));
    }
    if (metadata.format && !["markdown", "html"].includes(metadata.format)) {
      diagnostics.push(diagnostic("error", "format must be markdown or html.", metadataLines.format, "bad-format"));
    }
  } else {
    if (metadata.slug && !/^[A-Za-z0-9-]+$/.test(metadata.slug)) {
      diagnostics.push(diagnostic("error", "slug may contain only ASCII letters, numbers, and hyphens.", metadataLines.slug, "bad-slug"));
    }
    if (metadata.tag && !/^[A-Za-z0-9]\/$/.test(metadata.tag)) {
      diagnostics.push(diagnostic("error", "tag must be one ASCII letter or number followed by /.", metadataLines.tag, "bad-tag"));
    }
    if (metadata.color && !COLOR_PRESETS.some(preset => preset.name.toLowerCase() === metadata.color.toLowerCase())) {
      diagnostics.push(diagnostic("error", `color must be a built-in name: ${COLOR_PRESETS.map(item => item.name).join(", ")}.`, metadataLines.color, "bad-color"));
    }
  }

  const bodyStartLine = closingIndex + 2;
  const body = lines.slice(closingIndex + 1).join("\n");
  if (/<\/template/i.test(body)) {
    const preceding = body.slice(0, body.search(/<\/template/i));
    const line = bodyStartLine + preceding.split("\n").length - 1;
    diagnostics.push(diagnostic("error", "The production builder rejects a closing template tag in lesson content.", line, "unsafe-template"));
  }
  const activeHTML = body.match(/<(?:script|iframe|object|embed|meta|link|base)\b/i);
  if (activeHTML) {
    const line = bodyStartLine + body.slice(0, activeHTML.index).split("\n").length - 1;
    diagnostics.push(diagnostic("warning", "The isolated preview removes active or document-level HTML tags.", line, "active-html"));
  }
  if (kind === "lesson" && !body.trim()) {
    diagnostics.push(diagnostic("warning", "The lesson body is empty.", bodyStartLine, "empty-body"));
  }
  if (kind === "lesson" && body.trim() && !/^#\s+\S/m.test(body) && !/<h1[\s>]/i.test(body)) {
    diagnostics.push(diagnostic("warning", "Add a visible H1 heading; front matter does not create one automatically.", bodyStartLine, "missing-h1"));
  }
  const remoteMatch = body.match(/(?:\]\(|href\s*=\s*["'])https?:\/\//i);
  if (remoteMatch) {
    const line = bodyStartLine + body.slice(0, remoteMatch.index).split("\n").length - 1;
    diagnostics.push(diagnostic("warning", "This library prefers local reading links; verify any remote URL before publishing.", line, "remote-link"));
  }

  return { kind, metadata, body, diagnostics, normalizedSource: normalized.source, bodyStartLine };
}

function createTokenStore() {
  const values = [];
  return {
    put(value) {
      const token = `\uE000${values.length}\uE001`;
      values.push(value);
      return token;
    },
    restore(value) {
      return value.replace(/\uE000(\d+)\uE001/g, (_, index) => values[Number(index)] ?? "");
    },
  };
}

function safeDestination(value) {
  const cleaned = value.trim();
  if (/^(?:javascript|vbscript):/i.test(cleaned)) return "#blocked-link";
  if (/^data:/i.test(cleaned) && !/^data:image\/(?:png|gif|jpeg|webp);base64,/i.test(cleaned)) return "#blocked-link";
  return cleaned;
}

export function renderInlineMarkdown(value) {
  const store = createTokenStore();
  let output = String(value ?? "");

  output = output.replace(/`([^`\n]+)`/g, (_, code) => store.put(`<code>${escapeHTML(code)}</code>`));
  output = output.replace(/<\/?(?!https?:\/\/)[A-Za-z][^>]*>/gi, tag => store.put(tag));
  output = escapeHTML(output);

  output = output.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, (_, alt, source) => {
    return `<img src="${escapeHTML(safeDestination(source))}" alt="${escapeHTML(alt)}">`;
  });
  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, (_, label, destination) => {
    return `<a href="${escapeHTML(safeDestination(destination))}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  output = output.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, (_, destination) => {
    return `<a href="${escapeHTML(destination)}" target="_blank" rel="noopener noreferrer">${escapeHTML(destination)}</a>`;
  });
  output = output.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  output = output.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  output = output.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  output = output.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  output = output.replace(/ {2}\n/g, "<br>\n").replace(/\n/g, " ");
  return store.restore(output);
}

function splitTableRow(line) {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  const cells = [];
  let current = "";
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isTableDivider(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
}

function tableAlignment(cell) {
  if (/^:-+:$/.test(cell)) return "center";
  if (/^-+:$/.test(cell)) return "right";
  return "left";
}

function beginsBlock(lines, index) {
  const line = lines[index] ?? "";
  const next = lines[index + 1] ?? "";
  return /^ {0,3}(?:#{1,6}\s|>|```|~~~|[-+*]\s|\d+[.)]\s|<)/.test(line)
    || /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)
    || (line.includes("|") && isTableDivider(next));
}

export function renderMarkdown(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)\s*$/);
    if (fence) {
      const marker = fence[1][0];
      const minimum = fence[1].length;
      const language = fence[2];
      const code = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^ {0,3}${marker}{${minimum},}\\s*$`).test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const className = language ? ` class="language-${escapeHTML(language)}"` : "";
      output.push(`<pre><code${className}>${escapeHTML(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      output.push("<hr>");
      index += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoted = [];
      while (index < lines.length && /^ {0,3}>/.test(lines[index])) {
        quoted.push(lines[index].replace(/^ {0,3}> ?/, ""));
        index += 1;
      }
      output.push(`<blockquote>${renderMarkdown(quoted.join("\n"))}</blockquote>`);
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      const headers = splitTableRow(line);
      const dividers = splitTableRow(lines[index + 1]);
      const alignments = dividers.map(tableAlignment);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      output.push(`<div class="table-scroll"><table><thead><tr>${headers.map((cell, cellIndex) => `<th style="text-align:${alignments[cellIndex] ?? "left"}">${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${headers.map((_, cellIndex) => `<td style="text-align:${alignments[cellIndex] ?? "left"}">${renderInlineMarkdown(row[cellIndex] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    const listMatch = line.match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^ {0,3}([-+*]|\d+[.)])\s+(.+)$/);
        if (!match || /^\d/.test(match[1]) !== ordered) break;
        let item = match[2];
        const task = item.match(/^\[([ xX])\]\s+(.+)$/);
        if (task) {
          item = `<input type="checkbox" disabled${task[1].toLowerCase() === "x" ? " checked" : ""}> ${renderInlineMarkdown(task[2])}`;
        } else {
          item = renderInlineMarkdown(item);
        }
        items.push(`<li>${item}</li>`);
        index += 1;
      }
      output.push(`<${tag}${items.some(item => item.includes("checkbox")) ? ' class="task-list"' : ""}>${items.join("")}</${tag}>`);
      continue;
    }

    if (/^\s*</.test(line)) {
      const raw = [];
      while (index < lines.length && lines[index].trim()) {
        raw.push(lines[index]);
        index += 1;
      }
      output.push(raw.join("\n"));
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !beginsBlock(lines, index)) {
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(`<p>${renderInlineMarkdown(paragraph.join("\n"))}</p>`);
  }

  return output.join("\n");
}

export function getColorPreset(name) {
  return COLOR_PRESETS.find(preset => preset.name.toLowerCase() === String(name ?? "").toLowerCase()) ?? COLOR_PRESETS[1];
}

export function renderLessonBody(parsedLesson) {
  return parsedLesson.metadata.format === "html" ? parsedLesson.body : renderMarkdown(parsedLesson.body);
}
