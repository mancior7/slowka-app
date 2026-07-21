const VocabQuiz = (() => {
  const DIACRITICS = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };

  function normalize(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[ąćęłńóśźż]/g, (ch) => DIACRITICS[ch] || ch);
  }

  function levenshtein(a, b) {
    const m = a.length,
      n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  // Tłumaczenia bywają zapisane jako "narażony, bezbronny" (synonimy) albo
  // "wkład (w coś)" (dopowiedzenie w nawiasie) - każdy z tych wariantów ma być
  // zaliczony jako poprawna odpowiedź, nie tylko dokładnie cały napis.
  function expandAlternatives(expected) {
    return expected
      .split(/[,;/]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((s) => {
        const withoutParens = s.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
        return withoutParens && withoutParens !== s ? [s, withoutParens] : [s];
      });
  }

  function checkAnswer(userAnswer, expected) {
    const a = normalize(userAnswer);
    if (!a) return { correct: false, quality: 2 };

    const alternatives = expandAlternatives(expected).map(normalize).filter(Boolean);

    if (alternatives.some((b) => a === b)) return { correct: true, quality: 5 };

    for (const b of alternatives) {
      const tolerance = b.length >= 4 ? 1 : 0;
      if (levenshtein(a, b) <= tolerance) return { correct: true, quality: 4 };
    }
    return { correct: false, quality: 2 };
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function randomDirection() {
    return Math.random() < 0.5 ? "en2pl" : "pl2en";
  }

  function buildChoices(word, direction, allWords) {
    const correctAnswer = direction === "en2pl" ? word.pl : word.en;
    const pool = allWords
      .filter((w) => w.id !== word.id)
      .map((w) => (direction === "en2pl" ? w.pl : w.en));
    const distractors = shuffle(pool).slice(0, 3);
    return shuffle([correctAnswer, ...distractors]);
  }

  const MAX_ATTEMPTS_PER_WORD = 3;

  function createSession(deckId, words, allDeckWords, { mode = "typing", order = "random", rounds = 1 } = {}) {
    const totalRounds = Math.max(1, rounds);
    let round = 1;
    const buildRoundQueue = () => (order === "random" ? shuffle(words) : words.slice());
    let queue = buildRoundQueue();
    let index = 0;
    const results = [];
    let attemptCounts = new Map();
    let current = null;

    function loadCurrent() {
      if (index >= queue.length) {
        if (round < totalRounds) {
          // koniec tej rundy, ale zostały kolejne powtórzenia - zaczynamy od nowa
          // tą samą partią słówek zamiast pokazywać wyniki
          round++;
          queue = buildRoundQueue();
          index = 0;
          attemptCounts = new Map();
        } else {
          current = null;
          return null;
        }
      }
      const word = queue[index];
      const direction = randomDirection();
      const prompt = direction === "en2pl" ? word.en : word.pl;
      const expected = direction === "en2pl" ? word.pl : word.en;
      current = { word, direction, prompt, expected };
      if (mode === "choice") {
        current.choices = buildChoices(word, direction, allDeckWords.length >= 4 ? allDeckWords : words);
      }
      return current;
    }

    function recordAndSchedule(word, quality, correct) {
      const updates = VocabSRS.review(word, quality);
      Object.assign(word, updates); // trzyma stan w pamięci świeży, gdyby to samo słówko
      VocabStorage.updateWord(deckId, word.id, updates); // wróciło jeszcze raz w tej sesji
      results.push({ en: word.en, pl: word.pl, correct });

      const attempts = (attemptCounts.get(word.id) || 0) + 1;
      attemptCounts.set(word.id, attempts);
      // słówko wraca w tej samej sesji po błędnej odpowiedzi, ale z limitem -
      // inaczej ktoś, kto naprawdę nie zna słówka, nigdy by nie skończył sesji
      if (!correct && attempts < MAX_ATTEMPTS_PER_WORD) queue.push(word);
    }

    function answerTyping(userAnswer) {
      const { correct, quality } = checkAnswer(userAnswer, current.expected);
      recordAndSchedule(current.word, quality, correct);
      index++;
      return { correct, expected: current.expected };
    }

    function answerChoice(selected) {
      const correct = normalize(selected) === normalize(current.expected);
      recordAndSchedule(current.word, correct ? 5 : 2, correct);
      index++;
      return { correct, expected: current.expected };
    }

    function answerFlashcard(knewIt) {
      recordAndSchedule(current.word, knewIt ? 5 : 2, knewIt);
      index++;
      return { correct: knewIt, expected: current.expected };
    }

    function getSummary() {
      const uniqueLatest = new Map();
      results.forEach((r) => uniqueLatest.set(r.en + "|" + r.pl, r));
      const finalResults = Array.from(uniqueLatest.values());
      return {
        total: finalResults.length,
        correct: finalResults.filter((r) => r.correct).length,
        missed: finalResults.filter((r) => !r.correct),
        all: finalResults,
      };
    }

    loadCurrent();

    return {
      mode,
      hasNext: () => current !== null,
      current: () => current,
      answerTyping,
      answerChoice,
      answerFlashcard,
      advance: loadCurrent,
      getSummary,
      progress: () => ({ index, total: queue.length, round, totalRounds }),
    };
  }

  return { checkAnswer, normalize, createSession };
})();
