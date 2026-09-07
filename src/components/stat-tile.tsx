export function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-ink/10 p-4 dark:border-white/10">
      <p className="font-serif text-2xl tabular-nums">{value}</p>
      <p className="mt-1 font-sans text-xs uppercase tracking-wide text-ink-soft dark:text-stone-400">
        {label}
      </p>
    </div>
  )
}
