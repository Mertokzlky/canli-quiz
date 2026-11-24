import { useState } from 'react';

/**
 * Oyun ekranlarında soru görseli. Yüklenemezse sessizce gizlenir: oyun bir görsel yüzünden
 * aksamamalı. Görsel başka bir siteden geldiği için adres bilgisi (referrer) gönderilmez.
 */
export function QuestionImage({ url, className = '' }: { url: string | null; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) return null;
  return (
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
      className={`mx-auto rounded-2xl object-contain ${className}`}
    />
  );
}
