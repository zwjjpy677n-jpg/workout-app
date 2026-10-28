import { HashRouter, Outlet, Route, Routes } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { HomePage } from './features/home/HomePage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { ProgressPage } from './features/progress/ProgressPage';
import { ManagePage } from './features/manage/ManagePage';
import { WorkoutPage } from './features/workout/WorkoutPage';

function TabLayout() {
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<TabLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/manage" element={<ManagePage />} />
      </Route>
      <Route path="/workout" element={<WorkoutPage />} />
      <Route path="/workout/:id" element={<WorkoutPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
