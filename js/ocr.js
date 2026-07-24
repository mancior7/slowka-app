// Cienki wrapper na OCR: domyślnie każde zdjęcie leci przez Google Cloud Vision
// (dużo lepsza jakość niż Tesseract.js), za pośrednictwem małego serwera
// (server/ocr-proxy) który chowa klucz API i omija blokadę CORS przeglądarek na
// bezpośrednie wywołania Vision. Jeśli serwer/Vision zawiedzie (brak sieci,
// przekroczony limit), automatycznie i widocznie wracamy do Tesseract.js.
const VocabOCR = (() => {
  const PROXY_URL = "https://ocr-proxy-1058209779115.europe-west1.run.app";

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = () => reject(new Error("Nie udało się przetworzyć obrazu."));
      reader.readAsDataURL(blob);
    });
  }

  async function recognizeWithVision(imageFile, onProgress) {
    if (onProgress) onProgress(0, "Rozpoznawanie tekstu (Google Cloud Vision)...");
    const base64 = await blobToBase64(imageFile);
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Serwer OCR zwrócił błąd HTTP ${res.status}.`);
    if (onProgress) onProgress(100, "Rozpoznawanie tekstu (Google Cloud Vision)...");
    return data.text || "";
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
    try {
      // Vision ma własną, dużo lepszą analizę układu strony (kolumny, akapity,
      // wielolinijkowe wpisy) niż nasze proste wykrywanie "szczeliny" w
      // imagesplit.js - ręczne cięcie obrazu tylko by jej przeszkadzało,
      // zwłaszcza przy układach typu "słowo / transkrypcja / tłumaczenie"
      // w jednym wierszu, gdzie nie ma naprawdę dwóch niezależnych kolumn.
      return await recognizeWithVision(imageFile, onProgress);
    } catch (err) {
      // serwer padł/limit wyczerpany itp. - nie blokujemy importu, wracamy do
      // Tesseract.js, ale widocznie informujemy o tym w pasku postępu
      if (onProgress) onProgress(0, `Google Cloud Vision niedostępne (${err.message}), używam Tesseract.js...`);
    }

    // Tesseract radzi sobie z układem wielokolumnowym dużo słabiej, więc tu
    // dzielimy zdjęcie na kolumny przed OCR, jeśli je wykryjemy.
    const parts = await VocabImageSplit.splitIfTwoColumn(imageFile);
    return recognizeWithTesseract(parts, onProgress);
  }

  return { recognize };
})();
