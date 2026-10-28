import { render, screen } from '@testing-library/react';
import { PlateBar } from './PlateBar';

const STD = [25, 20, 15, 10, 5, 2.5, 1.25];

test('PlateBar: 色と文言', () => {
  const { container } = render(<PlateBar targetKg={82.5} barKg={20} plates={STD} />);
  expect(screen.getByText('片側 25 + 5 + 1.25 ・ バー20kg')).toBeInTheDocument();
  expect([...container.querySelectorAll('rect[data-plate]')].map((r) => r.getAttribute('fill'))).toEqual(['#D7263D', '#F7F8FA', '#AEB6C0']);
});

test('PlateBar: 端数', () => {
  render(<PlateBar targetKg={61} barKg={20} plates={[20, 10]} />);
  expect(screen.getByText('片側 20 ・ バー20kg（端数 1kg）')).toBeInTheDocument();
});

test('PlateBar: バーのみ / バー未満', () => {
  const { container, rerender } = render(<PlateBar targetKg={20} barKg={20} plates={[20]} />);
  expect(screen.getByText('バーのみ ・ バー20kg')).toBeInTheDocument();
  rerender(<PlateBar targetKg={15} barKg={20} plates={[20]} />);
  expect(container).toBeEmptyDOMElement();
});
