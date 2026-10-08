# home-teacher-api

TutoTuto・DoriDoriが共有するExpress APIです。AI採点・追加質問・本の本文参照と、認証・課金を提供します。CopiCopiのAPI・Firebase・課金設定は別構成です。

## 構成

- `src/`：サーバーの実装。
- `contracts/`：ブラウザとAPIで共有する本文問い合わせの型・検証・上限。
- `repos/home-teacher-common`：採点定義を参照するGitサブモジュール。
- `tests/`、`Dockerfile`、`scripts/`：API専用の検証・ビルド・公開。

両アプリのメタリポジトリが `repos/home-teacher-api` としてコミットを固定します。アプリ側にはサーバーや通信定義のコピーを置きません。

## ローカル開発

Node.js 20以降とnpmを使用します。CI・DockerはNode.js 20、既定ポートは3003です。

```bash
git clone --recurse-submodules https://github.com/ThousandsOfTies/home-teacher-api.git
cd home-teacher-api
npm ci
# .env.example を .env にコピーして設定する
npm run dev
```

設定は [.env.example](.env.example) を参照してください。実行環境の変数を優先し、API直下の `.env` を読みます。APIキーはサーバー側に置きます。
アプリの `npm run dev:server` から起動する場合だけ、従来のアプリ `server/.env` とアプリ直下 `.env` も互換用に読みます。

`npm test` はビルドとAPIの検証を行い、実際のAI・決済APIは呼びません。API専用CIではテストとDockerビルドを実行します。

## 公開

このリポジトリから `npm run deploy:staging`、動作確認、`npm run deploy:production` の順にCloud Runへ公開します。詳しくは [DEPLOYMENT.md](DEPLOYMENT.md) を参照してください。

各アプリのGitHub Pages公開は、各メタリポジトリのCIが担当します。サブモジュールの固定コミットと本番APIの版は別管理です。本番のコミットはCloud Runリビジョンの `git-sha` ラベルで確認できます。
