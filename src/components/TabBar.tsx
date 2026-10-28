import { NavLink } from 'react-router-dom';
import s from './TabBar.module.css';

const TABS = [
  { to: '/', label: 'ホーム', icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /> },
  { to: '/calendar', label: 'カレンダー', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { to: '/progress', label: 'グラフ', icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { to: '/manage', label: '管理', icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></> },
];

export function TabBar() {
  return (
    <nav className={s.bar}>
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `${s.tab} ${isActive ? s.on : ''}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
