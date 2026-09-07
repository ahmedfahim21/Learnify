/**
 * Difficulty as five pips rather than the string "difficulty 3/5".
 *
 * Scannable at a glance across a grid of courses, which reading a fraction on
 * every card is not. The text stays for screen readers.
 */
export function DifficultyPips({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Difficulty ${level} of ${max}`}>
      <span className="sr-only">{`Difficulty ${level} of ${max}`}</span>
      <span aria-hidden className="flex items-center gap-[3px]">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`h-[3px] w-3 ${i < level ? "bg-(--color-signal)" : "bg-(--color-line)"}`}
          />
        ))}
      </span>
    </span>
  );
}
