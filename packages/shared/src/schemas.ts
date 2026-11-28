import { z } from 'zod';
import { MAX_CHOICES, MIN_CHOICES, QUESTION_TIME_LIMITS } from './constants';
import { cleanName, MAX_PASSWORD_BYTES, utf8Length } from './text';

// Bu şemalar hem backend'de (güvenlik) hem frontend'de (anlık form hataları) kullanılır.

export const MAX_QUESTIONS_PER_QUIZ = 50;
export const MAX_IMAGE_URL_LENGTH = 500;

export const registerSchema = z.object({
  email: z.email('Geçerli bir e-posta girin').trim().toLowerCase(),
  password: z
    .string()
    .min(8, 'Şifre en az 8 karakter olmalı')
    .refine((p) => utf8Length(p) <= MAX_PASSWORD_BYTES, {
      message: 'Şifre çok uzun (en fazla 72 harf; ç, ğ, ı, ö, ş, ü gibi harfler 2 sayılır)',
    }),
  displayName: z
    .string()
    .transform(cleanName)
    .pipe(
      z
        .string()
        .min(2, 'İsim en az 2 karakter olmalı')
        .max(40, 'İsim en fazla 40 karakter olabilir'),
    ),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email('Geçerli bir e-posta girin').trim().toLowerCase(),
  password: z.string().min(1, 'Şifre gerekli'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const choiceInputSchema = z.object({
  text: z.string().trim().min(1, 'Şık boş olamaz').max(80, 'Şık en fazla 80 karakter olabilir'),
  isCorrect: z.boolean(),
});

export const questionInputSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, 'Soru metni boş olamaz')
      .max(200, 'Soru en fazla 200 karakter olabilir'),
    // Sadece http(s): "javascript:" ya da "data:" gibi adresler görsel olarak gösterilmez.
    imageUrl: z
      .url({ protocol: /^https?$/, message: 'Görsel adresi http:// veya https:// ile başlamalı' })
      .max(MAX_IMAGE_URL_LENGTH, `Görsel adresi en fazla ${MAX_IMAGE_URL_LENGTH} karakter olabilir`)
      .nullable()
      .optional(),
    timeLimitSec: z
      .number()
      .refine((v) => (QUESTION_TIME_LIMITS as readonly number[]).includes(v), {
        message: `Süre ${QUESTION_TIME_LIMITS.join(', ')} saniyeden biri olmalı`,
      }),
    choices: z
      .array(choiceInputSchema)
      .min(MIN_CHOICES, `En az ${MIN_CHOICES} şık olmalı`)
      .max(MAX_CHOICES, `En fazla ${MAX_CHOICES} şık olabilir`),
  })
  .refine((q) => q.choices.filter((c) => c.isCorrect).length === 1, {
    message: 'Tam olarak bir doğru cevap seçilmeli',
    path: ['choices'],
  });

export const quizInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Başlık gerekli')
    .max(100, 'Başlık en fazla 100 karakter olabilir'),
  description: z
    .string()
    .trim()
    .max(300, 'Açıklama en fazla 300 karakter olabilir')
    .nullable()
    .optional(),
  isPublic: z.boolean().default(false),
  questions: z
    .array(questionInputSchema)
    .min(1, 'En az bir soru ekleyin')
    .max(MAX_QUESTIONS_PER_QUIZ, `En fazla ${MAX_QUESTIONS_PER_QUIZ} soru eklenebilir`),
});
export type QuizInput = z.input<typeof quizInputSchema>;
export type QuizInputParsed = z.output<typeof quizInputSchema>;

// ---------- Hızlı quiz (soru bankasından rastgele) ----------

export const BANK_DIFFICULTIES = ['kolay', 'orta', 'zor'] as const;
export type BankDifficulty = (typeof BANK_DIFFICULTIES)[number];

export const QUICK_QUIZ_SIZES = [5, 10, 15, 20] as const;

export const quickQuizSchema = z.object({
  categories: z
    .array(z.string().min(1).max(40))
    .min(1, 'En az bir kategori seçin')
    .max(20, 'En fazla 20 kategori seçilebilir'),
  questionCount: z
    .number()
    .int()
    .min(1, 'En az 1 soru seçin')
    .max(MAX_QUESTIONS_PER_QUIZ, `En fazla ${MAX_QUESTIONS_PER_QUIZ} soru seçilebilir`),
  difficulty: z.enum(['karisik', ...BANK_DIFFICULTIES]).default('karisik'),
});
export type QuickQuizInput = z.input<typeof quickQuizSchema>;
