# Canlı Quiz

Gerçek zamanlı, çok oyunculu bir quiz platformu. Sunucu bir quiz başlatır, oyuncular telefonlarından
6 haneli PIN ile katılır, sorular herkese aynı anda gider ve cevap hızına göre puan kazanılır.

> 🚧 Geliştirme aşamasında: oyun baştan sona oynanabiliyor. Sırada internete açma (deploy) var.

## Teknolojiler

| Katman            | Teknoloji                                    |
| ----------------- | -------------------------------------------- |
| Frontend          | React, TypeScript, Vite, Tailwind CSS        |
| Gerçek zamanlı    | Socket.io                                    |
| Backend           | Node.js, Express, TypeScript                 |
| Veritabanı        | PostgreSQL, Prisma                           |
| Anlık oyun durumu | Sunucu belleği                               |
| Araçlar           | npm workspaces, ESLint, Prettier, Vitest, CI |

## Mimari

```
[Sunucu ekranı (React)] ─┐
                         ├── Socket.io ──► [Node sunucusu: oyun durumu bellekte]
[Oyuncu telefonları] ────┘                       │
                                                 └──► PostgreSQL (quizler, sonuçlar)
```

Devam eden oyunlar sunucunun belleğinde tutulur; veritabanına sadece biten oyunların sonuçları
yazılır. Tek bir sunucu 500 oyunculu bir oyunu rahatça taşır (bkz. "Oyun motoru"). Birden fazla
sunucuya geçmek gerekirse oyun durumu Redis gibi ortak bir yere taşınabilir.

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

Soru yazmak istemeyenler için 14 kategoride 713 soruluk (her kategoride en az 50 soru, bunların en az 15'i zor) bir banka var: Genel Kültür, Futbol,
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

## Oyun deneyimi

- **QR kod ile katılım:** lobide gösterilen QR kod oyuncuyu doğrudan takma ad ekranına götürür.
  Kod tarayıcıda üretilir; bağlantı hiçbir dış servise gönderilmez.
- **Lobiden çıkarma:** sunucu, uygunsuz takma adlı bir oyuncuyu tek tıkla çıkarabilir.
- **Soru görselleri:** editörde bir görsel bağlantısı eklenebilir; sadece `http(s)` adreslerine
  izin verilir, görsel yüklenemezse oyun aksamaz. Görseller referrer bilgisi gönderilmeden yüklenir.
- **Sesler ve titreşim:** ses dosyası yerine Web Audio ile üretilir (telif ve indirme yok); açılıp
  kapatılabilir. Telefonda doğru/yanlış cevapta titreşim olur.
- **Animasyonlar:** işletim sisteminde "hareketi azalt" açıksa kayma ve büyüme efektleri kapanır.
- **Ekran açık kalır:** sunucu ekranı oyun boyunca uykuya geçmez (Wake Lock).
- **Oyun geçmişi:** biten oyunların sonuçları ve soru bazında istatistikler (doğru oranı, en zor
  soru, ortalama cevap süresi). Quiz sonradan silinse de geçmiş kalır.
- **Parçalı yükleme:** sayfalar ihtiyaç duyuldukça yüklenir; telefondan katılan oyuncu editör ya da
  panel kodunu indirmez.

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
- **Kalabalık oyunlar için:** bir oyuncunun cevabı sadece sunucu ekranını ve o oyuncunun ekranını
  günceller; sıralama sadece puanlar değişince bir kez hesaplanıp önbellekte tutulur. İlk sürümde
  her cevapta tüm oyunculara görünüm üretiliyordu ve 500 oyunculu bir soruda sunucu 30 saniyede
  ancak 184 cevabı işleyebiliyordu; şimdi 500 cevabın tamamı yaklaşık 60 ms'de işleniyor.
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
| `host:kick`     | Sunucu → backend | Lobideki bir oyuncuyu çıkarır                             |
| `host:end`      | Sunucu → backend | Oyunu erkenden bitirir                                    |
| `player:join`   | Oyuncu → backend | PIN ve takma adla katılım, yeniden bağlanma token'ı döner |
| `player:rejoin` | Oyuncu → backend | Token ile kaldığı yere dönüş                              |
| `player:answer` | Oyuncu → backend | Cevap gönderilir                                          |
| `host:view`     | Backend → sunucu | Sunucu ekranının tam görünümü                             |
| `player:view`   | Backend → oyuncu | Oyuncunun kendi görünümü                                  |
| `game:closed`   | Backend → oyuncu | Oyun kapandı veya oyuncu çıkarıldı                        |

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

npm run db:start -w @canli-quiz/server     # yerel PostgreSQL 17'yi oluşturur ve başlatır
npm run db:deploy -w @canli-quiz/server    # tabloları oluşturur
npm run db:seed -w @canli-quiz/server      # hazır demo quizleri ekler

npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000/health

Yerel veritabanı, [embedded-postgres](https://github.com/leinelissen/embedded-postgres) paketiyle
gelen gerçek PostgreSQL 17'dir; kurulum, Docker veya yönetici izni gerekmez
(`apps/server/scripts/db.mjs`). `npm run dev` önce onu kontrol eder: açıksa dokunmaz, kapalıysa
5433 portunda arka planda başlatır. Veriler `%LOCALAPPDATA%\canli-quiz` (macOS/Linux'ta kullanıcının
uygulama verisi klasörü) altında durur. Windows'ta PostgreSQL Türkçe karakterli yollarla
çalışamadığı için veriler proje klasöründe tutulmaz.

| Komut (`-w @canli-quiz/server` ile) | Açıklama                              |
| ----------------------------------- | ------------------------------------- |
| `npm run db:start`                  | Veritabanını başlatır                 |
| `npm run db:stop`                   | Veritabanını düzgünce durdurur        |
| `npm run db:status`                 | Çalışıp çalışmadığını gösterir        |
| `npm run db:migrate`                | Şema değişikliği için yeni migration  |
| `npm run db:studio`                 | Verileri tarayıcıda gösterir (Prisma) |

Yerel veritabanı yerine Neon'un ücretsiz katmanı ya da başka bir PostgreSQL de kullanılabilir;
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
| GET    | `/api/games`            | Giriş   | Sunucusu olunan biten oyunlar                       |
| GET    | `/api/games/:id`        | Sahibi  | Oyun sonuçları ve soru bazında istatistikler        |
| DELETE | `/api/games/:id`        | Sahibi  | Oyun kaydını siler                                  |

Güvenlik notları:

- Şifreler bcrypt ile saklanır; giriş ve kayıt adreslerinde IP başına deneme sınırı vardır.
- Hatalı giriş mesajı, e-postanın kayıtlı olup olmadığını belli etmez.
- Gizli quizler sahibi dışındakilere 404 döner, varlıkları sızmaz. Herkese açık bir quizin
  doğru cevapları API'de gösterilmez, ama quizi kopyalayan kişi kopyada cevapları görür; editör
  bunu açıkça söyler.
- Socket olaylarında kötüye kullanıma karşı sınırlar vardır: bağlantı başına olay sınırı, IP başına
  katılma ve hatalı PIN sınırı (6 haneli PIN'ler deneme yanılmayla taranamaz) ve aynı bağlantının
  aynı oyuna ikinci kez katılamaması.
- Bir ara sunucunun arkasında (ör. Render) çalışırken `TRUST_PROXY=1` ayarlanır; böylece sınırlar
  gerçek istemci IP'sine göre uygulanır. Ayarlanmazsa `X-Forwarded-For` başlığına güvenilmez.
- Girdi doğrulama kuralları (`packages/shared/src/schemas.ts`) hem frontend'de hem backend'de
  aynı Zod şemasıyla çalışır.

## Komutlar

| Komut               | Açıklama                                   |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Veritabanını, backend'i ve frontend'i açar |
| `npm test`          | Testleri çalıştırır                        |
| `npm run lint`      | ESLint                                     |
| `npm run typecheck` | TypeScript kontrolü                        |
| `npm run build`     | Üretim derlemesi                           |

## Yol haritası

- [x] 1. hafta: monorepo, veri modeli, socket olayları, CI
- [x] 2. hafta: kimlik doğrulama, quiz editörü, hazır demo quizler, API testleri
- [x] 3-4. hafta: oyun motoru (lobi, durum makinesi, sunucu taraflı zamanlama, yeniden bağlanma)
- [x] 5. hafta: QR kod, soru görselleri, sesler, animasyonlar, oyun geçmişi ve istatistikler
- [ ] 6. hafta: deploy, yük testi, gerekirse Redis ile ölçekleme

## Lisans

[MIT](LICENSE)
