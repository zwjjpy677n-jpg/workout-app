export type Slot = 'morning' | 'pre' | 'post' | 'night';

export const SLOTS: { key: Slot; label: string }[] = [
  { key: 'morning', label: '朝' },
  { key: 'pre', label: '練習前' },
  { key: 'post', label: '練習後' },
  { key: 'night', label: '夜' },
];

/** ルーティン項目。消しても行は残し（deletedAt）、過去の記録の分母に使う */
export interface Item {
  id: string;
  name: string;
  slot: Slot;
  /** やる曜日（0=日〜6=土） */
  days: number[];
  kind: 'check' | 'number';
  target?: number;
  unit?: string;
  step?: number;
  order: number;
  active: boolean;
  createdAt: number;
  deletedAt?: number;
}

/** 1日1項目につき1件。id は `${date}:${itemId}` */
export interface Log {
  id: string;
  date: string;
  itemId: string;
  done: boolean;
  value?: number;
}

export interface Todo {
  id: string;
  date: string;
  text: string;
  done: boolean;
  order: number;
  /** 持ち越し元の日付 */
  carriedFrom?: string;
}
