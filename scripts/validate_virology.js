#!/usr/bin/env node
/* data/virology.json 驗證器（零相依）。共用核心見 validate-core.js。
   臨床病毒學為單軸模組（依病毒科分群），無跨模組互連；--strict-links 保留以對齊 npm 鏈。

   兩種卡型（依 h1 前綴自動判定，共用同一 schema）：
   - 病毒卡（h1 起於 DNA病毒／RNA病毒／肝炎病毒）：必填 genome/transmission/disease/lab/treatment。
   - 總論／其他卡（總論 ‧ …、其他 ‧ Prion…）：改必填 principle（原理／方法），無基因體等病毒欄。
   通用必填：h1/name/en/zh/stars/hot/qa。

   執行：node scripts/validate_virology.js [--strict-links]  失敗時 exit 1。 */
const { runValidator, checkCompare } = require('./validate-core.js');

const isVirusGroup = (h1) => typeof h1 === 'string' && /^(DNA病毒|RNA病毒|肝炎病毒)/.test(h1);

runValidator({
  filePath: ['data', 'virology.json'],
  arr: 'virology',
  idField: 'name', idLabel: 'name',
  cardLabel: '病毒卡', groupLabel: '科群',
  required: ['h1', 'name', 'en', 'zh', 'stars', 'hot', 'qa'],
  allowed: ['h1', 'name', 'en', 'zh', 'stars', 'genome', 'transmission', 'disease', 'lab', 'treatment', 'interpret', 'pitfall', 'compare', 'principle', 'hot', 'qa'],
  reqStr: ['h1', 'name', 'en', 'zh'],
  strFields: ['genome', 'transmission', 'disease', 'lab', 'treatment', 'interpret', 'pitfall', 'principle'],
  perCard: (c, id, { errors }) => {
    // 依卡型補強必填：病毒卡要病毒欄；總論／其他卡要 principle。
    const need = isVirusGroup(c.h1)
      ? ['genome', 'transmission', 'disease', 'lab', 'treatment']
      : ['principle'];
    need.forEach((f) => {
      if (!(f in c)) errors.push(`${id}: 缺少欄位 "${f}"（${isVirusGroup(c.h1) ? '病毒卡' : '總論／其他卡'}必填）`);
      else if (typeof c[f] !== 'string' || !c[f].trim()) errors.push(`${id}: 欄位 "${f}" 必須為非空字串`);
    });
    checkCompare(c, id, errors);
  },
});
