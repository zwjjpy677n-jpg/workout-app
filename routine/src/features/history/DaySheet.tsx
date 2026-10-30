import { Sheet } from '../../../../src/components/Sheet';
import { fromDateKey } from '../../../../src/lib/dates';
import { RoutineList } from '../today/RoutineList';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

export const dayTitle = (date: string) => {
  const d = fromDateKey(date);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`;
};

/** 過去の日のルーティンを見て、後から直す */
export function DaySheet({ date, today, onClose }: { date: string; today: string; onClose(): void }) {
  return (
    <Sheet open title={dayTitle(date)} onClose={onClose}>
      <RoutineList date={date} today={today} />
    </Sheet>
  );
}
