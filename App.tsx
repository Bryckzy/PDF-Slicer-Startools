
import React, { useState, useRef } from 'react';
import { AppState, ProcessedFile } from './types';
import { getPageCount, getPageText, extractSinglePage } from './services/pdfService';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isProcessing: false,
    progress: 0,
    files: [],
    error: null,
  });
  
  const [selectedFile, setSelectedFile] = useState<ProcessedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const findDocNumber = (text: string): string | null => {
    // 1. Limpeza pesada: Remove espaços múltiplos e normaliza hífens
    const cleanText = text.replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-');
    
    // 2. Tenta encontrar a label "Num. do Documento" e pegar o valor próximo
    // No OCR do Bradesco, geralmente vem "Data do Documento Num. do Documento ... 06/11/2025 24277-4"
    // Vamos procurar por uma data seguida do padrão XXXXX-X
    const dateAndNumberRegex = /(\d{2}\/\d{2}\/\d{4})\s*(\d{5}-\d)/g;
    const dateMatches = [...cleanText.matchAll(dateAndNumberRegex)];
    
    if (dateMatches.length > 0) {
      // Retorna o segundo grupo de captura (o número do documento) do primeiro match
      return dateMatches[0][2];
    }

    // 3. Fallback: Busca apenas o padrão isolado de 5 dígitos + hífen + 1 dígito
    const isolatedRegex = /\b\d{5}-\d\b/g;
    const matches = cleanText.match(isolatedRegex);
    
    if (matches && matches.length > 0) {
      // Se houver mais de um, o primeiro costuma ser o correto no topo do boleto
      return matches[0];
    }
    
    // 4. Fallback 2: Tenta qualquer número com hífen de 4 a 8 dígitos caso o boleto varie
    const flexibleRegex = /\b\d{4,8}-\d\b/g;
    const flexMatches = cleanText.match(flexibleRegex);
    if (flexMatches && flexMatches.length > 0) {
      return flexMatches[0];
    }

    return null;
  };

  const processPDF = async (file: File) => {
    setState({ isProcessing: true, progress: 0, files: [], error: null });

    try {
      const originalArrayBuffer = await file.arrayBuffer();
      const pageCount = await getPageCount(originalArrayBuffer.slice(0));
      const processedFiles: ProcessedFile[] = [];

      for (let i = 1; i <= pageCount; i++) {
        setState(prev => ({ ...prev, progress: Math.round(((i - 1) / pageCount) * 100) }));

        // Extrai o texto da página atual com reconstrução de linhas
        const text = await getPageText(originalArrayBuffer.slice(0), i);
        let docNumber = findDocNumber(text);

        if (!docNumber) {
          docNumber = `BOLETO-PAG-${i}`;
        }

        const extractionBuffer = originalArrayBuffer.slice(0);
        const pagePdfBytes = await extractSinglePage(extractionBuffer, i);
        const blob = new Blob([pagePdfBytes], { type: 'application/pdf' });

        const newFile: ProcessedFile = {
          id: `file-${i}-${Date.now()}`,
          name: `${docNumber}.pdf`,
          originalPage: i,
          docNumber: docNumber,
          blob: blob,
          status: 'completed'
        };

        processedFiles.push(newFile);
        setState(prev => ({ ...prev, files: [...processedFiles] }));
      }

      setState(prev => ({ ...prev, isProcessing: false, progress: 100 }));
    } catch (err: any) {
      console.error("Erro no processamento:", err);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: "ERRO CRÍTICO NO ARQUIVO. Verifique se o PDF não é apenas uma imagem (scan)." 
      }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      processPDF(file);
    } else {
      setState(prev => ({ ...prev, error: "TIPO DE ARQUIVO INVÁLIDO. Use apenas PDF." }));
    }
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    state.files.forEach(file => {
      zip.file(file.name, file.blob);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BOLETOS_STARTOOLS_${new Date().toISOString().split('T')[0]}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadSingle = (file: ProcessedFile, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-yellow-brand selection:text-black">
      {/* Header Industrial */}
      <header className="bg-black border-b border-zinc-800 py-8 px-6 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-yellow-brand text-black font-black w-12 h-12 flex items-center justify-center text-2xl skew-x-[-10deg]">
              ST
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">
              PDF <span className="text-yellow-brand">SLICER</span> STARTOOLS
            </h1>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span className="bg-zinc-900 text-zinc-500 text-[10px] px-4 py-2 rounded-full font-bold uppercase tracking-widest border border-zinc-800">
              Pattern: 00000-0
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-10">
        {/* Dropzone Principal */}
        <div 
          onClick={() => !state.isProcessing && fileInputRef.current?.click()}
          className={`relative group mb-12 p-16 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-6 ${
            state.isProcessing 
            ? 'border-yellow-brand/20 bg-yellow-brand/5 cursor-wait' 
            : 'border-zinc-800 bg-zinc-900/10 hover:border-yellow-brand hover:bg-zinc-900/20 cursor-pointer'
          }`}
        >
          {state.isProcessing && <div className="scan-line"></div>}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept="application/pdf"
            disabled={state.isProcessing}
          />
          
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all rotate-3 group-hover:rotate-0 ${
            state.isProcessing 
            ? 'bg-yellow-brand text-black animate-pulse' 
            : 'bg-zinc-900 text-zinc-700 group-hover:bg-yellow-brand group-hover:text-black'
          }`}>
            <i className={`fa-solid ${state.isProcessing ? 'fa-cog fa-spin' : 'fa-file-pdf'} text-3xl`}></i>
          </div>
          
          <div className="text-center">
            <h2 className="text-2xl font-black uppercase tracking-widest mb-2">
              {state.isProcessing ? 'FATIAMENTO INDUSTRIAL' : 'INICIAR PROCESSO'}
            </h2>
            <p className="text-zinc-500 text-sm font-medium">
              {state.isProcessing 
                ? `Extraindo número da página ${state.files.length + 1}...` 
                : 'Arraste ou clique para carregar o PDF de boletos'}
            </p>
          </div>

          {state.isProcessing && (
            <div className="w-full max-w-md bg-zinc-900 h-1 rounded-full overflow-hidden mt-4">
              <div 
                className="bg-yellow-brand h-full transition-all duration-300" 
                style={{ width: `${state.progress}%` }}
              ></div>
            </div>
          )}
        </div>

        {state.error && (
          <div className="bg-red-950/50 border border-red-900 text-red-400 p-5 rounded-xl mb-10 flex items-center gap-4 animate-in fade-in duration-300">
            <i className="fa-solid fa-triangle-exclamation text-xl"></i>
            <span className="font-bold text-sm uppercase tracking-wider">{state.error}</span>
          </div>
        )}

        {/* Gallery */}
        {state.files.length > 0 && (
          <div className="animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-8 border-b border-zinc-800 pb-8">
              <div>
                <h3 className="text-4xl font-black uppercase tracking-tighter">
                  BOLETOS <span className="text-yellow-brand">GERADOS</span>
                </h3>
                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.4em] mt-1">
                  Arquivos prontos para arquivamento: {state.files.length}
                </p>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setState({ isProcessing: false, progress: 0, files: [], error: null })}
                  className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold px-6 py-3 rounded-lg text-[10px] uppercase tracking-widest transition-all"
                >
                  LIMPAR
                </button>
                {!state.isProcessing && (
                  <button 
                    onClick={downloadAll}
                    className="bg-yellow-brand hover:bg-white text-black font-black px-8 py-3 rounded-lg text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95"
                  >
                    BAIXAR TODOS (.ZIP)
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {state.files.map((file) => (
                <div 
                  key={file.id} 
                  className="bg-zinc-900/40 border border-zinc-800 hover:border-yellow-brand/50 rounded-xl p-5 group transition-all"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center text-yellow-brand border border-zinc-800 group-hover:border-yellow-brand/30">
                      <i className="fa-solid fa-barcode text-lg"></i>
                    </div>
                    <span className="text-[9px] font-black text-zinc-600 bg-black px-2 py-1 rounded">
                      PAG {file.originalPage}
                    </span>
                  </div>

                  <div className="mb-6">
                    <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mb-1">Doc. Identificado</p>
                    <h4 className="text-lg font-black text-white truncate group-hover:text-yellow-brand" title={file.name}>
                      {file.name}
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setSelectedFile(file)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg text-[9px] uppercase tracking-widest transition-all"
                    >
                      VISUALIZAR
                    </button>
                    <button 
                      onClick={(e) => downloadSingle(file, e)}
                      className="bg-yellow-brand hover:bg-white text-black font-black py-3 rounded-lg text-[9px] uppercase tracking-widest transition-all"
                    >
                      SALVAR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!state.isProcessing && state.files.length === 0 && (
          <div className="py-24 text-center opacity-10 flex flex-col items-center">
            <i className="fa-solid fa-layer-group text-8xl mb-6"></i>
            <h3 className="text-xl font-black uppercase tracking-[0.6em]">Aguardando Produção</h3>
          </div>
        )}
      </main>

      {/* Modal Preview */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" onClick={() => setSelectedFile(null)}></div>
          <div className="relative w-full max-w-4xl h-[90vh] bg-zinc-900 rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-zinc-800">
            <div className="bg-black p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-file-pdf text-yellow-brand"></i>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{selectedFile.name}</h4>
              </div>
              <button 
                onClick={() => setSelectedFile(null)}
                className="w-10 h-10 rounded-full bg-zinc-800 text-white hover:bg-yellow-brand hover:text-black transition-all flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            
            <div className="flex-1 bg-zinc-950">
              <iframe 
                src={`${URL.createObjectURL(selectedFile.blob)}#toolbar=0`} 
                className="w-full h-full border-none"
                title="Preview Boleto"
              />
            </div>

            <div className="p-6 bg-black border-t border-zinc-800 flex justify-center">
              <button 
                onClick={(e) => downloadSingle(selectedFile, e)}
                className="bg-yellow-brand text-black font-black px-12 py-4 rounded-xl text-[10px] uppercase tracking-[0.4em] hover:bg-white transition-all"
              >
                CONFIRMAR E BAIXAR
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-12 bg-black border-t border-zinc-900 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-4">
            STARTOOLS INDUSTRIAL DATA PROCESSING
          </p>
          <div className="flex justify-center gap-2 mb-6">
            <div className="w-1 h-1 bg-yellow-brand rounded-full"></div>
            <div className="w-10 h-1 bg-yellow-brand rounded-full"></div>
            <div className="w-1 h-1 bg-yellow-brand rounded-full"></div>
          </div>
          <p className="text-[9px] font-bold text-zinc-800 uppercase tracking-widest">
            ENGINE V3.0 • VECTOR TEXT RECONSTRUCTION • NO CLOUD PROCESSING
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
