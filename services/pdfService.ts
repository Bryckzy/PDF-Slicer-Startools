
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Usando a versão .js (legacy) em vez de .mjs para evitar erros de MIME-type no Vercel
const PDFJS_VERSION = '5.4.530';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export const getPageAsImage = async (pdfData: ArrayBuffer, pageNum: number): Promise<string> => {
  try {
    const data = new Uint8Array(pdfData);
    
    const loadingTask = pdfjsLib.getDocument({ 
      data,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
      disableFontFace: false // Importante para renderizar fontes de boletos corretamente
    });
    
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);
    
    // Escala 2.5 para maior nitidez no OCR em produção
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error('Canvas context error');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ 
      canvasContext: context, 
      viewport,
      intent: 'print' // Melhora a nitidez de textos e linhas
    }).promise;
    
    const base64 = canvas.toDataURL('image/png', 0.9).split(',')[1];
    
    // Cleanup prevent memory leaks
    canvas.width = 0;
    canvas.height = 0;
    
    return base64;
  } catch (error) {
    console.error("Erro render PDF page:", error);
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
