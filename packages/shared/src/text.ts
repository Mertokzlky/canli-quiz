// Kullanıcıların yazdığı isimler için ortak temizlik kuralları (tarayıcı ve sunucu aynısını kullanır).

/**
 * Görünmeyen karakterler: kontrol ve biçim karakterleri (sıfır genişlikli boşluk, yön değiştiren
 * işaretler vb.), özel kullanım alanı ve "boş görünen" harfler (Hangul dolgu, boş Braille).
 * Bunlarla "Ayşe" ile görünüşte aynı ama farklı bir takma ad ya da tamamen boş görünen bir isim
 * oluşturulabiliyordu.
 */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cn}ᅟᅠㅤﾠ⠀]/gu;

/** İsmi tek biçime getirir: görünmez karakterleri siler, boşlukları sadeleştirir. */
export function cleanName(raw: string): string {
  return raw.normalize('NFC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
}

/** bcrypt şifrenin sadece ilk 72 baytını kullanır; Türkçe harfler UTF-8'de 2 bayttır. */
export const MAX_PASSWORD_BYTES = 72;

export const utf8Length = (text: string) => new TextEncoder().encode(text).length;
