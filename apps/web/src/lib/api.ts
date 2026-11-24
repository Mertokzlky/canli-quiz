import type {
  ApiError,
  AuthResponse,
  BankCategory,
  GameHistoryDetail,
  GameHistorySummary,
  LoginInput,
  QuickQuizInput,
  PublicUser,
  QuizDetail,
  QuizInput,
  QuizSummary,
  RegisterInput,
} from '@canli-quiz/shared';

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'canli-quiz:token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Gizli sekme gibi durumlarda depolama kapalı olabilir; oturum sadece bu sayfada yaşar.
    }
  },
};

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(res.status, err.error ?? 'Bir hata oluştu', err.fields);
  }
  return data as T;
}

export const api = {
  register: (input: RegisterInput) => request<AuthResponse>('POST', '/api/auth/register', input),
  login: (input: LoginInput) => request<AuthResponse>('POST', '/api/auth/login', input),
  me: () => request<PublicUser>('GET', '/api/auth/me'),

  myQuizzes: () => request<QuizSummary[]>('GET', '/api/quizzes'),
  publicQuizzes: () => request<QuizSummary[]>('GET', '/api/quizzes/public'),
  getQuiz: (id: string) => request<QuizDetail>('GET', `/api/quizzes/${id}`),
  createQuiz: (input: QuizInput) => request<{ id: string }>('POST', '/api/quizzes', input),
  updateQuiz: (id: string, input: QuizInput) =>
    request<{ id: string }>('PUT', `/api/quizzes/${id}`, input),
  deleteQuiz: (id: string) => request<void>('DELETE', `/api/quizzes/${id}`),
  copyQuiz: (id: string) => request<{ id: string }>('POST', `/api/quizzes/${id}/copy`),

  bankCategories: () => request<BankCategory[]>('GET', '/api/bank/categories'),
  games: () => request<GameHistorySummary[]>('GET', '/api/games'),
  game: (id: string) => request<GameHistoryDetail>('GET', `/api/games/${id}`),
  deleteGame: (id: string) => request<void>('DELETE', `/api/games/${id}`),

  quickQuiz: (input: QuickQuizInput) =>
    request<{ id: string }>('POST', '/api/bank/quick-quiz', input),
};
