const KEY = 'sudoku_v1_technique_stats';

export function useTechniqueStats() {
  function getAll(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  function record(name: string): void {
    if (typeof window === 'undefined') return;
    try {
      const stats = getAll();
      stats[name] = (stats[name] ?? 0) + 1;
      localStorage.setItem(KEY, JSON.stringify(stats));
    } catch { }
  }

  function getCount(name: string): number {
    return getAll()[name] ?? 0;
  }

  return { record, getCount, getAll };
}
