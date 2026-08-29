(() => {
  "use strict";

  const STORAGE_KEY = "field-guide-library-appearance-v1";
  const PALETTE = Object.freeze([
    { name: "Swift Lime", color: "#baff63", soft: "#dfffba" },
    { name: "Aqua", color: "#6fe7ff", soft: "#c9f6ff" },
    { name: "Amber", color: "#ffcb42", soft: "#fff0bd" },
    { name: "Coral", color: "#ff9a62", soft: "#ffe2d2" },
    { name: "Pink", color: "#ff86b6", soft: "#ffe0ed" },
    { name: "Violet", color: "#bca9ff", soft: "#ece6ff" },
    { name: "MLX Blue", color: "#80a7ff", soft: "#dce7ff" },
    { name: "Mint", color: "#79e0bd", soft: "#d9f7ed" },
    { name: "Copper", color: "#e59b5a", soft: "#f7dfca" }
  ]);

  const DEFAULTS = Object.freeze({
    swift: { mark: "S", color: "#79e0bd" },
    "swift-basics": { mark: "C", color: "#e59b5a" },
    swiftnio: { mark: "S", color: "#baff63" },
    mlx: { mark: "M", color: "#80a7ff" },
    abliteration: { mark: "R", color: "#6fe7ff" },
    "wikiskill-research": { mark: "W", color: "#ff9a62" },
    hummingbird: { mark: "H", color: "#ffcb42" },
    "attacking-ai": { mark: "A", color: "#ff86b6" },
    "llm-backdoors": { mark: "B", color: "#bca9ff" }
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
    const color = PALETTE.some(item => item.color === candidate) ? candidate : fallback.color;
    return { mark, color, soft: softColor(color) };
  }

  function set(projectID, appearance) {
    if (!DEFAULTS[projectID]) return null;
    const mark = normalizeMark(appearance && appearance.mark);
    const color = normalizeColor(appearance && appearance.color);
    if (!mark || !color || !PALETTE.some(item => item.color === color)) return null;
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
