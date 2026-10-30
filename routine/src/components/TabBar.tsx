import { NavLink } from 'react-router-dom';
import s from '../../../src/components/TabBar.module.css';

const TABS = [
  { to: '/', label: '今日', icon: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></> },
  { to: '/history', label: '記録', icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { to: '/routines', label: 'ルーティン', icon: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> },
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
