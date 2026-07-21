const VocabStorage = (() => {
  const KEY = "vocab_decks_v1";

  function loadAll() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveAll(decks) {
    localStorage.setItem(KEY, JSON.stringify(decks));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function makeWord(en, pl) {
    return {
      id: uid(),
      en: en.trim(),
      pl: pl.trim(),
      interval: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      dueDate: new Date().toISOString(),
    };
  }

  function getDecks() {
    return loadAll();
  }

  function getDeck(deckId) {
    return loadAll().find((d) => d.id === deckId) || null;
  }

  function createDeck(name, pairs) {
    const decks = loadAll();
    const deck = {
      id: uid(),
      name: name.trim() || "Talia bez nazwy",
      createdAt: new Date().toISOString(),
      words: pairs.map((p) => makeWord(p.en, p.pl)),
    };
    decks.push(deck);
    saveAll(decks);
    return deck;
  }

  function deleteDeck(deckId) {
    const decks = loadAll().filter((d) => d.id !== deckId);
    saveAll(decks);
  }

  function addWords(deckId, pairs) {
    const decks = loadAll();
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return null;
    deck.words.push(...pairs.map((p) => makeWord(p.en, p.pl)));
    saveAll(decks);
    return deck;
  }

  function updateWord(deckId, wordId, updates) {
    const decks = loadAll();
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const word = deck.words.find((w) => w.id === wordId);
    if (!word) return;
    Object.assign(word, updates);
    saveAll(decks);
  }

  function deleteWord(deckId, wordId) {
    const decks = loadAll();
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    deck.words = deck.words.filter((w) => w.id !== wordId);
    saveAll(decks);
  }

  // Zapisuje nazwę i pełną listę słówek z ekranu edycji naraz: pary z `id`
  // aktualizują istniejące słówka (stan powtórek zostaje), pary bez `id` to
  // nowo dodane, a słówka, których nie ma na liście, zostają usunięte.
  function saveDeckEdits(deckId, name, pairs) {
    const decks = loadAll();
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return null;

    deck.name = name.trim() || deck.name;

    const keepIds = new Set(pairs.filter((p) => p.id).map((p) => p.id));
    deck.words = deck.words.filter((w) => keepIds.has(w.id));

    pairs.forEach((p) => {
      if (p.id) {
        const word = deck.words.find((w) => w.id === p.id);
        if (word) {
          word.en = p.en.trim();
          word.pl = p.pl.trim();
        }
      } else {
        deck.words.push(makeWord(p.en, p.pl));
      }
    });

    saveAll(decks);
    return deck;
  }

  return { getDecks, getDeck, createDeck, deleteDeck, addWords, updateWord, deleteWord, saveDeckEdits, makeWord };
})();
