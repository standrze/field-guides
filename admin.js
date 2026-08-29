const projects = {
  abliteration: {
    name: "Abliteration Methods Guide",
    total: 23,
    keys: ["llm-abliteration-field-guide-progress-v1"]
  },
  mlx: {
    name: "MLX Swift Field Guide",
    total: 26,
    keys: ["mlx-swift-field-guide-progress-v1"]
  }
};

const appearance = window.FieldGuideAppearance;
const resetDialog = document.querySelector("#reset-dialog");
const dialogTitle = document.querySelector("#dialog-title");
const dialogCopy = document.querySelector("#dialog-copy");
const confirmReset = document.querySelector("#confirm-reset");
const appearanceDialog = document.querySelector("#appearance-dialog");
const appearanceForm = document.querySelector("#appearance-form");
const appearanceTitle = document.querySelector("#appearance-title");
const appearanceMark = document.querySelector("#appearance-mark");
const appearancePreview = document.querySelector("#appearance-preview");
const colorSwatches = document.querySelector("#color-swatches");
let pendingReset = [];
let pendingAppearance = null;

function storedIDs(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function renderProgress() {
  let libraryCompleted = 0;
  let libraryTotal = 0;
  Object.entries(projects).forEach(([id, project]) => {
    const stored = storedIDs(project.keys[0]);
    const completed = project.validIDs
      ? new Set(stored.filter(item => project.validIDs.includes(item))).size
      : Math.min(new Set(stored).size, project.total);
    libraryCompleted += completed;
    libraryTotal += project.total;
    const label = `${completed} of ${project.total} lessons complete · ${Math.round(completed / project.total * 100)}%`;
    document.querySelector(`[data-project="${id}"] [data-progress]`).textContent = label;
  });
  document.querySelector("#library-progress").textContent = `${libraryCompleted} / ${libraryTotal} lessons`;
  document.querySelector("#library-progress-bar").style.width = `${Math.round(libraryCompleted / libraryTotal * 100)}%`;
}

function applyProjectAppearance(id) {
  const selected = appearance.get(id);
  if (!selected) return;
  const card = document.querySelector(`[data-project="${id}"]`);
  const sidebarLink = document.querySelector(`[data-project-link="${id}"]`);
  [card, sidebarLink].filter(Boolean).forEach(element => {
    element.style.setProperty("--project-accent", selected.color);
    element.style.setProperty("--project-soft", selected.soft);
    element.querySelectorAll("[data-project-mark]").forEach(mark => {
      mark.textContent = `${selected.mark}/`;
    });
  });
}

function renderAppearances() {
  Object.keys(projects).forEach(applyProjectAppearance);
}

function askToReset(ids) {
  pendingReset = ids;
  const all = ids.length > 1;
  dialogTitle.textContent = all ? "Reset every project?" : `Reset ${projects[ids[0]].name}?`;
  dialogCopy.textContent = all
    ? "This removes all lesson and challenge progress stored by this browser. Appearance choices stay in place."
    : "This removes its lesson and challenge progress stored by this browser. Its appearance stays in place.";
  resetDialog.showModal();
}

function selectedColor() {
  return appearanceForm.elements["appearance-color"].value;
}

function updateAppearancePreview() {
  const mark = appearance.normalizeMark(appearanceMark.value) || "?";
  const color = selectedColor() || "#f2f0e8";
  appearancePreview.textContent = `${mark}/`;
  appearancePreview.style.background = color;
}

function buildColorPicker(selected) {
  colorSwatches.replaceChildren();
  appearance.palette.forEach((preset, index) => {
    const label = document.createElement("label");
    label.className = "color-swatch";
    label.title = preset.name;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "appearance-color";
    input.value = preset.color;
    input.checked = preset.color === selected;
    input.setAttribute("aria-label", preset.name);
    const sample = document.createElement("span");
    sample.style.background = preset.color;
    const caption = document.createElement("small");
    caption.textContent = preset.name;
    label.append(input, sample, caption);
    colorSwatches.append(label);
    if (index === 0 && !selected) input.checked = true;
  });
}

function openAppearancePicker(id) {
  pendingAppearance = id;
  const current = appearance.get(id);
  appearanceTitle.textContent = `Customize ${projects[id].name}`;
  appearanceMark.value = current.mark;
  appearanceMark.setCustomValidity("");
  buildColorPicker(current.color);
  updateAppearancePreview();
  appearanceDialog.showModal();
  appearanceMark.focus();
  appearanceMark.select();
}

document.querySelectorAll("[data-reset]").forEach(button => {
  button.addEventListener("click", () => askToReset([button.dataset.reset]));
});

document.querySelectorAll("[data-customize]").forEach(button => {
  button.addEventListener("click", () => openAppearancePicker(button.dataset.customize));
});

document.querySelector("#reset-all").addEventListener("click", () => askToReset(Object.keys(projects)));
confirmReset.addEventListener("click", () => {
  pendingReset.flatMap(id => projects[id].keys).forEach(key => localStorage.removeItem(key));
  pendingReset = [];
  queueMicrotask(renderProgress);
});

appearanceMark.addEventListener("input", () => {
  const mark = appearance.normalizeMark(appearanceMark.value);
  appearanceMark.value = mark || "";
  appearanceMark.setCustomValidity(mark ? "" : "Enter one letter or number.");
  updateAppearancePreview();
});
colorSwatches.addEventListener("change", updateAppearancePreview);

appearanceForm.addEventListener("submit", event => {
  event.preventDefault();
  const mark = appearance.normalizeMark(appearanceMark.value);
  if (!mark) {
    appearanceMark.setCustomValidity("Enter one letter or number.");
    appearanceMark.reportValidity();
    return;
  }
  const saved = appearance.set(pendingAppearance, { mark, color: selectedColor() });
  if (!saved) return;
  applyProjectAppearance(pendingAppearance);
  appearanceDialog.close();
  pendingAppearance = null;
});

document.querySelector("#restore-appearance").addEventListener("click", () => {
  if (!pendingAppearance) return;
  appearance.reset(pendingAppearance);
  applyProjectAppearance(pendingAppearance);
  appearanceDialog.close();
  pendingAppearance = null;
});

["#appearance-close", "#appearance-cancel"].forEach(selector => {
  document.querySelector(selector).addEventListener("click", () => {
    appearanceDialog.close();
    pendingAppearance = null;
  });
});

window.addEventListener("storage", renderAppearances);
renderProgress();
renderAppearances();
