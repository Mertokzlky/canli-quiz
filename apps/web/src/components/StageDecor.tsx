import { ChoiceShape } from './ChoiceShape';

/** Arka plandaki dekoratif şekiller (şıklardaki şekillerle aynı aile). */
export function StageDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 select-none">
      <span className="animate-float absolute top-[12%] left-[6%] rotate-12 text-rose-400/20">
        <ChoiceShape index={0} className="h-14 w-14" />
      </span>
      <span className="animate-float absolute top-[60%] left-[3%] text-sky-300/15 [animation-delay:-3s]">
        <ChoiceShape index={1} className="h-16 w-16" />
      </span>
      <span className="animate-float absolute top-[8%] right-[8%] text-amber-300/20 [animation-delay:-5s]">
        <ChoiceShape index={2} className="h-10 w-10" />
      </span>
      <span className="animate-float absolute right-[4%] bottom-[10%] -rotate-12 text-emerald-300/15 [animation-delay:-7s]">
        <ChoiceShape index={3} className="h-16 w-16" />
      </span>
    </div>
  );
}
