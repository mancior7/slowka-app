// Zamienia surowy tekst (np. z OCR) na listę par {en, pl}.
// Obsługuje dwa formaty linii:
//   1) "słówko /transkrypcja fonetyczna/ tłumaczenie"  (typowy układ w podręcznikach) -
//      transkrypcja w ukośnikach jest wycinana i pomijana.
//   2) "słówko - tłumaczenie" (prostszy układ z notatek własnych).
const VocabParser = (() => {
  const DELIMITERS = [/\s+-\s+/, /\s+–\s+/, /\t+/, /\s*:\s+/, /-/];
  const PHONETIC_PATTERN = /^(.*?)\s*\/[^/\n]+\/\s*(.*)$/;

  // Okrągłe znaczki poziomu trudności w podręczniku (❶❷❸) OCR często odczytuje
  // jako znaki typu ©®™ albo inne śmieciowe symbole - wycinamy je.
  const JUNK_SYMBOLS = /[©®™|†‡•●○◦§¶@~^]/g;

  function cleanFragment(str) {
    let cleaned = str
      .replace(/\/[^/\n]*\/?/g, " ") // resztki transkrypcji fonetycznej, jeśli jakieś zostały
      .replace(JUNK_SYMBOLS, " ")
      .replace(/\s+/g, " ")
      .trim();
    // usuwa wiodące znaczki/numerki przed pierwszą literą
    cleaned = cleaned.replace(/^[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/, "");
    cleaned = cleaned.replace(/[,;:\s]+$/, "");
    return cleaned.trim();
  }

  function splitLine(line) {
    const phoneticMatch = line.match(PHONETIC_PATTERN);
    if (phoneticMatch) {
      const en = cleanFragment(phoneticMatch[1]);
      const pl = cleanFragment(phoneticMatch[2]);
      if (en && pl) return [en, pl];
    }

    for (const delim of DELIMITERS) {
      const parts = line.split(delim);
      if (parts.length === 2) {
        const [a, b] = parts.map((p) => cleanFragment(p));
        if (a && b) return [a, b];
      }
    }
    return null;
  }

  function parse(rawText) {
    const lines = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const pairs = [];
    for (const line of lines) {
      const split = splitLine(line);
      if (split) pairs.push({ en: split[0], pl: split[1] });
    }
    return pairs;
  }

  function swapSides(pairs) {
    return pairs.map((p) => ({ en: p.pl, pl: p.en }));
  }

  return { parse, swapSides };
})();
