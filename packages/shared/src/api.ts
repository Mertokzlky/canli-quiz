import type { QuestionStat } from './types';

// REST API'nin cevap tipleri. Tarihler JSON'da ISO metni olarak gelir.

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  questionCount: number;
  ownerName: string;
  isOwner: boolean;
  updatedAt: string;
}

export interface QuizDetail {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  isOwner: boolean;
  questions: {
    id: string;
    text: string;
    imageUrl: string | null;
    timeLimitSec: number;
    /** isCorrect sadece quizin sahibine gönderilir. */
    choices: { id: string; text: string; isCorrect?: boolean }[];
  }[];
}

export interface BankCategory {
  slug: string;
  name: string;
  emoji: string;
  /** Zorluğa göre soru sayıları. */
  counts: { kolay: number; orta: number; zor: number; total: number };
}

export interface GameHistorySummary {
  id: string;
  quizTitle: string;
  /** Quiz sonradan silindiyse null. */
  quizId: string | null;
  endedAt: string;
  durationSec: number | null;
  playerCount: number;
  questionCount: number;
  /** Erken bitirilen oyunlarda questionCount'tan az olabilir. */
  playedQuestionCount: number;
  /** Tüm cevaplar içinde doğru oranı (0-1). Hiç cevap yoksa null. */
  accuracy: number | null;
  winner: { nickname: string; score: number } | null;
}

export interface GameHistoryDetail extends GameHistorySummary {
  results: { rank: number; nickname: string; score: number; correctCount: number }[];
  questionStats: QuestionStat[];
}

export interface ApiError {
  error: string;
  /** Alan bazlı doğrulama hataları, ör. { "questions.0.text": "Soru metni boş olamaz" } */
  fields?: Record<string, string>;
}
