
import React, { useState, useRef } from 'react';
import { AppState, ProcessedFile } from './types';
import { getPageCount, getPageAsImage, extractSinglePage } from './services/pdfService';
import { extractDocNumber } from './services/geminiService';
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

  const processPDF = async (file: File) => {
    setState({ isProcessing: true, progress: 0, files: [], error: null });

    try {
      const originalArrayBuffer = await file.arrayBuffer();
      const pageCount = await getPageCount(originalArrayBuffer.slice(0));
      const processedFiles: ProcessedFile[] = [];

      for (let i = 1; i <= pageCount; i++) {
        setState(prev => ({ ...prev, progress: Math.round(((i - 1) / pageCount) * 100) }));

        const imageBuffer = originalArrayBuffer.slice(0);
        let docNumberRaw = "";
        
        try {
          const imageBase64 = await getPageAsImage(imageBuffer, i);
          docNumberRaw = await extractDocNumber(imageBase64);
        } catch (ocrErr) {
          docNumberRaw = "ERRO_PROCESSAMENTO";
        }
        
        let docNumber = docNumberRaw.trim().toUpperCase();
        
        // Se retornar erro de chave, avisa o usuário
        if (docNumber === "ERRO_SEM_CHAVE") {
          throw new Error("API KEY NÃO CONFIGURADA. Verifique as variáveis de ambiente no Vercel.");
        }

        // Limpeza do retorno
        if (docNumber.includes(':')) {
          docNumber = docNumber.split(':').pop()?.trim() || docNumber;
        }

        if (["NAO_ENCONTRADO", "ERRO_LEITURA", "ERRO_IA", "ERRO_PROCESSAMENTO"].includes(docNumber)) {
          docNumber = `BOLETO-PAG-${i}`;
        } else {
          // Mantém apenas o que interessa para o nome do arquivo
          docNumber = docNumber.replace(/[^0-9-]/g, '');
          if (!docNumber || docNumber === "-") docNumber = `BOLETO-PAG-${i}`;
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
      console.error("Erro no fluxo:", err);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: err.message || "FALHA NO PROCESSAMENTO. Tente novamente." 
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
    link.download = `STARTOOLS_BOLETOS_${new Date().getTime()}.zip`;
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

  const reset = () => {
    if(window.confirm("DESEJA LIMPAR A LISTA?")) {
      setState({ isProcessing: false, progress: 0, files: [], error: null });
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-yellow-brand selection:text-black">
      <header className="bg-black border-b border-zinc-800 py-10 px-6 sticky top-0 z-40 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="bg-yellow-brand text-black font-black w-14 h-14 flex items-center justify-center text-3xl skew-x-[-12deg]">
              ST
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">
              PDF <span className="text-yellow-brand">SLICER</span> STARTOOLS
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-12">
        <div 
          onClick={() => !state.isProcessing && fileInputRef.current?.click()}
          className={`relative group mb-16 p-20 border-2 border-dashed rounded-xl transition-all duration-500 flex flex-col items-center justify-center gap-8 ${
            state.isProcessing 
            ? 'border-yellow-brand/30 bg-yellow-brand/5 cursor-wait' 
            : 'border-zinc-800 bg-zinc-900/10 hover:border-yellow-brand hover:bg-zinc-900/30 cursor-pointer'
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
          
          <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all ${
            state.isProcessing 
            ? 'border-yellow-brand text-yellow-brand animate-pulse scale-110' 
            : 'border-zinc-800 text-zinc-700 group-hover:border-yellow-brand group-hover:text-yellow-brand group-hover:scale-110'
          }`}>
            <i className={`fa-solid ${state.isProcessing ? 'fa-spinner fa-spin' : 'fa-upload'} text-4xl`}></i>
          </div>
          
          <div className="text-center z-20">
            <h2 className="text-3xl font-black uppercase tracking-widest mb-3">
              {state.isProcessing ? 'PROCESSANDO DOCUMENTO' : 'UPLOAD DE PDF'}
            </h2>
            <p className="text-zinc-500 font-medium tracking-wide">
              {state.isProcessing 
                ? `IDENTIFICANDO NÚMERO NA PÁGINA ${state.files.length + 1}...` 
                : 'SELECIONE O PDF COM OS BOLETOS BRADESCO'}
            </p>
          </div>

          {state.isProcessing && (
            <div className="w-full max-w-xl bg-zinc-900 h-1.5 rounded-full overflow-hidden mt-6">
              <div 
                className="bg-yellow-brand h-full transition-all duration-500" 
                style={{ width: `${state.progress}%` }}
              ></div>
            </div>
          )}
        </div>

        {state.error && (
          <div className="bg-red-600 text-white p-6 rounded-lg mb-12 font-black uppercase text-sm tracking-widest flex items-center gap-4 shadow-xl">
            <i className="fa-solid fa-circle-exclamation text-2xl"></i>
            {state.error}
          </div>
        )}

        {state.files.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12 border-b-2 border-zinc-800 pb-10">
              <div>
                <h3 className="text-5xl font-black uppercase tracking-tighter mb-2">
                  ARQUIVOS <span className="text-yellow-brand">PRONTOS</span>
                </h3>
                <p className="text-zinc-500 font-bold uppercase text-xs tracking-[0.3em]">Total: {state.files.length}</p>
              </div>
              
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={reset}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white font-black px-8 py-4 rounded-lg text-xs uppercase tracking-widest transition-all"
                >
                  LIMPAR
                </button>
                {!state.isProcessing && (
                  <button 
                    onClick={downloadAll}
                    className="bg-yellow-brand hover:bg-white text-black font-black px-10 py-4 rounded-lg text-xs uppercase tracking-[0.2em] transition-all shadow-lg active:scale-95"
                  >
                    BAIXAR TUDO (.ZIP)
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {state.files.map((file) => (
                <div 
                  key={file.id} 
                  className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 group hover:border-yellow-brand transition-all flex flex-col shadow-sm"
                >
                  <div className="flex items-start justify-between mb-8">
                    <div className="bg-black w-14 h-14 rounded-xl flex items-center justify-center text-yellow-brand border border-zinc-800 group-hover:border-yellow-brand/40 transition-all">
                      <i className="fa-solid fa-file-invoice-dollar text-2xl"></i>
                    </div>
                    <div className="text-right">
                      <span className="bg-zinc-800 text-zinc-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                        PÁG {file.originalPage}
                      </span>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h4 className="text-xl font-black text-white truncate mb-2 group-hover:text-yellow-brand transition-colors" title={file.name}>
                      {file.name}
                    </h4>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Número do Documento</p>
                  </div>

                  <div className="mt-auto grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setSelectedFile(file)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-eye"></i> VER
                    </button>
                    <button 
                      onClick={(e) => downloadSingle(file, e)}
                      className="bg-yellow-brand hover:bg-white text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <i className="fa-solid fa-download"></i> BAIXAR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!state.isProcessing && state.files.length === 0 && (
          <div className="py-32 text-center opacity-10">
            <i className="fa-solid fa-file-pdf text-[120px] mb-8"></i>
            <h3 className="text-2xl font-black uppercase tracking-[0.5em]">Aguardando PDF</h3>
          </div>
        )}
      </main>

      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedFile(null)}></div>
          <div className="relative w-full max-w-5xl h-full bg-zinc-900 rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-zinc-800">
            <div className="bg-black p-6 border-b border-zinc-800 flex items-center justify-between">
              <h4 className="text-sm font-black uppercase tracking-widest text-yellow-brand">{selectedFile.name}</h4>
              <button 
                onClick={() => setSelectedFile(null)}
                className="w-12 h-12 rounded-full bg-zinc-800 text-white hover:bg-yellow-brand hover:text-black transition-all flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            
            <div className="flex-1 bg-zinc-950">
              <iframe 
                src={`${URL.createObjectURL(selectedFile.blob)}#toolbar=0&navpanes=0`} 
                className="w-full h-full border-none"
                title="Preview"
              />
            </div>

            <div className="p-8 bg-black flex justify-center border-t border-zinc-800">
              <button 
                onClick={(e) => downloadSingle(selectedFile, e)}
                className="bg-yellow-brand text-black font-black px-16 py-5 rounded-xl text-xs uppercase tracking-[0.3em] hover:bg-white transition-all shadow-xl"
              >
                BAIXAR ESTA PÁGINA
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-16 bg-black border-t border-zinc-900 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.5em] text-zinc-500 mb-2">
            STARTOOLS INDUSTRIAL SOLUTIONS
          </p>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-6 italic">
            Created by Hamza Brykcy
          </p>
          <div className="w-20 h-1 bg-yellow-brand mx-auto mb-6"></div>
          <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">
            © {new Date().getFullYear()} SISTEMA DE PROCESSAMENTO DE ARQUIVOS. TODOS OS DIREITOS RESERVADOS.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
