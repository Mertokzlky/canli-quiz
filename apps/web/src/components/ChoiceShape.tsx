/**
 * Şıkların şekli (üçgen, karo, daire, kare). Renk körü oyuncular şıkları renk yerine şekilden
 * ayırt edebilsin diye her ekranda aynı şekil kullanılır. Yazı tipindeki karakterler yerine SVG
 * çizildiği için her cihazda aynı boyutta görünür.
 */
export function ChoiceShape({
  index,
  className = 'h-5 w-5',
}: {
  index: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      {SHAPES[index % SHAPES.length]}
    </svg>
  );
}

const SHAPES = [
  <path
    key="ucgen"
    d="M12 3.2 22 20.4H2z"
    strokeLinejoin="round"
    stroke="currentColor"
    strokeWidth="2"
  />,
  <path
    key="karo"
    d="M12 1.8 22.2 12 12 22.2 1.8 12z"
    strokeLinejoin="round"
    stroke="currentColor"
    strokeWidth="1.5"
  />,
  <circle key="daire" cx="12" cy="12" r="10" />,
  <rect key="kare" x="2.5" y="2.5" width="19" height="19" rx="3" />,
];
