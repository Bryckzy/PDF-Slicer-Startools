
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Garantindo que o worker seja carregado da mesma fonte (esm.sh) definida no index.html para evitar mismatches de versão no Vercel
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs`;

export const getPageAsImage = async (pdfData: ArrayBuffer, pageNum: number): Promise<string> => {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);
    
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error('Could not get canvas context');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    
    // Limpeza explícita para ajudar o coletor de lixo
    canvas.width = 0;
    canvas.height = 0;
    
    return base64;
  } catch (error) {
    console.error("Erro ao converter página em imagem:", error);
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
