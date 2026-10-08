// sfc32 seeded by splitmix32. The state is four uint32s, so it lives in GameState
// and round-trips through JSON; every draw is reproducible from the seed.
export type RngState = [number, number, number, number];

export function seedRng(seed: number): RngState {
  let x = seed >>> 0;
  const splitmix = () => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return (z ^ (z >>> 15)) >>> 0;
  };
  const state: RngState = [splitmix(), splitmix(), splitmix(), splitmix()];
  for (let i = 0; i < 12; i++) nextU32(state);
  return state;
}

export function nextU32(s: RngState): number {
  const [a, b, c, d] = s;
  const t = (((a + b) | 0) + d) | 0;
  s[0] = b ^ (b >>> 9);
  s[1] = (c + (c << 3)) | 0;
  s[2] = (((c << 21) | (c >>> 11)) + t) | 0;
  s[3] = (d + 1) | 0;
  s[0] >>>= 0;
  s[1] >>>= 0;
  s[2] >>>= 0;
  s[3] >>>= 0;
  return t >>> 0;
}

// Uniform 0-9 by rejection, replacing the printed Random Number Table.
export function draw10(s: RngState): number {
  for (;;) {
    const x = nextU32(s);
    if (x < 4294967290) return x % 10;
  }
}

// Uniform 0..n-1 by rejection, for draws the book leaves to chance without a table.
export function drawBelow(s: RngState, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 0xffffffff) throw new RangeError(`cannot draw below ${n}`);
  const limit = 0x100000000 - (0x100000000 % n);
  for (;;) {
    const x = nextU32(s);
    if (x < limit) return x % n;
  }
}
