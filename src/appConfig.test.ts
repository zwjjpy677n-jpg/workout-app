import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// App Store に出すための設定が消えたり戻ったりしないように確かめる
const file = (p: string) => resolve(process.cwd(), p);
const read = (p: string) => readFileSync(file(p), 'utf8');

test('外部のフォントを読み込まない（プライバシーポリシーの「外部へ送らない」とオフライン動作のため）', () => {
  expect(read('index.html')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
});

test('ステータスバーは黒地に白文字、画面は常にダーク', () => {
  const plist = read('ios/App/App/Info.plist');
  expect(plist).toMatch(/<key>UIStatusBarStyle<\/key>\s*<string>UIStatusBarStyleLightContent<\/string>/);
  expect(plist).toMatch(/<key>UIUserInterfaceStyle<\/key>\s*<string>Dark<\/string>/);
});

test('ファイル機能のプライバシーマニフェストがあり、アプリに組み込まれている', () => {
  expect(existsSync(file('ios/App/App/PrivacyInfo.xcprivacy'))).toBe(true);
  const manifest = read('ios/App/App/PrivacyInfo.xcprivacy');
  expect(manifest).toContain('NSPrivacyAccessedAPICategoryFileTimestamp');
  expect(manifest).toContain('C617.1');
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  expect(pbx).toMatch(/PrivacyInfo\.xcprivacy in Resources/);
});

const ICON_KEYS = ['red', 'yellow', 'orange', 'pink', 'purple', 'blue', 'sky', 'mint', 'green', 'navy', 'black', 'cream'];

test('猫アイコンが 12 色そろっていて、iPhone の別アイコンとして組み込まれている', () => {
  for (const k of ICON_KEYS) {
    expect(existsSync(file(`public/icons/${k}-180.png`))).toBe(true);
    expect(existsSync(file(`public/icons/${k}-64.png`))).toBe(true);
    if (k !== 'red') expect(existsSync(file(`ios/App/App/Assets.xcassets/AppIcon-${k}.appiconset/Contents.json`))).toBe(true);
  }
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  expect(pbx.match(/ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = YES;/g)).toHaveLength(2);
});

test('表に出る名前はキントレ部', () => {
  const html = read('index.html');
  expect(html).toContain('<title>キントレ部</title>');
  expect(html).toContain('<meta name="apple-mobile-web-app-title" content="キントレ部" />');
  expect(read('vite.config.ts')).toContain("name: 'キントレ部'");
  expect(read('capacitor.config.ts')).toContain("appName: 'キントレ部'");
  expect(read('ios/App/App/Info.plist')).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>キントレ部<\/string>/);
  for (const p of ['public/privacy.html', 'public/support.html']) expect(read(p)).not.toContain('GRIND');
});

test('画面と共有メッセージに GRIND が残っていない', () => {
  const walk = (d: string): string[] =>
    readdirSync(file(d), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [`${d}/${e.name}`] : [],
    );
  expect(walk('src').filter((p) => read(p).includes('GRIND'))).toEqual([]);
});

test('入力欄を押しても iPhone が画面を自動で拡大しない（maximum-scale=1）', () => {
  expect(read('index.html')).toMatch(/<meta name="viewport" content="[^"]*maximum-scale=1[^"]*"/);
});
