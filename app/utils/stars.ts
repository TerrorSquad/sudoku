// Pure star rating for a finished game — no Vue, no storage. Unit-tested in tests/stars.test.ts.
//
// 3 stars: no mistakes and no hints. 2 stars: at most one mistake and two hints. Otherwise 1:
// finishing is always worth a star.

export function starsFor(mistakes: number, hintsUsed: number): 1 | 2 | 3 {
  if (mistakes === 0 && hintsUsed === 0) return 3;
  if (mistakes <= 1 && hintsUsed <= 2) return 2;
  return 1;
}
