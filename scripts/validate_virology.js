#!/usr/bin/env node
/* data/virology.json 驗證器（零相依）。共用核心見 validate-core.js。
   臨床病毒學為單軸模組（依病毒科分群），無跨模組互連；--strict-links 保留以對齊 npm 鏈。
   執行：node scripts/validate_virology.js [--strict-links]  失敗時 exit 1。 */
const { runValidator, checkCompare } = require('./validate-core.js');

runValidator({
  filePath: ['data', 'virology.json'],
  arr: 'virology',
  idField: 'name', idLabel: 'name',
  cardLabel: '病毒卡', groupLabel: '科群',
  required: ['h1', 'name', 'en', 'zh', 'stars', 'genome', 'transmission', 'disease', 'lab', 'hot', 'qa'],
  allowed: ['h1', 'name', 'en', 'zh', 'stars', 'genome', 'transmission', 'disease', 'lab', 'interpret', 'treatment', 'pitfall', 'compare', 'hot', 'qa'],
  reqStr: ['h1', 'name', 'en', 'zh', 'genome', 'transmission', 'disease', 'lab'],
  strFields: ['genome', 'transmission', 'disease', 'lab', 'interpret', 'treatment', 'pitfall'],
  perCard: (c, id, { errors }) => {
    checkCompare(c, id, errors);
  },
});
