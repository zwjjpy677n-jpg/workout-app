import { useLayoutEffect, useRef } from 'react';
import { HashRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { GroupPage } from './features/groups/GroupPage';
import { HomePage } from './features/home/HomePage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { ProgressPage } from './features/progress/ProgressPage';
import { ManageRoute } from './features/manage/ManagePage';
import { FriendsPage } from './features/friends/FriendsPage';
import { ImportPage } from './features/friends/ImportPage';
import { JoinPage } from './features/friends/JoinPage';
import { FriendPage } from './features/friends/FriendPage';
import { FriendExercisePage } from './features/friends/FriendExercisePage';
import { MenuEditorPage } from './features/friends/MenuEditorPage';
import { FriendMenuPage } from './features/friends/FriendMenuPage';
import { WorkoutPage } from './features/workout/WorkoutPage';

// 中身だけをスクロールさせ、タブバーはその下に並べる（iPhone のホーム画面アプリでは、画面に固定したバーが短いページで浮くため）
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

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/manage" element={<ManageRoute />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/friends/add" element={<ImportPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/friends/:id" element={<FriendPage />} />
        <Route path="/friends/:id/exercise/:x8" element={<FriendExercisePage />} />
        <Route path="/friends/:id/menu/new" element={<MenuEditorPage />} />
        <Route path="/friends/:id/menus/:name" element={<FriendMenuPage />} />
        <Route path="/friends/groups/:id" element={<GroupPage />} />
      </Route>
      <Route path="/workout" element={<WorkoutPage />} />
      <Route path="/workout/:id" element={<WorkoutPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </HashRouter>
  );
}
