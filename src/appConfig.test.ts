import { existsSync, readFileSync } from 'node:fs';
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
