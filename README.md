# 臨床病毒學 ‧ 醫檢師國考複習大綱

[![Validate](https://github.com/<OWNER>/<REPO>/actions/workflows/validate.yml/badge.svg)](https://github.com/<OWNER>/<REPO>/actions/workflows/validate.yml)

醫事檢驗師國家考試科目「**臨床血清免疫學與臨床病毒學**」之**病毒部分**複習網站。
依**病毒科**（DNA→RNA→其他）分群，資料驅動、零相依驗證，**每張卡片皆掛真實歷屆國考題**。

## 特色

- **資料驅動**：內容全在 [`data/virology.json`](data/virology.json)，`assets/app.js` 於瀏覽器端渲染；共編者只需編 JSON，不寫 HTML。
- **依病毒科分群**：`meta.groups` 決定顯示順序（總論 → DNA 病毒各科 → RNA 病毒各科 → 其他／Prion）。
- **真題為骨幹**：每張卡的 `qa` 至少一筆，皆取自考選部歷屆試題（透過 moex-exam 查得），格式 `["民國年[第一/二次] 第N題","考點摘要"]`；**絕不杜撰**。
- **兩道驗證閘**：
  - `npm run validate:strict` — 格式／欄位／科群一致性（零相依 Node 驗證器）。
  - `npm run verify-qa` — 以 moex-exam 題庫回核每筆 qa 是否真實存在、梯次是否正確。

## 卡片欄位

| 欄位 | 必填 | 說明 |
|---|---|---|
| `h1` | ✓ | 所屬病毒科（須為 `meta.groups` 之一） |
| `name` / `en` / `zh` | ✓ | 病毒簡名（唯一）／英文全名／中文全名 |
| `stars` | ✓ | 考頻 1–3（★–★★★） |
| `genome` | ✓ | 基因體與構造（DNA/RNA、單雙股、正負股、套膜、對稱、複製部位） |
| `transmission` | ✓ | 傳播途徑／媒介／宿主 |
| `disease` | ✓ | 致病機轉與臨床表現 |
| `lab` | ✓ | 實驗室診斷（培養／CPE／包涵體、血清學、分子） |
| `interpret` | | 結果判讀（血清標記組合、病毒量等） |
| `treatment` | | 治療與預防（抗病毒藥、疫苗類型） |
| `pitfall` | | 陷阱／易混點 |
| `compare` | | 鑑別比較表（表頭＋≥1 列） |
| `hot` | ✓ | 高頻考點（≥1 條） |
| `qa` | ✓ | 歷屆國考題引用（≥1 筆） |

## 本機預覽

務必用 HTTP 伺服器（勿用 `file://`，瀏覽器會擋 JSON fetch）：

```bash
python -m http.server 8000
# 開 http://localhost:8000/
```

## 驗證與內容覆核

```bash
npm run validate:strict   # 格式/欄位/科群（CI 亦跑此）
npm run verify-qa         # 用 moex-exam 回核 qa 真實性與梯次（需網路）
npm run codex-brief <ref> # 產出送 Codex 的內容覆核 prompt（自 <ref> 以來的變動）
```

> `verify-qa` 由「獨立安裝」的 moex-exam-mcp 匯入服務層（預設 `../../moex-exam-mcp/src/*`），
> 不在本 repo 內複製其 `node_modules`。安裝路徑不同時，改 `scripts/verify-qa.mjs` 頂端的 import。

## 貢獻

1. 於 `data/virology.json` 對應病毒科新增／修改卡片（遵守上表欄位與 `**重點**` 粗體慣例）。
2. `npm run validate:strict` 綠燈。
3. `npm run verify-qa` 回核 0 硬錯誤（並依建議補梯次）。
4. 送 PR。CI 會跑 strict 驗證。

## 授權

程式碼採 [MIT](LICENSE)。卡片 `qa` 為歷屆醫檢師國考考古題之重點改寫摘要，標注考選部年度／題號為出處；
題目著作權屬**考選部**，本專案僅作非營利之考試準備與教育用途。
