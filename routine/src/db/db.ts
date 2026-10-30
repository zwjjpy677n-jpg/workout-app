import Dexie, { type Table } from 'dexie';
import type { Item, Log, Todo } from '../lib/types';

export type MetaRow = { key: string; at: number };

// GRIND の DB とは別。名前は routine
class RoutineDB extends Dexie {
  items!: Table<Item, string>;
  logs!: Table<Log, string>;
  todos!: Table<Todo, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('routine');
    this.version(1).stores({
      items: 'id',
      logs: 'id, date, itemId',
      todos: 'id, date',
      meta: 'key',
    });
  }
}

export const db = new RoutineDB();
