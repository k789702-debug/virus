/* validate-core.js — 三模組共用的零相依驗證核心。
   各模組驗證器只提供 config（欄位清單＋module 專屬檢查），共用規則（未知欄位、型別、
   qa 梯次格式、跨卡重複引用、群組一致性、--strict-links 互連）都集中在此，避免三份分歧。 */
const fs = require('fs');
const path = require('path');

const okStars = s => Number.isInteger(s) && s >= 1 && s <= 3;
const boldBalanced = s => (String(s).match(/\*\*/g) || []).length % 2 === 0;
// qa[0] 格式：民國年 + 選填梯次(第一/二次) + 第N題。例「113年第一次 第18題」「110年 第6題」。
const QA_YEAR = /^\d{2,3}年(第[一二]次)?\s+第\d+題$/;

function loadJson(absPath) { try { return JSON.parse(fs.readFileSync(absPath, 'utf8')); } catch (e) { return null; } }

// ---- module 專屬欄位檢查（供 config.perCard 呼叫）----
function checkStrList(c, id, field, errors) {
  if (!(field in c)) return;
  if (!Array.isArray(c[field])) { errors.push(`${id}: 欄位 "${field}" 必須為陣列`); return; }
  c[field].forEach((s, j) => {
    if (typeof s !== 'string') errors.push(`${id}: ${field}[${j}] 必須為字串`);
    else if (!boldBalanced(s)) errors.push(`${id}: ${field}[${j}] 的 ** 未成對`);
  });
}
function checkNonEmptyStrArray(c, id, field, errors) {
  if (!(field in c)) return;
  if (!Array.isArray(c[field]) || c[field].length === 0) { errors.push(`${id}: ${field} 必須為非空陣列`); return; }
  c[field].forEach((s, j) => { if (typeof s !== 'string') errors.push(`${id}: ${field}[${j}] 必須為字串`); });
}
function checkQc(c, id, errors) {
  if (!('qc' in c)) return;
  if (!Array.isArray(c.qc)) { errors.push(`${id}: qc 必須為陣列`); return; }
  c.qc.forEach((r, j) => {
    if (!Array.isArray(r) || r.length !== 3) { errors.push(`${id}: qc[${j}] 必須為 ["現象","假陽/假陰·原因","QC對策"]`); return; }
    r.forEach((cell, k) => { if (typeof cell === 'string' && !boldBalanced(cell)) errors.push(`${id}: qc[${j}][${k}] 的 ** 未成對`); });
  });
}
function checkProsCons(c, id, errors) {
  if (!('pros_cons' in c)) return;
  const pc = c.pros_cons;
  if (typeof pc !== 'object' || Array.isArray(pc) || pc === null) { errors.push(`${id}: pros_cons 必須為物件 {pros,cons}`); return; }
  ['pros', 'cons'].forEach(k => {
    if (k in pc && !Array.isArray(pc[k])) errors.push(`${id}: pros_cons.${k} 必須為陣列`);
    else if (Array.isArray(pc[k])) pc[k].forEach((s, j) => { if (typeof s === 'string' && !boldBalanced(s)) errors.push(`${id}: pros_cons.${k}[${j}] 的 ** 未成對`); });
  });
}
function checkCompare(c, id, errors) {
  if (!('compare' in c)) return;
  if (!Array.isArray(c.compare)) { errors.push(`${id}: compare 必須為陣列`); return; }
  const w = (c.compare[0] || []).length;
  if (c.compare.length < 2) errors.push(`${id}: compare 至少需表頭＋一列（≥2 列）`);
  if (w < 2) errors.push(`${id}: compare 表頭至少 2 欄`);
  c.compare.forEach((r, j) => {
    if (!Array.isArray(r)) { errors.push(`${id}: compare[${j}] 必須為陣列`); return; }
    if (r.length !== w) errors.push(`${id}: compare[${j}] 欄數(${r.length}) 與表頭(${w}) 不符`);
    r.forEach((cell, k) => { if (typeof cell === 'string' && !boldBalanced(cell)) errors.push(`${id}: compare[${j}][${k}] 的 ** 未成對`); });
  });
}

// ---- 主驗證器 ----
function runValidator(cfg) {
  const STRICT = process.argv.includes('--strict-links');
  const errors = [], warns = [];
  const FILE = path.join(__dirname, '..', ...cfg.filePath);
  const data = loadJson(FILE);
  if (data === null) { console.error(`✗ 無法讀取或解析 ${cfg.filePath.join('/')}`); process.exit(1); }

  if (!data.meta || !Array.isArray(data.meta.groups)) errors.push('meta.groups 缺失或不是陣列');
  const arr = data[cfg.arr];
  if (!Array.isArray(arr) || arr.length === 0) errors.push(`${cfg.arr} 缺失或為空`);

  const flowKeys = new Set(Object.keys(data.flows || {}));
  const groupSet = new Set((data.meta && data.meta.groups) || []);
  const ALLOWED = new Set(cfg.allowed);
  const seenId = new Map(), qaRefSeen = new Map();

  (arr || []).forEach((c, i) => {
    const id = `${cfg.arr}[${i}] ${c[cfg.idField] || c.en || '(無名)'}`;
    if (typeof c !== 'object' || c === null || Array.isArray(c)) { errors.push(`${id}: 卡片必須為物件`); return; }
    cfg.required.forEach(f => { if (!(f in c)) errors.push(`${id}: 缺少欄位 "${f}"`); });
    Object.keys(c).forEach(k => { if (!ALLOWED.has(k)) errors.push(`${id}: 不允許的欄位 "${k}"（請對照 schema）`); });
    cfg.reqStr.forEach(f => { if (f in c && (typeof c[f] !== 'string' || !c[f].trim())) errors.push(`${id}: 欄位 "${f}" 必須為非空字串`); });
    if ('stars' in c && !okStars(c.stars)) errors.push(`${id}: stars 必須 1–3，目前=${c.stars}`);
    const idv = c[cfg.idField];
    if (idv) { if (seenId.has(idv)) errors.push(`${id}: ${cfg.idLabel} 重複`); else seenId.set(idv, i); }
    if (c.h1 && groupSet.size && !groupSet.has(c.h1)) warns.push(`${id}: h1 "${c.h1}" 不在 meta.groups`);

    (cfg.strFields || []).forEach(f => {
      if (typeof c[f] === 'string') {
        if (!boldBalanced(c[f])) errors.push(`${id}: 欄位 "${f}" 的 ** 未成對`);
        if (/<[a-zA-Z/]/.test(c[f])) warns.push(`${id}: 欄位 "${f}" 含疑似 HTML 標籤`);
      }
    });

    if ('hot' in c && (!Array.isArray(c.hot) || c.hot.length === 0)) errors.push(`${id}: hot 必須為非空陣列（至少一條高頻考點）`);
    (Array.isArray(c.hot) ? c.hot : []).forEach((h, j) => {
      if (typeof h !== 'string') errors.push(`${id}: hot[${j}] 必須為字串`);
      else if (!boldBalanced(h)) errors.push(`${id}: hot[${j}] 的 ** 未成對`);
    });

    if (Array.isArray(c.qa)) {
      if (c.qa.length === 0) errors.push(`${id}: qa 不可為空（國考題引用是骨幹，至少一筆）`);
      c.qa.forEach((q, j) => {
        if (!Array.isArray(q) || q.length !== 2) { errors.push(`${id}: qa[${j}] 必須為 ["年度題號","說明"]`); return; }
        if (typeof q[0] !== 'string' || !QA_YEAR.test(q[0])) errors.push(`${id}: qa[${j}][0] 應為「民國年[第一/二次] 第N題」格式（例「113年第一次 第18題」），目前="${q[0]}"`);
        else if (qaRefSeen.has(q[0])) warns.push(`${id}: qa「${q[0]}」與 ${cfg.arr}[${qaRefSeen.get(q[0])}] 重複引用（如為刻意共用可忽略；常見為梯次標錯）`);
        else qaRefSeen.set(q[0], i);
        if (typeof q[1] !== 'string' || !q[1].trim()) errors.push(`${id}: qa[${j}][1] 說明必須為非空字串`);
      });
    } else if ('qa' in c) errors.push(`${id}: qa 必須為陣列`);

    if (cfg.perCard) cfg.perCard(c, id, { errors, warns });
  });

  // 群組一致性：flows key 必為合法群；meta.groups 列了卻無卡→warn（flows 可只覆蓋部分群）。
  flowKeys.forEach(k => { if (!groupSet.has(k)) errors.push(`flows 的 "${k}" 不在 meta.groups（請對齊群名）`); });
  const used = new Set((arr || []).map(c => c.h1));
  groupSet.forEach(g => { if (!used.has(g)) warns.push(`meta.groups 的 "${g}" 沒有任何卡片`); });

  // 跨模組互連（選填）：linkField 值需對到目標模組某卡的 key；strict 下未解析＝error。
  if (cfg.xref) {
    const t = loadJson(path.join(__dirname, '..', ...cfg.xref.targetPath));
    if (t) {
      const names = new Set((t[cfg.xref.targetArr] || []).flatMap(cfg.xref.targetKeys));
      (arr || []).forEach((c, i) => {
        (c[cfg.xref.field] || []).forEach(v => {
          if (!names.has(v)) (STRICT ? errors : warns).push(`${cfg.arr}[${i}] ${c[cfg.idField] || ''}: ${cfg.xref.field} "${v}" 在 ${cfg.xref.targetArr} 找不到對應卡，前端不會連結`);
        });
      });
    }
  }

  console.log(`檢查 ${(arr || []).length} 張${cfg.cardLabel}、${groupSet.size} ${cfg.groupLabel}、${flowKeys.size} 分流${STRICT ? '（--strict-links）' : ''}。`);
  warns.forEach(w => console.log('⚠ ' + w));
  if (errors.length) { console.error(`\n✗ 發現 ${errors.length} 個錯誤：`); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
  console.log(`✓ 通過驗證${warns.length ? '（含 ' + warns.length + ' 項提醒）' : ''}。`);
}

module.exports = { runValidator, boldBalanced, okStars, QA_YEAR, checkStrList, checkNonEmptyStrArray, checkQc, checkProsCons, checkCompare };
