import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Button } from '../../../../src/components/Button';
import { Sheet } from '../../../../src/components/Sheet';
import { db } from '../../db/db';
import { addTodo, deleteTodo, moveTodo, pendingBefore, updateTodo } from '../../db/repo';
import type { Todo } from '../../lib/types';
import { CarrySheet, md } from './CarrySheet';
import s from './today.module.css';

function TodoMenu({ todo, onClose }: { todo: Todo; onClose(): void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(todo.text);
  const run = (f: () => Promise<void>) => async () => {
    await f();
    onClose();
  };
  if (editing) {
    return (
      <Sheet open title="編集" onClose={onClose}>
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void run(() => updateTodo(todo.id, { text: text.trim() }))();
          }}
        >
          <input aria-label="内容" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          <Button type="submit" variant="primary" block disabled={!text.trim()}>保存</Button>
        </form>
      </Sheet>
    );
  }
  return (
    <Sheet open title={todo.text} onClose={onClose}>
      <div className={s.menu}>
        <Button block onClick={() => setEditing(true)}>編集</Button>
        <Button block onClick={run(() => moveTodo(todo.id, -1))}>上へ</Button>
        <Button block onClick={run(() => moveTodo(todo.id, 1))}>下へ</Button>
        <Button block variant="danger" onClick={run(() => deleteTodo(todo.id))}>削除</Button>
      </div>
    </Sheet>
  );
}

export function TodoList({ today }: { today: string }) {
  const todos = useLiveQuery(() => db.todos.where('date').equals(today).sortBy('order'), [today]);
  const pending = useLiveQuery(() => pendingBefore(today), [today]);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState<Todo | null>(null);
  const [carry, setCarry] = useState(false);

  return (
    <section>
      <h2 className="sec">今日のやること</h2>
      {pending && pending.length > 0 && (
        <button type="button" className={s.carry} onClick={() => setCarry(true)}>
          {`未完了が${pending.length}件あります`}
        </button>
      )}
      <div className={s.list}>
        {todos?.map((t) => (
          <div key={t.id} className={`${s.row} ${t.done ? s.done : ''}`}>
            <button type="button" role="checkbox" aria-checked={t.done} aria-label={t.text} className={s.todo} onClick={() => void updateTodo(t.id, { done: !t.done })}>
              <span className={s.box} aria-hidden="true">{t.done ? '✓' : ''}</span>
              <span className={s.name}>
                {t.text}
                {t.carriedFrom && <small className="muted">{`${md(t.carriedFrom)}から`}</small>}
              </span>
            </button>
            <button type="button" aria-label={`${t.text}のメニュー`} className={s.more} onClick={() => setMenu(t)}>…</button>
          </div>
        ))}
      </div>
      <form
        className={s.add}
        onSubmit={(e) => {
          e.preventDefault();
          void addTodo(today, text);
          setText('');
        }}
      >
        <input aria-label="やることを追加" placeholder="やることを追加" value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done" />
      </form>
      {menu && <TodoMenu todo={menu} onClose={() => setMenu(null)} />}
      {carry && pending && <CarrySheet pending={pending} today={today} onClose={() => setCarry(false)} />}
    </section>
  );
}
