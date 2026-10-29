# firebase-rest-firestore

## リリース

- main への push で Release ワークフロー (`.github/workflows/release.yml`) が走り、テストのあと semantic-release が動く。
  **`fix:` / `feat:` / `perf:` のコミットがあれば npm に新しい版が自動で publish される** (scope が `test` などでも同じ)。
  `chore:` / `ci:` / `docs:` / `test:` だけなら版は出ない
- テストや CI だけの修正は `fix:` ではなく `test:` / `ci:` / `chore:` で squash マージする。
  2026-10-29 に `fix(test): ...` をマージして、中身が変わらない 1.6.4 が出た
- npm へは Trusted Publishing (OIDC) で publish する。リポジトリのシークレットは使わない
  (`NPM_TOKEN` と `FIREBASE_*` は 2026-10-29 に削除した)

## テスト

- `npm run test:unit`: エミュレータも認証情報も要らないテストだけを回す
- `npm run test:emulator:ci`: `firebase emulators:exec` で Firestore エミュレータを立て、全テストを回す。CI (PR・Release) はこれを使う。
  firebase CLI と Java 21 以上が必要。CI では firebase-tools をバージョン固定で入れている
- `npm run test:emulator`: 手元用。`.env` (`npm run setup:local:env` で作る) を読み、起動済みのエミュレータがあればそれを使う
- 本物の Firebase プロジェクトにはつながない。以前 CI で使っていたテスト用プロジェクトは 2026-10-26 に削除され、
  結合テストが `403 PERMISSION_DENIED` (`CONSUMER_INVALID`) で落ちたので、エミュレータに切り替えた
- 落とし穴: `firebase emulators:exec` は子プロセスに `FIRESTORE_EMULATOR_HOST=127.0.0.1:8089` (ポート付き) を渡す。
  テストの helper はホストとポートを別々に読むので、そのままだと URL が `127.0.0.1:8089:8089` になって落ちる。
  `test:emulator:ci` はコマンドの中でホストを `127.0.0.1` に入れ直している
