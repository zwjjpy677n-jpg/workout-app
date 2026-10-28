import { useState } from 'react';
import { BackupPanel } from './BackupPanel';
import { BodyweightList } from './BodyweightList';
import { ExerciseList } from './ExerciseList';
import { RoutineList } from './RoutineList';
import { SettingsForm } from './SettingsForm';
import s from './manage.module.css';

const SECTIONS = [
  { key: 'exercises', label: '種目', el: <ExerciseList /> },
  { key: 'routines', label: 'ルーティン', el: <RoutineList /> },
  { key: 'bodyweight', label: '体重', el: <BodyweightList /> },
  { key: 'settings', label: '設定', el: <SettingsForm /> },
  { key: 'backup', label: 'バックアップ', el: <BackupPanel /> },
] as const;

export function ManagePage() {
  const [cur, setCur] = useState<string>('exercises');
  return (
    <div className="page">
      <h1 className="page-title">MANAGE</h1>
      <div className={s.seg} role="tablist">
        {SECTIONS.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={cur === x.key} onClick={() => setCur(x.key)}>
            {x.label}
          </button>
        ))}
      </div>
      {SECTIONS.find((x) => x.key === cur)?.el}
    </div>
  );
}
