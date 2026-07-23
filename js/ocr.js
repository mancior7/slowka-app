// Cienki wrapper na OCR: jeśli użytkownik poda własny klucz Google Cloud Vision
// (przechowywany tylko w localStorage, nigdy w kodzie apki), używamy go dla dużo
// lepszej jakości rozpoznawania. Bez klucza działa jak dotychczas przez Tesseract.js.
const VocabOCR = (() => {
  const VISION_KEY_STORAGE = "vocab_vision_api_key";

  function getVisionApiKey() {
    return (localStorage.getItem(VISION_KEY_STORAGE) || "").trim();
  }

  function saveVisionApiKey(key) {
    const trimmed = (key || "").trim();
    if (trimmed) localStorage.setItem(VISION_KEY_STORAGE, trimmed);
    else localStorage.removeItem(VISION_KEY_STORAGE);
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = () => reject(new Error("Nie udało się przetworzyć obrazu."));
      reader.readAsDataURL(blob);
    });
  }

  async function recognizeWithVision(parts, apiKey, onProgress) {
    let combined = "";
    for (let i = 0; i < parts.length; i++) {
      if (onProgress) onProgress(Math.round((i / parts.length) * 100), "Rozpoznawanie tekstu (Google Cloud Vision)...");
      const base64 = await blobToBase64(parts[i]);
      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ image: { content: base64 }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }],
        }),
      });
      if (!res.ok) throw new Error(`Google Cloud Vision zwróciło błąd HTTP ${res.status}.`);
      const data = await res.json();
      const apiError = data.responses && data.responses[0] && data.responses[0].error;
      if (apiError) throw new Error(apiError.message || "Nieznany błąd Google Cloud Vision.");
      combined += (data.responses?.[0]?.fullTextAnnotation?.text || "") + "\n";
    }
    if (onProgress) onProgress(100, "Rozpoznawanie tekstu (Google Cloud Vision)...");
    return combined;
  }

  async function recognizeWithTesseract(parts, onProgress) {
    if (typeof Tesseract === "undefined") {
      throw new Error("Silnik OCR nie załadował się (brak połączenia z internetem?).");
    }

    let partIndex = 0;
    const worker = await Tesseract.createWorker("eng+pol", 1, {
      logger: (info) => {
        if (onProgress && info.status === "recognizing text") {
          const overall = ((partIndex + info.progress) / parts.length) * 100;
          onProgress(Math.round(overall), "Rozpoznawanie tekstu (Tesseract.js)...");
        }
      },
    });

    try {
      // SINGLE_COLUMN: każda część to lista linii jedna pod drugą, nie swobodny
      // układ akapitów.
      await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN });

      let combined = "";
      for (partIndex = 0; partIndex < parts.length; partIndex++) {
        const { data } = await worker.recognize(parts[partIndex]);
        combined += data.text + "\n";
      }
      return combined;
    } finally {
      await worker.terminate();
    }
  }

  async function recognize(imageFile, onProgress) {
    const apiKey = getVisionApiKey();

    if (apiKey) {
      try {
        // Vision ma własną, dużo lepszą analizę układu strony (kolumny, akapity,
        // wielolinijkowe wpisy) niż nasze proste wykrywanie "szczeliny" w
        // imagesplit.js - ręczne cięcie obrazu tylko by jej przeszkadzało,
        // zwłaszcza przy układach typu "słowo / transkrypcja / tłumaczenie"
        // w jednym wierszu, gdzie nie ma naprawdę dwóch niezależnych kolumn.
        return await recognizeWithVision([imageFile], apiKey, onProgress);
      } catch (err) {
        // klucz zły/wyczerpany limit itp. - nie blokujemy importu, wracamy do
        // Tesseract.js, ale widocznie informujemy o tym w pasku postępu
        if (onProgress) onProgress(0, `Google Cloud Vision niedostępne (${err.message}), używam Tesseract.js...`);
      }
    }

    // Tesseract radzi sobie z układem wielokolumnowym dużo słabiej, więc tu
    // nadal dzielimy zdjęcie na kolumny przed OCR, jeśli je wykryjemy.
    const parts = await VocabImageSplit.splitIfTwoColumn(imageFile);
    return recognizeWithTesseract(parts, onProgress);
  }

  return { recognize, getVisionApiKey, saveVisionApiKey };
})();
