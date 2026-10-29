import { useSyncExternalStore } from 'react';

// 見た目（アイコンの色・強調色・背景）。端末ごとの好みなので端末に保存し、バックアップには含めない

export type IconKey = 'red' | 'yellow' | 'orange' | 'pink' | 'purple' | 'blue' | 'sky' | 'mint' | 'green' | 'navy' | 'black' | 'cream';
export type AccentKey = 'red' | 'yellow' | 'orange' | 'pink' | 'purple' | 'blue' | 'sky' | 'mint' | 'green';
export type BgKey = 'black' | 'navy' | 'brown' | 'forest';
export type Appearance = { icon: IconKey; accent: AccentKey; bg: BgKey };

export const ICONS: { key: IconKey; name: string; color: string }[] = [
  { key: 'red', name: '赤', color: '#E5262B' },
  { key: 'yellow', name: '黄', color: '#FFC21A' },
  { key: 'orange', name: 'オレンジ', color: '#FF8A1F' },
  { key: 'pink', name: 'ピンク', color: '#FF85B3' },
  { key: 'purple', name: '紫', color: '#9B5CF6' },
  { key: 'blue', name: '青', color: '#2F7FEB' },
  { key: 'sky', name: '水色', color: '#55C8F5' },
  { key: 'mint', name: 'ミント', color: '#5ED6B4' },
  { key: 'green', name: '緑', color: '#3DBE57' },
  { key: 'navy', name: '紺', color: '#1E2A4A' },
  { key: 'black', name: '黒', color: '#141418' },
  { key: 'cream', name: 'クリーム', color: '#FBEFD5' },
];

/** on = 強調色の上に置く文字の色（明るい色の上は黒） */
export const ACCENTS: { key: AccentKey; name: string; color: string; on: string }[] = [
  { key: 'red', name: '赤', color: '#E10600', on: '#fff' },
  { key: 'yellow', name: '黄', color: '#FFC21A', on: '#111' },
  { key: 'orange', name: 'オレンジ', color: '#FF8A1F', on: '#111' },
  { key: 'pink', name: 'ピンク', color: '#FF6FA8', on: '#111' },
  { key: 'purple', name: '紫', color: '#A26BFA', on: '#fff' },
  { key: 'blue', name: '青', color: '#3B82F6', on: '#fff' },
  { key: 'sky', name: '水色', color: '#38BDF8', on: '#111' },
  { key: 'mint', name: 'ミント', color: '#34D3A6', on: '#111' },
  { key: 'green', name: '緑', color: '#22C55E', on: '#111' },
];

export const BGS: { key: BgKey; name: string; bg: string; surface: string; surface2: string; line: string }[] = [
  { key: 'black', name: '黒', bg: '#0B0B0D', surface: '#16161A', surface2: '#1F1F25', line: '#2A2A31' },
  { key: 'navy', name: '紺', bg: '#0A0F1E', surface: '#131A2C', surface2: '#1B2338', line: '#283149' },
  { key: 'brown', name: 'こげ茶', bg: '#120D0A', surface: '#1D1612', surface2: '#271E18', line: '#362A22' },
  { key: 'forest', name: '深緑', bg: '#08120E', surface: '#111D18', surface2: '#182821', line: '#22362D' },
];

export const DEFAULT_APPEARANCE: Appearance = { icon: 'red', accent: 'red', bg: 'black' };

const KEY = 'ironlog:appearance';

export const iconUrl = (key: IconKey, size: 64 | 180): string => `./icons/${key}-${size}.png`;

const pick = <K extends string>(list: { key: K }[], v: unknown, fallback: K): K =>
  list.some((x) => x.key === v) ? (v as K) : fallback;

/** 保存されている見た目。壊れた項目・知らない値は既定に戻す */
export function getAppearance(): Appearance {
  let v: Partial<Record<keyof Appearance, unknown>> | null = null;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    if (raw && typeof raw === 'object') v = raw;
  } catch {
    // 壊れた値・保存領域が使えない環境は既定に戻す
  }
  return {
    icon: pick(ICONS, v?.icon, DEFAULT_APPEARANCE.icon),
    accent: pick(ACCENTS, v?.accent, DEFAULT_APPEARANCE.accent),
    bg: pick(BGS, v?.bg, DEFAULT_APPEARANCE.bg),
  };
}

// 画面に出している見た目（保存できない環境でも、選んだ色を表示に使う）。useSyncExternalStore には同じ参照を返す
let shown: Appearance | null = null;
const snapshot = (): Appearance => (shown ??= getAppearance());

const listeners = new Set<() => void>();

export function subscribeAppearance(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setAppearance(a: Appearance): void {
  shown = { ...a };
  try {
    localStorage.setItem(KEY, JSON.stringify(shown));
  } catch {
    // 保存できなくても今回の表示には反映する
  }
  applyAppearance(shown);
  listeners.forEach((fn) => fn());
}

export function applyAppearance(a: Appearance): void {
  const accent = ACCENTS.find((x) => x.key === a.accent) ?? ACCENTS[0];
  const bg = BGS.find((x) => x.key === a.bg) ?? BGS[0];
  const st = document.documentElement.style;
  st.setProperty('--red', accent.color);
  st.setProperty('--red-soft', `color-mix(in srgb, ${accent.color} 15%, transparent)`);
  st.setProperty('--on-accent', accent.on);
  st.setProperty('--bg', bg.bg);
  st.setProperty('--surface', bg.surface);
  st.setProperty('--surface2', bg.surface2);
  st.setProperty('--line', bg.line);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg.bg);
  // Safari はホーム画面に追加した時点のこのアイコンを使う
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', iconUrl(a.icon, 180));
}

export const useAppearance = (): Appearance => useSyncExternalStore(subscribeAppearance, snapshot);
