import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

export const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function Where() {
  const l = useLocation();
  return <div data-testid="location">{l.pathname + l.search}</div>;
}

/** path に element を置き、それ以外の遷移先は現在地を表示するだけのダミーにする */
export function renderRoute(path: string, pattern: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <Routes>
        <Route path={pattern} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
