/** Grid columns/rows for N camera tiles inside the PST monitor. */
export function resolvePreviewGrid(count: number): { cols: number; rows: number } {
  const n = Math.max(1, count);
  if (n === 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(n / 4) };
}

export function previewGridStyle(count: number): { gridTemplateColumns: string; gridTemplateRows: string } {
  const { cols, rows } = resolvePreviewGrid(count);
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
  };
}
