const nav = document.querySelector("#course-nav");
const lessonElement = document.querySelector("#lesson");
const crumb = document.querySelector("#crumb");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const completeButton = document.querySelector("#complete");
const progressBar = document.querySelector("#progress-bar");
const progressLabel = document.querySelector("#progress-label");
const sidebar = document.querySelector("#sidebar");
const dialog = document.querySelector("#search-dialog");
const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");

const guideSettings = window.FIELD_GUIDE || {};
const storageKey = guideSettings.storageKey || "swifttui-field-guide-progress-v1";
const validLessonIDs = new Set(COURSE.map(lesson => lesson.id));
let completed = new Set(readStoredIDs(storageKey).filter(id => validLessonIDs.has(id)));
let currentIndex = 0;
let selectedResult = 0;
const labStorageKey = guideSettings.labStorageKey || "swifttui-field-guide-labs-v1";
const validLabIDs = new Set(Object.values(LABS).map(lab => lab.id));
let solvedLabs = new Set(readStoredIDs(labStorageKey).filter(id => validLabIDs.has(id)));
let capabilities = null;

function readStoredIDs(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

// Preserve retained progress while removing IDs retired by curriculum revisions.
localStorage.setItem(storageKey, JSON.stringify([...completed]));
localStorage.setItem(labStorageKey, JSON.stringify([...solvedLabs]));

function routeID() {
  return location.hash.slice(1) || COURSE[0].id;
}

function renderNavigation() {
  let group = "";
  nav.innerHTML = COURSE.map((lesson, index) => {
    const heading = lesson.group !== group ? `<div class="nav-group">${lesson.group}</div>` : "";
    group = lesson.group;
    return `${heading}<button class="lesson-link ${index === currentIndex ? "active" : ""} ${completed.has(lesson.id) ? "done" : ""}" data-id="${lesson.id}">
      <span class="lesson-index"><span>${String(index).padStart(2, "0")}</span></span><span>${lesson.title}</span>
    </button>`;
  }).join("");
  nav.querySelectorAll("[data-id]").forEach(button => button.addEventListener("click", () => {
    location.hash = button.dataset.id;
    sidebar.classList.remove("open");
  }));
}

function renderLesson() {
  const requested = routeID();
  currentIndex = Math.max(0, COURSE.findIndex(lesson => lesson.id === requested));
  const lesson = COURSE[currentIndex];
  if (requested !== lesson.id) history.replaceState(null, "", `#${lesson.id}`);
  lessonElement.innerHTML = lesson.body;
  if (LABS[lesson.id]) injectCodeLab(lesson, LABS[lesson.id]);
  crumb.textContent = `${String(currentIndex).padStart(2, "0")} / ${lesson.group}`;
  document.title = `${lesson.title} · ${guideSettings.title || "SwiftTUI Field Guide"}`;
  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === COURSE.length - 1;
  completeButton.classList.toggle("done", completed.has(lesson.id));
  completeButton.textContent = completed.has(lesson.id) ? "✓ Completed" : "Mark complete";
  renderNavigation();
  updateProgress();
  window.scrollTo({ top: 0, behavior: "instant" });
  lessonElement.focus({ preventScroll: true });
}

function escapeHTML(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function injectCodeLab(lesson, lab) {
  const meta = lessonElement.querySelector(".lesson-meta");
  const container = document.createElement("section");
  container.className = `code-lab ${solvedLabs.has(lab.id) ? "solved" : ""}`;
  container.dataset.lab = lab.id;
  container.innerHTML = `
    <div class="lab-heading">
      <div><span class="lab-kicker">Interactive Swift Lab</span><h2>${lab.title}</h2></div>
      <span class="lab-status">${solvedLabs.has(lab.id) ? "✓ Solved" : "Ready"}</span>
    </div>
    <p>${lab.brief}</p>
    <div class="lab-workbench">
      <div class="editor-pane">
        <div class="pane-bar"><span>main.swift</span><span class="compiler-state">Swift 6.3</span></div>
        <textarea class="code-editor" spellcheck="false" aria-label="Swift code editor">${escapeHTML(lab.starter)}</textarea>
      </div>
      <div class="output-pane">
        <div class="pane-bar"><span>Output</span><span class="run-time"></span></div>
        <pre class="lab-output" aria-live="polite">Run your code to see compiler output.</pre>
      </div>
    </div>
    <div class="expected-row"><span>Expected output</span><code>${escapeHTML(lab.expected)}</code></div>
    <div class="lab-actions">
      <button class="run-code">▶ Run & Check</button>
      <button class="reset-code">Reset</button>
      <button class="show-hint">Hint</button>
      <button class="ask-coach" ${capabilities?.aiCoachAvailable ? "" : "disabled"}>Ask AI coach</button>
    </div>
    <div class="hint-panel" hidden><strong>One hint</strong><p>${lab.hint}</p></div>
    <div class="coach-panel" hidden>
      <span class="coach-provider">${capabilities?.aiCoachAvailable ? `${capabilities.aiProvider} · ${capabilities.aiAuthMode} · ${capabilities.aiModel}` : "AI coach not connected"}</span>
      <label>What are you stuck on?</label>
      <div><input class="coach-question" maxlength="1000" placeholder="Optional—ask about the error or concept"><button class="send-coach">Ask</button></div>
      <p class="coach-answer"></p>
    </div>`;
  const requestedSlot = lessonElement.querySelector("[data-lab-slot]");
  if (requestedSlot) requestedSlot.replaceWith(container);
  else meta.insertAdjacentElement("afterend", container);

  const editor = container.querySelector(".code-editor");
  const output = container.querySelector(".lab-output");
  const runButton = container.querySelector(".run-code");
  let lastDiagnostics = "";

  editor.addEventListener("keydown", event => {
    if (event.key === "Tab") {
      event.preventDefault();
      const start = editor.selectionStart;
      editor.setRangeText("  ", start, editor.selectionEnd, "end");
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") runButton.click();
  });

  runButton.addEventListener("click", async () => {
    setLabBusy(container, true);
    output.className = "lab-output running";
    output.textContent = "Compiling…";
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({code: editor.value, challengeID: lab.id})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "The runner rejected this request.");
      lastDiagnostics = [result.diagnostics, result.stdout].filter(Boolean).join("\n\n");
      output.className = `lab-output ${result.passed ? "passed" : result.succeeded ? "mismatch" : "failed"}`;
      output.textContent = [result.message, result.stdout && `\n${result.stdout}`, result.diagnostics && `\n${result.diagnostics}`].filter(Boolean).join("");
      container.querySelector(".run-time").textContent = `${result.durationMilliseconds} ms`;
      if (result.passed) markLabSolved(container, lab.id);
    } catch (error) {
      lastDiagnostics = error.message;
      output.className = "lab-output failed";
      output.textContent = `Runner unavailable: ${error.message}`;
    } finally { setLabBusy(container, false); }
  });

  container.querySelector(".reset-code").addEventListener("click", () => {
    editor.value = lab.starter;
    output.className = "lab-output";
    output.textContent = "Starter code restored.";
  });
  container.querySelector(".show-hint").addEventListener("click", () => {
    const panel = container.querySelector(".hint-panel");
    panel.hidden = !panel.hidden;
  });
  container.querySelector(".ask-coach").addEventListener("click", () => {
    const panel = container.querySelector(".coach-panel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) panel.querySelector("input").focus();
  });
  container.querySelector(".send-coach").addEventListener("click", async () => {
    const answer = container.querySelector(".coach-answer");
    const button = container.querySelector(".send-coach");
    button.disabled = true;
    answer.textContent = "Thinking about your code…";
    try {
      const response = await fetch("/api/coach", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          lessonTitle: lesson.title, challenge: lab.brief, code: editor.value,
          diagnostics: lastDiagnostics, question: container.querySelector(".coach-question").value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "AI coach unavailable.");
      answer.textContent = result.answer;
    } catch (error) { answer.textContent = error.message; }
    finally { button.disabled = false; }
  });
}

function setLabBusy(container, busy) {
  container.querySelectorAll("button").forEach(button => button.disabled = busy || (button.classList.contains("ask-coach") && !capabilities?.aiCoachAvailable));
}

function markLabSolved(container, id) {
  solvedLabs.add(id);
  localStorage.setItem(labStorageKey, JSON.stringify([...solvedLabs]));
  container.classList.add("solved");
  container.querySelector(".lab-status").textContent = "✓ Solved";
}

async function loadCapabilities() {
  try {
    const response = await fetch("/api/capabilities");
    capabilities = await response.json();
  } catch {
    capabilities = {compilerAvailable: false, aiCoachAvailable: false};
  }
}

function updateProgress() {
  const percent = Math.round((completed.size / COURSE.length) * 100);
  progressBar.style.width = `${percent}%`;
  progressLabel.textContent = `${percent}%`;
}

function move(offset) {
  const destination = COURSE[currentIndex + offset];
  if (destination) location.hash = destination.id;
}

function toggleComplete() {
  const id = COURSE[currentIndex].id;
  completed.has(id) ? completed.delete(id) : completed.add(id);
  localStorage.setItem(storageKey, JSON.stringify([...completed]));
  renderLesson();
}

function matchingLessons(query) {
  const normalized = query.trim().toLowerCase();
  return COURSE.filter(lesson => !normalized || `${lesson.title} ${lesson.summary} ${lesson.group}`.toLowerCase().includes(normalized));
}

function renderSearch() {
  const matches = matchingLessons(searchInput.value);
  selectedResult = Math.min(selectedResult, Math.max(0, matches.length - 1));
  searchResults.innerHTML = matches.map((lesson, index) => `<button class="search-result ${index === selectedResult ? "selected" : ""}" data-id="${lesson.id}"><span>${lesson.title}</span><small>${lesson.group}</small></button>`).join("") || `<p>No matching lesson.</p>`;
  searchResults.querySelectorAll("button").forEach(button => button.addEventListener("click", () => openResult(button.dataset.id)));
}

function openResult(id) {
  dialog.close();
  location.hash = id;
}

function openSearch() {
  selectedResult = 0;
  searchInput.value = "";
  renderSearch();
  dialog.showModal();
  searchInput.focus();
}

window.addEventListener("hashchange", renderLesson);
previousButton.addEventListener("click", () => move(-1));
nextButton.addEventListener("click", () => move(1));
completeButton.addEventListener("click", toggleComplete);
document.querySelector("#menu-button").addEventListener("click", () => sidebar.classList.toggle("open"));
document.querySelector("#search-button").addEventListener("click", openSearch);
searchInput.addEventListener("input", () => { selectedResult = 0; renderSearch(); });
searchInput.addEventListener("keydown", event => {
  const matches = matchingLessons(searchInput.value);
  if (event.key === "ArrowDown") { event.preventDefault(); selectedResult = Math.min(selectedResult + 1, matches.length - 1); renderSearch(); }
  if (event.key === "ArrowUp") { event.preventDefault(); selectedResult = Math.max(selectedResult - 1, 0); renderSearch(); }
  if (event.key === "Enter" && matches[selectedResult]) openResult(matches[selectedResult].id);
});
document.addEventListener("keydown", event => {
  if (event.key === "/" && !dialog.open && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault(); openSearch();
  }
});
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

loadCapabilities().finally(renderLesson);
