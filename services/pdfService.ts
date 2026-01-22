
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configuração de worker usando unpkg que é altamente estável para produção
// Mantemos a versão sincronizada com o import map (5.4.530)
const PDFJS_VERSION = '5.4.530';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

export const getPageAsImage = async (pdfData: ArrayBuffer, pageNum: number): Promise<string> => {
  try {
    // Convertemos para Uint8Array para maior compatibilidade com o pdf.js
    const data = new Uint8Array(pdfData);
    
    const loadingTask = pdfjsLib.getDocument({ 
      data,
      // CMaps são essenciais para renderizar fontes de boletos corretamente
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
    });
    
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);
    
    // Escala 2.0 para garantir que o OCR do Gemini consiga ler os números pequenos
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error('Falha ao obter contexto 2D do Canvas');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({ canvasContext: context, viewport }).promise;
    
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    
    // Cleanup
    canvas.width = 0;
    canvas.height = 0;
    
    return base64;
  } catch (error) {
    console.error("Erro técnico no processamento da página PDF:", error);
    throw error;
  }
};

export const extractSinglePage = async (originalPdfData: ArrayBuffer, pageNum: number): Promise<Uint8Array> => {
  try {
    const srcDoc = await PDFDocument.load(originalPdfData);
    const pdfDoc = await PDFDocument.create();
    
    const [copiedPage] = await pdfDoc.copyPages(srcDoc, [pageNum - 1]);
    pdfDoc.addPage(copiedPage);
    
    return await pdfDoc.save();
  } catch (error) {
    console.error("Erro ao extrair página individual:", error);
    throw error;
  }
};

export const getPageCount = async (pdfData: ArrayBuffer): Promise<number> => {
  try {
    const doc = await PDFDocument.load(pdfData);
    return doc.getPageCount();
  } catch (error) {
    console.error("Erro ao ler contagem de páginas:", error);
    throw error;
  }
};
