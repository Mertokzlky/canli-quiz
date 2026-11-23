// Hazır demo quizleri ekler. Tekrar çalıştırılabilir: demo quizleri silip yeniden yazar.
// Çalıştırmak için: npm run db:seed -w @canli-quiz/server

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@canliquiz.local';

type SeedQuestion = [text: string, timeLimitSec: number, choices: string[], correctIndex: number];

const quizzes: { title: string; description: string; questions: SeedQuestion[] }[] = [
  {
    title: 'Genel Kültür',
    description: 'Herkesin katılabileceği karışık sorular.',
    questions: [
      ["Türkiye'nin başkenti hangi şehirdir?", 10, ['İstanbul', 'Ankara', 'İzmir', 'Bursa'], 1],
      [
        'Güneş sistemindeki en büyük gezegen hangisidir?',
        20,
        ['Mars', 'Satürn', 'Jüpiter', 'Neptün'],
        2,
      ],
      [
        '"Mona Lisa" tablosunun ressamı kimdir?',
        20,
        ['Leonardo da Vinci', 'Michelangelo', 'Van Gogh', 'Picasso'],
        0,
      ],
      ["Suyun deniz seviyesinde kaynama noktası kaç °C'dir?", 10, ['90', '100', '110', '120'], 1],
      ['Hangisi bir memeli hayvandır?', 20, ['Köpek balığı', 'Yunus', 'Penguen', 'Timsah'], 1],
      ['Bir yılda kaç ay 31 gün çeker?', 20, ['5', '6', '7', '8'], 2],
    ],
  },
  {
    title: 'Yazılım Temelleri',
    description: 'Web, Git ve algoritmalar üzerine sorular.',
    questions: [
      [
        'HTML kısaltmasındaki "M" harfi neyi ifade eder?',
        20,
        ['Machine', 'Markup', 'Module', 'Method'],
        1,
      ],
      [
        "Git'te commit'leri uzak depoya göndermek için hangi komut kullanılır?",
        20,
        ['git pull', 'git push', 'git commit', 'git fetch'],
        1,
      ],
      ['Hangisi bir NoSQL veritabanıdır?', 20, ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'], 2],
      [
        'HTTP 404 durum kodu ne anlama gelir?',
        10,
        ['Sunucu hatası', 'Bulunamadı', 'Yetkisiz', 'Başarılı'],
        1,
      ],
      [
        "JavaScript'te typeof null ifadesi ne döner?",
        30,
        ['"null"', '"undefined"', '"object"', '"number"'],
        2,
      ],
      [
        'İkili aramanın (binary search) zaman karmaşıklığı nedir?',
        30,
        ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'],
        1,
      ],
    ],
  },
  {
    title: 'Türkiye Coğrafyası',
    description: 'Dağlar, göller, nehirler ve bölgeler.',
    questions: [
      [
        "Türkiye'nin en yüksek dağı hangisidir?",
        20,
        ['Erciyes', 'Ağrı Dağı', 'Uludağ', 'Süphan Dağı'],
        1,
      ],
      [
        "Türkiye'nin yüzölçümü en büyük gölü hangisidir?",
        20,
        ['Tuz Gölü', 'Van Gölü', 'Beyşehir Gölü', 'Eğirdir Gölü'],
        1,
      ],
      ["Türkiye'de kaç il vardır?", 10, ['79', '80', '81', '82'], 2],
      [
        'Kızılırmak, tamamı Türkiye sınırları içinde kalan en uzun nehirdir.',
        10,
        ['Doğru', 'Yanlış'],
        0,
      ],
      [
        "Hangisi Karadeniz Bölgesi'nde yer alan bir ildir?",
        20,
        ['Konya', 'Rize', 'Muğla', 'Edirne'],
        1,
      ],
      [
        'Kapadokya hangi coğrafi bölgededir?',
        20,
        ['İç Anadolu', 'Ege', 'Akdeniz', 'Doğu Anadolu'],
        0,
      ],
    ],
  },
];

async function main() {
  // Demo hesabıyla giriş yapılamaz: şifresi rastgele ve kimseyle paylaşılmaz.
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      displayName: 'Canlı Quiz',
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
    },
  });

  await prisma.quiz.deleteMany({ where: { ownerId: demoUser.id } });

  for (const quiz of quizzes) {
    await prisma.quiz.create({
      data: {
        title: quiz.title,
        description: quiz.description,
        isPublic: true,
        ownerId: demoUser.id,
        questions: {
          create: quiz.questions.map(([text, timeLimitSec, choices, correctIndex], order) => ({
            order,
            text,
            timeLimitSec,
            choices: {
              create: choices.map((choiceText, i) => ({
                order: i,
                text: choiceText,
                isCorrect: i === correctIndex,
              })),
            },
          })),
        },
      },
    });
  }

  console.log(`${quizzes.length} demo quiz eklendi.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
