# オンライン共有を使えるようにする（Supabase のセットアップ）

キントレ部の「オンラインでつながる」（友達と記録を自動で見せ合う・メニューをアプリで送る）は、Supabase という無料のサーバーを使います。
ここに書いた順に画面を進めれば、プログラムを書かずに設定できます。全部で 30 分ほどです。

設定しないうちは、アプリにオンラインの機能は出てきません（今までどおり端末の中だけで動きます）。

---

## 1. Supabase のアカウントを作る

1. ブラウザで https://supabase.com を開く
2. 右上の **Start your project**（または **Sign up**）を押す
3. **Continue with GitHub** を押して、いつもの GitHub アカウントでログインする
   （メールアドレスで登録してもかまいません）

## 2. プロジェクトを作る

1. ログイン後の画面で **New project** を押す
2. 次のように入れる
   - **Name**: `kintorebu`（何でもよい）
   - **Database Password**: **Generate a password** を押して出てきたものを、パスワード管理アプリなどに控えておく（あとで使うことはほぼありませんが、無くすと戻せません）
   - **Region**: **Northeast Asia (Tokyo)** を選ぶ
   - **Plan**: Free（無料）
3. **Create new project** を押す。準備に 1〜2 分かかるので、緑の表示に変わるまで待つ

## 3. 表と決まりごとを作る（schema.sql を実行する）

1. 左のメニューの **SQL Editor**（`>_` のような絵）を開く
2. **New query**（または `+`）を押して、空の入力欄を出す
3. このリポジトリの `supabase/schema.sql` を GitHub で開き、右上の **Copy raw file**（重なった四角の絵）で中身を全部コピーする
4. SQL Editor の入力欄に貼り付けて、右下の **Run** を押す
5. 下に **Success. No rows returned** と出れば成功
   - 何度実行しても壊れないように作ってあるので、失敗したら直してもう一度 Run してかまいません
   - `delete from auth.users` のところでエラーになった場合は、その旨を開発者（Claude）に伝えてください。これはアカウント削除の機能（第 2 段階で使う予定）の部分なので、オンライン共有そのものは先に進められます

## 4. ログイン用のメール（確認コード）を設定する

キントレ部は、メールに届く 6 桁の確認コードでログインします。

1. 左のメニューの **Authentication** を開く
2. **Sign In / Providers**（または **Providers**）を開き、**Email** が **Enabled**（オン）になっていることを確かめる
   - **Confirm email** はオンのままでかまいません
3. 左の **Emails**（または **Email Templates**）を開く
4. **Magic Link** のテンプレートを開き、次のように書き換えて **Save** を押す
   - **Subject（件名）**: `キントレ部の確認コード`
   - **Body（本文）**: 次の 1 行だけにする

     ```
     キントレ部の確認コード: {{ .Token }}
     ```

5. 同じように **Confirm signup** のテンプレートも、件名と本文を上と同じにして **Save** を押す
   （はじめてログインする人にはこちらのメールが届くため）

`{{ .Token }}` のところに 6 桁の数字が入って届きます。ここを書き換えないと、数字ではなくリンクが届いてしまいます。

> 無料のプランでは、メールは 1 時間に数通までしか送れません。たくさんの人で一度に試すと「しばらく待ってください」と出ることがあります。少し時間をおけば送れるようになります。

## 5. 無料プランの「一時停止」について

無料のプロジェクトは、**7 日間だれも使わないと自動で一時停止** します。停止中はアプリのオンライン機能が「つながらない」状態になります（端末の中の記録は消えません）。

- Supabase から「Your project has been paused」のようなメールが届きます
- 戻すときは、Supabase にログインしてプロジェクトを開き、**Restore project**（または **Resume**）を押すだけです。数分で元どおりになり、データもそのまま残っています
- 毎週だれかが使っていれば止まりません

## 6. 接続先の URL と鍵を控える

1. 左下の歯車 **Project Settings** を開く
2. **Data API**（または **API**）を開き、**Project URL** をコピーして控える（`https://xxxx.supabase.co` の形）
3. **API Keys** を開き、**anon** **public** と書かれた鍵をコピーして控える（`eyJ` で始まる長い文字）
   - **service_role**（secret）と書かれた鍵は **絶対に使わない・どこにも貼らない** でください。こちらは何でもできてしまう鍵です
   - anon public の鍵はアプリに入れて公開される前提の鍵です。表ごとの「見てよい人」の決まり（手順 3 で作ったもの）で守られています

## 7. GitHub に登録して、アプリを作り直す

1. GitHub でこのリポジトリを開き、上のタブの **Settings** を押す
2. 左のメニューの **Secrets and variables** → **Actions** を開く
3. **Variables** のタブを選ぶ（Secrets ではなく Variables）
4. **New repository variable** を押して、次の 2 つを登録する
   - Name: `SUPABASE_URL` / Value: 手順 6 の Project URL
   - Name: `SUPABASE_ANON_KEY` / Value: 手順 6 の anon public の鍵
5. 上のタブの **Actions** を開き、左の **CI / Deploy to GitHub Pages** を選ぶ
6. 右の **Run workflow** → **Run workflow** を押す
7. 緑のチェックになったら完了。数分後に公開中のページを開き直すと、友達タブに「オンラインでつながる」が出ます

## 8. iPhone アプリ（Mac でビルドする版）に入れる

GitHub に登録した値は、GitHub 上で作るウェブ版にしか入りません。Mac で作る iPhone アプリには、Mac の中に同じ 2 つの値を置きます。

1. Mac のターミナルで `workout-app` のフォルダに入る（`cd workout-app`）
2. 次を実行して、`.env.production.local` というファイルを作る（`xxxx` と `eyJ...` は手順 6 で控えた値に置き換える）

   ```
   printf 'VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJ...\n' > .env.production.local
   ```

3. いつもどおり `npm run build:ios` をやり直して、Xcode で ▶ を押す

このファイルは GitHub には上がりません（`.gitignore` で外してあります）。Mac を替えたときや、フォルダを作り直したときは、もう一度作ってください。
ひな形は `.env.example` にあります。

## 9. ちゃんと動くかの確認リスト

スマホ 2 台（またはスマホとパソコン）と、メールアドレス 3 つを用意して確かめます。

- [ ] **A さん** でログインする（友達タブ →「オンラインでつながる」→ メールアドレス → 届いた 6 桁のコードを入れる → 表示名を決める）
- [ ] **B さん** で別の端末からログインする
- [ ] A さんが招待リンクを作って B さんに送り、B さんが開いて友達になる。お互いの友達一覧に相手の名前が出る
- [ ] A さんがワークアウトを最後まで終える → しばらくして（または B さんがアプリを開き直して）B さんの側に A さんの記録が出る
- [ ] A さんが B さんにメニューをアプリで送る → B さんの側に届く
- [ ] **C さん**（3 つ目のメールアドレス）でログインし、A さん・B さんと友達にならないままでいる → C さんには A さんの記録もメニューも見えない
- [ ] Supabase の **Table Editor** を開き、左の表（profiles, friendships, shared_workouts, menu_messages など）がすべて **RLS enabled**（鍵の絵）になっている。**RLS disabled** や **Unrestricted** と出ている表があれば、手順 3 をやり直す
- [ ] **SQL Editor** で次を Run し、`authenticated` に `SELECT` `INSERT` `UPDATE` `DELETE` が並んでいる（Supabase の初期設定のままなら並んでいます。並んでいなければ開発者に相談）

  ```
  select table_name, privilege_type
  from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public'
  order by table_name, privilege_type;
  ```

全部にチェックがついたら、オンライン共有の準備は完了です。

## 困ったとき

- **コードのメールが届かない**: 迷惑メールのフォルダを見る。手順 4 のテンプレートが保存されているか確かめる。1 時間に送れる数を超えていたら、しばらく待つ
- **メールにコードではなくリンクが来る**: 手順 4 の本文に `{{ .Token }}` が入っているか確かめる
- **急につながらなくなった**: 手順 5 の一時停止かもしれません。Supabase を開いて Restore を押す
- **友達タブに「オンラインでつながる」が出ない**: 手順 7 の Variables の名前（`SUPABASE_URL` / `SUPABASE_ANON_KEY`）がぴったり合っているか、Run workflow をやり直したか確かめる。iPhone アプリなら手順 8
