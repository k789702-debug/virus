#!/usr/bin/env node
/* verify-qa.mjs — 用 moex-exam 題庫「回核」每筆 qa 是否真的存在、梯次是否標對。
   這是內容正確性的自動化第一道防線（送 Codex 之前先攔題號/梯次錯）。
   需要網路 + 獨立安裝的 moex-exam-mcp（會實際打考選部網站，較慢，有快取）。

   服務層由「獨立安裝」的 moex-exam-mcp 匯入（不在本 repo 內複製 node_modules）：
     預設位置 ../../moex-exam-mcp/src/*  （即 C:\Users\User\Desktop\moex-exam-mcp）
   若你的安裝路徑不同，改下方 import 路徑即可。

   用法：
     node scripts/verify-qa.mjs             # 核所有模組（本站僅 virology）
     node scripts/verify-qa.mjs virology    # 只核單一模組
   離開碼：有「查無對應題」的硬錯誤時為 1，否則 0（可當 gate）。
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listPapers } from "../../moex-exam-mcp/src/examSite.mjs";
import { splitQuestions } from "../../moex-exam-mcp/src/questionIndex.mjs";
import { extractText } from "../../moex-exam-mcp/src/pdf.mjs";
import { createClient } from "../../moex-exam-mcp/src/httpClient.mjs";
import { validateMoexPdfUrl, filterBySubject } from "../../moex-exam-mcp/src/service.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// 臨床病毒學單軸模組；subject 子字串「病毒」命中「臨床血清免疫學與臨床病毒學」合卷。
const MODULES = [
  { name: "virology", file: "data/virology.json", arr: "virology" },
];
const SUBJECT = "病毒"; // 命中「臨床血清免疫學與臨床病毒學」合卷
const QA_RE = /^(\d{2,3})年(第[一二]次)?\s+第(\d+)題$/;

// sessionCode 末碼：020=第一次、090=第二次（已對 109/110/113 官方標頭確認）
function termOfCode(code) {
  if (/020$/.test(code)) return "第一次";
  if (/090$/.test(code)) return "第二次";
  return null;
}
function cardName(c) { return c.name || c.abbr || c.en || "(無名)"; }

// 收集所有 qa 參照
function collectRefs(only) {
  const refs = [];
  for (const m of MODULES) {
    if (only && m.name !== only) continue;
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, m.file), "utf8"));
    (data[m.arr] || []).forEach((c) => {
      (c.qa || []).forEach((q) => {
        const raw = Array.isArray(q) ? q[0] : null;
        const mt = raw && raw.match(QA_RE);
        refs.push({
          module: m.name, file: m.file, arr: m.arr, card: cardName(c), raw,
          year: mt ? Number(mt[1]) : null,
          term: mt ? (mt[2] || null) : null,
          no: mt ? Number(mt[3]) : null,
          summary: Array.isArray(q) ? q[1] : "",
          badFormat: !mt,
        });
      });
    });
  }
  return refs;
}

// 建題庫索引：year|term|no -> questionText；year|no -> Set(terms)
async function buildIndex(years) {
  const client = createClient();
  const idx = new Map();       // `${year}|${term}|${no}` -> text
  const byNo = new Map();      // `${year}|${no}` -> Set(term)
  const yearStart = Math.min(...years), yearEnd = Math.max(...years);
  process.stderr.write(`抓取 ${yearStart}-${yearEnd} 年考卷…\n`);
  const papers = filterBySubject(await listPapers({ yearStart, yearEnd, client }), SUBJECT);
  for (const p of papers) {
    if (!years.includes(Number(p.year))) continue;
    const term = termOfCode(p.sessionCode);
    let text;
    try {
      const res = await client.get(validateMoexPdfUrl(p.qUrl));
      if (!res.ok) { process.stderr.write(`  ! ${p.year} ${term||p.sessionCode} PDF HTTP ${res.status}\n`); continue; }
      text = await extractText(new Uint8Array(await res.arrayBuffer()));
    } catch (e) { process.stderr.write(`  ! ${p.year} ${term||p.sessionCode} ${e.message}\n`); continue; }
    const { questions, splitFailed } = splitQuestions(text);
    if (splitFailed) { process.stderr.write(`  ! ${p.year} ${term||p.sessionCode} 題目切割失敗（掃描型？）\n`); continue; }
    for (const q of questions) {
      if (term) idx.set(`${p.year}|${term}|${q.questionNo}`, q.questionText);
      const k = `${p.year}|${q.questionNo}`;
      if (!byNo.has(k)) byNo.set(k, new Map());
      if (term) byNo.get(k).set(term, q.questionText);
    }
    process.stderr.write(`  ✓ ${p.year} ${term||p.sessionCode}：${questions.length} 題\n`);
  }
  return { idx, byNo };
}

// 摘要關鍵詞（中文 2+ 字、英數 3+ 字）與題幹的重疊分數
function tokens(s) {
  return [...new Set([
    ...((s || "").match(/[一-鿿]{2,}/g) || []),
    ...((s || "").match(/[A-Za-z0-9][A-Za-z0-9-]{2,}/g) || []),
  ])].sort((a, b) => b.length - a.length).slice(0, 8);
}
function overlap(summary, text) {
  const t = tokens(summary);
  if (!t.length || !text) return 0;
  return t.filter((x) => text.includes(x)).length;
}
function looksMismatched(summary, text) { return overlap(summary, text) === 0; }

async function main() {
  const only = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : null;
  const refs = collectRefs(only);
  const years = [...new Set(refs.filter((r) => r.year).map((r) => r.year))].sort();
  if (years.length === 0) { console.log("沒有可核對的 qa。"); return; }
  const { idx, byNo } = await buildIndex(years);

  const notFound = [], ambiguous = [], mism = [], badFmt = [];
  for (const r of refs) {
    if (r.badFormat) { badFmt.push(r); continue; }
    if (r.term) {
      const text = idx.get(`${r.year}|${r.term}|${r.no}`);
      if (text === undefined) notFound.push({ ...r, why: `${r.year}${r.term} 第${r.no}題 查無此題` });
      else if (looksMismatched(r.summary, text)) mism.push({ ...r, text });
    } else {
      const m = byNo.get(`${r.year}|${r.no}`);
      if (!m || m.size === 0) notFound.push({ ...r, why: `${r.year} 第${r.no}題 兩梯皆查無` });
      else if (m.size >= 2) {
        const scored = [...m.entries()].map(([term, text]) => ({ term, s: overlap(r.summary, text) })).sort((a, b) => b.s - a.s);
        const suggest = scored[0].s > (scored[1]?.s ?? -1) ? scored[0].term : null;
        ambiguous.push({ ...r, terms: scored.map((x) => x.term), suggest, scored });
      } else {
        const [term, text] = [...m.entries()][0];
        if (looksMismatched(r.summary, text)) mism.push({ ...r, text, onlyTerm: term });
      }
    }
  }

  const line = (r, extra) => `  [${r.module}] ${r.card}｜${r.raw}${extra ? " — " + extra : ""}`;
  console.log(`\n=== verify-qa 報告（核 ${refs.length} 筆 qa，${years.join("/")} 年）===`);
  console.log(`\n✗ 查無對應題（硬錯誤，需修）: ${notFound.length}`);
  notFound.forEach((r) => console.log(line(r, r.why)));
  console.log(`\n⚠ 未標梯次而兩卷皆有此題號（歧義，建議補梯次）: ${ambiguous.length}`);
  ambiguous.forEach((r) => console.log(line(r, r.suggest
    ? `摘要較符 → 建議標「${r.suggest}」(分 ${r.scored.map((x) => x.term + ":" + x.s).join(" / ")})`
    : `兩梯難分(分 ${r.scored.map((x) => x.term + ":" + x.s).join(" / ")})，需人工判`)));
  console.log(`\n⚠ 摘要疑似與題幹無關（請人工/Codex 複核）: ${mism.length}`);
  mism.forEach((r) => console.log(line(r, `題幹「${(r.text || "").slice(0, 40)}…」`)));
  if (badFmt.length) {
    console.log(`\n⚠ qa[0] 格式不符無法核對: ${badFmt.length}`);
    badFmt.forEach((r) => console.log(line(r)));
  }
  console.log(`\n小結：✗${notFound.length} 硬錯誤 / ⚠${ambiguous.length} 歧義 / ⚠${mism.length} 疑似不符。`);

  // --apply：把「建議明確」的歧義項就地補上梯次（以 題號+摘要前綴 為唯一錨點，保留檔案格式）
  if (process.argv.includes("--apply")) {
    const targets = ambiguous.filter((r) => r.suggest);
    const skipped = ambiguous.filter((r) => !r.suggest);
    const files = [...new Set(targets.map((r) => r.file))];
    let applied = 0, missed = [];
    for (const file of files) {
      const abs = path.join(ROOT, file);
      let text = fs.readFileSync(abs, "utf8");
      for (const r of targets.filter((t) => t.file === file)) {
        const anchor = `"${r.raw}", "${r.summary.slice(0, 10)}`;
        const repl = `"${r.year}年${r.suggest} 第${r.no}題", "${r.summary.slice(0, 10)}`;
        if (text.includes(anchor)) { text = text.replace(anchor, repl); applied++; }
        else missed.push(`${r.card}｜${r.raw}`);
      }
      fs.writeFileSync(abs, text, "utf8");
    }
    console.log(`\n--apply：已補 ${applied} 筆梯次；跳過 ${skipped.length} 筆兩梯難分（需人工）。`);
    skipped.forEach((r) => console.log(`  待人工：[${r.module}] ${r.card}｜${r.raw}`));
    if (missed.length) { console.log(`  ⚠ 錨點找不到未套用 ${missed.length} 筆：`); missed.forEach((m) => console.log("    " + m)); }
    console.log(`請接著跑 npm run validate:strict 與 npm run verify-qa 複核。`);
    return; // apply 模式不以歧義數當離開碼
  }
  process.exit(notFound.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error("verify-qa 失敗：", e.message); process.exit(2); });
