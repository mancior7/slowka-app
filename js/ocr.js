// Cienki wrapper na Tesseract.js (ładowany z CDN w index.html jako window.Tesseract).
const VocabOCR = (() => {
  async function recognize(imageFile, onProgress) {
    if (typeof Tesseract === "undefined") {
      throw new Error("Silnik OCR nie załadował się (brak połączenia z internetem?).");
    }

    // Jeśli wykryjemy dwie kolumny tekstu, dzielimy zdjęcie i czytamy je osobno -
    // inaczej OCR miesza tekst z lewej i prawej kolumny w złej kolejności.
    const parts = await VocabImageSplit.splitIfTwoColumn(imageFile);
    let partIndex = 0;

    const worker = await Tesseract.createWorker("eng+pol", 1, {
      logger: (info) => {
        if (onProgress && info.status === "recognizing text") {
          const overall = ((partIndex + info.progress) / parts.length) * 100;
          onProgress(Math.round(overall));
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

  return { recognize };
})();
