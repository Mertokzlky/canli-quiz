# Canlı Quiz

Gerçek zamanlı, çok oyunculu bir quiz platformu. Sunucu bir quiz başlatır, oyuncular telefonlarından
6 haneli PIN ile katılır, sorular herkese aynı anda gider ve cevap hızına göre puan kazanılır.

> 🚧 Geliştirme aşamasında: 1. hafta (temel kurulum) tamamlandı.

## Teknolojiler

| Katman            | Teknoloji                                    |
| ----------------- | -------------------------------------------- |
| Frontend          | React, TypeScript, Vite, Tailwind CSS        |
| Gerçek zamanlı    | Socket.io                                    |
| Backend           | Node.js, Express, TypeScript                 |
| Veritabanı        | PostgreSQL, Prisma                           |
| Anlık oyun durumu | Bellek içi, ölçeklemede Redis                |
| Araçlar           | npm workspaces, ESLint, Prettier, Vitest, CI |

## Mimari

```
[Sunucu ekranı (React)] ─┐
                         ├── Socket.io ──► [Node sunucusu] ──► Redis (anlık oyun durumu)
[Oyuncu telefonları] ────┘                       │
                                                 └──► PostgreSQL (quizler, sonuçlar)
```

Zamanlama ve puanlama tamamen sunucuda yapılır; istemcinin gönderdiği zamana güvenilmez.

## Proje yapısı

```
apps/
  web/       React arayüzü (sunucu ekranı ve oyuncu ekranı)
  server/    Express + Socket.io backend, Prisma şeması
packages/
  shared/    Ortak tipler, socket olayları, puanlama mantığı
```

## Socket olayları

| Olay               | Yön              | Açıklama                            |
| ------------------ | ---------------- | ----------------------------------- |
| `host:create`      | Sunucu → backend | Oyun açılır, PIN döner              |
| `host:start`       | Sunucu → backend | Oyun başlar                         |
| `host:next`        | Sunucu → backend | Sonraki aşamaya geçilir             |
| `player:join`      | Oyuncu → backend | PIN ve takma adla katılım           |
| `player:rejoin`    | Oyuncu → backend | Bağlantı koptuktan sonra geri dönüş |
| `player:answer`    | Oyuncu → backend | Cevap gönderilir                    |
| `lobby:update`     | Backend → herkes | Lobideki oyuncu listesi             |
| `game:question`    | Backend → herkes | Soru ve bitiş zamanı                |
| `game:reveal`      | Backend → herkes | Doğru cevap ve şık dağılımı         |
| `player:result`    | Backend → oyuncu | Oyuncunun kendi sonucu              |
| `game:leaderboard` | Backend → herkes | Sıralama                            |
| `game:end`         | Backend → herkes | Final sonuçları                     |

Tipler: [`packages/shared/src/events.ts`](packages/shared/src/events.ts)

## Puanlama

`puan = 1000 × (kalan süre / toplam süre) + seri bonusu`. Seri bonusu, üst üste her doğru
cevap için 100 puandır ve en fazla 500 olabilir. Ayrıntılar:
[`packages/shared/src/scoring.ts`](packages/shared/src/scoring.ts)

## Kurulum

Gereksinim: Node.js 20.19 veya üstü.

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000/health

Veritabanı için yerel PostgreSQL, `docker compose up -d` ya da Neon'un ücretsiz katmanı
kullanılabilir. `DATABASE_URL` ayarlandıktan sonra:

```bash
npm run db:migrate -w @canli-quiz/server
```

## Komutlar

| Komut               | Açıklama                            |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Backend ve frontend'i birlikte açar |
| `npm test`          | Testleri çalıştırır                 |
| `npm run lint`      | ESLint                              |
| `npm run typecheck` | TypeScript kontrolü                 |
| `npm run build`     | Üretim derlemesi                    |

## Yol haritası

- [x] 1. hafta: monorepo, veri modeli, socket olayları, CI
- [ ] 2. hafta: kimlik doğrulama ve quiz editörü
- [ ] 3-4. hafta: oyun motoru (lobi, durum makinesi, sunucu taraflı zamanlama, yeniden bağlanma)
- [ ] 5. hafta: arayüz, animasyonlar, sonuç geçmişi
- [ ] 6. hafta: testler, yük testi, Redis ile ölçekleme, deploy
