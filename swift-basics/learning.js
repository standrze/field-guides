(() => {
  "use strict";

  const CACHE_NAME = "field-guide-audio-v1";
  const MAX_CHUNK = 420;
  const SKIP = 'nav,button,input,textarea,select,script,style,template,svg,canvas,audio,video,iframe,[hidden],[aria-hidden="true"],[data-narration-skip],.fg-learning,.code-lab,.lab-workbench,.interactive-lab,.practice-workspace';
  const BLOCK = "h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,figcaption,caption";

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function truncateUTF8(value, maxBytes) {
    const encoder = new TextEncoder();
    let result = "";
    let bytes = 0;
    for (const character of String(value || "")) {
      const size = encoder.encode(character).length;
      if (bytes + size > maxBytes) break;
      result += character;
      bytes += size;
    }
    return result;
  }

  // Short requests keep Voxtral's bounded speech output from cutting off a page.
  function splitText(value, maxLength = MAX_CHUNK) {
    let remaining = normalizeText(value);
    const chunks = [];
    const limit = Math.max(40, Math.floor(maxLength));
    while (remaining.length > limit) {
      const window = remaining.slice(0, limit + 1);
      const endings = [...window.matchAll(/[.!?;](?:["'”’])?\s/g)];
      const sentenceEnd = endings.at(-1);
      let end = sentenceEnd ? sentenceEnd.index + sentenceEnd[0].trimEnd().length : -1;
      if (end < limit / 3) end = window.lastIndexOf(" ");
      if (end <= 0) end = limit;
      chunks.push(remaining.slice(0, end).trim());
      remaining = remaining.slice(end).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  function extractNarration(root, options = {}) {
    const sections = [];
    const emit = (text, element) => {
      speechChunks(text, options).forEach(part => sections.push({ text: part, element }));
    };
    function visit(element, buffer) {
      if (element.nodeType === 3) {
        if (buffer) buffer.parts.push(element.textContent);
        return;
      }
      if (element.nodeType !== 1 || element.matches(SKIP)) return;
      const override = element.getAttribute("data-narration");
      if (override !== null) {
        buffer?.flush();
        if (override !== "skip") emit(override, element);
        return;
      }
      if (element.matches("pre")) {
        buffer?.flush();
        if (options.codeMode === "read") emit(element.querySelector("code")?.textContent || element.textContent, element);
        return;
      }
      if (element.matches("table,figure")) {
        buffer?.flush();
        const captions = [...element.querySelectorAll("caption,figcaption,[data-narration]")];
        captions.filter(child => !captions.some(parent => parent !== child && parent.contains(child))).forEach(child => visit(child, null));
        return;
      }
      if (element.matches(BLOCK)) {
        buffer?.flush();
        const own = {
          parts: [],
          flush() {
            emit(this.parts.join(""), element);
            this.parts = [];
          }
        };
        element.childNodes.forEach(child => visit(child, own));
        own.flush();
      } else {
        if (element.tagName === "BR" && buffer) buffer.parts.push(" ");
        element.childNodes.forEach(child => visit(child, buffer));
      }
    }
    visit(root, null);
    return sections;
  }

  function speechChunks(text, speech = {}) {
    if (!speech.pronunciations?.length) return splitText(text);
    if (!window.FieldGuidePronunciation) throw new Error('Reload this guide to load its pronunciation support.');
    return splitText(window.FieldGuidePronunciation.apply(text, speech.pronunciations));
  }

  function cacheIdentity(text, speech = {}) {
    return JSON.stringify({ text, baseURL: speech.baseURL || "", model: speech.model || "", voice: speech.voice || "" });
  }

  async function cacheRequest(text, speech) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(cacheIdentity(text, speech)));
    const key = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    return new Request(new URL(`/__field-guide_audio__/v1/${key}.wav`, location.origin));
  }

  function errorText(value, fallback) {
    return typeof value?.error === "string" ? value.error : value?.error?.message || value?.message || fallback;
  }

  async function responseError(response, fallback) {
    try { return new Error(errorText(await response.json(), fallback)); }
    catch { return new Error(fallback); }
  }

  function init() {
    const lesson = document.querySelector("#lesson") || document.querySelector(".lesson-stage article");
    if (!lesson || document.querySelector(".fg-learning")) return;

    const panel = document.createElement("section");
    panel.className = "fg-learning";
    panel.setAttribute("aria-label", "Lesson learning tools");
    panel.innerHTML = `
      <div class="fg-learning-heading"><span>Read &amp; explore</span><div class="fg-tool-links"><a class="fg-audiobook-link" href="/audiobooks.html">Generate audiobook <span aria-hidden="true">↗</span></a><a href="/settings.html">Settings <span aria-hidden="true">↗</span></a></div></div>
      <div class="fg-learning-actions">
        <div class="fg-speech-actions" role="group" aria-label="Read aloud">
          <button type="button" class="fg-listen fg-primary">Listen</button>
          <button type="button" class="fg-pause" disabled>Pause</button>
          <button type="button" class="fg-stop" disabled>Stop</button>
          <button type="button" class="fg-next" aria-label="Next narration section" disabled>Next section <span aria-hidden="true">→</span></button>
        </div>
        <button type="button" class="fg-ask-toggle" aria-expanded="false" aria-controls="fg-ask-panel">Ask AI <span aria-hidden="true">+</span></button>
      </div>
      <p class="fg-speech-status" role="status" aria-live="polite">Listen to this page with your local voice.</p>
      <div class="fg-ask-panel" id="fg-ask-panel" hidden>
        <form class="fg-ask-form">
          <label for="fg-question">What would you like to understand?</label>
          <p class="fg-ask-context">Your question includes the text of this lesson. Choose your AI connection in Settings.</p>
          <textarea id="fg-question" name="question" rows="3" maxlength="2000" placeholder="Explain the main idea, or ask about a specific passage…" required></textarea>
          <div class="fg-ask-footer"><button type="submit" class="fg-primary fg-ask-submit">Ask about this page</button><span class="fg-ask-status" role="status" aria-live="polite"></span></div>
        </form>
        <div class="fg-answer" hidden><span class="fg-answer-label">AI response</span><div class="fg-answer-text"></div><small class="fg-answer-model"></small></div>
      </div>`;
    const guideSlug = location.pathname.split("/").filter(Boolean).at(-1) || "";
    panel.querySelector(".fg-audiobook-link").href = `/audiobooks.html?guide=${encodeURIComponent(guideSlug)}`;
    lesson.before(panel);

    const find = selector => panel.querySelector(selector);
    const listenButton = find(".fg-listen");
    const pauseButton = find(".fg-pause");
    const stopButton = find(".fg-stop");
    const nextButton = find(".fg-next");
    const speechStatus = find(".fg-speech-status");
    const question = find("#fg-question");
    const askSubmit = find(".fg-ask-submit");
    const askStatus = find(".fg-ask-status");
    const answer = find(".fg-answer");
    const state = { settings: null, phase: "idle", sections: [], index: 0, token: 0, audio: null, url: null, jobs: new Map(), settingsController: null, highlight: null, askController: null, askToken: 0 };

    function render() {
      const phase = state.phase;
      listenButton.disabled = phase === "playing" || phase === "loading";
      listenButton.textContent = phase === "paused" ? "Resume" : phase === "between" ? "Continue" : phase === "done" ? "Listen again" : phase === "loading" ? "Preparing…" : "Listen";
      pauseButton.disabled = phase !== "playing";
      stopButton.disabled = !["loading", "playing", "paused", "between"].includes(phase);
      nextButton.disabled = !state.sections.length || state.index + 1 >= state.sections.length;
      panel.dataset.playback = phase;
    }

    function clearHighlight() {
      state.highlight?.classList.remove("fg-narrating");
      state.highlight = null;
    }

    function releaseAudio() {
      if (state.audio) {
        state.audio.onended = null;
        state.audio.onerror = null;
        state.audio.onplaying = null;
        state.audio.pause();
        state.audio.removeAttribute("src");
        state.audio.load();
        state.audio = null;
      }
      if (state.url) URL.revokeObjectURL(state.url);
      state.url = null;
      clearHighlight();
    }

    function cancelPlayback(reset = true) {
      state.token += 1;
      state.settingsController?.abort();
      state.settingsController = null;
      state.jobs.forEach(job => job.controller.abort());
      state.jobs.clear();
      releaseAudio();
      if (reset) { state.sections = []; state.index = 0; }
      state.phase = "idle";
      render();
    }

    function applySettings(settings) {
      state.settings = settings;
      const disabled = settings?.ai?.provider === "disabled";
      question.disabled = disabled;
      askSubmit.disabled = disabled || Boolean(state.askController);
      if (disabled) askStatus.textContent = "AI assistance is off. Enable it in Settings.";
      else if (!state.askController) askStatus.textContent = "";
      return settings;
    }

    async function readSettings(signal) {
      const response = await fetch("/api/settings", { cache: "no-store", signal });
      if (!response.ok) throw await responseError(response, "Unable to load your settings.");
      const settings = await response.json();
      if (!settings?.speech || !settings?.ai) throw new Error("The learning settings are unavailable.");
      return applySettings(settings);
    }

    async function loadAudio(index, token, signal) {
      const text = state.sections[index].text;
      const requestSettings = { ai: { ...state.settings.ai }, speech: { ...state.settings.speech } };
      const speech = requestSettings.speech;
      let cache = null;
      let request = null;
      if (speech.cache !== false && "caches" in window && crypto.subtle) {
        try {
          request = await cacheRequest(text, speech);
          cache = await caches.open(CACHE_NAME);
          const stored = await cache.match(request);
          if (stored) {
            const blob = await stored.blob();
            if (blob.size) return blob;
          }
        } catch { /* Audio can still play when browser storage is unavailable. */ }
      }
      if (signal.aborted || token !== state.token) throw new DOMException("Cancelled", "AbortError");
      const response = await fetch("/api/speech", {
        method: "POST", headers: { "Content-Type": "application/json", "X-Field-Guide": "1" },
        body: JSON.stringify({ text, settings: requestSettings }), signal
      });
      if (!response.ok) throw await responseError(response, "Midnight could not generate audio.");
      if ((response.headers.get("content-type") || "").includes("application/json")) throw await responseError(response, "Midnight returned no playable audio.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Midnight returned an empty audio file.");
      if (signal.aborted || token !== state.token) throw new DOMException("Cancelled", "AbortError");
      if (cache && request) {
        try { await cache.put(request, new Response(blob, { headers: { "Content-Type": blob.type || "audio/wav" } })); }
        catch { /* A full cache must not prevent listening. */ }
      }
      return blob;
    }

    function requestAudio(index, token) {
      if (!state.jobs.has(index)) {
        const controller = new AbortController();
        const promise = loadAudio(index, token, controller.signal);
        // A prefetched request may fail before it becomes the current section.
        promise.catch(() => {});
        state.jobs.set(index, { controller, promise });
      }
      return state.jobs.get(index).promise;
    }

    function playbackError(error, token) {
      if (token !== state.token || error?.name === "AbortError") return;
      releaseAudio();
      state.jobs.forEach(job => job.controller.abort());
      state.jobs.clear();
      state.phase = "error";
      speechStatus.textContent = `${error.message || "Audio is unavailable."} Check Read aloud in Settings.`;
      render();
    }

    async function resumeAudio(token) {
      const audio = state.audio;
      try { await audio.play(); }
      catch (error) {
        if (token !== state.token || state.audio !== audio) return;
        if (error.name === "NotAllowedError") {
          state.phase = "paused";
          speechStatus.textContent = "Audio is ready. Press Resume to start playback.";
          render();
        } else playbackError(error, token);
      }
    }

    async function playSection(index, token = state.token) {
      if (token !== state.token || !state.sections[index]) return;
      releaseAudio();
      state.index = index;
      state.phase = "loading";
      speechStatus.textContent = `Preparing section ${index + 1} of ${state.sections.length}…`;
      render();
      try {
        const blob = await requestAudio(index, token);
        if (token !== state.token || index !== state.index) return;
        state.jobs.delete(index);
        const audio = new Audio();
        state.audio = audio;
        state.url = URL.createObjectURL(blob);
        audio.src = state.url;
        audio.playbackRate = Math.max(0.5, Math.min(2, Number(state.settings.speech.rate) || 1));
        audio.onplaying = () => {
          if (token !== state.token || index !== state.index) return;
          state.phase = "playing";
          clearHighlight();
          state.highlight = state.sections[index].element;
          state.highlight?.classList.add("fg-narrating");
          const rect = state.highlight?.getBoundingClientRect();
          if (rect && (rect.top < 90 || rect.bottom > innerHeight)) {
            state.highlight.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
          }
          speechStatus.textContent = `Reading section ${index + 1} of ${state.sections.length}.`;
          render();
          if (state.settings.speech.autoAdvance !== false && index + 1 < state.sections.length) requestAudio(index + 1, token);
        };
        audio.onerror = () => {
          if (index === state.index) playbackError(new Error("The generated audio could not be played."), token);
        };
        audio.onended = () => {
          if (token !== state.token || index !== state.index) return;
          releaseAudio();
          if (index + 1 === state.sections.length) {
            state.phase = "done";
            speechStatus.textContent = "Finished reading this page.";
          } else if (state.settings.speech.autoAdvance !== false) {
            void playSection(index + 1, token);
            return;
          } else {
            state.phase = "between";
            speechStatus.textContent = `Section ${index + 1} complete. Continue when you’re ready.`;
          }
          render();
        };
        await resumeAudio(token);
      } catch (error) {
        if (index === state.index) playbackError(error, token);
      }
    }

    listenButton.addEventListener("click", async () => {
      if (state.phase === "paused" && state.audio) { await resumeAudio(state.token); return; }
      if (state.phase === "between") { await playSection(state.index + 1); return; }
      cancelPlayback();
      const token = state.token;
      state.phase = "loading";
      speechStatus.textContent = "Loading your read-aloud settings…";
      render();
      const controller = new AbortController();
      state.settingsController = controller;
      try {
        const settings = await readSettings(controller.signal);
        if (token !== state.token) return;
        state.sections = extractNarration(lesson, settings.speech);
        if (!state.sections.length) throw new Error("There is no readable lesson text on this page.");
        await playSection(0, token);
      } catch (error) { playbackError(error, token); }
    });

    pauseButton.addEventListener("click", () => {
      state.audio?.pause();
      state.phase = "paused";
      speechStatus.textContent = `Paused at section ${state.index + 1} of ${state.sections.length}.`;
      render();
    });
    stopButton.addEventListener("click", () => {
      cancelPlayback();
      speechStatus.textContent = "Stopped. Listen starts this page from the beginning.";
    });
    nextButton.addEventListener("click", () => {
      const next = state.index + 1;
      // Keep an in-flight prefetch for the next section; cancelling and starting
      // it again can overlap work on a local model that serves one request at a time.
      state.jobs.forEach((job, index) => {
        if (index !== next) { job.controller.abort(); state.jobs.delete(index); }
      });
      void playSection(next);
    });

    const askToggle = find(".fg-ask-toggle");
    const askPanel = find(".fg-ask-panel");
    askToggle.addEventListener("click", () => {
      askPanel.hidden = !askPanel.hidden;
      askToggle.setAttribute("aria-expanded", String(!askPanel.hidden));
      askToggle.querySelector("span").textContent = askPanel.hidden ? "+" : "−";
      if (!askPanel.hidden) question.focus();
    });

    find(".fg-ask-form").addEventListener("submit", async event => {
      event.preventDefault();
      const query = question.value.trim();
      if (!query || state.askController) return;
      if (new TextEncoder().encode(query).length > 2000) {
        askStatus.textContent = "Please shorten your question before asking AI.";
        question.focus();
        return;
      }
      const token = ++state.askToken;
      const controller = new AbortController();
      state.askController = controller;
      askSubmit.disabled = true;
      askStatus.textContent = "Thinking about this lesson…";
      answer.hidden = true;
      try {
        const settings = await readSettings(controller.signal);
        if (settings.ai.provider === "disabled") return;
        const copy = lesson.cloneNode(true);
        copy.querySelectorAll(SKIP).forEach(element => element.remove());
        const fullText = normalizeText(copy.textContent);
        const text = truncateUTF8(fullText, 32000);
        const lessonTitle = truncateUTF8(normalizeText(lesson.querySelector("h1")?.textContent || document.title), 200);
        const response = await fetch("/api/ask", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Field-Guide": "1" },
          body: JSON.stringify({ lessonTitle, text, question: query }), signal: controller.signal
        });
        if (!response.ok) throw await responseError(response, "The AI connection could not answer.");
        const result = await response.json();
        if (token !== state.askToken) return;
        if (result.available === false || !result.answer) throw new Error(errorText(result, "AI assistance is unavailable."));
        find(".fg-answer-label").textContent = text.length < fullText.length ? "AI response · based on the opening part of this lesson" : "AI response";
        find(".fg-answer-text").textContent = result.answer;
        find(".fg-answer-model").textContent = result.model ? `Answered with ${result.model}` : "";
        answer.hidden = false;
        askStatus.textContent = "Response ready below.";
      } catch (error) {
        if (token === state.askToken && error.name !== "AbortError") askStatus.textContent = `${error.message || "Unable to connect."} Check AI assistance in Settings.`;
      } finally {
        if (token === state.askToken) {
          state.askController = null;
          askSubmit.disabled = state.settings?.ai?.provider === "disabled";
        }
      }
    });

    function resetLesson() {
      cancelPlayback();
      state.askToken += 1;
      state.askController?.abort();
      state.askController = null;
      question.value = "";
      answer.hidden = true;
      askSubmit.disabled = state.settings?.ai?.provider === "disabled";
      askStatus.textContent = state.settings?.ai?.provider === "disabled" ? "AI assistance is off. Enable it in Settings." : "";
      speechStatus.textContent = "Listen to this page with your local voice.";
    }

    window.addEventListener("hashchange", resetLesson);
    window.addEventListener("pagehide", resetLesson);
    // Some guides swap lesson markup after an asynchronous router update.
    new MutationObserver(records => {
      if (records.some(record => record.type === "childList")) resetLesson();
    }).observe(lesson, { childList: true });
    window.addEventListener("focus", () => {
      if (["idle", "done", "error"].includes(state.phase) && !state.askController) void readSettings().catch(() => {});
    });
    void readSettings().catch(() => {
      speechStatus.textContent = "Set up your local voice and AI connection in Settings.";
    });
    render();
  }

  window.FieldGuideLearning = Object.freeze({ splitText, speechChunks, normalizeText, truncateUTF8, extractNarration, cacheIdentity, errorText, cacheName: CACHE_NAME, maxChunk: MAX_CHUNK });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
