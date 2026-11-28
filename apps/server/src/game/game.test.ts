import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game, GameError, type GameChange, type GameQuiz } from './game';

const quiz: GameQuiz = {
  id: 'quiz-1',
  title: 'Deneme',
  questions: [
    {
      id: 'q1',
      text: '2 + 2 kaçtır?',
      imageUrl: null,
      timeLimitSec: 20,
      choices: [
        { id: 'q1a', text: '3', isCorrect: false },
        { id: 'q1b', text: '4', isCorrect: true },
      ],
    },
    {
      id: 'q2',
      text: 'Gökyüzü ne renktir?',
      imageUrl: null,
      timeLimitSec: 10,
      choices: [
        { id: 'q2a', text: 'Mavi', isCorrect: true },
        { id: 'q2b', text: 'Yeşil', isCorrect: false },
      ],
    },
  ],
};

let onChange: ReturnType<typeof vi.fn<(game: Game, change: GameChange) => void>>;
let game: Game;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  onChange = vi.fn<(game: Game, change: GameChange) => void>();
  game = new Game('123456', quiz, 'host-1', onChange);
});

afterEach(() => {
  game.dispose();
  vi.useRealTimers();
});

const join = (name: string) => game.addPlayer(name).playerId;

describe('lobi', () => {
  it('oyuncu ekler ve her değişikliği bildirir', () => {
    join('Ayşe');
    expect(game.hostView().players).toEqual([
      expect.objectContaining({ nickname: 'Ayşe', connected: true }),
    ]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('aynı takma adı büyük/küçük harf ve boşluk farkıyla da reddeder', () => {
    join('Işık');
    expect(() => join('  ışık ')).toThrow('Bu takma ad alınmış');
  });

  it('çok kısa veya uzun takma adı reddeder', () => {
    expect(() => join('A')).toThrow(GameError);
    expect(() => join('A'.repeat(17))).toThrow(GameError);
  });

  it('oyuncu olmadan başlamaz, başladıktan sonra katılıma izin vermez', () => {
    expect(() => game.start()).toThrow('en az bir oyuncu');
    join('Ayşe');
    game.start();
    expect(() => join('Geç Kalan')).toThrow('Oyun başladı');
  });

  it('token ile oyuncuyu bulur', () => {
    const { playerId, reconnectToken } = game.addPlayer('Ayşe');
    expect(game.findPlayerByToken(reconnectToken)).toBe(playerId);
    expect(game.findPlayerByToken('yanlis')).toBeNull();
  });
});

describe('soru akışı', () => {
  it('oyunculara doğru cevabı göndermez', () => {
    const id = join('Ayşe');
    game.start();
    const view = game.playerView(id)!;
    expect(view.phase).toBe('QUESTION');
    expect(view.correctChoiceId).toBeNull();
    expect(JSON.stringify(view)).not.toContain('isCorrect');
    expect(JSON.stringify(game.hostView())).not.toContain('isCorrect');
  });

  it('hıza göre puan verir ve herkes cevaplayınca süreyi beklemeden açıklar', () => {
    const ayse = join('Ayşe');
    const mehmet = join('Mehmet');
    game.start();

    vi.advanceTimersByTime(5_000); // 20 saniyenin 5'i geçti
    game.answer(ayse, 'q1b'); // doğru
    expect(game.phase).toBe('QUESTION');

    vi.advanceTimersByTime(5_000);
    game.answer(mehmet, 'q1a'); // yanlış
    expect(game.phase).toBe('REVEAL');

    expect(game.playerView(ayse)!.result).toEqual({
      answered: true,
      correct: true,
      pointsEarned: 750,
      totalScore: 750,
      streak: 1,
    });
    expect(game.playerView(mehmet)!.result).toMatchObject({ correct: false, pointsEarned: 0 });
    expect(game.hostView().reveal).toEqual({
      correctChoiceId: 'q1b',
      distribution: { q1a: 1, q1b: 1 },
    });
  });

  it('süre dolunca kendiliğinden açıklar, cevap vermeyene 0 puan verir', () => {
    const ayse = join('Ayşe');
    game.start();
    vi.advanceTimersByTime(20_000);
    expect(game.phase).toBe('REVEAL');
    expect(game.playerView(ayse)!.result).toMatchObject({ answered: false, pointsEarned: 0 });
  });

  it('bağlantısı kopan oyuncuyu beklemez', () => {
    const ayse = join('Ayşe');
    const mehmet = join('Mehmet');
    game.start();
    game.setPlayerConnected(mehmet, false);
    game.answer(ayse, 'q1b');
    expect(game.phase).toBe('REVEAL');
  });

  it('cevap vermemiş son oyuncunun bağlantısı kopunca süreyi beklemeden açıklar', () => {
    const ayse = join('Ayşe');
    const mehmet = join('Mehmet');
    game.start();
    game.answer(ayse, 'q1b');
    expect(game.phase).toBe('QUESTION');
    game.setPlayerConnected(mehmet, false);
    expect(game.phase).toBe('REVEAL');
  });

  it('herkesin bağlantısı koparsa (ör. kısa bir ağ kesintisi) süre dolana kadar bekler', () => {
    const ayse = join('Ayşe');
    game.start();
    game.setPlayerConnected(ayse, false);
    expect(game.phase).toBe('QUESTION');
    game.setPlayerConnected(ayse, true);
    game.answer(ayse, 'q1b');
    expect(game.phase).toBe('REVEAL');
  });

  it('bir cevabı sadece o oyuncuyu etkileyen değişiklik olarak bildirir', () => {
    const ayse = join('Ayşe');
    join('Mehmet');
    game.start();
    onChange.mockClear();
    game.answer(ayse, 'q1b');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(game, { type: 'answer', playerId: ayse });
  });

  it('sıralama puanlar ve oyuncular değiştikçe güncellenir', () => {
    const ayse = join('Ayşe');
    const mehmet = join('Mehmet');
    expect(game.leaderboard().map((e) => e.rank)).toEqual([1, 1]);
    game.start();
    game.answer(mehmet, 'q1b');
    game.answer(ayse, 'q1a');
    expect(game.leaderboard()[0]).toMatchObject({ playerId: mehmet, rank: 1 });
    expect(game.playerView(ayse)!.me.rank).toBe(2);
    expect(game.playerView(mehmet)!.me.rank).toBe(1);
  });

  it('ikinci cevabı, geçersiz şıkkı ve süre sonrası cevabı reddeder', () => {
    const ayse = join('Ayşe');
    const mehmet = join('Mehmet');
    game.start();
    expect(() => game.answer(ayse, 'baska-sorunun-sikki')).toThrow('Geçersiz şık');
    game.answer(ayse, 'q1a');
    expect(() => game.answer(ayse, 'q1b')).toThrow('zaten cevap');

    // Zamanlayıcı tetiklenmeden hemen önce saat süreyi geçmiş olabilir.
    vi.setSystemTime(Date.now() + 20_001);
    expect(() => game.answer(mehmet, 'q1b')).toThrow('Süre doldu');
  });

  it('cevap açıklandıktan sonra sıralamaya, sonra sonraki soruya geçer; son sorudan sonra biter', () => {
    const ayse = join('Ayşe');
    game.start();
    game.answer(ayse, 'q1b');
    expect(game.phase).toBe('REVEAL');

    game.next();
    expect(game.phase).toBe('LEADERBOARD');
    expect(game.playerView(ayse)!.leaderboard[0]).toMatchObject({ nickname: 'Ayşe', rank: 1 });

    game.next();
    expect(game.phase).toBe('QUESTION');
    expect(game.hostView().question).toMatchObject({ index: 1, total: 2 });
    expect(game.playerView(ayse)!.myChoiceId).toBeNull();

    game.answer(ayse, 'q2a');
    game.next(); // son sorudan sonra sıralama atlanır
    expect(game.phase).toBe('ENDED');
    expect(game.endedAt).toBeInstanceOf(Date);
    expect(() => game.next()).toThrow('Oyun bitti');
  });

  it('seri bonusu ekler ve eşit puanlılara aynı sırayı verir', () => {
    const ayse = join('Ayşe');
    const bora = join('Bora');
    const cem = join('Cem');
    game.start();
    game.answer(ayse, 'q1b');
    game.answer(bora, 'q1b');
    game.answer(cem, 'q1a');
    game.next();
    game.next();
    game.answer(ayse, 'q2a');
    game.answer(bora, 'q2a');
    game.answer(cem, 'q2a');

    // İkinci doğru cevapta 100 seri bonusu: 1000 + 1000 + 100
    expect(game.playerView(ayse)!.me.score).toBe(2100);
    const board = game.leaderboard();
    expect(board.map((e) => [e.nickname, e.rank])).toEqual([
      ['Ayşe', 1],
      ['Bora', 1],
      ['Cem', 3],
    ]);
    expect(game.finalResults()[0]).toMatchObject({ correctCount: 2 });
  });

  it('soru sırasında "devam" süreyi beklemeden açıklar, erken bitirme oyunu kapatır', () => {
    join('Ayşe');
    game.start();
    game.next();
    expect(game.phase).toBe('REVEAL');
    game.end();
    expect(game.phase).toBe('ENDED');
  });
});

describe('soru istatistikleri', () => {
  it('her açıklanan soru için cevap, doğru sayısı ve ortalama doğru süresini kaydeder', () => {
    const ayse = join('Ayşe');
    const mehmet = join('Mehmet');
    join('Cem');
    game.start();

    vi.advanceTimersByTime(4_000);
    game.answer(ayse, 'q1b'); // doğru, 4 sn
    vi.advanceTimersByTime(2_000);
    game.answer(mehmet, 'q1b'); // doğru, 6 sn
    vi.advanceTimersByTime(14_000); // Cem cevap vermedi, süre doldu
    expect(game.phase).toBe('REVEAL');

    expect(game.questionStats()).toEqual([
      {
        text: '2 + 2 kaçtır?',
        correctChoice: '4',
        playerCount: 3,
        answered: 2,
        correct: 2,
        avgCorrectMs: 5_000,
      },
    ]);
  });

  it('kimse doğru bilmezse ortalama süre boş kalır, erken bitirilen oyunda sadece oynanan sorular olur', () => {
    const ayse = join('Ayşe');
    game.start();
    game.answer(ayse, 'q1a'); // yanlış
    game.end();

    const stats = game.questionStats();
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ answered: 1, correct: 0, avgCorrectMs: null });
  });
});

describe('oyuncu çıkarma', () => {
  it('lobideki oyuncuyu çıkarır, aynı takma ad tekrar kullanılabilir', () => {
    const ayse = join('Ayşe');
    join('Mehmet');
    game.kickPlayer(ayse);
    expect(game.hostView().players.map((p) => p.nickname)).toEqual(['Mehmet']);
    expect(game.playerView(ayse)).toBeNull();
    expect(() => join('Ayşe')).not.toThrow();
  });

  it('oyun başladıktan sonra veya olmayan oyuncuyu çıkarmaz', () => {
    const ayse = join('Ayşe');
    expect(() => game.kickPlayer('olmayan')).toThrow('Oyuncu bulunamadı');
    game.start();
    expect(() => game.kickPlayer(ayse)).toThrow('sadece lobide');
  });
});
