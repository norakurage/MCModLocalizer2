# MCModLocalizer2

Minecraft Mod 翻訳ツールの Electron 再実装。Python/Flet 版 (`MCModLocalizer/`) を TypeScript + React + Electron で書き直し、Windows/macOS 両対応のネイティブアプリとして配布する。

既存 Python 実装は `MCModLocalizer/` ディレクトリに参照用として存在する。ロジックの移植元として参照すること。

## 技術スタック

| 層 | 技術 |
|---|---|
| フレームワーク | Electron 30+ |
| ビルドツール | electron-vite |
| レンダラー | React 18 + Tailwind CSS v3 |
| 言語 | TypeScript (strict モード) |
| パッケージャー | electron-builder |
| 状態管理 (renderer) | Zustand |
| 永続ストア | electron-store |
| API キー保管 | keytar (OS Keychain / Windows 資格情報マネージャー) |
| JAR 読み取り | adm-zip または jszip |
| ユニットテスト | Vitest |
| E2E テスト | Playwright |
| CI/CD | GitHub Actions |
| 自動更新 | electron-updater |

## 主要コマンド

```bash
npm run dev          # electron-vite で HMR 開発起動
npm run build        # 本番ビルド (dist/ へ出力)
npm run dist         # electron-builder でインストーラー生成
npm run test         # Vitest ユニットテスト
npm run test:e2e     # Playwright E2E テスト
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

## ディレクトリ構成

```
MCModLocalizer2/
├── CLAUDE.md
├── SPEC.md
├── TASKS.md
├── package.json
├── tsconfig.json
├── electron-builder.yml
├── electron.vite.config.ts
├── .github/workflows/build.yml
├── src/
│   ├── main/                  # メインプロセス (Node.js)
│   │   ├── index.ts           # エントリ・ウィンドウ生成
│   │   ├── ipc/
│   │   │   ├── handlers.ts    # ipcMain.handle / on 登録
│   │   │   └── channels.ts    # チャンネル名定数
│   │   ├── core/
│   │   │   ├── jarReader.ts   # ZIP/JAR 解析・再帰スキャン
│   │   │   ├── tokenProtection.ts  # プレースホルダー保護
│   │   │   ├── chunking.ts    # バッチ分割
│   │   │   ├── constants.ts   # PROTECT_RE・プロンプト定数
│   │   │   └── jsonIO.ts      # JSON 読み書き
│   │   ├── services/
│   │   │   ├── geminiClient.ts  # Gemini REST 呼び出し (AbortController 対応)
│   │   │   ├── translation.ts   # 翻訳ワークフロー全体
│   │   │   └── extraction.ts    # JAR スキャン & リソースパック生成
│   │   ├── store/
│   │   │   └── index.ts       # electron-store ラッパー (設定・履歴)
│   │   └── keychain.ts        # keytar ラッパー
│   ├── preload/
│   │   └── index.ts           # contextBridge で renderer へ API 公開
│   └── renderer/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx            # タブルーター・テーマプロバイダー
│       ├── components/
│       │   ├── tabs/
│       │   │   ├── ExtractTab.tsx
│       │   │   ├── TokenTab.tsx
│       │   │   └── SettingsTab.tsx
│       │   └── common/
│       │       ├── LogViewer.tsx   # 仮想スクロール付きログ表示
│       │       ├── ProgressBar.tsx
│       │       └── FolderInput.tsx # D&D + ダイアログ両対応
│       └── store/
│           └── index.ts       # Zustand ストア
└── tests/
    ├── unit/                  # Vitest
    └── e2e/                   # Playwright
```

## アーキテクチャ上の重要ルール

### Electron セキュリティ
- `contextIsolation: true`, `sandbox: true` を必ず維持する
- renderer から Node.js API への直接アクセスは禁止。preload の `contextBridge` 経由のみ
- IPC チャンネル名は `channels.ts` に定数として一元管理する

### IPC パターン
- 一回性の操作 (フォルダ選択・設定読み書き・翻訳開始): `ipcMain.handle` + `ipcRenderer.invoke`
- ストリーミング (ログ・進捗更新): メインプロセスから `webContents.send` でプッシュ
- 即時停止: renderer から stop チャンネルに送信 → メインが `AbortController.abort()` を呼ぶ

### 翻訳処理
- 実行は必ずメインプロセスで行う (renderer は表示のみ)
- 中断時は翻訳済み分を中間ファイル (`<out>/.resume/<modid>.json`) に保存し、次回起動時に再開可能
- リトライ: HTTP 429/5xx に対して Exponential Backoff (最大 5 回)
- AbortController で即時キャンセル可能

### Gemini API
- エンドポイント: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (OpenAI 互換)
- 対応モデル: `gemini-2.5-flash`, `gemini-2.5-flash-lite` (設定ファイルで追加可能)
- レスポンスは `{"items": [...]}` の JSON スキーマを強制

### JAR スキャン
- `mods/` 配下の `.jar` を列挙
- 各 JAR 内の `assets/<modid>/lang/en_us.json` を抽出
- JAR 内に別の JAR が存在する場合は再帰的に読み込む (Forge モッコウカダリ対応)

## 既存 Python 実装との対応表

| Python モジュール | TypeScript 対応先 |
|---|---|
| `core/jar_reader.py` | `main/core/jarReader.ts` |
| `core/token_protection.py` | `main/core/tokenProtection.ts` |
| `core/chunking.py` | `main/core/chunking.ts` |
| `core/constants.py` | `main/core/constants.ts` |
| `core/translation_batch.py` | `main/services/geminiClient.ts` |
| `services/translation.py` | `main/services/translation.ts` |
| `services/extraction.py` | `main/services/extraction.ts` |
| `core/usage.py` | `main/store/index.ts` (UsageStats 型) |
