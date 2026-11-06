// Lekka wersja algorytmu SM-2 (jak w Anki, uproszczona).
// quality: 2 = źle, 4 = dobrze, 5 = dobrze i łatwo.
const VocabSRS = (() => {
  // Bez górnego limitu przerwa rosła wykładniczo (przy ease 2.8 po ~19 poprawnych
  // odpowiedziach to dziesiątki milionów dni), data powtórki wychodziła poza zakres
  // i toISOString() rzucało wyjątek, który przerywał sprawdzanie odpowiedzi w połowie.
  const MAX_INTERVAL_DAYS = 365;

  function review(word, quality) {
    // słówka, które już mają zapisane absurdalne lub uszkodzone wartości, też się naprawiają
    const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
    let interval = Math.min(num(word.interval, 0), MAX_INTERVAL_DAYS);
    let ease = num(word.ease, 2.5);
    let reps = num(word.reps, 0);
    let lapses = num(word.lapses, 0);

    if (quality < 3) {
      lapses += 1;
      reps = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
    } else {
      reps += 1;
      if (reps === 1) interval = 1;
      else if (reps === 2) interval = 6;
      else interval = Math.round(interval * ease);
      ease = Math.min(2.8, ease + (quality === 5 ? 0.1 : 0));
    }

    interval = Math.min(interval, MAX_INTERVAL_DAYS);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + interval);

    return { interval, ease, reps, lapses, dueDate: dueDate.toISOString() };
  }

  function isDue(word, now = new Date()) {
    return new Date(word.dueDate) <= now;
  }

  function pickSessionWords(words, size = 15) {
    const now = new Date();
    const due = words.filter((w) => isDue(w, now)).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    if (due.length >= size) return due.slice(0, size);

    const rest = words.filter((w) => !isDue(w, now));
    return due.concat(rest.slice(0, size - due.length));
  }

  return { review, isDue, pickSessionWords };
})();
