import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  MAX_CHOICES,
  MAX_QUESTIONS_PER_QUIZ,
  MIN_CHOICES,
  QUESTION_TIME_LIMITS,
  quizInputSchema,
  type QuizDetail,
} from '@canli-quiz/shared';
import { ImageUrlField } from '../components/ImageUrlField';
import { Alert, Button, FieldError, Spinner, TextField } from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { zodFieldErrors } from '../lib/errors';

// Editördeki her öğenin React listeleri için sabit bir anahtarı olur.
interface ChoiceDraft {
  key: string;
  text: string;
  isCorrect: boolean;
}
interface QuestionDraft {
  key: string;
  text: string;
  imageUrl: string;
  timeLimitSec: number;
  choices: ChoiceDraft[];
}
interface QuizDraft {
  title: string;
  description: string;
  isPublic: boolean;
  questions: QuestionDraft[];
}

const newKey = () => crypto.randomUUID();

const emptyQuestion = (): QuestionDraft => ({
  key: newKey(),
  text: '',
  imageUrl: '',
  timeLimitSec: 20,
  choices: Array.from({ length: 4 }, (_, i) => ({ key: newKey(), text: '', isCorrect: i === 0 })),
});

const emptyDraft = (): QuizDraft => ({
  title: '',
  description: '',
  isPublic: false,
  questions: [emptyQuestion()],
});

const fromDetail = (quiz: QuizDetail): QuizDraft => ({
  title: quiz.title,
  description: quiz.description ?? '',
  isPublic: quiz.isPublic,
  questions: quiz.questions.map((q) => ({
    key: newKey(),
    text: q.text,
    imageUrl: q.imageUrl ?? '',
    timeLimitSec: q.timeLimitSec,
    choices: q.choices.map((c) => ({ key: newKey(), text: c.text, isCorrect: !!c.isCorrect })),
  })),
});

const toInput = (draft: QuizDraft) => ({
  title: draft.title,
  description: draft.description.trim() || null,
  isPublic: draft.isPublic,
  questions: draft.questions.map((q) => ({
    text: q.text,
    // Boş bırakılan görsel alanı "görsel yok" demektir.
    imageUrl: q.imageUrl.trim() || null,
    timeLimitSec: q.timeLimitSec,
    choices: q.choices.map((c) => ({ text: c.text, isCorrect: c.isCorrect })),
  })),
});

const CHOICE_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];

export function QuizEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [draft, setDraft] = useState<QuizDraft | null>(isNew ? emptyDraft() : null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getQuiz(id)
      .then((quiz) => {
        if (!quiz.isOwner) {
          setError('Bu quizi sadece sahibi düzenleyebilir. Panelden kopyalayabilirsiniz.');
          return;
        }
        setDraft(fromDetail(quiz));
      })
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : 'Quiz yüklenemedi'));
  }, [id]);

  if (error && !draft) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Alert>{error}</Alert>
        <Link to="/panel" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Panele dön
        </Link>
      </div>
    );
  }
  if (!draft) return <Spinner />;

  const update = (fn: (d: QuizDraft) => QuizDraft) => {
    setDraft((d) => (d ? fn(d) : d));
    setSavedAt(null);
  };

  const updateQuestion = (qi: number, fn: (q: QuestionDraft) => QuestionDraft) =>
    update((d) => ({ ...d, questions: d.questions.map((q, i) => (i === qi ? fn(q) : q)) }));

  const moveQuestion = (qi: number, delta: -1 | 1) =>
    update((d) => {
      const questions = [...d.questions];
      const target = qi + delta;
      if (target < 0 || target >= questions.length) return d;
      [questions[qi], questions[target]] = [questions[target]!, questions[qi]!];
      return { ...d, questions };
    });

  async function save() {
    if (!draft) return;
    setError(null);
    const input = toInput(draft);
    const parsed = quizInputSchema.safeParse(input);
    if (!parsed.success) {
      setFields(zodFieldErrors(parsed.error));
      setError('Kaydetmeden önce işaretli alanları düzeltin.');
      return;
    }
    setFields({});
    setSaving(true);
    try {
      if (isNew) {
        const { id: createdId } = await api.createQuiz(input);
        navigate(`/quiz/${createdId}/duzenle`, { replace: true });
      } else {
        await api.updateQuiz(id, input);
      }
      setSavedAt(new Date());
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fields);
      } else {
        setError('Beklenmeyen bir hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex items-center justify-between gap-4">
        <Link to="/panel" className="text-sm font-semibold text-indigo-600 hover:underline">
          ← Panele dön
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{isNew ? 'Yeni quiz' : 'Quizi düzenle'}</h1>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <TextField
          id="title"
          label="Başlık"
          value={draft.title}
          maxLength={100}
          onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
          error={fields.title}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-sm font-medium text-gray-700">
            Açıklama <span className="font-normal text-gray-400">(isteğe bağlı)</span>
          </label>
          <textarea
            id="description"
            rows={2}
            maxLength={300}
            value={draft.description}
            onChange={(e) => update((d) => ({ ...d, description: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <FieldError message={fields.description} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={draft.isPublic}
            onChange={(e) => update((d) => ({ ...d, isPublic: e.target.checked }))}
            className="h-4 w-4 rounded accent-indigo-600"
          />
          Herkese açık (diğer kullanıcılar görüp kopyalayabilir, doğru cevapları göremez)
        </label>
      </section>

      <FieldError message={fields.questions} />

      <ol className="flex flex-col gap-4">
        {draft.questions.map((q, qi) => {
          const prefix = `questions.${qi}`;
          return (
            <li
              key={q.key}
              className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-gray-900">Soru {qi + 1}</h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    aria-label={`Soru ${qi + 1}'i yukarı taşı`}
                    disabled={qi === 0}
                    onClick={() => moveQuestion(qi, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1"
                    aria-label={`Soru ${qi + 1}'i aşağı taşı`}
                    disabled={qi === draft.questions.length - 1}
                    onClick={() => moveQuestion(qi, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-red-600"
                    disabled={draft.questions.length === 1}
                    onClick={() =>
                      update((d) => ({ ...d, questions: d.questions.filter((_, i) => i !== qi) }))
                    }
                  >
                    Sil
                  </Button>
                </div>
              </div>

              <TextField
                id={`${q.key}-text`}
                label="Soru metni"
                value={q.text}
                maxLength={200}
                onChange={(e) => updateQuestion(qi, (old) => ({ ...old, text: e.target.value }))}
                error={fields[`${prefix}.text`]}
              />

              <ImageUrlField
                id={`${q.key}-image`}
                value={q.imageUrl}
                onChange={(imageUrl) => updateQuestion(qi, (old) => ({ ...old, imageUrl }))}
                error={fields[`${prefix}.imageUrl`]}
              />

              <fieldset className="flex flex-wrap items-center gap-2">
                <legend className="mb-1 text-sm font-medium text-gray-700">Süre</legend>
                {QUESTION_TIME_LIMITS.map((sec) => (
                  <label
                    key={sec}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ${q.timeLimitSec === sec ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-gray-700 ring-gray-300'}`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`${q.key}-time`}
                      checked={q.timeLimitSec === sec}
                      onChange={() => updateQuestion(qi, (old) => ({ ...old, timeLimitSec: sec }))}
                    />
                    {sec} sn
                  </label>
                ))}
              </fieldset>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium text-gray-700">
                  Şıklar{' '}
                  <span className="font-normal text-gray-400">(doğru cevabı işaretleyin)</span>
                </legend>
                {q.choices.map((c, ci) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <span className={`h-8 w-2 shrink-0 rounded-full ${CHOICE_COLORS[ci]}`} />
                    <input
                      type="radio"
                      name={`${q.key}-correct`}
                      checked={c.isCorrect}
                      aria-label={`${ci + 1}. şık doğru cevap`}
                      className="h-5 w-5 shrink-0 accent-green-600"
                      onChange={() =>
                        updateQuestion(qi, (old) => ({
                          ...old,
                          choices: old.choices.map((x, i) => ({ ...x, isCorrect: i === ci })),
                        }))
                      }
                    />
                    <input
                      value={c.text}
                      maxLength={80}
                      placeholder={`${ci + 1}. şık`}
                      aria-label={`${ci + 1}. şık`}
                      onChange={(e) =>
                        updateQuestion(qi, (old) => ({
                          ...old,
                          choices: old.choices.map((x, i) =>
                            i === ci ? { ...x, text: e.target.value } : x,
                          ),
                        }))
                      }
                      className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 ${fields[`${prefix}.choices.${ci}.text`] ? 'border-red-400' : 'border-gray-300'} ${c.isCorrect ? 'bg-green-50' : ''}`}
                    />
                    <Button
                      variant="ghost"
                      className="px-2 py-1"
                      aria-label={`${ci + 1}. şıkkı sil`}
                      disabled={q.choices.length <= MIN_CHOICES}
                      onClick={() =>
                        updateQuestion(qi, (old) => {
                          const choices = old.choices.filter((_, i) => i !== ci);
                          // Doğru cevap silindiyse ilk şık doğru olsun.
                          if (!choices.some((x) => x.isCorrect) && choices[0]) {
                            choices[0] = { ...choices[0], isCorrect: true };
                          }
                          return { ...old, choices };
                        })
                      }
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <FieldError message={fields[`${prefix}.choices`]} />
                {q.choices.length < MAX_CHOICES && (
                  <Button
                    variant="ghost"
                    className="self-start px-2 py-1 text-indigo-600"
                    onClick={() =>
                      updateQuestion(qi, (old) => ({
                        ...old,
                        choices: [...old.choices, { key: newKey(), text: '', isCorrect: false }],
                      }))
                    }
                  >
                    + Şık ekle
                  </Button>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      {draft.questions.length < MAX_QUESTIONS_PER_QUIZ && (
        <Button
          variant="secondary"
          className="py-3"
          onClick={() => update((d) => ({ ...d, questions: [...d.questions, emptyQuestion()] }))}
        >
          + Soru ekle
        </Button>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0 text-sm">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : savedAt ? (
              <span className="text-green-700">Kaydedildi ✓</span>
            ) : (
              <span className="text-gray-500">{draft.questions.length} soru</span>
            )}
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}
