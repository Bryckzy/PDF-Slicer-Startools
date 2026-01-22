
export interface ProcessedFile {
  id: string;
  name: string;
  originalPage: number;
  docNumber: string;
  blob: Blob;
  status: 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface AppState {
  isProcessing: boolean;
  progress: number;
  files: ProcessedFile[];
  error: string | null;
}
