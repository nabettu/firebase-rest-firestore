## [1.1.2](https://github.com/nabettu/firebase-rest-firestore/compare/v1.1.1...v1.1.2) (2025-03-25)


### Bug Fixes

* 既存のドキュメントを取得してからマージする機能を追加し、テストを修正 ([d68a11c](https://github.com/nabettu/firebase-rest-firestore/commit/d68a11c9a515c990124164431cb26ab3d369bb2d))

## [1.1.1](https://github.com/nabettu/firebase-rest-firestore/compare/v1.1.0...v1.1.1) (2025-03-25)


### Bug Fixes

* FirestoreクライアントにデータベースIDのサポートを追加し、関連するURL生成を修正 ([10b4aed](https://github.com/nabettu/firebase-rest-firestore/commit/10b4aedf451f7beff2e3341c583accc1714f9e3c))

# [1.1.0](https://github.com/nabettu/firebase-rest-firestore/compare/v1.0.0...v1.1.0) (2025-03-21)


### Features

* ネストしたコレクションの操作とコレクショングループクエリのテストを追加 ([ddd8327](https://github.com/nabettu/firebase-rest-firestore/commit/ddd8327364fe119d73419742ab2a9c34317bbcfc))

# 1.0.0 (2025-03-21)


### Bug Fixes

* release.ymlからテスト実行ステップを削除し、リリースプロセスを簡素化。 ([0361080](https://github.com/nabettu/firebase-rest-firestore/commit/0361080b401d6276e8bf4ba80cb3d88c6e146282))
* release.ymlにFirebase環境変数を追加し、テスト実行時に必要な設定を明確化。 ([c82a5a3](https://github.com/nabettu/firebase-rest-firestore/commit/c82a5a3fea96cf612531bbabff96f1d8325f55b5))
* テストタイムアウトを30000ミリ秒に設定し、テスト実行時の安定性を向上。 ([c32fd41](https://github.com/nabettu/firebase-rest-firestore/commit/c32fd416124a08d26fb7bd315423cf2364df63dc))
* バージョンを0.3.1に更新し、依存関係に@semantic-release/changelog、@semantic-release/git、semantic-releaseを追加。package-lock.jsonを更新し、関連するモジュールのバージョンを最新に保つ。 ([12bd322](https://github.com/nabettu/firebase-rest-firestore/commit/12bd32296307acf0b98379ee9a1bcfb658fc78d8))
