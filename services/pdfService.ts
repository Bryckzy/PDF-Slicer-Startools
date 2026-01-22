
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Sincronizando com a versão do importmap no index.html
const PDFJS_VERSION = '5.4.530';

// Para versões recentes do PDF.js (v4+), o worker deve ser referenciado como um módulo (.mjs)
// e preferencialmente do mesmo provedor que a biblioteca principal (esm.sh ou unpkg)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export const getPageText = async (pdfData: ArrayBuffer, pageNum: number): Promise<string> => {
  try {
    const data = new Uint8Array(pdfData);
    const loadingTask = pdfjsLib.getDocument({ 
      data,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
    });
    
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Agrupar itens por linha (y-coordinate)
    // No pdf.js, transform[5] é a posição Y
    const items = textContent.items as any[];
    
    // Ordenar itens: Primeiro por Y (descendente) e depois por X (ascendente)
    items.sort((a, b) => {
      if (Math.abs(a.transform[5] - b.transform[5]) < 5) { // Mesma linha (tolerância de 5px)
        return a.transform[4] - b.transform[4];
      }
      return b.transform[5] - a.transform[5];
    });

    let fullText = "";
    let lastY = -1;

    for (const item of items) {
      if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
        fullText += "\n"; // Quebra de linha se a posição Y mudou significativamente
      } else if (lastY !== -1) {
        fullText += " "; // Espaço entre palavras na mesma linha
      }
      fullText += item.str;
      lastY = item.transform[5];
    }
      
    return fullText;
  } catch (error) {
    console.error("Erro ao extrair texto do PDF:", error);
    // Fallback: Tenta inicializar o worker de forma alternativa se falhar
    throw error;
  }
};

export const extractSinglePage = async (originalPdfData: ArrayBuffer, pageNum: number): Promise<Uint8Array> => {
  const srcDoc = await PDFDocument.load(originalPdfData);
  const pdfDoc = await PDFDocument.create();
  const [copiedPage] = await pdfDoc.copyPages(srcDoc, [pageNum - 1]);
  pdfDoc.addPage(copiedPage);
  return await pdfDoc.save();
};

export const getPageCount = async (pdfData: ArrayBuffer): Promise<number> => {
  const doc = await PDFDocument.load(pdfData);
  return doc.getPageCount();
};
