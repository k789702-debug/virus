#!/usr/bin/env node
/* codex-brief.mjs — 自動產出送 Codex 的內容覆核 prompt。
   列出「本輪改動/新增的卡與其 qa」＋執行指示＋輸出格式，省去每次手寫。

   用法：
     node scripts/codex-brief.mjs <sinceRef>   # 只列自 <sinceRef> 以來有變動的卡（推薦）
     node scripts/codex-brief.mjs               # 全量列出所有卡（完整覆核）
     node scripts/codex-brief.mjs <sinceRef> > docs/codex-brief.md
   <sinceRef> 為本輪開工前的 git 參照（commit/tag），例如上一個 content commit。
*/
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULES = [
  { name: "virology", file: "data/virology.json", arr: "virology", idField: "name" },
];
const sinceRef = process.argv[2] || null;

function load(file) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8")); } catch { return null; } }
function loadAt(ref, file) {
  try { return JSON.parse(execSync(`git show ${ref}:${file}`, { cwd: ROOT, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] })); }
  catch { return null; }
}
const sig = (c) => JSON.stringify(c.qa || []); // 卡的 qa 簽章，用來判斷有無變動

const rows = [];
for (const m of MODULES) {
  const cur = load(m.file); if (!cur) continue;
  const oldArr = sinceRef ? (loadAt(sinceRef, m.file)?.[m.arr] || []) : [];
  const oldSig = new Map(oldArr.map((c) => [c[m.idField], sig(c)]));
  for (const c of cur[m.arr] || []) {
    const id = c[m.idField];
    const changed = !sinceRef || !oldSig.has(id) || oldSig.get(id) !== sig(c);
    if (!changed) continue;
    const qa = (c.qa || []).map((q) => q[0]).join("、");
    rows.push(`| ${m.name} | ${id} | ${qa} |`);
  }
}

const title = sinceRef ? `本輪（自 \`${sinceRef}\` 以來）` : "全量";
console.log(`# Codex 內容覆核 — 臨床病毒學國考複習網站（${title}）

資料驅動的病毒學複習網站；請對**下表卡片的 qa** 逐筆核對考選部官方標準答案卷，
沿用 OK／修摘要／可精修 標準。先唯讀、實跑指令，產出分級報告，先別改檔。
科目：臨床血清免疫學與臨床病毒學（qa 只取病毒部分）。

## 先執行
- \`npm run validate:strict\`（格式/欄位/科群一致性，應全綠）
- \`npm run verify-qa\`（用 moex-exam 回核 qa 真實性/梯次；請把它的 ⚠「疑似不符」清單一起看）
- 開 HTTP 預覽抽看渲染

## 本輪需覆核的卡與 qa（共 ${rows.length} 張）

| 模組 | 卡片 | qa（年度[梯次]題號） |
|---|---|---|
${rows.join("\n") || "| — | （無變動） | — |"}

## 請確認
- 每筆 qa 的**題號、梯次（第一/二次）、官方答案、摘要**是否一致；不一致標「修摘要」，可更精準標「可精修」。
- **梯次**：醫檢師每年兩梯、同題號兩卷不同題；請特別檢查有無標錯梯次（本科目已知含 113 年第一次(113020)＋第二次(113090)）。
- 我不確定或摘要未點名答案之處，請補上官方答案選項。
- 注意部分 qa 為**刻意跨卡共用**同一真題（不同框架），非重複錯誤。

## 輸出
分級報告（Critical / Important / Minor / Nice-to-have），每條附 \`檔案:行號\` 與具體修法；
結尾列「建議優先處理前 5 項」。不確定處標明，不要臆測。`);
