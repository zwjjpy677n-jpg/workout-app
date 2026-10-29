import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { change } = vi.hoisted(() => ({ change: vi.fn() }));
vi.mock('../../lib/appIcon', () => ({ changeAppIcon: change }));

import { DEFAULT_APPEARANCE, getAppearance, setAppearance } from '../../lib/appearance';
import { AppearanceSection } from './AppearanceSection';

const css = (name: string) => document.documentElement.style.getPropertyValue(name);
const group = (name: string) => screen.getByRole('group', { name });

beforeEach(() => {
  localStorage.clear();
  setAppearance(DEFAULT_APPEARANCE);
  change.mockReset().mockResolvedValue('changed');
});

test('3 つのグループに 12・9・4 個の選択肢があり、既定は赤・赤・黒が選択中', () => {
  render(<AppearanceSection />);
  expect(within(group('アイコンの色')).getAllByRole('button')).toHaveLength(12);
  expect(within(group('強調色')).getAllByRole('button')).toHaveLength(9);
  expect(within(group('背景')).getAllByRole('button')).toHaveLength(4);
  expect(within(group('アイコンの色')).getByRole('button', { name: '赤' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(group('強調色')).getByRole('button', { name: '赤' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(group('背景')).getByRole('button', { name: '黒' })).toHaveAttribute('aria-pressed', 'true');
});

test('どの選択肢にも色の名前が見えている', () => {
  render(<AppearanceSection />);
  expect(within(group('アイコンの色')).getByText('クリーム')).toBeVisible();
  expect(within(group('強調色')).getByText('ミント')).toBeVisible();
  expect(within(group('背景')).getByText('こげ茶')).toBeVisible();
});

test('強調色の「青」を押すと --red が #3B82F6 になり保存される', async () => {
  render(<AppearanceSection />);
  await userEvent.click(within(group('強調色')).getByRole('button', { name: '青' }));
  expect(css('--red')).toBe('#3B82F6');
  expect(getAppearance().accent).toBe('blue');
  expect(within(group('強調色')).getByRole('button', { name: '青' })).toHaveAttribute('aria-pressed', 'true');
});

test('背景の「紺」を押すと --bg が #0A0F1E になる', async () => {
  render(<AppearanceSection />);
  await userEvent.click(within(group('背景')).getByRole('button', { name: '紺' }));
  expect(css('--bg')).toBe('#0A0F1E');
  expect(getAppearance().bg).toBe('navy');
});

test('Web でアイコンの「黄」を押すと選択が黄になり、追加し直しの案内が出る', async () => {
  change.mockResolvedValue('reinstall');
  render(<AppearanceSection />);
  await userEvent.click(within(group('アイコンの色')).getByRole('button', { name: '黄' }));
  expect(change).toHaveBeenCalledWith('yellow');
  expect(getAppearance().icon).toBe('yellow');
  expect(await screen.findByRole('status')).toHaveTextContent('ホーム画面のアイコンをこの色にするには、ホーム画面に追加し直してください');
});

test('アイコンの切り替えに失敗すると「アイコンを変えられませんでした」が出て、選択は赤に戻る', async () => {
  change.mockResolvedValue('failed');
  render(<AppearanceSection />);
  await userEvent.click(within(group('アイコンの色')).getByRole('button', { name: '紫' }));
  expect(await screen.findByRole('status')).toHaveTextContent('アイコンを変えられませんでした');
  expect(getAppearance().icon).toBe('red');
  expect(within(group('アイコンの色')).getByRole('button', { name: '赤' })).toHaveAttribute('aria-pressed', 'true');
});

test('アプリで切り替えに成功すると、案内もエラーも出ない', async () => {
  render(<AppearanceSection />);
  await userEvent.click(within(group('アイコンの色')).getByRole('button', { name: '緑' }));
  expect(change).toHaveBeenCalledWith('green');
  expect(getAppearance().icon).toBe('green');
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});
