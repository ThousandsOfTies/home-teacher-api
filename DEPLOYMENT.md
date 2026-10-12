# 共有Cloud Run APIの公開

TutoTutoとDoriDoriの共有APIの公開元は `ThousandsOfTies/home-teacher-api`。
現行のAPIのURL・Firebaseプロジェクト・Stripe設定を使用する。CopiCopiは別サービス。

## 手順

変更をcommit・pushし、API専用CIを通してから実行する。

```sh
npm run deploy:staging
# stagingのAPI、変更した機能、既存フロントとの互換性を検証する
npm run deploy:production
```

Google Cloud CLI 587.0.0以降でプロジェクト `hometeacher-api` への認証・公開権限が必要。
stagingは `hometeacher-api-staging`、本番は `hometeacher-api`、リージョンは `asia-northeast1`。
未コミットの変更を拒否し、必要なソースだけを `.cloud-run` に生成する。
既存サービスの環境変数・Secret Manager参照・サービスアカウント・リソース・スケール設定を保持する。
各リビジョンに `source-repository=home-teacher-api` と `git-sha=<40桁のコミット>` を付ける。
`cloudbuild.yaml` の `options.workerRelease: regular` でイメージをビルドし、成功したイメージのSHA256ダイジェストを指定して公開する。
Docker BuildKitが対応しない `docker build --network cloudbuild` を生成する `gcloud run deploy --source` は使用しない。
ビルドに失敗した場合は公開を行わない。ビルド用サービスアカウントは既存のCompute Engineデフォルトアカウントを使用する。
アプリの旧公開コマンドは、APIリポジトリの手順を案内して停止する。

Cloud Runを変更せずにビルドだけ確認する場合：

```sh
npm run deploy:staging -- --build-only
```

リリースチャンネルの仕様は [Cloud Build公式ドキュメント](https://docs.cloud.google.com/build/docs/release-channels) を参照。

## 動作の確認

- `/api/health`、`/api/models`、`/api/subjects` が200。
- `/api/grade-work`、`/api/ask-question`、`/api/book/embed`、`/api/book/read-question`、`/api/book/ask`、`/api/book/ask-agent`、`/api/book/reference-media` は空JSONで400。404はAPIの欠落。
- `/api/book/ocr` は410でAIを呼ばない。
- 未認証の課金・SNS時間更新APIは401。Stripe Webhookは生データと署名を検証する。
- AIや課金の処理を変更する場合は、stagingで実際の変更対象を確認してから本番へ公開する。
- 本文問い合わせの最大2往復、参照ページ、先のページの許可は既存フロントで維持する。

## 公開ソース

```sh
npm run prepare:deploy
docker build -t home-teacher-api-check .cloud-run
```

`.env`、認証ファイル、フロント資産は許可リストに入らず、アップロードされない。
採点定義はAPI側で固定した共通サブモジュールから取得し、Dockerのビルド時にサーバーへまとめる。
API側で共通定義を更新する場合は、アプリが使う固定版との互換性も確認する。
