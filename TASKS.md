# MCModLocalizer2 実装タスク

## フェーズ構成

```
Phase 0: プロジェクト基盤
Phase 1: コアロジック (TypeScript 移植)
Phase 2: メインプロセス & IPC
Phase 3: プリロード & Renderer (React UI)
Phase 4: 統合・品質
Phase 5: テスト
Phase 6: CI/CD & 配布
```

---

## Phase 0: プロジェクト基盤

### 0-1. electron-vite スキャフォールド
- [ ] `npm create @quick-start/electron` で React + TypeScript テンプレートを生成
- [ ] `electron-builder.yml` を作成 (win/mac ターゲット・publish 設定)
- [ ] `tsconfig.json` を `strict: true` で設定
- [ ] ESLint + Prettier を設定

### 0-2. 依存パッケージのインストール
```bash
# 本番依存
npm i electron-store keytar @google/generative-ai adm-zip zustand

# 開発依存
npm i -D electron-builder electron-vite vitest @playwright/test
npm i -D tailwindcss postcss autoprefixer
npm i -D @types/adm-zip @types/keytar
```

### 0-3. Tailwind CSS セットアップ
- [ ] `tailwind.config.ts` で `darkMode: 'class'` を設定
- [ ] `src/renderer/index.css` に `@tailwind` ディレクティブを追加

### 0-4. 開発環境検証
- [ ] `npm run dev` でウィンドウが起動することを確認
- [ ] `npm run build` が通ることを確認

---

## Phase 1: コアロジック (TypeScript 移植)

`src/main/core/` 以下に実装。単体テスト可能なピュア関数として設計する。

### 1-1. 定数定義 (`constants.ts`)
- [ ] `PROTECT_RE` 正規表現 (Python 版 `constants.py` から移植)
- [ ] `SYSTEM_INSTRUCTIONS_BASE` プロンプト文字列
- [ ] `USER_TEMPLATE` プロンプトテンプレート
- [ ] `MODEL_DEFINITIONS` (id/label/単価のリスト)

### 1-2. トークン保護 (`tokenProtection.ts`)
- [ ] `protectTokens(s: string): { protected: string; mapping: Map<string, string> }` を実装
- [ ] `restoreTokens(s: string, mapping: Map<string, string>): string` を実装
- [ ] Vitest ユニットテストを記述 (`%s`, `§a`, `{name}`, `{0}` のケース)

### 1-3. JSON I/O (`jsonIO.ts`)
- [ ] `loadJson(path: string): Record<string, string>` — ファイルが存在しない場合は `{}` を返す
- [ ] `writeJson(path: string, data: Record<string, string>): void` — 親ディレクトリを自動作成

### 1-4. チャンク分割 (`chunking.ts`)
- [ ] `chunkPairs(pairs: [string, string][], maxChars: number, maxItems: number): [string, string][][]` を実装
- [ ] Vitest ユニットテストを記述 (境界値: 空配列・ちょうど上限・超過)

### 1-5. JAR スキャン (`jarReader.ts`)
- [ ] `adm-zip` で `.jar` を ZIP として開く
- [ ] `assets/<modid>/lang/en_us.json` を抽出する正規表現
- [ ] JAR 内 `.jar` を検出したら再帰呼び出し (深さ制限 2)
- [ ] `choosePrimaryModid(modMaps)` — エントリ数が最多の modid を選択
- [ ] Vitest ユニットテストを記述 (モックした ZIP バイナリを使用)

### 1-6. Gemini API クライアント (`geminiClient.ts`)
- [ ] `fetch` ベースで OpenAI 互換エンドポイントを呼び出す
- [ ] `AbortController` の `signal` を受け取り、停止時にキャンセルできる
- [ ] Exponential Backoff リトライ (429/5xx、最大 5 回、初期待機 5s)
- [ ] HTTP 400/401/403 は即時 throw
- [ ] レスポンスから `{ items: string[] }` をパース
- [ ] 要素数不足時の再試行ロジック (再帰深さ 2 まで)
- [ ] 使用トークン数を返す (`promptTokens`, `completionTokens`)
- [ ] ログコールバック `onLog` を受け取り、リトライ状況をログに流す

---

## Phase 2: メインプロセス & IPC

### 2-1. electron-store セットアップ (`store/index.ts`)
- [ ] `AppStore` スキーマの型定義
- [ ] `createStore()` — electron-store のラッパー (get/set/reset)
- [ ] デフォルト値を定義

### 2-2. keytar ラッパー (`keychain.ts`)
- [ ] `getApiKey()`, `setApiKey(key: string)`, `deleteApiKey()` を実装
- [ ] サービス名: `MCModLocalizer2`、アカウント名: `gemini-api-key`
- [ ] `electron-rebuild` またはビルドスクリプトで keytar をリビルドする設定

### 2-3. 翻訳サービス (`services/translation.ts`)
- [ ] `TranslationRunner` クラスを実装
  - `start(request: TranslationRequest, callbacks: TranslationCallbacks): Promise<void>`
  - `stop(): void` — 内部 `AbortController` を abort
- [ ] N 並列処理 (`Promise.all` + セマフォ的制御)
- [ ] 中間ファイルの読み書き (`.resume/<modid>.json`)
- [ ] 中間ファイルがある場合に再開ロジックを実行

### 2-4. 抽出サービス (`services/extraction.ts`)
- [ ] `scanModsDir(modsDir: string): JarEntry[]` — `.jar` を列挙
- [ ] `buildResourcePack(outDir: string, modId: string, jaJson: Record<string, string>): void`
  - `pack.mcmeta` の生成
  - `pack.png` のコピー (アプリ内蔵 `assets/icon.png` を使用)
  - `assets/<modid>/lang/ja_jp.json` の書き出し

### 2-5. IPC ハンドラー (`ipc/handlers.ts`)
- [ ] チャンネル名を `channels.ts` に定数として定義
- [ ] `dialog:openFolder` — `dialog.showOpenDialog` で実装
- [ ] `translation:start` — `TranslationRunner.start()` を呼び出し、コールバックで `webContents.send`
- [ ] `translation:stop` — `TranslationRunner.stop()` を呼び出し
- [ ] `keychain:get/set/delete` — keychain ラッパーへの橋渡し
- [ ] `store:get/set/reset` — electron-store ラッパーへの橋渡し

### 2-6. ウィンドウ管理 (`main/index.ts`)
- [ ] ウィンドウ生成 (`contextIsolation: true`, `sandbox: true`, `preload: preloadPath`)
- [ ] 前回のウィンドウ位置・サイズを electron-store から復元
- [ ] `close` イベントで現在の位置・サイズを保存
- [ ] electron-updater の初期化 (起動時にアップデート確認)

### 2-7. 出力フォルダ推測ロジック
- [ ] `inferOutDir(modsDir: string): string` を実装
  - `<root>/mods/` → `<root>/resourcepacks/<root_name>_localize`
  - それ以外 → `<modsDir>/../<parentName>_localize`
- [ ] IPC チャンネルで renderer から呼び出せるようにする

---

## Phase 3: プリロード & Renderer

### 3-1. preload (`preload/index.ts`)
- [ ] `contextBridge.exposeInMainWorld('electron', { ... })` で以下を公開:
  - `invoke(channel, ...args)` — 許可チャンネルのみ通過
  - `on(channel, callback)` / `off(channel, callback)` — イベントリスナー
- [ ] 許可チャンネルをホワイトリストで管理

### 3-2. Zustand ストア (`renderer/store/index.ts`)
- [ ] `useAppStore` — テーマ・設定・ログリスト・進捗・セッショントークンを管理
- [ ] IPC イベント受信時にストアを更新する `setupIpcListeners()` を実装

### 3-3. App.tsx & タブルーター
- [ ] タブ切り替え (抽出/トークン/設定)
- [ ] `ThemeProvider` — `dark` クラスを `<html>` に付け外し
- [ ] システムテーマ変更 (`matchMedia`) を監視して追従

### 3-4. 共通コンポーネント

#### FolderInput.tsx
- [ ] テキスト入力 + 「フォルダを選択」ボタン
- [ ] D&D でフォルダをドロップ → `event.dataTransfer.files[0].path` をセット
- [ ] D&D で `.jar` ファイルをドロップ → 単体 JAR 処理モードに切り替え

#### LogViewer.tsx
- [ ] 仮想スクロール (件数が多くても描画コストを抑える)
- [ ] 末尾に自動スクロール (ユーザーが上にスクロール中は追従しない)
- [ ] ログレベル別の色付け (`info`: 白/グレー, `warn`: 黄, `error`: 赤)
- [ ] 右上に「コピー」ボタン (全ログをクリップボードへ)

#### ProgressBar.tsx
- [ ] Mod 名 + 進捗率 + パーセント表示

### 3-5. ExtractTab.tsx
- [ ] `FolderInput` × 2 (mods / output)
- [ ] 出力フォルダ推測テキストの表示
- [ ] 並列数セレクター (1〜8)
- [ ] 「翻訳を開始」「停止」ボタン (排他表示)
- [ ] `LogViewer` の配置
- [ ] Mod 別 `ProgressBar` のリスト
- [ ] 完了後に OS 通知 (`new Notification(...)`)

### 3-6. TokenTab.tsx
- [ ] セッション統計 (入力/出力/合計トークン・概算コスト)
- [ ] 履歴テーブル (日時・モデル・トークン・コスト)
- [ ] electron-store の `usageHistory` から読み込み

### 3-7. SettingsTab.tsx
- [ ] モデルセレクター + 単価表示
- [ ] API キー入力 (マスク) + 保存/削除ボタン
- [ ] 翻訳詳細設定 (並列数・チャンク設定・スリープ)
- [ ] テーマ切り替えラジオボタン
- [ ] 「アプリを初期化」ボタン + 確認ダイアログ

---

## Phase 4: 統合・品質

### 4-1. D&D の統合テスト
- [ ] フォルダ D&D が `FolderInput` に反映されることを手動確認
- [ ] `.jar` D&D が単体処理として動作することを確認

### 4-2. 翻訳フロー E2E 動作確認
- [ ] テスト用 JAR (最小限の `en_us.json` を含む) を作成
- [ ] API キーをセットして翻訳が完走することを確認
- [ ] 途中で停止ボタンを押し、中間ファイルが生成されることを確認
- [ ] 中間ファイルから再開できることを確認

### 4-3. エラーハンドリング確認
- [ ] API キー未設定時のボタン無効化を確認
- [ ] 不正 API キーで HTTP 403 → ログへのエラー表示を確認
- [ ] Rate Limit (429) → リトライログが表示されることを確認 (モック)

### 4-4. テーマ切り替えの動作確認
- [ ] ライト/ダーク/システム の 3 モードが正しく切り替わることを確認
- [ ] ウィンドウリサイズ後も次回起動で位置・サイズが復元されることを確認

### 4-5. keytar ネイティブモジュール確認
- [ ] Windows/macOS 両方でキーの保存・取得・削除が動作することを確認
- [ ] `electron-builder` でパッケージ後も keytar が機能することを確認

---

## Phase 5: テスト

### 5-1. Vitest ユニットテスト
- [ ] `tokenProtection.ts` — 6 パターン以上の保護・復元テスト
- [ ] `chunking.ts` — 空・ちょうど上限・超過・大量データのテスト
- [ ] `jarReader.ts` — モック ZIP を使った抽出テスト (再帰含む)
- [ ] `geminiClient.ts` — `msw` でモックして 429 リトライ・401 即時失敗テスト
- [ ] `translation.ts` — 差分翻訳ロジック・中間ファイル再開テスト

### 5-2. Playwright E2E テスト
- [ ] セットアップ: `playwright.config.ts` に Electron アプリの起動設定を記述
- [ ] テスト: アプリ起動 → タブ切り替えが動作する
- [ ] テスト: フォルダ選択ダイアログが開く (モック)
- [ ] テスト: 設定タブで API キーを保存 → マスク表示になる
- [ ] テスト: テーマ切り替えで `<html>` の `dark` クラスが変わる
- [ ] テスト: 翻訳開始 → ログが流れる → 完了メッセージが表示される (モック API)

---

## Phase 6: CI/CD & 配布

### 6-1. GitHub Actions ワークフロー (`.github/workflows/build.yml`)
- [ ] トリガー: `push` (tag `v*.*.*`)
- [ ] マトリックス: `windows-latest` / `macos-latest`
- [ ] ステップ:
  1. `actions/checkout`
  2. `actions/setup-node` (Node.js 20)
  3. `npm ci`
  4. `npm run typecheck`
  5. `npm run test`
  6. `npm run dist` (electron-builder)
  7. `softprops/action-gh-release` で Release に成果物をアップロード

### 6-2. electron-updater 設定
- [ ] `electron-builder.yml` に `publish.provider: github` を設定
- [ ] メインプロセスで `autoUpdater` を初期化
- [ ] 更新通知ダイアログを実装

### 6-3. アイコン整備
- [ ] `assets/icon.png` (256×256 以上) を用意
- [ ] Windows 用 `icon.ico`、macOS 用 `icon.icns` を生成

### 6-4. README 更新
- [ ] インストール方法 (インストーラー)
- [ ] 使い方のスクリーンショット
- [ ] Gemini API キーの取得方法

---

## 実装優先度と依存関係

```
0-1~0-4 (基盤)
  └→ 1-1~1-6 (コアロジック)
       └→ 2-1~2-7 (メインプロセス)
            └→ 3-1~3-7 (UI)
                 └→ 4-1~4-5 (統合確認)
                      └→ 5-1~5-2 (テスト)
                           └→ 6-1~6-4 (CI/CD)
```

Phase 1 のコアロジックは Phase 2 UI なしで Vitest テスト可能。
Phase 2 の IPC ハンドラーは Phase 3 なしで独立してテスト可能。
Phase 3 のコンポーネントは IPC をモックして Vitest/Storybook で確認可能。

---

## 見積もり

| フェーズ | 概算工数 |
|---|---|
| Phase 0 | 0.5 日 |
| Phase 1 | 2 日 |
| Phase 2 | 2 日 |
| Phase 3 | 3 日 |
| Phase 4 | 1 日 |
| Phase 5 | 1.5 日 |
| Phase 6 | 1 日 |
| **合計** | **約 11 日** |
