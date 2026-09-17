(() => {
  "use strict";

  const STORAGE_KEY = "field-guide-library-appearance-v1";
  const PALETTE = Object.freeze([
    { name: "Orange", color: "#ffb38a", soft: "#ffe7da" },
    { name: "Yellow", color: "#ffe083", soft: "#fff4d7" },
    { name: "Lime", color: "#baff63", soft: "#dfffba" },
    { name: "Blue", color: "#b2c5ff", soft: "#e6ecff" },
    { name: "Violet", color: "#cbb8ff", soft: "#efe8ff" }
  ]);

  const DEFAULTS = Object.freeze({
    swift: { mark: "S", color: "#cbb8ff" },
    "swift-basics": { mark: "C", color: "#ffb38a" },
    swiftnio: { mark: "S", color: "#baff63" },
    mlx: { mark: "M", color: "#b2c5ff" },
    abliteration: { mark: "R", color: "#cbb8ff" },
    "wikiskill-research": { mark: "W", color: "#ffe083" },
    hummingbird: { mark: "H", color: "#ffe083" },
    "attacking-ai": { mark: "A", color: "#ffb38a" },
    "llm-backdoors": { mark: "B", color: "#cbb8ff" }
  });

  function normalizeMark(value) {
    const mark = String(value || "").trim().slice(0, 1).toUpperCase();
    return /^[A-Z0-9]$/.test(mark) ? mark : null;
  }

  function normalizeColor(value) {
    const color = String(value || "").trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : null;
  }

  function readOverrides() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function writeOverrides(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Appearance remains usable for this page even when storage is unavailable.
    }
  }

  function softColor(color) {
    const preset = PALETTE.find(item => item.color === color);
    if (preset) return preset.soft;
    const channels = color.slice(1).match(/.{2}/g).map(value => Number.parseInt(value, 16));
    const mixed = channels.map(value => Math.round(value + (255 - value) * 0.68));
    return `#${mixed.map(value => value.toString(16).padStart(2, "0")).join("")}`;
  }

  function get(projectID) {
    const fallback = DEFAULTS[projectID];
    if (!fallback) return null;
    const override = readOverrides()[projectID] || {};
    const mark = normalizeMark(override.mark) || fallback.mark;
    const candidate = normalizeColor(override.color);
    // Saved choices belong to the reader, including colors from earlier palettes.
    const color = candidate || fallback.color;
    return { mark, color, soft: softColor(color) };
  }

  function set(projectID, appearance) {
    if (!DEFAULTS[projectID]) return null;
    const mark = normalizeMark(appearance && appearance.mark);
    const color = normalizeColor(appearance && appearance.color);
    const savedColor = normalizeColor(readOverrides()[projectID]?.color);
    if (!mark || !color || !(PALETTE.some(item => item.color === color) || color === savedColor)) return null;
    const overrides = readOverrides();
    overrides[projectID] = { mark, color };
    writeOverrides(overrides);
    return get(projectID);
  }

  function reset(projectID) {
    const overrides = readOverrides();
    delete overrides[projectID];
    writeOverrides(overrides);
    return get(projectID);
  }

  function applyToGuide(projectID = document.body && document.body.dataset.guideId) {
    const appearance = get(projectID);
    if (!appearance) return null;
    const root = document.documentElement;
    root.style.setProperty("--green", appearance.color);
    root.style.setProperty("--green-deep", appearance.soft);
    root.style.setProperty("--guide-accent", appearance.color);
    document.querySelectorAll(".brand-mark").forEach(mark => {
      mark.textContent = `${appearance.mark}/`;
    });
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.setAttribute("content", appearance.color);
    return appearance;
  }

  window.FieldGuideAppearance = Object.freeze({
    defaults: DEFAULTS,
    palette: PALETTE,
    get,
    set,
    reset,
    applyToGuide,
    normalizeMark
  });

  const applyCurrentGuide = () => applyToGuide();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyCurrentGuide, { once: true });
  } else {
    applyCurrentGuide();
  }
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) applyCurrentGuide();
  });
})();
