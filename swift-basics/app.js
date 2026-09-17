const nav = document.querySelector("#course-nav");
const lessonElement = document.querySelector("#lesson");
const crumb = document.querySelector("#crumb");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const completeButton = document.querySelector("#complete");
const progressBar = document.querySelector("#progress-bar");
const progressLabel = document.querySelector("#progress-label");
const sidebar = document.querySelector("#sidebar");
const menuButton = document.querySelector("#menu-button");
const dialog = document.querySelector("#search-dialog");
const searchInput = document.querySelector("#search-input");
const searchResults = document.querySelector("#search-results");
const courseData = document.querySelector("#course-data");
const guideData = document.querySelector("#guide-data");
const COURSE = JSON.parse(courseData.textContent);
const GUIDE = JSON.parse(guideData.textContent);
const validIDs = new Set(COURSE.map(lesson => lesson.id));

function readProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(GUIDE.storageKey) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter(id => validIDs.has(id)) : []);
  } catch {
    return new Set();
  }
}

function saveProgress() {
  try {
    localStorage.setItem(GUIDE.storageKey, JSON.stringify([...completed]));
  } catch {
    // The guide remains usable when storage is unavailable or private.
  }
}

let completed = readProgress();
let currentIndex = 0;
let selectedResult = 0;
const searchTextCache = new Map();

function lessonTemplate(lesson) {
  return document.getElementById(`lesson-${lesson.id}`);
}

function lessonBody(lesson) {
  return lessonTemplate(lesson)?.innerHTML || "";
}

function routeID() {
  if (!COURSE.length) return "";
  try {
    return decodeURIComponent(location.hash.slice(1)) || COURSE[0].id;
  } catch {
    return COURSE[0].id;
  }
}

function setSidebarOpen(isOpen) {
  sidebar.classList.toggle("open", isOpen);
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close guide navigation" : "Open guide navigation");
}

function navigationButton(lesson, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lesson-link";
  if (index === currentIndex) button.classList.add("active");
  if (completed.has(lesson.id)) button.classList.add("done");
  button.dataset.id = lesson.id;

  const indexWrapper = document.createElement("span");
  indexWrapper.className = "lesson-index";
  const indexText = document.createElement("span");
  indexText.textContent = String(index).padStart(2, "0");
  indexWrapper.append(indexText);

  const title = document.createElement("span");
  title.textContent = lesson.title;
  button.append(indexWrapper, title);
  button.addEventListener("click", () => {
    location.hash = lesson.id;
    setSidebarOpen(false);
  });
  return button;
}

function renderNavigation() {
  nav.replaceChildren();
  let group = "";

  COURSE.forEach((lesson, index) => {
    if (lesson.group !== group) {
      group = lesson.group;
      const heading = document.createElement("div");
      heading.className = "nav-group";
      heading.textContent = group;
      nav.append(heading);
    }
    nav.append(navigationButton(lesson, index));
  });

  nav.querySelector(".lesson-link.active")?.scrollIntoView({ block: "nearest" });
}

function updateCompleteButton(id) {
  completeButton.classList.toggle("done", completed.has(id));
  completeButton.textContent = completed.has(id) ? "✓ Completed" : "Mark complete";
}

function updateProgress() {
  const count = [...completed].filter(id => validIDs.has(id)).length;
  const percent = COURSE.length ? Math.round((count / COURSE.length) * 100) : 0;
  progressBar.style.width = `${percent}%`;
  progressLabel.textContent = `${percent}%`;
}

function renderLesson() {
  if (!COURSE.length) {
    lessonElement.textContent = "No lessons are available in this guide.";
    previousButton.disabled = true;
    nextButton.disabled = true;
    completeButton.disabled = true;
    updateProgress();
    return;
  }

  const requested = routeID();
  const found = COURSE.findIndex(lesson => lesson.id === requested);
  currentIndex = found >= 0 ? found : 0;
  const lesson = COURSE[currentIndex];

  if (requested !== lesson.id) history.replaceState(null, "", `#${lesson.id}`);
  lessonElement.innerHTML = lessonBody(lesson);
  crumb.textContent = `${String(currentIndex).padStart(2, "0")} / ${lesson.group}`;
  document.title = `${lesson.title} · ${GUIDE.title}`;
  previousButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === COURSE.length - 1;
  updateCompleteButton(lesson.id);
  renderNavigation();
  updateProgress();
  setSidebarOpen(false);
  window.scrollTo({ top: 0, behavior: "instant" });
  lessonElement.focus({ preventScroll: true });
}

function move(offset) {
  const destination = COURSE[currentIndex + offset];
  if (destination) location.hash = destination.id;
}

function toggleComplete() {
  const lesson = COURSE[currentIndex];
  if (!lesson) return;
  completed.has(lesson.id) ? completed.delete(lesson.id) : completed.add(lesson.id);
  saveProgress();
  updateCompleteButton(lesson.id);
  renderNavigation();
  updateProgress();
}

function searchableText(lesson) {
  if (searchTextCache.has(lesson.id)) return searchTextCache.get(lesson.id);
  const plainBody = lessonTemplate(lesson)?.content.textContent || "";
  const text = [lesson.title, lesson.summary, lesson.group, lesson.terms, plainBody]
    .join(" ")
    .toLocaleLowerCase();
  searchTextCache.set(lesson.id, text);
  return text;
}

function matchingLessons(query) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return COURSE;
  return COURSE.filter(lesson => {
    const text = searchableText(lesson);
    return words.every(word => text.includes(word));
  });
}

function openResult(id) {
  dialog.close();
  location.hash = id;
}

function searchResultButton(lesson, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "search-result";
  if (index === selectedResult) button.classList.add("selected");
  button.dataset.id = lesson.id;

  const title = document.createElement("span");
  title.textContent = lesson.title;
  const group = document.createElement("small");
  group.textContent = lesson.group;
  button.append(title, group);
  button.addEventListener("click", () => openResult(lesson.id));
  return button;
}

function renderSearch() {
  const matches = matchingLessons(searchInput.value);
  selectedResult = Math.min(selectedResult, Math.max(0, matches.length - 1));
  searchResults.replaceChildren();
  if (!matches.length) {
    const empty = document.createElement("p");
    empty.textContent = "No matching lesson.";
    searchResults.append(empty);
    return;
  }
  matches.forEach((lesson, index) => searchResults.append(searchResultButton(lesson, index)));
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
menuButton.addEventListener("click", () => setSidebarOpen(!sidebar.classList.contains("open")));
document.querySelector("#search-button").addEventListener("click", openSearch);

searchInput.addEventListener("input", () => {
  selectedResult = 0;
  renderSearch();
});

searchInput.addEventListener("keydown", event => {
  const matches = matchingLessons(searchInput.value);
  if (event.key === "ArrowDown" && matches.length) {
    event.preventDefault();
    selectedResult = Math.min(selectedResult + 1, matches.length - 1);
    renderSearch();
  }
  if (event.key === "ArrowUp" && matches.length) {
    event.preventDefault();
    selectedResult = Math.max(selectedResult - 1, 0);
    renderSearch();
  }
  if (event.key === "Enter" && matches[selectedResult]) {
    event.preventDefault();
    openResult(matches[selectedResult].id);
  }
});

document.addEventListener("keydown", event => {
  const activeTag = document.activeElement?.tagName || "";
  const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag) || document.activeElement?.isContentEditable;
  if (event.key === "/" && !dialog.open && !isTyping) {
    event.preventDefault();
    openSearch();
    return;
  }
  if (event.key === "Escape" && sidebar.classList.contains("open")) {
    setSidebarOpen(false);
    return;
  }
  if (!dialog.open && !isTyping && event.altKey && event.key === "ArrowLeft") {
    event.preventDefault();
    move(-1);
  }
  if (!dialog.open && !isTyping && event.altKey && event.key === "ArrowRight") {
    event.preventDefault();
    move(1);
  }
});

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

renderLesson();
