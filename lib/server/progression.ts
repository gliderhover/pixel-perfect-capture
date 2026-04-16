export function nextXpThreshold(level: number) {
  return 80 + level * 40;
}

export function clampStat(value: number) {
  return Math.max(0, Math.min(99, value));
}
