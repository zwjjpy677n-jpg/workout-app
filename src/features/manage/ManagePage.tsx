import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BackupPanel } from './BackupPanel';
import { BodyweightList } from './BodyweightList';
import { ExerciseList } from './ExerciseList';
import { ProgramPanel } from './ProgramPanel';
import { RoutineList } from './RoutineList';
import { SettingsForm } from './SettingsForm';
import s from './manage.module.css';

const SECTIONS = [
  { key: 'exercises', label: '種目', el: <ExerciseList /> },
  { key: 'routines', label: 'ルーティン', el: <RoutineList /> },
  { key: 'program', label: 'プログラム', el: <ProgramPanel /> },
  { key: 'bodyweight', label: '体重', el: <BodyweightList /> },
  { key: 'settings', label: '設定', el: <SettingsForm /> },
  { key: 'backup', label: 'バックアップ', el: <BackupPanel /> },
] as const;

/** URL の ?tab= で最初に開く区分を決める（受け取ったメニューを保存したあとはルーティンを開く） */
export function ManageRoute() {
  const [params] = useSearchParams();
  const tab = params.get('tab');
  return <ManagePage initial={SECTIONS.some((x) => x.key === tab) ? tab! : undefined} />;
}

export function ManagePage({ initial = 'exercises' }: { initial?: string }) {
  const [cur, setCur] = useState<string>(initial);
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
