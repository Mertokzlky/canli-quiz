import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  MAX_CHOICES,
  MAX_QUESTIONS_PER_QUIZ,
  MIN_CHOICES,
  QUESTION_TIME_LIMITS,
  quizInputSchema,
  type QuizDetail,
} from '@canli-quiz/shared';
import { ChoiceShape } from '../components/ChoiceShape';
import { ImageUrlField } from '../components/ImageUrlField';
import {
  Alert,
  BackLink,
  Button,
  Card,
  FieldError,
  inputClass,
  PageHeader,
  Spinner,
  TextField,
} from '../components/ui';
import { api, ApiRequestError } from '../lib/api';
import { choiceStyle } from '../lib/game';
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
        <BackLink to="/panel">Panele dön</BackLink>
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
      <PageHeader
        back={{ to: '/panel', label: 'Panele dön' }}
        title={isNew ? 'Yeni quiz' : 'Quizi düzenle'}
        description="Soruları yaz, doğru şıkkı işaretle ve kaydet. Kaydettikten sonra panelden başlatabilirsin."
      />

      <Card as="section" className="flex flex-col gap-4 p-5 sm:p-6">
        <TextField
          id="title"
          label="Başlık"
          value={draft.title}
          maxLength={100}
          onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
          error={fields.title}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-semibold text-slate-700">
            Açıklama <span className="font-normal text-slate-400">(isteğe bağlı)</span>
          </label>
          <textarea
            id="description"
            rows={2}
            maxLength={300}
            value={draft.description}
            onChange={(e) => update((d) => ({ ...d, description: e.target.value }))}
            className={`${inputClass(Boolean(fields.description))} resize-y`}
          />
          <FieldError message={fields.description} />
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
          <input
            type="checkbox"
            checked={draft.isPublic}
            onChange={(e) => update((d) => ({ ...d, isPublic: e.target.checked }))}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-600"
          />
          <span>
            <strong className="font-semibold text-slate-900">Herkese açık</strong>
            <span className="block text-slate-500">
              Diğer kullanıcılar görüp kopyalayabilir, doğru cevapları göremez.
            </span>
          </span>
        </label>
      </Card>

      <FieldError message={fields.questions} />

      <ol className="flex flex-col gap-4">
        {draft.questions.map((q, qi) => {
          const prefix = `questions.${qi}`;
          return (
            <Card as="li" key={q.key} className="flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2.5 font-bold text-slate-900">
                  <span className="bg-brand-gradient grid h-8 w-8 place-items-center rounded-lg text-sm text-white">
                    {qi + 1}
                  </span>
                  Soru {qi + 1}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Soru ${qi + 1}'i yukarı taşı`}
                    disabled={qi === 0}
                    onClick={() => moveQuestion(qi, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Soru ${qi + 1}'i aşağı taşı`}
                    disabled={qi === draft.questions.length - 1}
                    onClick={() => moveQuestion(qi, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost-danger"
                    size="sm"
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
                <legend className="mb-1.5 text-sm font-semibold text-slate-700">Süre</legend>
                {QUESTION_TIME_LIMITS.map((sec) => (
                  <label
                    key={sec}
                    className={`cursor-pointer rounded-xl px-3 py-1.5 text-sm font-semibold transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-500 ${q.timeLimitSec === sec ? 'bg-brand-gradient text-white shadow-sm' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}
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
                <legend className="mb-1.5 text-sm font-semibold text-slate-700">
                  Şıklar{' '}
                  <span className="font-normal text-slate-400">(doğru cevabı işaretleyin)</span>
                </legend>
                {q.choices.map((c, ci) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white ${choiceStyle(ci).dot}`}
                      aria-hidden
                    >
                      <ChoiceShape index={ci} className="h-4 w-4" />
                    </span>
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
                      className={`${inputClass(Boolean(fields[`${prefix}.choices.${ci}.text`]), c.isCorrect)} min-w-0 flex-1`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
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
                    variant="ghost-brand"
                    size="sm"
                    className="self-start"
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
            </Card>
          );
        })}
      </ol>

      {draft.questions.length < MAX_QUESTIONS_PER_QUIZ && (
        <Button
          variant="dashed"
          size="lg"
          onClick={() => update((d) => ({ ...d, questions: [...d.questions, emptyQuestion()] }))}
        >
          + Soru ekle
        </Button>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/85 shadow-[0_-8px_24px_-12px_rgb(15_23_42/0.15)] backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0 text-sm">
            {error ? (
              <span className="font-medium text-red-600">{error}</span>
            ) : savedAt ? (
              <span className="font-semibold text-emerald-700">Kaydedildi ✓</span>
            ) : (
              <span className="text-slate-500">{draft.questions.length} soru</span>
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
