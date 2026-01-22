
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Usando unpkg que é mais estável para o worker mjs do pdfjs 5.x
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const getPageAsImage = async (pdfData: ArrayBuffer, pageNum: number): Promise<string> => {
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
  return base64;
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
