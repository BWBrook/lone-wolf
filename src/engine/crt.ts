export type Loss = number | 'k';
export type CombatResult = readonly [enemyLoss: Loss, heroLoss: Loss];

// Kai-series Combat Results Table. Rows are random numbers 0-9; columns are the
// combat-ratio bands from "-11 or lower" to "11 or higher". Generated from the
// Project Aon edition; publication pending Project Aon's view on rules data.
const TABLE: readonly (readonly CombatResult[])[] = [
  /* 0 */ [[6, 0], [7, 0], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [14, 0], [16, 0], [18, 0], ['k', 0], ['k', 0], ['k', 0]],
  /* 1 */ [[0, 'k'], [0, 'k'], [0, 8], [0, 6], [1, 6], [2, 5], [3, 5], [4, 5], [5, 4], [6, 4], [7, 4], [8, 3], [9, 3]],
  /* 2 */ [[0, 'k'], [0, 8], [0, 7], [1, 6], [2, 5], [3, 5], [4, 4], [5, 4], [6, 3], [7, 3], [8, 3], [9, 3], [10, 2]],
  /* 3 */ [[0, 8], [0, 7], [1, 6], [2, 5], [3, 5], [4, 4], [5, 4], [6, 3], [7, 3], [8, 3], [9, 2], [10, 2], [11, 2]],
  /* 4 */ [[0, 8], [1, 7], [2, 6], [3, 5], [4, 4], [5, 4], [6, 3], [7, 3], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2]],
  /* 5 */ [[1, 7], [2, 6], [3, 5], [4, 4], [5, 4], [6, 3], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2], [14, 1]],
  /* 6 */ [[2, 6], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2], [8, 2], [9, 2], [10, 2], [11, 1], [12, 1], [14, 1], [16, 1]],
  /* 7 */ [[3, 5], [4, 5], [5, 4], [6, 3], [7, 2], [8, 2], [9, 1], [10, 1], [11, 1], [12, 0], [14, 0], [16, 0], [18, 0]],
  /* 8 */ [[4, 4], [5, 4], [6, 3], [7, 2], [8, 1], [9, 1], [10, 0], [11, 0], [12, 0], [14, 0], [16, 0], [18, 0], ['k', 0]],
  /* 9 */ [[5, 3], [6, 3], [7, 2], [8, 0], [9, 0], [10, 0], [11, 0], [12, 0], [14, 0], [16, 0], [18, 0], ['k', 0], ['k', 0]],
];

export function ratioColumn(ratio: number): number {
  if (ratio <= -11) return 0;
  if (ratio >= 11) return 12;
  return 6 + Math.sign(ratio) * Math.ceil(Math.abs(ratio) / 2);
}

export function combatResult(ratio: number, random: number): CombatResult {
  const result = TABLE[random]?.[ratioColumn(ratio)];
  if (!result) throw new RangeError(`random number must be 0-9, got ${random}`);
  return result;
}
