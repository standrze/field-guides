(() => {
  "use strict";

  const EXCLUDED = 'nav,button,[role="button"],input,textarea,select,script,style,template,audio,video,iframe,[hidden],[aria-hidden="true"],[data-narration-skip],.fg-learning,.lesson-meta,.terminal-bar,.code-label';
  const INTERACTIVE = ".code-lab,.lab-workbench,.interactive-lab,.practice-workspace";
  const VISUAL = 'figure,img,svg,canvas,[role="img"],.diagram,.stack-diagram,.flow,.journey,[data-diagram]';
  const NARRATIVE = "h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,figcaption,caption,pre,[data-narration]";
  const CONTAINER = "div,section,article,main,aside,header,footer,ul,ol,dl,details,summary";
  const normalize = text => String(text || "").replace(/\s+/g, " ").trim();
  const sentence = text => /[.!?]$/.test(normalize(text)) ? normalize(text) : `${normalize(text)}.`;

  function emptyCounts() {
    return { omittedVisuals: 0, omittedCodeBlocks: 0, omittedInteractive: 0, authoredSkips: 0, tablesRead: 0 };
  }

  function readJSON(id) {
    const node = document.getElementById(id);
    if (!node) return null;
    try { return JSON.parse(node.textContent); }
    catch { throw new Error(`The guide’s ${id === "course-data" ? "chapter list" : "metadata"} could not be read.`); }
  }

  function courseData() {
    const embedded = readJSON("course-data");
    if (embedded !== null) return embedded;
    // Legacy courses declare COURSE with const in an earlier classic script.
    // Read that binding directly; never evaluate code or HTML from a lesson.
    try { if (typeof COURSE !== "undefined") return COURSE; }
    catch { /* The guide's earlier script has not finished loading. */ }
    return window.COURSE || null;
  }

  function inertChapter(section) {
    const template = document.getElementById(`lesson-${section.id}`);
    let content;
    if (template?.content) content = template.content;
    else if (typeof section.body === "string") {
      const holder = document.createElement("template");
      holder.innerHTML = section.body;
      content = holder.content;
    } else throw new Error(`“${section.title || section.id}” has no readable chapter source.`);
    // A template's owner document has no browsing context. The cloned chapter
    // never enters the live page, runs a script, or navigates to another lesson.
    const root = content.ownerDocument.createElement("div");
    root.append(content.cloneNode(true));
    return root;
  }

  function plainText(element) {
    if (element.nodeType === 3) return element.textContent;
    if (element.nodeType !== 1 || element.matches(EXCLUDED)) return "";
    const authored = element.getAttribute("data-narration");
    if (authored !== null) return authored === "skip" ? "" : authored;
    if (element.matches("img")) return element.getAttribute("alt") || element.getAttribute("aria-label") || "";
    if (element.tagName === "BR") return " ";
    return [...element.childNodes].map(node => {
      const text = plainText(node);
      return node.nodeType === 1 && node.matches(CONTAINER) ? ` ${text} ` : node.nodeType === 1 && node.matches("p,li,dt,dd,h1,h2,h3,h4,h5,h6,figcaption,caption") ? ` ${text} ` : text;
    }).join("");
  }

  function tableNarration(table) {
    const captions = [...table.children].filter(node => node.tagName === "CAPTION").map(plainText).map(normalize).filter(Boolean);
    const rows = [...table.querySelectorAll("tr")].filter(row => row.closest("table") === table && !row.closest(EXCLUDED)).map(row =>
      [...row.children].filter(cell => cell.matches("th,td") && !cell.matches(EXCLUDED)).map(cell => ({
        text: normalize(plainText(cell)), header: cell.tagName === "TH",
        merged: (Number(cell.getAttribute("colspan")) || 1) > 1 || (Number(cell.getAttribute("rowspan")) || 1) > 1
      }))
    ).filter(row => row.length);
    const output = captions.length ? captions.map(text => sentence(`Table. ${text}`)) : ["Table."];
    const complex = rows.some(row => row.some(cell => cell.merged));
    if (complex) {
      output.push("This table contains merged cells. Its rows are read in document order; refer to the guide for the full layout.");
      rows.forEach((row, index) => output.push(`Row ${index + 1}. ${row.map((cell, column) => sentence(`${cell.header ? "Header" : `Cell ${column + 1}`}: ${cell.text || "blank"}`)).join(" ")}`));
    } else {
      const hasHeader = rows[0]?.every(cell => cell.header);
      const headers = hasHeader ? rows.shift().map(cell => cell.text) : [];
      if (headers.length) output.push(sentence(`Columns: ${headers.map((text, index) => text || `Column ${index + 1}`).join("; ")}`));
      rows.forEach((row, index) => output.push(`Row ${index + 1}. ${row.map((cell, column) => sentence(`${headers[column] || `Column ${column + 1}`}: ${cell.text || "blank"}`)).join(" ")}`));
    }
    if (!rows.length) output.push("There are no data rows in this table.");
    return output;
  }

  function visualNarration(element, root) {
    if (element.matches('img[alt=""]') && !element.getAttribute("aria-label") && !element.getAttribute("aria-describedby")) return { text: [], omitted: false };
    const descriptions = [];
    const add = value => {
      const text = normalize(value);
      if (text && !descriptions.some(existing => existing.toLocaleLowerCase() === text.toLocaleLowerCase())) descriptions.push(text);
    };
    add(element.getAttribute("aria-label"));
    for (const id of (element.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)) {
      const target = [...root.querySelectorAll("[id]")].find(node => node.id === id);
      if (target) add(plainText(target));
    }
    if (element.matches("img")) add(element.getAttribute("alt"));
    [...element.querySelectorAll("[data-narration],img,figcaption,title,desc")].forEach(node => {
      if (node.closest(EXCLUDED) || node.closest('[data-narration="skip"]') || node.parentElement.closest("[data-narration]")) return;
      if (node.matches("img") && !node.hasAttribute("data-narration")) add(node.getAttribute("alt") || node.getAttribute("aria-label"));
      else add(plainText(node));
    });
    [...element.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li")].forEach(node => {
      if (!node.closest("[data-narration],figcaption")) add(plainText(node));
    });
    // HTML diagrams often express their labels and steps as ordinary text.
    // Include those words rather than relying on a short accessible name alone.
    if (element.matches(".journey")) add([...element.children].map(plainText).map(sentence).join(" "));
    else if (!element.matches("figure,img,svg") && !element.querySelector("p,h1,h2,h3,h4,h5,h6,li")) add(plainText(element));
    else if (element.matches(".flow,.diagram,.stack-diagram,[data-diagram]")) {
      // Read the complete visible diagram text in its written order once.
      descriptions.length = 0;
      add(plainText(element));
    }
    if (!descriptions.length) return { text: ["This page includes a visual without a written description. Refer to the guide for its details."], omitted: true };
    return { text: descriptions.map((text, index) => sentence(`${index === 0 ? "Visual description. " : ""}${text}`)), omitted: false };
  }

  function prepareChapter(root, options) {
    const counts = emptyCounts();
    const owner = root.ownerDocument;
    const spokenNodes = texts => texts.map(text => {
      const paragraph = owner.createElement("p");
      paragraph.setAttribute("data-narration", text);
      paragraph.textContent = text;
      return paragraph;
    });

    function convert(element) {
      if (element.nodeType !== 1) return;
      if (element.matches(EXCLUDED)) { element.remove(); return; }
      const authored = element.getAttribute("data-narration");
      if (authored !== null) {
        if (authored === "skip" || !normalize(authored)) { counts.authoredSkips += 1; element.remove(); }
        else element.replaceWith(...spokenNodes([authored]));
        return;
      }
      if (element.matches(INTERACTIVE)) {
        counts.omittedInteractive += 1;
        element.replaceWith(...spokenNodes(["An interactive exercise appears here. Open the guide to complete it."]));
        return;
      }
      if (element.matches("table")) {
        counts.tablesRead += 1;
        element.replaceWith(...spokenNodes(tableNarration(element)));
        return;
      }
      if (element.matches("pre")) {
        const overrides = [...element.querySelectorAll("[data-narration]")].filter(node => !node.parentElement.closest("[data-narration]"));
        if (overrides.length) {
          const narration = overrides.map(plainText).map(normalize).filter(Boolean);
          if (!narration.length) counts.authoredSkips += 1;
          element.replaceWith(...spokenNodes(narration));
        } else if (options.codeMode !== "read") {
          counts.omittedCodeBlocks += 1;
          element.replaceWith(...spokenNodes(["Code example omitted from the narration. You can read it in the guide."]));
        }
        return;
      }
      if (element.matches(VISUAL)) {
        [...element.querySelectorAll("table,pre")].filter(node => !node.parentElement.closest("table,pre")).forEach(convert);
        const visual = visualNarration(element, root);
        if (visual.omitted) counts.omittedVisuals += 1;
        element.replaceWith(...spokenNodes(visual.text));
        return;
      }
      [...element.children].forEach(convert);
    }
    [...root.children].forEach(convert);

    // The read-aloud reader already handles semantic paragraphs and lists.
    // Give unwrapped callout labels, card descriptions, and other written runs
    // a paragraph boundary too, so an audiobook does not silently lose them.
    function preserveLooseText(element) {
      if (element.matches(NARRATIVE)) return;
      let run = [];
      const flush = () => {
        if (run.some(node => normalize(node.textContent))) {
          const paragraph = owner.createElement("p");
          run[0].before(paragraph);
          run.forEach(node => paragraph.append(node));
        }
        run = [];
      };
      [...element.childNodes].forEach(node => {
        const structural = node.nodeType === 1 && (node.matches(`${NARRATIVE},${CONTAINER}`) || node.querySelector(NARRATIVE));
        if (structural) { flush(); preserveLooseText(node); }
        else run.push(node);
      });
      flush();
    }
    preserveLooseText(root);
    return counts;
  }

  function build(options = {}) {
    const reader = window.FieldGuideLearning;
    if (!reader?.extractNarration || !reader?.splitText) throw new Error("The guide’s narration tools have not finished loading.");
    const course = courseData();
    if (!Array.isArray(course) || !course.length) throw new Error("This guide has no chapter list available for an audiobook.");
    const metadata = readJSON("guide-data") || window.FIELD_GUIDE || {};
    const guideID = normalize(document.body?.dataset.guideId || metadata.slug || location.pathname.split("/").filter(Boolean)[0]);
    const title = normalize(metadata.title || document.title.split(" · ").slice(1).join(" · ") || document.title || guideID);
    const seen = new Set();
    const totals = emptyCounts();
    const chapters = course.map((section, index) => {
      const id = normalize(section?.id);
      if (!id || seen.has(id)) throw new Error("The guide’s chapter list contains a missing or duplicate chapter identifier.");
      seen.add(id);
      const root = inertChapter(section);
      const chapterTitle = normalize(section.title || root.querySelector("h1")?.textContent || `Chapter ${index + 1}`);
      const heading = root.querySelector("h1");
      const comparable = text => normalize(text).replace(/\.+$/, "").toLocaleLowerCase();
      if (heading && !heading.hasAttribute("data-narration") && comparable(heading.textContent) === comparable(chapterTitle)) heading.remove();
      const counts = prepareChapter(root, options);
      const body = reader.extractNarration(root, { codeMode: options.codeMode === "read" ? "read" : "skip", pronunciations: options.pronunciations || [] }).map(section => section.text);
      if (!body.length && !heading) throw new Error(`“${chapterTitle}” has no readable chapter content.`);
      const segments = [...reader.speechChunks(`Chapter ${index + 1}. ${sentence(chapterTitle)}`, options), ...body];
      Object.keys(totals).forEach(key => { totals[key] += counts[key]; });
      return { id, title: chapterTitle, segments, ...counts, omittedCount: counts.omittedVisuals + counts.omittedCodeBlocks + counts.omittedInteractive + counts.authoredSkips };
    });
    return {
      guideID, title, chapters, ...totals,
      omittedCount: totals.omittedVisuals + totals.omittedCodeBlocks + totals.omittedInteractive + totals.authoredSkips,
      segmentCount: chapters.reduce((sum, chapter) => sum + chapter.segments.length, 0)
    };
  }

  window.FieldGuideAudiobookSource = Object.freeze({ build });
})();
