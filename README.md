# Canlı Quiz

Gerçek zamanlı, çok oyunculu bir quiz platformu. Sunucu bir quiz başlatır, oyuncular telefonlarından
6 haneli PIN ile katılır, sorular herkese aynı anda gider ve cevap hızına göre puan kazanılır.

> 🚧 Geliştirme aşamasında: oyun baştan sona oynanabiliyor. Sırada arayüz cilası ve deploy var.

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

## Hızlı quiz ve soru bankası

Soru yazmak istemeyenler için 14 kategoride 573 soruluk (her kategoride en az 40) bir banka var: Genel Kültür, Futbol,
Sinema, Dizi, Oyunlar, Counter-Strike 2, League of Legends, Tarih, Türkçe Müzik, Anime, Yemek ve
Mutfak, Coğrafya, Mitoloji ve Hayvanlar. Kullanıcı kategori, soru sayısı ve zorluk seçer; sorular rastgele seçilip hesabına quiz olarak
eklenir.

- Birden fazla kategori seçilirse sorular kategoriler arasında dengeli dağıtılır.
- Şıkların sırası her seferinde karıştırılır; doğru cevap hep aynı yerde olmaz.
- Zor sorulara 30, diğerlerine 20 saniye verilir.
- Zamanla değişebilecek bilgiler (güncel şampiyonlar, rekorlar, oyun yamalarıyla değişen
  değerler) bilerek sorulmaz.
- Yeni kategori eklemek için `apps/server/src/bank/categories/` altına bir dosya yazıp
  `bank/index.ts` içindeki listeye eklemek yeterli. Bütünlük testleri boş ya da tekrar eden
  şıkları, aynı sorunun iki kez yazılmasını ve uzunluk sınırlarını CI'da yakalar.

## Oyun motoru

- Oyun akışı bir durum makinesidir: `LOBBY → QUESTION → REVEAL → LEADERBOARD → … → ENDED`.
  Kurallar [`apps/server/src/game/game.ts`](apps/server/src/game/game.ts) içinde, soket ve
  veritabanından bağımsızdır; bu sayede sahte saatle birim testleri yazılabilir.
- **Zamanı sunucu ölçer.** Cevap süresi, sorunun sunucuda açıldığı andan itibaren hesaplanır;
  süre dolduktan sonra gelen cevap reddedilir. Telefonların saati farklı olabileceği için her
  mesajda sunucu saati (`serverNow`) gönderilir ve geri sayım bu farka göre gösterilir.
- **Doğru cevap, açıklanana kadar istemciye hiç gönderilmez.** Tarayıcı araçlarıyla bakan biri de
  göremez.
- **Durum yerine görünüm gönderilir.** Her değişiklikte sunucu ekranına ve her oyuncuya kendi
  rolüne özel tam bir görünüm gider. Bağlantısı kopup dönen biri tek mesajla kaldığı yere gelir.
- **Yeniden bağlanma:** oyuncu katılırken tahmin edilemez bir token alır; sayfayı yenilese veya
  telefonu kilitlense de bu token ile aynı oyuncu olarak döner. Sunucu ekranı da yenilenince
  oyununa geri bağlanır; 5 dakika dönmezse oyun kapanır ve oyunculara bildirilir.
- Herkes cevap verince süre beklenmeden cevap açıklanır; bağlantısı kopan oyuncular beklenmez.
- Biten oyunların sonuçları veritabanına kaydedilir.

## Socket olayları

| Olay            | Yön              | Açıklama                                                  |
| --------------- | ---------------- | --------------------------------------------------------- |
| `host:create`   | Sunucu → backend | Giriş yapmış kullanıcı oyun açar, PIN döner               |
| `host:rejoin`   | Sunucu → backend | Yenilenen sunucu ekranı oyununa döner                     |
| `host:start`    | Sunucu → backend | Oyun başlar                                               |
| `host:next`     | Sunucu → backend | Sonraki aşama (soru sırasında: cevabı göster)             |
| `host:end`      | Sunucu → backend | Oyunu erkenden bitirir                                    |
| `player:join`   | Oyuncu → backend | PIN ve takma adla katılım, yeniden bağlanma token'ı döner |
| `player:rejoin` | Oyuncu → backend | Token ile kaldığı yere dönüş                              |
| `player:answer` | Oyuncu → backend | Cevap gönderilir                                          |
| `host:view`     | Backend → sunucu | Sunucu ekranının tam görünümü                             |
| `player:view`   | Backend → oyuncu | Oyuncunun kendi görünümü                                  |
| `game:closed`   | Backend → oyuncu | Sunucu ayrıldığı için oyun kapandı                        |

Tipler: [`packages/shared/src/events.ts`](packages/shared/src/events.ts),
[`packages/shared/src/types.ts`](packages/shared/src/types.ts)

## Puanlama

`puan = 1000 × (kalan süre / toplam süre) + seri bonusu`. Seri bonusu, üst üste her doğru
cevap için 100 puandır ve en fazla 500 olabilir. Ayrıntılar:
[`packages/shared/src/scoring.ts`](packages/shared/src/scoring.ts)

## Kurulum

Gereksinim: Node.js 24 veya üstü. Docker gerekmez.

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
| GET    | `/api/bank/categories`  | -       | Soru bankası kategorileri ve soru sayıları          |
| POST   | `/api/bank/quick-quiz`  | Giriş   | Bankadan rastgele quiz oluşturur                    |

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
- [x] 3-4. hafta: oyun motoru (lobi, durum makinesi, sunucu taraflı zamanlama, yeniden bağlanma)
- [ ] 5. hafta: arayüz, animasyonlar, sonuç geçmişi
- [ ] 6. hafta: testler, yük testi, Redis ile ölçekleme, deploy
