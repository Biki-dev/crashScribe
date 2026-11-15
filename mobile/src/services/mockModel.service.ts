export interface AIModelInfo {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  sizeMB: number;
  isDownloaded: boolean;
  downloadProgress: number; // 0 to 100
  isDownloading: boolean;
}

const DEFAULT_MODELS: AIModelInfo[] = [
  {
    id: 'model-indic-conformer',
    name: 'Model 01 — Regional Language Processing',
    code: 'IndicConformer INT8',
    category: 'Assamese, Bengali and Bodo ASR',
    description: 'On-device quantized acoustic model fine-tuned for northeast Indian traffic dialects with low background SNR resilience.',
    sizeMB: 125,
    isDownloaded: false,
    downloadProgress: 0,
    isDownloading: false,
  },
  {
    id: 'model-whisper-indictrans',
    name: 'Model 02 — English & Translation Processing',
    code: 'Whisper Tiny.en + IndicTrans2',
    category: 'Bilingual Speech & Translation Engine',
    description: 'Ultra-compact English transcription pipeline coupled with Indic-to-English translation tokenizer for official eDAR court dossiers.',
    sizeMB: 190,
    isDownloaded: false,
    downloadProgress: 0,
    isDownloading: false,
  },
];

const STORAGE_KEY = 'crashscribe_ai_models_status';

export class MockModelService {
  static getModels(): AIModelInfo[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : DEFAULT_MODELS;
    } catch {
      return DEFAULT_MODELS;
    }
  }

  static saveModels(models: AIModelInfo[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
  }
}
