// Takma ad ve görünen ad için basit küfür filtresi (Türkçe ağırlıklı, birkaç İngilizce kelime).
//
// İki zorluk var:
// 1. Atlatma: "s1kt1r", "0r0spu", "o.r.o.s.p.u", "orrrospu" gibi yazımlar. Bu yüzden metin önce
//    sadeleştirilir (Türkçe harfler katlanır, harf yerine kullanılan rakam ve semboller çözülür)
//    ve köklerdeki her harfin istenildiği kadar tekrar edilmesine izin verilir.
// 2. Yanlış alarm: "Işık" içinde "sik", "Kamil" içinde "am", "kayarak" içinde "yarak", "Amina"
//    gibi isimler. Bu yüzden kısa kelimeler sadece tek başına bir kelime olarak aranır; kelime
//    içinde aranan kökler uzun ve ayırt edicidir, çift harfleri de korunur ("yarrak" en az iki r
//    ister, "kayarak" eşleşmez).
//
// Liste bilerek kısa tutuldu: amaç her şeyi yakalamak değil, açık küfürleri lobiden uzak tutmak.
// Kalanlar için sunucu ekranında oyuncuyu çıkarma butonu var.

/** Kelimenin içinde de aranan, yanlış alarm riski düşük kökler (sadeleştirilmiş yazımla). */
const ROOTS = [
  'orospu',
  'siktir',
  'sikerim',
  'sikeyim',
  'sikik',
  'amcik',
  'aminakoy',
  'yarrak',
  'pezevenk',
  'kahpe',
  'gotveren',
  'ibne',
  'kaltak',
  'serefsiz',
  'kerhane',
  'fuck',
  'bitch',
  'whore',
  'porno',
];

/** Sadece tek başına kelime olarak aranan kısa kelimeler. */
const WORDS = [
  'sik',
  'sikim',
  'pic',
  'got',
  'oc',
  'amk',
  'aq',
  'mk',
  'pust',
  'shit',
  'cunt',
  'nigger',
  'nigga',
];

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
};

const TURKISH: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/**
 * Metni karşılaştırma için sadeleştirir: sadece a-z harfleri kalır, gerisi boşluk olur.
 * `keepDotless`: noktasız ı korunur. Kısa kelimelerde gerekli; yoksa sık kullanılan "sık"
 * kelimesi argo bir kelimeyle aynı yazılırdı.
 */
function simplify(text: string, keepDotless = false): string {
  let out = '';
  for (const ch of text.toLocaleLowerCase('tr')) {
    if (keepDotless && ch === 'ı') {
      out += ch;
      continue;
    }
    const mapped = TURKISH[ch] ?? LEET[ch] ?? ch;
    out += /[a-z]/.test(mapped) ? mapped : ' ';
  }
  return out;
}

/**
 * Kökten, harf tekrarlarına izin veren bir kalıp üretir. Tek harf bir veya daha fazla kez,
 * çift harf en az iki kez geçmeli: "yarrak" → /y+a+r{2,}a+k+/.
 */
function pattern(word: string): string {
  return (word.match(/(.)\1*/g) ?? [])
    .map((run) => (run.length > 1 ? `${run[0]}{${run.length},}` : `${run}+`))
    .join('');
}

const ROOT_REGEX = new RegExp(ROOTS.map(pattern).join('|'));
const WORD_REGEX = new RegExp(`^(?:${WORDS.map(pattern).join('|')})$`);

/** Metinde küfür var mı? */
export function containsProfanity(text: string): boolean {
  const words = simplify(text, true).split(' ');
  if (words.some((word) => word && WORD_REGEX.test(word))) return true;
  // Harfler arasına konan boşluk ve noktalara karşı ("o.r.o.s.p.u") hepsi birleştirilip de bakılır.
  return ROOT_REGEX.test(simplify(text).replace(/ /g, ''));
}

export const PROFANITY_MESSAGE = 'Bu isim uygun değil, lütfen başka bir tane seçin';
