import { useState } from 'react';
import { MAX_IMAGE_URL_LENGTH } from '@canli-quiz/shared';
import { FieldError } from './ui';

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
        className="self-start text-sm font-semibold text-indigo-600 hover:underline"
      >
        + Görsel ekle
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          Görsel bağlantısı <span className="font-normal text-gray-400">(isteğe bağlı)</span>
        </label>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setOpen(false);
          }}
          className="text-sm text-gray-500 hover:text-red-600"
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
        className={`rounded-lg border px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 ${error ? 'border-red-400' : 'border-gray-300'}`}
      />
      <p className="text-xs text-gray-500">
        İnternette herkese açık bir görselin adresini yapıştırın (sağ tık → "Resim adresini
        kopyala").
      </p>
      <FieldError message={error} />

      {looksValid &&
        (failedUrl === url ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Bu adresteki görsel yüklenemedi. Adresin doğrudan bir görsele ait olduğundan emin olun.
          </p>
        ) : (
          <img
            src={url}
            alt="Soru görseli önizlemesi"
            referrerPolicy="no-referrer"
            onError={() => setFailedUrl(url)}
            className="max-h-48 self-start rounded-lg object-contain ring-1 ring-gray-200"
          />
        ))}
    </div>
  );
}
