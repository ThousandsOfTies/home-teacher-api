# home-teacher-api プロジェクトルール

TutoTutoとDoriDoriが共有するAPIの唯一のソースと公開元。CopiCopiのAPI・Firebase・課金設定は独立しており、ここへ統合しない。

- サーバーは `src/`、ブラウザとの通信形式・上限は `contracts/` に置く。アプリ側へ実装や通信定義のコピーを作らない。
- 採点定義はGitサブモジュール `repos/home-teacher-common` の固定コミットを参照する。更新時は採点・モデル・科目の互換性を確認する。
- 未コミット変更を上書きしない。変更前に状態を確認し、`pull --ff-only` 後に作業する。
- 依存を復元するには `git submodule update --init --recursive`、検証は `npm ci`、`npm test`。
- 公開順序はAPIの検証・commit・push → APIのCI確認 → アプリとメタの固定コミットを更新 → staging検証 → 本番公開。
- 公開はこのリポジトリの `npm run deploy:staging` / `npm run deploy:production` を使う。アプリから共有APIを公開しない。
- `.env`・認証ファイル・秘密情報をGitへ入れない。公開ソースは `prepare:deploy` の許可リストで作る。
- Stripe Webhookの生データの処理順、認証・課金の保存形式、既存URLと入力・出力を維持する。
- 本文索引はテキストのみ。画像OCRを追加しない。本文問い合わせは最大2往復で、先のページは利用者が許可した場合だけ参照する。
