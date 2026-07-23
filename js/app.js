document.addEventListener("DOMContentLoaded", () => {
  const screens = {};
  document.querySelectorAll(".screen").forEach((el) => (screens[el.id] = el));
  const topbarTitle = document.getElementById("topbar-title");
  const btnBack = document.getElementById("btn-back");

  const TITLES = {
    "screen-home": "WordSnap",
    "screen-import": "Nowa talia",
    "screen-review": "Sprawdź słówka",
    "screen-setup": "Ustawienia nauki",
    "screen-session": "Nauka",
    "screen-bulk": "Test zbiorczy",
    "screen-results": "Wyniki",
    "screen-stats": "Statystyki",
  };
  const BACK_TARGET = {
    "screen-import": "screen-home",
    "screen-review": "screen-import",
    "screen-setup": "screen-home",
    "screen-session": "screen-setup",
    "screen-bulk": "screen-setup",
    "screen-results": "screen-home",
    "screen-stats": "screen-home",
  };

  let currentScreenId = "screen-home";
  const state = {
    pendingPairs: [],
    currentDeckId: null,
    selectedMode: "typing",
    selectedOrder: "random",
    selectedRounds: 1,
    selectedDirection: "random",
    selectedBulkCount: 10,
    session: null,
    bulkSession: null,
    editingDeckId: null, // ustawione = zapis trafi do istniejącej talii, nie utworzy nowej
    appendMode: false, // true = wynik importu dopisze się do pendingPairs zamiast je zastąpić
    sessionStartedAt: null,
  };

  let screenLeaveTimeout = null;
  function showScreen(id) {
    const next = screens[id];
    const prev = screens[currentScreenId];
    if (screenLeaveTimeout) {
      clearTimeout(screenLeaveTimeout);
      screenLeaveTimeout = null;
      Object.values(screens).forEach((el) => el.classList.remove("leaving"));
    }
    if (prev && prev !== next) {
      prev.classList.remove("active");
      prev.classList.add("leaving");
      screenLeaveTimeout = setTimeout(() => {
        prev.classList.remove("leaving");
        screenLeaveTimeout = null;
      }, 200);
    }
    next.classList.add("active");
    currentScreenId = id;
    topbarTitle.textContent = TITLES[id] || "WordSnap";
    btnBack.hidden = !BACK_TARGET[id];
  }

  btnBack.addEventListener("click", () => {
    const target = BACK_TARGET[currentScreenId];
    if (target === "screen-home") renderDeckList();
    if (target) showScreen(target);
  });

  // ===================== HOME =====================
  function renderDeckList() {
    const decks = VocabStorage.getDecks();
    const list = document.getElementById("deck-list");
    const empty = document.getElementById("empty-state");
    list.innerHTML = "";
    empty.hidden = decks.length > 0;

    decks.forEach((deck) => {
      const dueCount = deck.words.filter((w) => VocabSRS.isDue(w)).length;
      const card = document.createElement("div");
      card.className = "deck-card stagger-item";
      card.style.setProperty("--i", Math.min(list.children.length, 10));
      card.innerHTML = `
        <div class="deck-card__info">
          <h3>${escapeHtml(deck.name)}</h3>
          <p>${deck.words.length} słówek</p>
        </div>
        <span class="deck-card__due ${dueCount === 0 ? "zero" : ""}">${dueCount === 0 ? "brak zaległych" : dueCount + " do powtórki"}</span>
      `;
      card.addEventListener("click", () => openSetup(deck.id));
      list.appendChild(card);
    });
  }

  document.getElementById("btn-new-deck").addEventListener("click", () => {
    state.editingDeckId = null;
    state.appendMode = false;
    state.pendingPairs = [];
    document.getElementById("deck-name").value = "";
    document.getElementById("input-paste").value = "";
    document.getElementById("ocr-progress").hidden = true;
    showScreen("screen-import");
  });

  // ===================== IMPORT =====================
  const inputPhoto = document.getElementById("input-photo");

  inputPhoto.addEventListener("change", async () => {
    const file = inputPhoto.files[0];
    if (!file) return;

    const progressWrap = document.getElementById("ocr-progress");
    const progressFill = document.getElementById("ocr-progress-fill");
    const progressText = document.getElementById("ocr-progress-text");
    progressWrap.hidden = false;
    progressFill.style.width = "0%";
    progressText.textContent = "Rozpoznawanie tekstu...";

    try {
      const text = await VocabOCR.recognize(file, (pct) => {
        progressFill.style.width = pct + "%";
        progressText.textContent = `Rozpoznawanie tekstu... ${pct}%`;
      });
      progressWrap.hidden = true;
      const pairs = VocabParser.parse(text);
      processParsedPairs(pairs);
    } catch (err) {
      progressWrap.hidden = true;
      alert("Nie udało się odczytać zdjęcia: " + err.message + "\nSpróbuj wkleić tekst ręcznie.");
    }
  });

  document.getElementById("btn-parse-paste").addEventListener("click", () => {
    const text = document.getElementById("input-paste").value;
    const pairs = VocabParser.parse(text);
    if (pairs.length === 0) {
      alert('Nie znalazłem żadnych par w formacie "słówko - tłumaczenie". Sprawdź format tekstu.');
      return;
    }
    processParsedPairs(pairs);
  });

  document.getElementById("btn-add-more-import").addEventListener("click", () => {
    state.appendMode = true;
    document.getElementById("input-paste").value = "";
    document.getElementById("ocr-progress").hidden = true;
    showScreen("screen-import");
  });

  // ===================== REVIEW =====================
  function updateReviewScreenLabels() {
    topbarTitle.textContent = state.editingDeckId ? "Edytuj talię" : "Sprawdź słówka";
    document.getElementById("btn-save-deck").textContent = state.editingDeckId ? "Zapisz zmiany" : "Zapisz talię";
  }

  function processParsedPairs(pairs) {
    state.pendingPairs = state.appendMode ? state.pendingPairs.concat(pairs) : pairs.length ? pairs : [{ en: "", pl: "" }];
    renderReviewRows();
    showScreen("screen-review");
    updateReviewScreenLabels();
  }

  function renderReviewRows() {
    const list = document.getElementById("review-list");
    list.innerHTML = "";
    state.pendingPairs.forEach((pair, i) => {
      const row = document.createElement("div");
      row.className = "review-row stagger-item";
      row.style.setProperty("--i", Math.min(i, 10));
      row.innerHTML = `
        <textarea rows="1" placeholder="EN" data-field="en" data-i="${i}">${escapeHtml(pair.en)}</textarea>
        <textarea rows="1" placeholder="PL" data-field="pl" data-i="${i}">${escapeHtml(pair.pl)}</textarea>
        <button class="review-row__del" data-i="${i}" aria-label="Usuń">✕</button>
      `;
      list.appendChild(row);
    });

    const autoResize = (el) => {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    };

    const textareas = list.querySelectorAll("textarea");
    textareas.forEach((textarea) => {
      textarea.addEventListener("input", () => {
        const i = +textarea.dataset.i;
        state.pendingPairs[i][textarea.dataset.field] = textarea.value;
        autoResize(textarea);
      });
    });
    // odłożone o tick, żeby przeglądarka zdążyła policzyć układ (szerokość
    // flex) świeżo dodanych elementów, zanim zmierzymy ich potrzebną wysokość
    setTimeout(() => textareas.forEach(autoResize), 0);
    list.querySelectorAll(".review-row__del").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.pendingPairs.splice(+btn.dataset.i, 1);
        renderReviewRows();
      });
    });
  }

  document.getElementById("btn-add-row").addEventListener("click", () => {
    state.pendingPairs.push({ en: "", pl: "" });
    renderReviewRows();
  });

  document.getElementById("btn-swap-sides").addEventListener("click", () => {
    state.pendingPairs = VocabParser.swapSides(state.pendingPairs);
    renderReviewRows();
  });

  document.getElementById("btn-save-deck").addEventListener("click", () => {
    const name = document.getElementById("deck-name").value.trim();
    const valid = state.pendingPairs.filter((p) => p.en.trim() && p.pl.trim());
    if (valid.length === 0) {
      alert("Dodaj przynajmniej jedną kompletną parę słówek.");
      return;
    }
    if (state.editingDeckId) {
      VocabStorage.saveDeckEdits(state.editingDeckId, name || "Talia bez nazwy", valid);
      state.editingDeckId = null;
    } else {
      VocabStorage.createDeck(name || "Talia bez nazwy", valid);
    }
    renderDeckList();
    showScreen("screen-home");
  });

  // ===================== SETUP =====================
  function openSetup(deckId) {
    state.currentDeckId = deckId;
    state.editingDeckId = null;
    const deck = VocabStorage.getDeck(deckId);
    document.getElementById("setup-deck-name").textContent = deck.name;
    const dueCount = deck.words.filter((w) => VocabSRS.isDue(w)).length;
    document.getElementById("setup-due-count").textContent =
      dueCount === 0 ? "Brak zaległych powtórek — możesz ćwiczyć wszystkie słówka." : `${dueCount} słówek czeka na powtórkę.`;
    showScreen("screen-setup");
  }

  document.getElementById("btn-edit-words").addEventListener("click", () => {
    const deck = VocabStorage.getDeck(state.currentDeckId);
    if (!deck) return;
    state.editingDeckId = deck.id;
    state.appendMode = false;
    state.pendingPairs = deck.words.map((w) => ({ id: w.id, en: w.en, pl: w.pl }));
    document.getElementById("deck-name").value = deck.name;
    renderReviewRows();
    showScreen("screen-review");
    updateReviewScreenLabels();
  });

  document.getElementById("mode-picker").addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__opt");
    if (!btn) return;
    document.querySelectorAll("#mode-picker .segmented__opt").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.selectedMode = btn.dataset.mode;

    const isBulk = state.selectedMode === "bulk";
    document.getElementById("direction-group").hidden = !isBulk;
    document.getElementById("bulk-count-group").hidden = !isBulk;
    document.getElementById("rounds-group").hidden = isBulk;
  });

  document.getElementById("direction-picker").addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__opt");
    if (!btn) return;
    document.querySelectorAll("#direction-picker .segmented__opt").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.selectedDirection = btn.dataset.direction;
  });

  const bulkCountCustom = document.getElementById("bulk-count-custom");

  document.getElementById("bulk-count-picker").addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__opt");
    if (!btn) return;
    document.querySelectorAll("#bulk-count-picker .segmented__opt").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.selectedBulkCount = +btn.dataset.count;
    bulkCountCustom.value = "";
  });

  bulkCountCustom.addEventListener("input", () => {
    const val = parseInt(bulkCountCustom.value, 10);
    if (val > 0) {
      document.querySelectorAll("#bulk-count-picker .segmented__opt").forEach((b) => b.classList.remove("active"));
      state.selectedBulkCount = val;
    } else if (!bulkCountCustom.value) {
      const defaultBtn = document.querySelector('#bulk-count-picker .segmented__opt[data-count="10"]');
      defaultBtn.classList.add("active");
      state.selectedBulkCount = 10;
    }
  });

  document.getElementById("order-picker").addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__opt");
    if (!btn) return;
    document.querySelectorAll("#order-picker .segmented__opt").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.selectedOrder = btn.dataset.order;
  });

  document.getElementById("rounds-picker").addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented__opt");
    if (!btn) return;
    document.querySelectorAll("#rounds-picker .segmented__opt").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.selectedRounds = +btn.dataset.rounds;
  });

  document.getElementById("btn-delete-deck").addEventListener("click", () => {
    if (!confirm("Usunąć tę talię wraz ze wszystkimi słówkami?")) return;
    VocabStorage.deleteDeck(state.currentDeckId);
    renderDeckList();
    showScreen("screen-home");
  });

  document.getElementById("btn-start-session").addEventListener("click", () => {
    const deck = VocabStorage.getDeck(state.currentDeckId);
    if (!deck || deck.words.length === 0) return;

    if (state.selectedMode === "bulk") {
      const bulkCount = Math.min(Math.max(1, state.selectedBulkCount || 10), deck.words.length);
      const bulkWords = VocabSRS.pickSessionWords(deck.words, bulkCount);
      state.bulkSession = VocabQuiz.createBulkSession(deck.id, bulkWords, state.selectedDirection, state.selectedOrder);
      state.sessionStartedAt = Date.now();
      renderBulkScreen();
      showScreen("screen-bulk");
      return;
    }

    // bez sztywnego limitu - jeśli talia ma 86 słówek, sesja obejmuje wszystkie 86
    const sessionWords = VocabSRS.pickSessionWords(deck.words, deck.words.length);
    state.session = VocabQuiz.createSession(deck.id, sessionWords, deck.words, {
      mode: state.selectedMode,
      order: state.selectedOrder,
      rounds: state.selectedRounds,
    });
    state.sessionStartedAt = Date.now();
    showScreen("screen-session");
    renderQuestion();
  });

  // ===================== TEST ZBIORCZY =====================
  const BULK_INSTRUCTIONS = {
    pl2en: "Wpisz angielskie słówka odpowiadające polskim tłumaczeniom.",
    en2pl: "Wpisz polskie tłumaczenia angielskich słówek.",
    random: "Wpisz brakujące tłumaczenie — język pytania zmienia się losowo dla każdego słówka.",
  };

  function renderBulkScreen() {
    document.getElementById("bulk-instruction").textContent = BULK_INSTRUCTIONS[state.selectedDirection];

    const isRandom = state.selectedDirection === "random";
    const list = document.getElementById("bulk-list");
    list.innerHTML = "";
    state.bulkSession.items.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "bulk-row stagger-item";
      row.style.setProperty("--i", Math.min(i, 10));
      const dirTag = isRandom
        ? `<span class="bulk-row__dir">${item.direction === "en2pl" ? "→ PL" : "→ EN"}</span>`
        : "";
      row.innerHTML = `
        <span class="bulk-row__num">${i + 1}.</span>
        <span class="bulk-row__prompt">${escapeHtml(item.prompt)} ${dirTag}</span>
        <input type="text" class="bulk-row__input" data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" />
      `;
      list.appendChild(row);
    });
  }

  document.getElementById("btn-bulk-submit").addEventListener("click", () => {
    const inputs = document.querySelectorAll(".bulk-row__input");
    const answers = Array.from(inputs).map((input) => input.value);
    const results = state.bulkSession.submitAll(answers);
    renderBulkResults(results);
    showScreen("screen-results");
  });

  function renderBulkResults(results) {
    const correct = results.filter((r) => r.correct).length;
    document.getElementById("results-score").textContent = `${correct}/${results.length}`;

    const deck = VocabStorage.getDeck(state.currentDeckId);
    VocabStats.recordSession({
      durationMs: state.sessionStartedAt ? Date.now() - state.sessionStartedAt : 0,
      wordsAnswered: results.length,
      correct,
      deckName: deck ? deck.name : "",
    });
    state.sessionStartedAt = null;

    const box = document.getElementById("results-missed");
    box.innerHTML = "";
    const title = document.createElement("p");
    title.className = "missed-title";
    title.textContent = "Wszystkie słówka z testu:";
    box.appendChild(title);

    const sorted = [...results].sort((a, b) => Number(a.correct) - Number(b.correct));
    sorted.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "result-item stagger-item " + (r.correct ? "result-item--ok" : "result-item--bad");
      row.style.setProperty("--i", Math.min(i, 10));
      const detail = r.correct
        ? ""
        : `<span class="result-item__detail">Napisałeś: <strong>${escapeHtml(r.userAnswer || "—")}</strong></span>`;
      row.innerHTML = `
        <span class="result-item__icon">${r.correct ? "✓" : "✗"}</span>
        <span class="result-item__en">${escapeHtml(r.prompt)}</span>
        <span class="result-item__pl">${escapeHtml(r.expected)}</span>
        ${detail}
      `;
      box.appendChild(row);
    });
  }

  // ===================== SESSION =====================
  const modePanels = {
    typing: document.getElementById("mode-typing"),
    flashcard: document.getElementById("mode-flashcard"),
    choice: document.getElementById("mode-choice"),
  };
  const feedbackBox = document.getElementById("answer-feedback");

  function renderQuestion() {
    const session = state.session;
    const q = session.current();
    feedbackBox.hidden = true;
    feedbackBox.className = "answer-feedback";

    Object.values(modePanels).forEach((p) => (p.hidden = true));
    modePanels[session.mode].hidden = false;

    document.getElementById("question-direction").textContent = q.direction === "en2pl" ? "Angielski → Polski" : "Polski → Angielski";
    document.getElementById("question-word").textContent = q.prompt;

    const { index, total, round, totalRounds } = session.progress();
    document.getElementById("session-progress-fill").style.width = Math.round((index / total) * 100) + "%";
    const roundLabel = totalRounds > 1 ? `Runda ${round}/${totalRounds} · ` : "";
    document.getElementById("session-progress-text").textContent = `${roundLabel}${Math.min(index + 1, total)}/${total}`;

    if (session.mode === "typing") {
      const input = document.getElementById("typing-input");
      input.value = "";
      input.disabled = false;
      setTimeout(() => input.focus(), 50);
    } else if (session.mode === "flashcard") {
      document.getElementById("reveal-answer").hidden = true;
      document.getElementById("reveal-answer").textContent = q.expected;
      document.getElementById("btn-reveal").hidden = false;
      document.getElementById("flash-actions").hidden = true;
    } else if (session.mode === "choice") {
      const list = document.getElementById("choices-list");
      list.innerHTML = "";
      q.choices.forEach((choice, i) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn stagger-item";
        btn.style.setProperty("--i", Math.min(i, 10));
        btn.textContent = choice;
        btn.addEventListener("click", () => handleChoiceAnswer(btn, choice));
        list.appendChild(btn);
      });
    }
  }

  function showFeedback(correct, expected) {
    feedbackBox.hidden = false;
    feedbackBox.classList.add(correct ? "correct" : "wrong");
    document.getElementById("feedback-text").textContent = correct ? "Dobrze! ✓" : `Poprawna odpowiedź: ${expected}`;
  }

  document.getElementById("btn-check-answer").addEventListener("click", () => {
    const input = document.getElementById("typing-input");
    if (input.disabled) return;
    const { correct, expected } = state.session.answerTyping(input.value);
    input.disabled = true;
    showFeedback(correct, expected);
  });

  document.getElementById("typing-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-check-answer").click();
  });

  document.getElementById("btn-reveal").addEventListener("click", () => {
    document.getElementById("reveal-answer").hidden = false;
    document.getElementById("btn-reveal").hidden = true;
    document.getElementById("flash-actions").hidden = false;
  });

  document.getElementById("btn-flash-yes").addEventListener("click", () => {
    const { correct, expected } = state.session.answerFlashcard(true);
    showFeedback(correct, expected);
  });
  document.getElementById("btn-flash-no").addEventListener("click", () => {
    const { correct, expected } = state.session.answerFlashcard(false);
    showFeedback(correct, expected);
  });

  function handleChoiceAnswer(clickedBtn, choice) {
    document.querySelectorAll(".choice-btn").forEach((b) => (b.disabled = true));
    const { correct, expected } = state.session.answerChoice(choice);
    document.querySelectorAll(".choice-btn").forEach((b) => {
      if (b.textContent === expected) b.classList.add("correct");
      else if (b === clickedBtn) b.classList.add("wrong");
    });
    showFeedback(correct, expected);
  }

  document.getElementById("btn-next-question").addEventListener("click", () => {
    state.session.advance();
    if (state.session.hasNext()) {
      renderQuestion();
    } else {
      renderResults();
      showScreen("screen-results");
    }
  });

  // ===================== RESULTS =====================
  function renderResults() {
    const summary = state.session.getSummary();
    document.getElementById("results-score").textContent = `${summary.correct}/${summary.total}`;

    const deck = VocabStorage.getDeck(state.currentDeckId);
    VocabStats.recordSession({
      durationMs: state.sessionStartedAt ? Date.now() - state.sessionStartedAt : 0,
      wordsAnswered: summary.total,
      correct: summary.correct,
      deckName: deck ? deck.name : "",
    });
    state.sessionStartedAt = null;

    const missedBox = document.getElementById("results-missed");
    missedBox.innerHTML = "";

    const title = document.createElement("p");
    title.className = "missed-title";
    title.textContent = "Wszystkie słówka z sesji:";
    missedBox.appendChild(title);

    // błędne odpowiedzi na górze, żeby od razu było widać co powtórzyć
    const sorted = [...summary.all].sort((a, b) => Number(a.correct) - Number(b.correct));
    sorted.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "result-item stagger-item " + (r.correct ? "result-item--ok" : "result-item--bad");
      row.style.setProperty("--i", Math.min(i, 10));
      row.innerHTML = `
        <span class="result-item__icon">${r.correct ? "✓" : "✗"}</span>
        <span class="result-item__en">${escapeHtml(r.en)}</span>
        <span class="result-item__pl">${escapeHtml(r.pl)}</span>
      `;
      missedBox.appendChild(row);
    });
  }

  document.getElementById("btn-results-done").addEventListener("click", () => {
    renderDeckList();
    showScreen("screen-home");
  });

  // ===================== STATYSTYKI =====================
  const DAY_LABELS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

  function renderStats() {
    const summary = VocabStats.getSummary();
    document.getElementById("stat-total-time").textContent = summary.totalTimeLabel;
    document.getElementById("stat-total-words").textContent = summary.totalWords;
    document.getElementById("stat-streak").textContent = summary.streak;
    document.getElementById("stat-accuracy").textContent = summary.accuracyPct === null ? "—" : summary.accuracyPct + "%";
    document.getElementById("stats-empty").hidden = summary.hasData;

    const maxMs = Math.max(...summary.last7.map((d) => d.ms), 60000); // co najmniej 1 min skali, żeby słupki nie znikały
    const week = document.getElementById("stats-week");
    week.innerHTML = "";
    summary.last7.forEach((day) => {
      const dayOfWeek = new Date(day.date).getDay();
      const pct = Math.round((day.ms / maxMs) * 100);
      const col = document.createElement("div");
      col.className = "stats-week__col";
      col.innerHTML = `
        <div class="stats-week__bar-track"><div class="stats-week__bar" style="height:${Math.max(pct, day.ms > 0 ? 6 : 0)}%"></div></div>
        <span class="stats-week__label">${DAY_LABELS[dayOfWeek]}</span>
      `;
      col.title = `${VocabStats.formatDuration(day.ms)}`;
      week.appendChild(col);
    });
  }

  document.getElementById("btn-stats").addEventListener("click", () => {
    renderStats();
    showScreen("screen-stats");
  });

  // ===================== UTIL =====================
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(str) {
    return escapeHtml(str || "");
  }

  // ===================== MOTYW (jasny/ciemny) =====================
  const THEME_KEY = "vocab_theme";
  const btnThemeToggle = document.getElementById("btn-theme-toggle");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme(theme) {
    // theme: "dark" | "light" | null (null = podążaj za ustawieniem systemu)
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    const isDark = theme ? theme === "dark" : systemPrefersDark.matches;
    btnThemeToggle.textContent = isDark ? "☀️" : "🌙";
  }

  applyTheme(localStorage.getItem(THEME_KEY));

  btnThemeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || (systemPrefersDark.matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  // ===================== INIT =====================
  renderDeckList();
  showScreen("screen-home");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  const splashScreen = document.getElementById("splash-screen");
  if (splashScreen) {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const showMs = prefersReducedMotion ? 500 : 1500;
    setTimeout(() => {
      splashScreen.classList.add("splash-screen--hidden");
      setTimeout(() => splashScreen.remove(), 550);
    }, showMs);
  }
});
