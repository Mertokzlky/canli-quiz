import { randomBytes, randomUUID } from 'node:crypto';
import {
  calculateScore,
  MAX_PLAYERS_PER_GAME,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  type GamePhase,
  type HostView,
  type LeaderboardEntry,
  type PlayerAnswerResult,
  type PlayerView,
  type PublicQuestion,
  type RevealInfo,
} from '@canli-quiz/shared';

// Bu sınıf soket ve veritabanından bağımsızdır: sadece oyun kurallarını bilir.
// Böylece tek başına, sahte saatle test edilebilir.

export interface GameQuiz {
  id: string;
  title: string;
  questions: {
    id: string;
    text: string;
    imageUrl: string | null;
    timeLimitSec: number;
    choices: { id: string; text: string; isCorrect: boolean }[];
  }[];
}

/** Oyun kuralına takılan istekler. Mesajı doğrudan kullanıcıya gösterilir. */
export class GameError extends Error {}

interface Player {
  id: string;
  nickname: string;
  reconnectToken: string;
  connected: boolean;
  score: number;
  streak: number;
  correctCount: number;
  lastResult: PlayerAnswerResult | null;
}

interface Answer {
  choiceId: string;
  elapsedMs: number;
}

export interface FinalResult {
  nickname: string;
  score: number;
  correctCount: number;
  rank: number;
}

const HOST_LEADERBOARD_SIZE = 10;
const PLAYER_LEADERBOARD_SIZE = 5;

const normalizeNickname = (name: string) => name.trim().replace(/\s+/g, ' ');

export class Game {
  readonly createdAt = Date.now();
  startedAt: Date | null = null;
  endedAt: Date | null = null;

  private _phase: GamePhase = 'LOBBY';
  private readonly players = new Map<string, Player>();
  private questionIndex = -1;
  private questionStartedAt = 0;
  private questionEndsAt = 0;
  private answers = new Map<string, Answer>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly pin: string,
    readonly quiz: GameQuiz,
    readonly hostUserId: string,
    /** Oyun durumu her değiştiğinde çağrılır; yayını yönetici yapar. */
    private readonly onChange: (game: Game) => void,
  ) {
    if (quiz.questions.length === 0) throw new GameError('Bu quizde hiç soru yok');
  }

  get phase(): GamePhase {
    return this._phase;
  }

  get playerIds(): string[] {
    return [...this.players.keys()];
  }

  // ---------- Oyuncular ----------

  addPlayer(rawNickname: string): { playerId: string; reconnectToken: string } {
    if (this._phase !== 'LOBBY') throw new GameError('Oyun başladı, artık katılınamaz');
    if (this.players.size >= MAX_PLAYERS_PER_GAME) throw new GameError('Oyun dolu');

    const nickname = normalizeNickname(rawNickname);
    if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
      throw new GameError(`Takma ad ${NICKNAME_MIN_LENGTH}-${NICKNAME_MAX_LENGTH} karakter olmalı`);
    }
    const taken = [...this.players.values()].some(
      (p) => p.nickname.toLocaleLowerCase('tr') === nickname.toLocaleLowerCase('tr'),
    );
    if (taken) throw new GameError('Bu takma ad alınmış, başka bir tane seçin');

    const player: Player = {
      id: randomUUID(),
      nickname,
      reconnectToken: randomBytes(24).toString('base64url'),
      connected: true,
      score: 0,
      streak: 0,
      correctCount: 0,
      lastResult: null,
    };
    this.players.set(player.id, player);
    this.onChange(this);
    return { playerId: player.id, reconnectToken: player.reconnectToken };
  }

  /** Token doğruysa oyuncunun id'sini döner. */
  findPlayerByToken(token: string): string | null {
    for (const p of this.players.values()) {
      if (p.reconnectToken === token) return p.id;
    }
    return null;
  }

  setPlayerConnected(playerId: string, connected: boolean) {
    const player = this.players.get(playerId);
    if (!player || player.connected === connected) return;
    player.connected = connected;
    this.onChange(this);
  }

  // ---------- Akış ----------

  start() {
    if (this._phase !== 'LOBBY') throw new GameError('Oyun zaten başladı');
    if (this.players.size === 0) throw new GameError('Başlamak için en az bir oyuncu gerekli');
    this.startedAt = new Date();
    this.openQuestion(0);
  }

  /** Sunucu ekranındaki "devam" butonu. */
  next() {
    switch (this._phase) {
      case 'QUESTION':
        this.reveal();
        return;
      case 'REVEAL':
        if (this.isLastQuestion) this.finish();
        else this.setPhase('LEADERBOARD');
        return;
      case 'LEADERBOARD':
        this.openQuestion(this.questionIndex + 1);
        return;
      case 'LOBBY':
        throw new GameError('Önce oyunu başlatın');
      case 'ENDED':
        throw new GameError('Oyun bitti');
    }
  }

  /** Oyunu erkenden bitirir. */
  end() {
    if (this._phase === 'ENDED') return;
    this.finish();
  }

  answer(playerId: string, choiceId: string) {
    if (this._phase !== 'QUESTION') throw new GameError('Şu an cevap verilemez');
    const player = this.players.get(playerId);
    if (!player) throw new GameError('Oyuncu bulunamadı');
    if (this.answers.has(playerId)) throw new GameError('Bu soruya zaten cevap verdiniz');
    if (!this.currentQuestion.choices.some((c) => c.id === choiceId)) {
      throw new GameError('Geçersiz şık');
    }

    // Zamanı sunucu ölçer: istemcinin gönderdiği bir zamana güvenilmez.
    const now = Date.now();
    if (now > this.questionEndsAt) throw new GameError('Süre doldu');

    this.answers.set(playerId, { choiceId, elapsedMs: now - this.questionStartedAt });

    const everyoneAnswered = [...this.players.values()]
      .filter((p) => p.connected)
      .every((p) => this.answers.has(p.id));
    if (everyoneAnswered) this.reveal();
    else this.onChange(this);
  }

  dispose() {
    this.clearTimer();
  }

  // ---------- Görünümler ----------

  hostView(): HostView {
    const showBoard = this._phase === 'LEADERBOARD' || this._phase === 'ENDED';
    return {
      pin: this.pin,
      quizTitle: this.quiz.title,
      phase: this._phase,
      serverNow: Date.now(),
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        nickname: p.nickname,
        connected: p.connected,
      })),
      question: this.publicQuestion(),
      answeredCount: this.answers.size,
      reveal: this._phase === 'REVEAL' ? this.revealInfo() : null,
      leaderboard: showBoard ? this.leaderboard().slice(0, HOST_LEADERBOARD_SIZE) : [],
    };
  }

  playerView(playerId: string): PlayerView | null {
    const player = this.players.get(playerId);
    if (!player) return null;

    const board = this._phase === 'LOBBY' ? [] : this.leaderboard();
    const showBoard = this._phase === 'LEADERBOARD' || this._phase === 'ENDED';
    const isReveal = this._phase === 'REVEAL';

    return {
      pin: this.pin,
      quizTitle: this.quiz.title,
      phase: this._phase,
      serverNow: Date.now(),
      me: {
        id: player.id,
        nickname: player.nickname,
        score: player.score,
        rank: board.find((e) => e.playerId === player.id)?.rank ?? null,
      },
      playerCount: this.players.size,
      question: this.publicQuestion(),
      myChoiceId: this.answers.get(playerId)?.choiceId ?? null,
      result: isReveal ? player.lastResult : null,
      correctChoiceId: isReveal ? this.correctChoiceId() : null,
      leaderboard: showBoard ? board.slice(0, PLAYER_LEADERBOARD_SIZE) : [],
    };
  }

  /** Oyun bitince veritabanına yazılacak sonuçlar. */
  finalResults(): FinalResult[] {
    return this.leaderboard().map((e) => ({
      nickname: e.nickname,
      score: e.score,
      rank: e.rank,
      correctCount: this.players.get(e.playerId)?.correctCount ?? 0,
    }));
  }

  leaderboard(): LeaderboardEntry[] {
    const sorted = [...this.players.values()].sort(
      (a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname, 'tr'),
    );
    let rank = 0;
    let previousScore: number | null = null;
    return sorted.map((p, i) => {
      if (p.score !== previousScore) rank = i + 1;
      previousScore = p.score;
      return { playerId: p.id, nickname: p.nickname, score: p.score, rank };
    });
  }

  // ---------- İç işleyiş ----------

  private get currentQuestion() {
    const q = this.quiz.questions[this.questionIndex];
    if (!q) throw new GameError('Soru bulunamadı');
    return q;
  }

  private get isLastQuestion() {
    return this.questionIndex >= this.quiz.questions.length - 1;
  }

  private openQuestion(index: number) {
    this.questionIndex = index;
    this.answers = new Map();
    for (const p of this.players.values()) p.lastResult = null;

    const limitMs = this.currentQuestion.timeLimitSec * 1000;
    this.questionStartedAt = Date.now();
    this.questionEndsAt = this.questionStartedAt + limitMs;

    this.clearTimer();
    this.timer = setTimeout(() => this.reveal(), limitMs);
    this.setPhase('QUESTION');
  }

  private reveal() {
    if (this._phase !== 'QUESTION') return;
    this.clearTimer();

    const question = this.currentQuestion;
    const correctId = this.correctChoiceId();
    const timeLimitMs = question.timeLimitSec * 1000;

    for (const player of this.players.values()) {
      const answer = this.answers.get(player.id);
      const correct = answer?.choiceId === correctId;
      const { points, streak } = calculateScore({
        correct,
        elapsedMs: answer?.elapsedMs ?? timeLimitMs,
        timeLimitMs,
        previousStreak: player.streak,
      });
      player.score += points;
      player.streak = streak;
      if (correct) player.correctCount += 1;
      player.lastResult = {
        answered: !!answer,
        correct,
        pointsEarned: points,
        totalScore: player.score,
        streak,
      };
    }
    this.setPhase('REVEAL');
  }

  private finish() {
    this.clearTimer();
    this.endedAt = new Date();
    this.setPhase('ENDED');
  }

  private setPhase(phase: GamePhase) {
    this._phase = phase;
    this.onChange(this);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private correctChoiceId(): string {
    const correct = this.currentQuestion.choices.find((c) => c.isCorrect);
    if (!correct) throw new GameError('Bu sorunun doğru cevabı tanımlı değil');
    return correct.id;
  }

  private publicQuestion(): PublicQuestion | null {
    if (this._phase === 'LOBBY' || this._phase === 'ENDED' || this._phase === 'LEADERBOARD') {
      return null;
    }
    const q = this.currentQuestion;
    return {
      index: this.questionIndex,
      total: this.quiz.questions.length,
      text: q.text,
      imageUrl: q.imageUrl,
      // isCorrect bilerek kopyalanmıyor.
      choices: q.choices.map((c) => ({ id: c.id, text: c.text })),
      timeLimitSec: q.timeLimitSec,
      endsAt: this.questionEndsAt,
    };
  }

  private revealInfo(): RevealInfo {
    const distribution: Record<string, number> = {};
    for (const c of this.currentQuestion.choices) distribution[c.id] = 0;
    for (const a of this.answers.values()) {
      distribution[a.choiceId] = (distribution[a.choiceId] ?? 0) + 1;
    }
    return { correctChoiceId: this.correctChoiceId(), distribution };
  }
}
