// Compact money formatter per custom spec:
// - Show full with commas up to $9,999,999
// - Then use suffixes: m (10^6), B (10^9), t (10^12), b (10^15), qu (10^18), qi (10^21), s (10^24)
// - After 10^27, switch to alphabetic suffixes: A for 10^27, B for 10^30, ... Z for 10^(27+25*3)

export function formatMoney(n) {
  const num = Math.floor(Math.max(0, Number(n) || 0));
  if (num < 10_000_000) return `$${num.toLocaleString()}`;

  // Order per spec: m(1e6), b(1e9), t(1e12), qu(1e15), qi(1e18), s(1e21)
  const suffixes = [
    { v: 1e21, s: 's' },   // sextillion
    { v: 1e18, s: 'qi' },  // quintillion
    { v: 1e15, s: 'qu' },  // quadrillion
    { v: 1e12, s: 't' },   // trillion
    { v: 1e9,  s: 'b' },   // billion
    { v: 1e6,  s: 'm' },   // million
  ];

  for (const { v, s } of suffixes) {
    if (num >= v) {
      const val = Math.floor(num / v);
      return `$${val}${s}`;
    }
  }
  return `$${num.toLocaleString()}`;
}

export function formatMoneyExtended(n) {
  const num = Math.floor(Math.max(0, Number(n) || 0));
  if (num < 10_000_000) return `$${num.toLocaleString()}`;

  // Switch to alphabetic at 1e24 (septillion and beyond): A=1e24, B=1e27, ...
  if (num >= 1e24) {
    const group = Math.floor(Math.log10(num) / 3); // 8 => 1e24
    const idx = Math.max(0, group - 8); // 0 => A for 1e24
    const letter = String.fromCharCode(65 + Math.min(25, idx)); // A..Z
    const pow = Math.pow(10, group * 3);
    const val = Math.floor(num / pow);
    return `$${val}${letter}`;
  }
  return formatMoney(num);
}
