import { render } from '@testing-library/react';
import { DEFAULT_APPEARANCE, setAppearance } from '../../lib/appearance';
import { ProgressChart } from './ProgressChart';

const data = [
  { date: Date.UTC(2026, 9, 1), value: 60 },
  { date: Date.UTC(2026, 9, 8), value: 65 },
];

afterEach(() => setAppearance(DEFAULT_APPEARANCE));

// iPhone の Safari は SVG の属性に書いた var() を解決しないことがあるので、色は実際の値で渡す
test('グラフの線は選んだ強調色・背景の実際の色で描く', () => {
  setAppearance({ icon: 'red', accent: 'blue', bg: 'navy' });
  const { container } = render(<ProgressChart data={data} format={String} />);
  const html = container.innerHTML;
  expect(html).not.toContain('var(--');
  expect(container.querySelector('path[stroke="#3B82F6"]')).not.toBeNull();
  expect(container.querySelector('stop[stop-color="#3B82F6"]')).not.toBeNull();
  expect(container.querySelector('[stroke="#283149"]')).not.toBeNull();
});
