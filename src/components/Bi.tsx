import { TA, type TamilLabel } from '@/config/labels';

/**
 * An English label with its Tamil alongside: "Up next · அடுத்து" (wording in
 * config/labels.ts), or with `stack`, the Tamil on a smaller line underneath
 * (big titles, where side by side would wrap mid-phrase). The Tamil ignores any
 * uppercase or letter-spacing on the label, which would break up Tamil letters.
 */
export function Bi({ en, ta, stack = false }: { en: string; ta: TamilLabel; stack?: boolean }) {
  const tamil = TA[ta];
  if (!tamil) return <>{en}</>;
  if (stack) {
    return (
      <>
        {en}
        <span lang="ta" className="block text-[0.8em] leading-snug font-medium tracking-normal normal-case opacity-75">
          {tamil}
        </span>
      </>
    );
  }
  return (
    <>
      {en}
      <span aria-hidden="true" className="opacity-50">
        {' · '}
      </span>
      <span lang="ta" className="font-medium tracking-normal normal-case">
        {tamil}
      </span>
    </>
  );
}
