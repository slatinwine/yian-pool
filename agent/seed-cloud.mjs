// 一次性迁移：把本地 store.json 的医案灌入云端（真实指纹重新计算，自动去重合并）
import { readFileSync } from 'node:fs';
import { addCase } from './pool-core.mjs';

const seed = JSON.parse(readFileSync(new URL('./store.json', import.meta.url), 'utf8'));
let created = 0, bumped = 0;
for (const c of seed.cases) {
  const r = await addCase({ err: c.err, cure: c.cure, cause: c.cause, agent: c.agent });
  if (r.status === 'created') created++; else bumped++;
  console.log(r.status.padEnd(8), r.case.type, 'hits=' + r.case.hits, '|', r.case.err.slice(0, 60));
}
console.log('\n完成：新建 ' + created + ' 案，合并 ' + bumped + ' 案');
