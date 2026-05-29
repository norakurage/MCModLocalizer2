export const PROTECT_RE =
  /(%\d+\$[sd]|%[sd]|\{[a-zA-Z0-9_]+\}|\{\d+\}|§[0-9a-fk-or]|\\n|\\t|\\r)/g

export const SYSTEM_INSTRUCTIONS_BASE = `あなたは熟練のローカライザーです。出力は必ず日本語で、自然で簡潔に訳してください。
Minecraft の Mod 用テキスト（ゲーム内のUI/メッセージ/アイテム名）です。次を厳守：
- ‹T0› のような保護トークンは絶対に改変・和訳しない（位置もできるだけ原文通り）
- 句読点・全角/半角の不自然さを避ける。文末の余分な空白を付けない
- 固有名詞/アイテムID/コマンドは文脈上そのまま残す（例: "Minecraft", "Redstone", "/reload"）
- バニラ Minecraft の公式日本語名が既に存在する語は尊重し、勝手に別訳へ置き換えない
- 技術語は日本のマイクラ文脈で一般的な用語に統一（例: "Stack"→"スタック"、ただし固有名は維持）
- 改行や \\n は原文通り保持
- 返答は必ず JSON オブジェクト {"items": [...]} で返す`

export const USER_TEMPLATE = `以下のリストは翻訳対象のテキスト配列です。
出力は **{"items": [...]} の JSON のみ** とし、構造は次の通りです。
- items 配列の要素数は入力と同じにする
- 配列の i 番目の要素は入力の i 番目の日本語訳とする（保護トークン ‹Tn› は原文どおりそのまま残す）
【入力例】
["Copper Block", "Press ‹T0› to open the menu."]
【出力例】（この形式以外は出力しない）
{"items": ["銅のブロック", "メニューを開くには ‹T0› を押します。"]}
入力リスト:
<<PAYLOAD>>`

export { MODEL_DEFINITIONS } from '../../shared/models'
export type { ModelDefinition } from '../../shared/models'
