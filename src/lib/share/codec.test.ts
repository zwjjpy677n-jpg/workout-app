import { decodeShare, encodeShare, shareUrl } from './codec';

test('往復で同じ内容に戻る', async () => {
  const d = { a: [1, null, 'ベンチ'], b: 'x'.repeat(500) };
  const s = await encodeShare('r', d);
  expect(s.startsWith('r1')).toBe(true);
  expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(s.length).toBeLessThan(200);
  expect(await decodeShare(s)).toEqual({ kind: 'r', data: d });
});

test('リンク全体・添えた文・改行つきの貼り付けでも読める', async () => {
  const s = await encodeShare('r', { ok: 1 });
  expect(shareUrl(s)).toMatch(/#\/friends\/add\?d=r1/);
  const pasted = `GRIND の記録です（10/21〜10/27・4回分）。\n${shareUrl(s)}\n `;
  expect((await decodeShare(pasted)).data).toEqual({ ok: 1 });
  expect((await decodeShare(`  ${s}\n`)).data).toEqual({ ok: 1 });
});

test('壊れた入力は invalid、版が新しすぎると newer', async () => {
  await expect(decodeShare('こんにちは')).rejects.toMatchObject({ code: 'invalid' });
  await expect(decodeShare('')).rejects.toMatchObject({ code: 'invalid' });
  await expect(decodeShare('r1@@@')).rejects.toMatchObject({ code: 'invalid' });
  await expect(decodeShare('r1AAAA')).rejects.toMatchObject({ code: 'invalid' });
  await expect(decodeShare('x1AAAA')).rejects.toMatchObject({ code: 'invalid' });
  await expect(decodeShare('r9AAAA')).rejects.toMatchObject({ code: 'newer' });
});
