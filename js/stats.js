// Zapisuje historię ukończonych sesji nauki (czas trwania, liczba słówek) i
// liczy z niej podsumowania: łączny czas, passa dni z rzędu, skuteczność.
const VocabStats = (() => {
  const KEY = "vocab_stats_v1";

  function loadAll() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveAll(sessions) {
    localStorage.setItem(KEY, JSON.stringify(sessions));
  }

  function todayStr(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function recordSession({ durationMs, wordsAnswered, correct, deckName }) {
    const sessions = loadAll();
    sessions.push({
      date: todayStr(),
      durationMs: Math.max(0, durationMs),
      wordsAnswered,
      correct,
      deckName,
    });
    saveAll(sessions);
  }

  function formatDuration(ms) {
    const totalMinutes = Math.round(ms / 60000);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m} min`;
    return `${h} godz. ${m} min`;
  }

  function computeStreak(sessions) {
    const days = new Set(sessions.map((s) => s.date));
    let streak = 0;
    let offset = days.has(todayStr()) ? 0 : 1;
    while (days.has(todayStr(-offset))) {
      streak++;
      offset++;
    }
    return streak;
  }

  function getSummary() {
    const sessions = loadAll();
    const totalTimeMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
    const totalWords = sessions.reduce((sum, s) => sum + s.wordsAnswered, 0);
    const totalCorrect = sessions.reduce((sum, s) => sum + s.correct, 0);

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = todayStr(-i);
      const dayMs = sessions.filter((s) => s.date === dateStr).reduce((sum, s) => sum + s.durationMs, 0);
      last7.push({ date: dateStr, ms: dayMs });
    }

    return {
      hasData: sessions.length > 0,
      totalTimeLabel: formatDuration(totalTimeMs),
      totalSessions: sessions.length,
      totalWords,
      accuracyPct: totalWords > 0 ? Math.round((totalCorrect / totalWords) * 100) : null,
      streak: computeStreak(sessions),
      last7,
    };
  }

  return { recordSession, getSummary, formatDuration };
})();
