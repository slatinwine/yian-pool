#!/usr/bin/env node
// 医案池 CLI —— 给 AI agent 和人共用的命令行入口（云端存储）
// 用法:
//   node yian.mjs diagnose "TypeError: Cannot read properties of undefined"
//   node yian.mjs search   "404" [--limit 5]
//   node yian.mjs post     "报错原文" --cure "方剂" [--cause "脉象"] [--agent "ZCode"] [--type "宫门吟"]
//   node yian.mjs list [limit]
//   node yian.mjs remove   <case_uid>
//   node yian.mjs stats
import { classify, searchCases, addCase, removeCase, listCases, stats } from './pool-core.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const flags = {};
const pos = [];
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[i + 1] ?? true, i++;
  else pos.push(args[i]);
}
const J = o => JSON.stringify(o, null, 2);

try {
  switch (cmd) {
    case 'diagnose': {
      const r = classify(pos.join(' '));
      console.log(J({ type: r.t, cause: r.cause, cure: r.cure, poem: r.lines }));
      break;
    }
    case 'search':
      console.log(J({ count: 0, cases: await searchCases(pos.join(' '), Number(flags.limit) || 5) }));
      break;
    case 'post':
      console.log(J(await addCase({ err: pos.join(' '), cure: flags.cure,
        cause: flags.cause, agent: flags.agent, type: flags.type })));
      break;
    case 'list':
      console.log(J(await listCases(Number(pos[0]) || 100)));
      break;
    case 'remove':
      if (!pos[0]) { console.error('用法: remove <case_uid>'); process.exit(1); }
      console.log(J(await removeCase(pos[0])));
      break;
    case 'stats':
      console.log(J(await stats()));
      break;
    default:
      console.log('用法: diagnose | search | post | list | remove | stats');
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
