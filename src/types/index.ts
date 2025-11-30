// Şarkı tipi
export interface Song {
  id: number;
  title: string;
  artist: string;
  lyrics: string;
  audio_file_path?: string | null;
  audio_file_name?: string | null;
  duration?: number;
  volume_level?: number;
  created_at: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  cover?: string;
}

// Performans tipi
export interface Performance {
  id: number;
  song_id: number;
  accuracy: number;
  duration: number;
  recorded_at: string;
}

// Eşleşen kelime tipi
export interface MatchedWord {
  original: string;
  detected: string;
  confidence: number;
  isCorrect: boolean;
  timestamp: number;
}

// Hata kodu tipi
export type ErrorCode = 
  | 'MICROPHONE_ACCESS_DENIED'
  | 'MODEL_LOAD_FAILED'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

