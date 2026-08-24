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
const courseData = document.querySelector("#course-data");
const COURSE = JSON.parse(courseData.textContent);

const storageKey = "llm-abliteration-field-guide-progress-v1";
const validIDs = new Set(COURSE.map(lesson => lesson.id));

function readProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter(id => validIDs.has(id)) : []);
  } catch {
    return new Set();
  }
}

let completed = readProgress();
let currentIndex = 0;
let selectedResult = 0;
let activeAudio = null;

function lessonBody(lesson) {
  const template = document.querySelector(`#lesson-${lesson.id}`);
  return template?.innerHTML || "";
}

function audioTrack(lesson) {
  if (typeof ABLITERATION_AUDIO === "undefined") return null;
  return ABLITERATION_AUDIO.lessons?.[lesson.id] || null;
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function renderLessonAudio(lesson) {
  const track = audioTrack(lesson);
  if (!track) return;

  const player = document.createElement("section");
  player.className = "lesson-audio";
  player.setAttribute("aria-label", `Audio narration for ${lesson.title}`);
  player.innerHTML = `
    <div class="audio-heading">
      <span class="audio-signal" aria-hidden="true">◖</span>
      <div><span class="audio-kicker">ELEVENLABS · BELLA · V3</span><strong>Listen to this lesson</strong></div>
      <span class="audio-total">${formatAudioTime(track.duration)}</span>
    </div>
    <audio preload="metadata"></audio>
    <div class="audio-controls">
      <button class="audio-skip" type="button" data-skip="-15" aria-label="Go back 15 seconds">−15</button>
      <button class="audio-toggle" type="button" aria-label="Play lesson narration"><span aria-hidden="true">▶</span><span class="audio-toggle-label">Play</span></button>
      <button class="audio-skip" type="button" data-skip="15" aria-label="Go forward 15 seconds">+15</button>
      <div class="audio-timeline">
        <input type="range" min="0" max="${track.duration || 0}" value="0" step="0.1" aria-label="Narration position">
        <div><span class="audio-current">0:00</span><span class="audio-duration">${formatAudioTime(track.duration)}</span></div>
      </div>
      <button class="audio-rate" type="button" aria-label="Change playback speed">1×</button>
    </div>
    <p class="audio-status" aria-live="polite">Narrated by ${ABLITERATION_AUDIO.voice.name}.</p>`;

  const meta = lessonElement.querySelector(".lesson-meta");
  (meta || lessonElement.firstElementChild)?.insertAdjacentElement(meta ? "afterend" : "beforebegin", player);

  const audio = player.querySelector("audio");
  const toggle = player.querySelector(".audio-toggle");
  const toggleIcon = toggle.querySelector("span");
  const toggleLabel = player.querySelector(".audio-toggle-label");
  const timeline = player.querySelector("input");
  const current = player.querySelector(".audio-current");
  const duration = player.querySelector(".audio-duration");
  const status = player.querySelector(".audio-status");
  const rateButton = player.querySelector(".audio-rate");
  const rates = [1, 1.25, 1.5, 0.75];
  let rateIndex = 0;

  audio.src = `./audio/${encodeURIComponent(track.file)}`;
  activeAudio = audio;

  function syncPlayState() {
    const playing = !audio.paused && !audio.ended;
    toggle.classList.toggle("playing", playing);
    toggleIcon.textContent = playing ? "Ⅱ" : "▶";
    toggleLabel.textContent = playing ? "Pause" : "Play";
    toggle.setAttribute("aria-label", `${playing ? "Pause" : "Play"} lesson narration`);
  }

  function syncTimeline() {
    const knownDuration = Number.isFinite(audio.duration) ? audio.duration : track.duration;
    if (knownDuration) {
      timeline.max = knownDuration;
      duration.textContent = formatAudioTime(knownDuration);
    }
    timeline.value = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    current.textContent = formatAudioTime(audio.currentTime);
  }

  toggle.addEventListener("click", async () => {
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        player.classList.add("audio-error");
        status.textContent = "The narration could not be played in this browser.";
      }
    } else {
      audio.pause();
    }
  });
  player.querySelectorAll("[data-skip]").forEach(button => button.addEventListener("click", () => {
    const limit = Number.isFinite(audio.duration) ? audio.duration : track.duration;
    audio.currentTime = Math.max(0, Math.min(limit || Infinity, audio.currentTime + Number(button.dataset.skip)));
  }));
  timeline.addEventListener("input", () => { audio.currentTime = Number(timeline.value); });
  rateButton.addEventListener("click", () => {
    rateIndex = (rateIndex + 1) % rates.length;
    audio.playbackRate = rates[rateIndex];
    rateButton.textContent = `${rates[rateIndex]}×`;
    status.textContent = `Playback speed ${rates[rateIndex]} times.`;
  });
  audio.addEventListener("play", syncPlayState);
  audio.addEventListener("pause", syncPlayState);
  audio.addEventListener("ended", syncPlayState);
  audio.addEventListener("timeupdate", syncTimeline);
  audio.addEventListener("loadedmetadata", syncTimeline);
  audio.addEventListener("error", () => {
    player.classList.add("audio-error");
    status.textContent = "Narration is temporarily unavailable.";
  });
}

function updateCompleteButton(id) {
  completeButton.classList.toggle("done", completed.has(id));
  completeButton.textContent = completed.has(id) ? "✓ Completed" : "Mark complete";
}

function routeID() {
  return decodeURIComponent(location.hash.slice(1)) || COURSE[0].id;
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

  nav.querySelector(".lesson-link.active")?.scrollIntoView({ block: "nearest" });
}

function renderLesson() {
  activeAudio?.pause();
  activeAudio = null;
  const requested = routeID();
  const found = COURSE.findIndex(lesson => lesson.id === requested);
  currentIndex = found >= 0 ? found : 0;
  const lesson = COURSE[currentIndex];

  if (requested !== lesson.id) history.replaceState(null, "", `#${lesson.id}`);
  lessonElement.innerHTML = lessonBody(lesson);
  crumb.textContent = `${String(currentIndex).padStart(2, "0")} / ${lesson.group}`;
  document.title = `${lesson.title} · Abliteration Methods Guide`;
  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === COURSE.length - 1;
  updateCompleteButton(lesson.id);
  renderLessonAudio(lesson);
  renderNavigation();
  updateProgress();
  window.scrollTo({ top: 0, behavior: "instant" });
  lessonElement.focus({ preventScroll: true });
}

function updateProgress() {
  const count = [...completed].filter(id => validIDs.has(id)).length;
  const percent = Math.round((count / COURSE.length) * 100);
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
  updateCompleteButton(id);
  renderNavigation();
  updateProgress();
}

function searchableText(lesson) {
  const plainBody = lessonBody(lesson).replace(/<[^>]*>/g, " ");
  return `${lesson.title} ${lesson.summary} ${lesson.group} ${lesson.terms || ""} ${plainBody}`.toLowerCase();
}

function matchingLessons(query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return COURSE;
  return COURSE.filter(lesson => {
    const text = searchableText(lesson);
    return words.every(word => text.includes(word));
  });
}

function renderSearch() {
  const matches = matchingLessons(searchInput.value);
  selectedResult = Math.min(selectedResult, Math.max(0, matches.length - 1));
  searchResults.innerHTML = matches.map((lesson, index) =>
    `<button class="search-result ${index === selectedResult ? "selected" : ""}" data-id="${lesson.id}"><span>${lesson.title}</span><small>${lesson.group}</small></button>`
  ).join("") || "<p>No matching lesson.</p>";

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
  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectedResult = Math.min(selectedResult + 1, matches.length - 1);
    renderSearch();
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    selectedResult = Math.max(selectedResult - 1, 0);
    renderSearch();
  }
  if (event.key === "Enter" && matches[selectedResult]) openResult(matches[selectedResult].id);
});

document.addEventListener("keydown", event => {
  const isTyping = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
  if (event.key === "/" && !dialog.open && !isTyping) {
    event.preventDefault();
    openSearch();
  }
  if (!dialog.open && !isTyping && event.altKey && event.key === "ArrowLeft") move(-1);
  if (!dialog.open && !isTyping && event.altKey && event.key === "ArrowRight") move(1);
});

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

renderLesson();
