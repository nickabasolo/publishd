interface BarChartProps {
  data: { label: string; value: number }[]
}

/** Dependency-free vertical bar chart (CSS heights, themes via currentColor). */
export function BarChart({ data }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div>
      <div className="flex h-32 items-end gap-1.5">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-ink/80 dark:bg-stone-200/80"
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            title={`Chapter ${d.label}: ${d.value.toLocaleString()} reads`}
          />
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 text-center font-sans text-[10px] text-ink-soft dark:text-stone-500"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  )
}
