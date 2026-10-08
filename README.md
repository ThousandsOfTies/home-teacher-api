# home-teacher-api

TutoTutoとDoriDoriの共有Express API。採点 `/api/grade-work`、追加質問 `/api/ask-question`、本文参照 `/api/book/*`、認証・課金を提供する。CopiCopiのAPI・Firebase・Stripeは別構成。

## 構成

- `src/`：サーバーの唯一の実装。
- `contracts/bookAgentProtocol.ts`：ブラウザとAPIで共有する本文要求の型・検証・上限。
- `tests/`：本文要求・画像参照・コスト上限・設定・起動・公開ソースの検証。
- `repos/home-teacher-common`：採点の定義を固定するGitサブモジュール。Reactやフロント依存のインストールはAPIの起動に不要。
- `Dockerfile` / `scripts/`：API専用のビルドと公開。

両アプリのメタリポジトリは、このリポジトリを `repos/home-teacher-api` として同じコミットへ固定する。各アプリの `shared/bookAgentProtocol.ts` はこの通信定義への再エクスポート。サーバーソースのコピーは保持しない。

## 開発と検証

```sh
git clone --recursive https://github.com/ThousandsOfTies/home-teacher-api.git
cd home-teacher-api
npm ci
# .env.example を .env にコピーし、サーバー用の設定を記入する
npm run dev
npm test
```

Node.js 20以降。APIの既定ポートは3003。APIキーはサーバー側のみ。
実行環境の変数を最優先にし、API直下の `.env` を読む。親ディレクトリの `.env` は自動で読まない。
アプリから `npm run dev:server` を実行した場合だけ、互換用にアプリの `server/.env`、アプリ直下 `.env` の順でも読み込む。API直下 `.env` の値が優先し、実行環境の変数は上書きしない。
認証ファイルの相対パスもAPI直下を優先し、アプリから起動した場合は従来の保存先を参照できる。

`npm test` はAIや決済APIを呼ばず、モックと入力検証で確認する。API専用CIはテストとDockerビルドを実行する。
GitHub Pagesへのフロント公開は各メタリポジトリのCIが担当する。

## Cloud Runへの公開

[DEPLOYMENT.md](DEPLOYMENT.md) を参照。公開コマンドとソースの正はこのリポジトリのみ。
Gitの固定コミットは開発時の版であり、本番接続先の版を選ぶものではない。公開したコミットはCloud Runリビジョンの `git-sha` ラベルで確認する。

## 移行元

2026-10-08に `tutotuto-app` の `9ac3699f1c5ebec66b29da925481e973d85dffcd` の `server/` から抽出した。
本文要求の通信定義はその時点の両アプリで一致することを確認して移した。採点定義は `home-teacher-common` の `72bb4da` を固定している。
