import { useLayoutEffect, useRef } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { RoutinesPage } from './features/routines/RoutinesPage';
import { TodayPage } from './features/today/TodayPage';

// 中身だけをスクロールさせ、タブバーはその下に並べる（GRIND と同じ作り）
function TabLayout() {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [pathname]);
  return (
    <div className="shell">
      <main ref={main} className="shell-main">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

const Placeholder = ({ title }: { title: string }) => <h1>{title}</h1>;

export function App() {
  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/history" element={<Placeholder title="記録" />} />
        <Route path="/routines" element={<RoutinesPage />} />
      </Route>
    </Routes>
  );
}
