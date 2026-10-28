export function roundTo(x: number, step: number): number {
  return Math.round(Math.round(x / step) * step * 1000) / 1000;
}

export function percentTable(oneRM: number): { percent: number; kg: number }[] {
  const rows = [];
  for (let p = 100; p >= 50; p -= 5) rows.push({ percent: p, kg: roundTo((oneRM * p) / 100, 2.5) });
  return rows;
}

const g = (kg: number) => Math.round(kg * 1000);

/** 片側に付けるプレートを大きい順の貪欲法で求める（整数グラムで計算） */
export function platesFor(targetKg: number, barKg: number, plates: number[]): { perSide: number[]; achievedKg: number; diffKg: number } {
  const sorted = plates.map(g).filter((p) => p > 0).sort((a, b) => b - a);
  let remain = Math.max(0, Math.floor((g(targetKg) - g(barKg)) / 2));
  const perSide: number[] = [];
  for (const p of sorted) {
    while (remain >= p) {
      perSide.push(p);
      remain -= p;
    }
  }
  const achieved = g(barKg) + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide: perSide.map((p) => p / 1000), achievedKg: achieved / 1000, diffKg: (g(targetKg) - achieved) / 1000 };
}

/** プレートの色（IWF配色）。キーは formatKg 済みの重量 */
export const PLATE_COLORS: Record<string, string> = {
  '25': '#D7263D', '20': '#1F5BC6', '15': '#E3B22A', '10': '#2E8F56', '5': '#F7F8FA', '2.5': '#5A6470', '1.25': '#AEB6C0',
};
