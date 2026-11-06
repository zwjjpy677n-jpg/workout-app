import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { autoFinishLongWorkout } from '../../db/repository';
import { toDateKey } from '../../lib/dates';

const CHECK_MS = 60_000;

/** 記録中のワークアウトが2時間を超えたら、自動で終了して保存する。起動したとき・画面に戻ったとき・1分ごとに確かめる */
export function AutoFinish() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const where = useRef(pathname);
  where.current = pathname;
  const busy = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const r = await autoFinishLongWorkout();
        if (!r) return;
        // 記録の画面を開いていたら、終わったワークアウトの画面から離れる
        if (where.current === '/workout') navigate(r.result === 'saved' ? `/calendar?date=${toDateKey(r.workout.startedAt)}` : '/', { replace: true });
        window.alert(
          r.result === 'saved'
            ? `「${r.workout.name}」が2時間を超えたので、自動で終了して保存しました`
            : `「${r.workout.name}」が2時間を超えましたが、完了したセットが無かったので記録を消しました`,
        );
      } catch {
        /* 次の確認でやり直す */
      } finally {
        busy.current = false;
      }
    };
    void check();
    const id = setInterval(() => void check(), CHECK_MS);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [navigate]);
  return null;
}
