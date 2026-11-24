import { useState } from 'react';
import { MAX_IMAGE_URL_LENGTH } from '@canli-quiz/shared';
import { FieldError, inputClass } from './ui';

/** Görsel bağlantısı alanı: önizleme gösterir, görsel yüklenemezse uyarır. */
export function ImageUrlField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(value.trim() !== '');
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = value.trim();
  const looksValid = /^https?:\/\/\S+$/i.test(url);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 hover:text-brand-700"
      >
        <span aria-hidden>🖼️</span> Görsel ekle
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-slate-700">
          Görsel bağlantısı <span className="font-normal text-slate-400">(isteğe bağlı)</span>
        </label>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setOpen(false);
          }}
          className="text-sm font-medium text-slate-500 hover:text-red-600"
        >
          Görseli kaldır
        </button>
      </div>
      <input
        id={id}
        type="url"
        inputMode="url"
        placeholder="https://..."
        value={value}
        maxLength={MAX_IMAGE_URL_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={inputClass(Boolean(error))}
      />
      <p className="text-xs text-slate-500">
        İnternette herkese açık bir görselin adresini yapıştırın (sağ tık → "Resim adresini
        kopyala").
      </p>
      <FieldError message={error} />

      {looksValid &&
        (failedUrl === url ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Bu adresteki görsel yüklenemedi. Adresin doğrudan bir görsele ait olduğundan emin olun.
          </p>
        ) : (
          <img
            src={url}
            alt="Soru görseli önizlemesi"
            referrerPolicy="no-referrer"
            onError={() => setFailedUrl(url)}
            className="max-h-48 self-start rounded-xl object-contain shadow-sm ring-1 ring-slate-200"
          />
        ))}
    </div>
  );
}
