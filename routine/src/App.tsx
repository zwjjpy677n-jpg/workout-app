import { useLayoutEffect, useRef } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { HistoryPage } from './features/history/HistoryPage';
import { RoutinesPage } from './features/routines/RoutinesPage';
import { TodayPage } from './features/today/TodayPage';

// 中身だけをスクロールさせ、タブバーはその下に並べる（GRIND と同じ作り）
function TabLayout({ storageOk }: { storageOk: boolean }) {
  const main = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [pathname]);
  return (
    <div className="shell">
      {!storageOk && (
        <div role="alert" className="storage-alert">
          この端末では保存できません。プライベートブラウズをやめるか、別のブラウザで開いてください
        </div>
      )}
      <main ref={main} className="shell-main">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

export function App({ storageOk = true }: { storageOk?: boolean }) {
  return (
    <Routes>
      <Route element={<TabLayout storageOk={storageOk} />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/routines" element={<RoutinesPage />} />
      </Route>
    </Routes>
  );
}
