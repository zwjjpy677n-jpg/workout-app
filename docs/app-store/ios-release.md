# Mac で組み立てて App Store に出す手順

GRIND の iPhone アプリを、Mac で組み立てて App Store に出すまでの手順です。上から順に進めてください。

アイコンと起動画面は、リポジトリの中に用意済みです（`ios/App/App/Assets.xcassets`）。

---

## 1. 準備（最初の1回だけ）

1. **Apple Developer Program に登録する**
   - https://developer.apple.com/programs/ から登録します（年99ドル）。
   - 登録が終わるまで、数時間〜2日ほどかかることがあります。
2. **Xcode を入れる（バージョン 26 以上）**
   - Mac の App Store で「Xcode」を検索して入れます（大きいので時間がかかります）。
   - 古い Xcode では組み立てに失敗します。App Store でアップデートしてから進めてください。
   - 入れたら一度起動し、追加のコンポーネントを入れる画面が出たら「Install」を押します。
   - Xcode の「Settings → Accounts」で「＋」を押し、Apple ID（Developer Program に登録したもの）でサインインします。
3. **Node.js を入れる（バージョン 22 以上）**
   - https://nodejs.org/ から「LTS」をダウンロードして入れます。
   - 入れたあと、ターミナルで `node -v` と打って `v22` 以上と出ることを確かめます。
4. **リポジトリを取ってくる**（「ターミナル」アプリで）
   ```bash
   git clone https://github.com/zwjjpy677n-jpg/workout-app.git
   cd workout-app
   npm ci
   ```

## 2. アプリを組み立てて Xcode で開く

```bash
npm run build:ios
npx cap open ios
```

Xcode が開きます。中身を変えたときは、毎回 `npm run build:ios` をやり直してください。

部品の取り込みは、いつも `npm ci` を使ってください（`npm install` だと部品のバージョンが変わり、Xcode 側の設定ファイルまで書き換わることがあります）。

## 3. Xcode の設定（最初の1回だけ）

1. 左の一覧のいちばん上「App」を選ぶ
2. 中央の「TARGETS」で「App」を選び、上のタブで「Signing & Capabilities」を開く
3. 「Automatically manage signing」にチェックが入っていることを確かめる
4. 「Team」で自分の名前（Developer Program のチーム）を選ぶ
5. 「Bundle Identifier」が `io.github.zwjjpy677njpg.grind` になっていることを確かめる

## 4. iPhone で動かしてみる

1. iPhone を USB ケーブルで Mac につなぐ
2. iPhone の「設定 → プライバシーとセキュリティ → デベロッパモード」をオンにする（再起動が入ります）
3. Xcode の上の真ん中の機種名のところで、つないだ iPhone を選ぶ
4. 左上の ▶（Run）を押す
5. 初回に「信頼されていないデベロッパ」と出たら、iPhone の「設定 → 一般 → VPN とデバイス管理」で自分の名前を選び「信頼」を押す

### 確認リスト

- [ ] 起動画面（黒地に GRIND.）が出て、ホームが開く
- [ ] iPhone をライトモードにしても、上の時計・電池の表示が白で読める
- [ ] 機内モードにしても、文字の見た目（数字の細長い書体）が変わらない
- [ ] トレーニングを始めて、セットを完了にすると軽く振動する
- [ ] レストタイマーが始まる。初回に通知の許可を聞かれるので「許可」を押す
- [ ] レスト中にホームボタン（下からスワイプ）でアプリを閉じる → 時間になると通知が来て**音が鳴る**（マナーモードがオフのとき）
- [ ] レスト中に「スキップ」したら、通知は来ない
- [ ] アプリを開いたまま時間になったら、通知は出ず、画面と音で知らせる
- [ ] 「友達 → 自分の記録を共有」で共有画面が出る。LINE に送ったリンクが `https://zwjjpy677n-jpg.github.io/workout-app/#/friends/add?d=…` になっている
- [ ] 友達から届いたリンクをコピーして「リンクを貼り付けて追加」→「クリップボードから貼り付け」で読める
- [ ] 「管理 → バックアップ → エクスポート」で共有画面が出て、「"ファイル"に保存」できる
- [ ] 保存したファイルを「インポート」で読み込める

### 記録の引っ越し（Web 版 → アプリ）

1. Web 版（Safari やホーム画面の GRIND）で「管理 → バックアップ → エクスポート」→ ファイルに保存
2. アプリで「管理 → バックアップ → インポート」→ そのファイルを選ぶ

## 5. App Store Connect でアプリを作る

1. https://appstoreconnect.apple.com/ を開き、「アプリ」→「＋」→「新規 App」
2. 入力する内容は `docs/app-store/listing.md` のとおり
   - プラットフォーム: iOS、名前: GRIND - 筋トレ記録、プライマリ言語: 日本語、バンドル ID: `io.github.zwjjpy677njpg.grind`、SKU: grind-ios
3. 「App 情報」「価格および配信状況（無料）」「App のプライバシー（データを収集していません）」を `listing.md` のとおりに入れる
4. スクリーンショットを撮って入れる（撮り方は `listing.md`）

## 6. 提出する

1. Xcode の機種名のところで「Any iOS Device (arm64)」を選ぶ
2. メニューの「Product → Archive」
3. 終わると「Organizer」が開く。いま作ったものを選んで「Distribute App」→「App Store Connect」→ 画面の案内どおり「Upload」
4. 10〜30分ほどで App Store Connect の「TestFlight」に出てくる
   - TestFlight アプリで自分の iPhone に入れて、最後の確認をするのがおすすめ
5. App Store Connect の「iOS App 1.0」で、さっきアップロードした「ビルド」を選ぶ
6. 「審査用に追加」→「審査に提出」
   - 審査メモ（「App Review に関する情報」）には次のように書くと伝わりやすい:
     「アカウント登録は不要です。記録は端末内のみに保存します。レストタイマーは記録画面でセットを完了すると始まり、終了時に通知します。」
7. 審査は早ければ1〜3日。通ったら公開されます

## 7. 更新を出すとき

1. 中身を変えたら `npm run build:ios`
2. Xcode の「TARGETS → App → General」で
   - 「Version」を上げる（例: 1.0 → 1.1）
   - 「Build」を上げる（例: 1 → 2）。同じ Version で出し直すときも Build は必ず上げる
3. 「6. 提出する」と同じ手順で Archive → アップロード → 審査に提出

## 困ったとき

- **「No account for team」「Signing for "App" requires a development team」**: 3 の「Team」を選び直す
- **「Untrusted Developer」**: 4 の 5 を行う
- **画面が真っ白**: `npm run build:ios` をやり直してから ▶ を押す
- **パッケージの読み込みエラー**: Xcode のメニュー「File → Packages → Reset Package Caches」
