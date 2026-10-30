import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// 強調色を直接書くと、色を変えてもそこだけ赤のまま残る。強調色は CSS 変数（--red / --on-accent）経由で使う
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(css|tsx)$/.test(n) && !/\.test\./.test(n) && n !== 'tokens.css' ? [p] : [];
  });
}

const sources = files(resolve(process.cwd(), 'src')).map((p) => ({ p, text: readFileSync(p, 'utf8') }));
const hits = (re: RegExp) => sources.filter((f) => re.test(f.text)).map((f) => f.p);

test('強調色の赤 #E10600 を直接書いていない', () => {
  expect(hits(/#E10600/i)).toEqual([]);
});

test('強調色の薄い赤 rgba(225, 6, 0, …) を直接書いていない', () => {
  expect(hits(/rgba\(\s*225,\s*6,\s*0/)).toEqual([]);
});

test('強調色の上の文字を白で固定していない', () => {
  expect(hits(/background:\s*var\(--red\)[^}]*color:\s*#fff/)).toEqual([]);
});

// color-mix() は iOS 16.2 より前の Safari で使えない（アプリは iOS 15 から動く）。透明度は rgb(var(--…-rgb) / a) で書く
test('color-mix() を使っていない', () => {
  expect(hits(/color-mix\(/)).toEqual([]);
});

test('カレンダーの一番濃い日は、強調色の上の文字色で読める', () => {
  const cal = readFileSync(resolve(process.cwd(), 'src/features/calendar/calendar.module.css'), 'utf8');
  expect(cal).toMatch(/\.d\[data-level='3'\]\s*\{[^}]*color:\s*var\(--on-accent\)/);
});

test('タブバーを画面に固定しない（iPhone のホーム画面アプリで短いページだと浮くため）', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/components/TabBar.module.css'), 'utf8');
  expect(css).not.toMatch(/position:\s*fixed/);
});

test('ホーム画面アプリでは、iPhone が引いてくる上の分（--vgap）を足して画面の一番下まで使う', () => {
  const g = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
  expect(g).toMatch(/:root\s*\{[^}]*--vgap:\s*0px/);
  // キーボードで変わる dvh は使わない（シートの保存ボタンがキーボードの下に隠れた）
  expect(g).not.toMatch(/dvh/);
  expect(g).toMatch(/\.shell\s*\{[^}]*height:\s*calc\(100% \+ var\(--vgap\)\)/);
  const sheet = readFileSync(resolve(process.cwd(), 'src/components/Sheet.module.css'), 'utf8');
  expect(sheet).toMatch(/bottom:\s*calc\(0px - var\(--vgap\)\)/);
  const rest = readFileSync(resolve(process.cwd(), 'src/features/workout/rest.module.css'), 'utf8');
  expect(rest).toMatch(/var\(--vgap\)/);
});
