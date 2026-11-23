# Canlı Quiz

Gerçek zamanlı, çok oyunculu bir quiz platformu. Sunucu bir quiz başlatır, oyuncular telefonlarından
6 haneli PIN ile katılır, sorular herkese aynı anda gider ve cevap hızına göre puan kazanılır.

> 🚧 Geliştirme aşamasında: kimlik doğrulama ve quiz editörü hazır, oyun motoru sırada.

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

Gereksinim: Node.js 20.19 veya üstü. Docker gerekmez.

```bash
npm install
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

npm run db:start -w @canli-quiz/server     # kurulum gerektirmeyen yerel PostgreSQL
npm run db:migrate -w @canli-quiz/server   # tabloları oluşturur
npm run db:seed -w @canli-quiz/server      # hazır demo quizleri ekler

npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000/health

Yerel veritabanı yerine `docker compose up -d` ya da Neon'un ücretsiz katmanı da kullanılabilir;
bunun için `apps/server/.env` içindeki `DATABASE_URL` değiştirilir.

## REST API

| Metot  | Adres                   | Yetki   | Açıklama                                            |
| ------ | ----------------------- | ------- | --------------------------------------------------- |
| POST   | `/api/auth/register`    | -       | Kayıt olur, token döner                             |
| POST   | `/api/auth/login`       | -       | Giriş yapar, token döner                            |
| GET    | `/api/auth/me`          | Giriş   | Oturumdaki kullanıcı                                |
| GET    | `/api/quizzes`          | Giriş   | Kullanıcının quizleri                               |
| GET    | `/api/quizzes/public`   | -       | Herkese açık quizler                                |
| GET    | `/api/quizzes/:id`      | -/Giriş | Quiz ayrıntısı; doğru cevaplar sadece sahibine      |
| POST   | `/api/quizzes`          | Giriş   | Quiz oluşturur                                      |
| PUT    | `/api/quizzes/:id`      | Sahibi  | Quizi bütün olarak günceller                        |
| DELETE | `/api/quizzes/:id`      | Sahibi  | Quizi siler                                         |
| POST   | `/api/quizzes/:id/copy` | Giriş   | Okunabilen bir quizi kullanıcının hesabına kopyalar |

Güvenlik notları:

- Şifreler bcrypt ile saklanır; giriş ve kayıt adreslerinde IP başına deneme sınırı vardır.
- Hatalı giriş mesajı, e-postanın kayıtlı olup olmadığını belli etmez.
- Gizli quizler sahibi dışındakilere 404 döner, varlıkları sızmaz.
- Girdi doğrulama kuralları (`packages/shared/src/schemas.ts`) hem frontend'de hem backend'de
  aynı Zod şemasıyla çalışır.

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
- [x] 2. hafta: kimlik doğrulama, quiz editörü, hazır demo quizler, API testleri
- [ ] 3-4. hafta: oyun motoru (lobi, durum makinesi, sunucu taraflı zamanlama, yeniden bağlanma)
- [ ] 5. hafta: arayüz, animasyonlar, sonuç geçmişi
- [ ] 6. hafta: testler, yük testi, Redis ile ölçekleme, deploy
