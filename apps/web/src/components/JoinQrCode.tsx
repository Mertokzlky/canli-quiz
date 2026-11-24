import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Katılım bağlantısının QR kodu. Kod tarayıcıda üretilir; bağlantı hiçbir dış servise gönderilmez.
 */
export function JoinQrCode({ url, size = 200 }: { url: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!svg) return <div style={{ width: size, height: size }} aria-hidden />;

  return (
    <div
      role="img"
      aria-label={`Katılmak için QR kod: ${url}`}
      style={{ width: size, height: size }}
      // SVG kendi ürettiğimiz bir metinden oluşuyor, kullanıcı girdisi içermiyor.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
