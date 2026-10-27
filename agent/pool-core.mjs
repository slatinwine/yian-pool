import { cloud, TABLE } from './cloud.js';

// ---------- 病症分类规则：与《Bug 诗笺》网页版共用同一套 ----------
export const RULES = [
  { t: '空山叹', re: /typeerror|undefined|null|cannot read/i,
    cause: '气血两虚——变量尚未赋值，便已伸手取物。',
    cure: '先问有没有，再问是什么：加一层判空，或补上初始化。',
    lines: ['执手相看竟为空', '回眸已是未定义', '山中本是无名客', '莫向虚无处问名'] },
  { t: '寻隐者不遇', re: /status code 404|not found/i,
    cause: '所寻之人（资源）不在原籍，地址恐有讹误。',
    cure: '核对路由与路径，确认服务已部署、端口未改。',
    lines: ['松下问童子', '言师采药去', '只在此山中', '云深不知处'] },
  { t: '隔岸观火', re: /cors|access-control|origin/i,
    cause: '两岸相望而渡船未开——服务端未放行你的来处。',
    cure: '后端配置 CORS 头，或架一座代理的桥。',
    lines: ['盈盈一水间', '脉脉不得语', '两岸皆有情', '无人来摆渡'] },
  { t: '断句吟', re: /syntaxerror|unexpected token/i,
    cause: '行文断句有误，字未穷而意已断。',
    cure: '顺着行号去找那个多余的（或逃跑的）括号与引号。',
    lines: ['文章千古事', '断句误一生', '一处标点错', '满盘皆不通'] },
  { t: '轮回苦', re: /call stack|maximum call|infinite loop/i,
    cause: '此函数执念太深，调用自己不肯回头。',
    cure: '给轮回设一个终局：补上终止条件，或改为迭代。',
    lines: ['春去春又来', '花开花又落', '不知身在局', '何处是出口'] },
  { t: '沧海叹', re: /heap|out of memory|allocation/i,
    cause: '胃口太大，一口气吃下了整片海。',
    cure: '分批进食：流式处理、分页加载、及时释放引用。',
    lines: ['曾经沧海难为水', '除却巫山不是云'] },
  { t: '宫门吟', re: /permission|eacces|denied|403/i,
    cause: '人已到宫门，名册上却无你的名字。',
    cure: '检查令牌是否过期、角色权限是否配齐。',
    lines: ['朱门沉沉深几许', '执笏立于阶下人'] },
  { t: '等归人', re: /timeout|etimedout|network/i,
    cause: '苦等一封回信，信使终未归来。',
    cure: '加超时与重试，先探服务是否存活。',
    lines: ['过尽千帆皆不是', '斜晖脉脉水悠悠'] },
];
export const FALLBACK = { t: '玄机谜',
  cause: '此症脉象奇异，古籍未载。',
  cure: '把完整堆栈读三遍——报错的第一行，往往就是答案。',
  lines: ['纸上得来终觉浅', '绝知此事要躬行'] };

export function classify(text) {
  const s = String(text);
  for (const r of RULES) if (r.re.test(s)) return r;
  return FALLBACK;
}

// 指纹：归一化报错文本（去数字/路径/引号内容），同类报错聚成一案
export function fingerprint(text) {
  let s = String(text).toLowerCase()
    .replace(/^(uncaught\s+)?(fatal\s+)?error:?\s*/i, '')
    .replace(/["'`][^"'`]{0,80}["'`]/g, 'S')
    .replace(/[a-z]:[\\\/][^\s"']+/g, 'P')
    .replace(/\/[^\s"']{2,}/g, 'P')
    .replace(/\d+/g, 'N')
    .replace(/\s+/g, ' ').trim();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16) + '-' + s.slice(0, 60);
}

// ---------- 敏感信息脱敏闸门 ----------
const REDACT_PATTERNS = [
  { tag: 'API密钥', re: /\b(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,})/g },
  { tag: '令牌赋值', re: /\b(api[_-]?key|apikey|secret|token|password|passwd|pwd|authorization|credential)[=:]\s*["']?[^\s"'\s,;&]{4,}/gi },
  { tag: 'Bearer令牌', re: /\bbearer\s+[A-Za-z0-9._-]{10,}/gi },
  { tag: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g },
  { tag: 'URL凭证', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s\/:@]+:[^\s\/:@]+@/gi },
  { tag: '邮箱', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { tag: '手机号', re: /\b1[3-9]\d{9}\b/g },
  { tag: '内网主机', re: /\b[\w.-]+\.(internal|local|lan|corp|intranet)\b/gi },
];
const PRIVATE_KEY_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

function maskIp(ip) {
  const o = ip.split('.');
  const n = o.map(Number);
  if (o[0] === '10' || o[0] === '127' || o[0] === '169' ||
      (o[0] === '192' && o[1] === '168') ||
      (o[0] === '172' && n[1] >= 16 && n[1] <= 31)) return ip[0] + '**.***.***.**';
  return o[0] + '.' + o[1] + '.*.*';
}

export function redact(text) {
  let s = String(text);
  const tags = new Set();
  for (const p of REDACT_PATTERNS) {
    if (p.re.test(s)) { tags.add(p.tag); s = s.replace(p.re, '[已脱敏]'); }
  }
  s = s.replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, m => { tags.add('IP地址'); return maskIp(m); });
  s = s.replace(/(c:[\\\/]+users[\\\/]+|\/users\/|\/home\/)([^\s"':\\\/]+)/gi,
    (m, pre) => { tags.add('用户路径'); return pre + '***'; });
  return { text: s, redactions: [...tags] };
}

// ---------- 云端数据层 ----------
function unwrap({ data, error }, where) {
  if (error) {
    const e = new Error('云端数据库错误（' + where + '）: ' + (error.message || JSON.stringify(error)));
    e.code = error.code;
    throw e;
  }
  return data;
}

function rowToCase(r) {
  return { id: r.case_uid, fp: r.fp, type: r.type, err: r.err, cause: r.cause,
    cure: r.cure, poem: r.poem || [], agent: r.agent, hits: Number(r.hits) || 1,
    ts: r.created_at ? Date.parse(r.created_at) : null };
}

function scoreCase(c, tokens, type) {
  let s = 0;
  if (type && c.type === type) s += 3;
  const hay = [c.err, c.cause, c.cure, c.type].join(' ').toLowerCase();
  for (const t of tokens) if (hay.includes(t)) s += 1;
  return s + Math.min(c.hits || 0, 5) * 0.1;
}

export async function searchCases(query, limit = 5) {
  const rule = classify(query);
  const tokens = String(query).toLowerCase().match(/[a-z0-9_\-\.]{3,}/g) || [];
  // 先按病症取候选（池子大了再换全文检索），内存打分排序
  const { data, error } = await cloud.database.from(TABLE)
    .select('*').eq('type', rule.t).order('hits', { ascending: false }).limit(200);
  const rows = unwrap({ data, error }, 'search');
  return rows.map(rowToCase)
    .map(c => ({ c, s: scoreCase(c, tokens, rule.t) }))
    .filter(x => x.s > 0.15)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.c);
}

export async function addCase({ err, cure, cause, agent, type }) {
  if (!err || !cure) throw new Error('err 与 cure 均为必填');
  if (PRIVATE_KEY_RE.test(String(err)) || PRIVATE_KEY_RE.test(String(cure))) {
    throw new Error('检测到私钥块（PRIVATE KEY），已拒收——请先移除敏感材料再回填');
  }
  const re1 = redact(err), re2 = redact(cure), re3 = redact(cause || ''), re4 = redact(agent || '');
  const redactions = [...new Set([...re1.redactions, ...re2.redactions, ...re3.redactions, ...re4.redactions])];
  err = re1.text; cure = re2.text; cause = re3.text; agent = re4.text;
  const rule = type ? RULES.find(r => r.t === type) : classify(err);
  const fp = fingerprint(err);

  // 同指纹同方剂 → 合并计数（bump）
  const { data: dups, error: e1 } = await cloud.database.from(TABLE)
    .select('*').eq('fp', fp).limit(50);
  const dup = unwrap({ data: dups, error: e1 }, 'dedup')
    .map(rowToCase).find(c => c.cure.trim() === String(cure).trim());
  if (dup) {
    const { error: e2 } = await cloud.database.from(TABLE)
      .update({ hits: dup.hits + 1, updated_at: new Date().toISOString() })
      .eq('case_uid', dup.id);
    unwrap({ data: null, error: e2 }, 'bump');
    return { status: 'bumped', case: { ...dup, hits: dup.hits + 1 }, redactions };
  }

  const case_uid = 'ya-' + fp.split('-')[0] + '-' + Date.now().toString(36);
  const { data: ins, error: e3 } = await cloud.database.from(TABLE)
    .insert({ case_uid, fp, type: rule.t, err: String(err).slice(0, 500),
      cause: cause || rule.cause, cure: String(cure).slice(0, 300),
      poem: rule.lines, agent: agent || 'anonymous', hits: 1 })
    .select();
  const row = unwrap({ data: ins, error: e3 }, 'insert');
  return { status: 'created', case: rowToCase(row[0]), redactions };
}

export async function removeCase(caseUid) {
  const { data, error } = await cloud.database.from(TABLE)
    .delete().eq('case_uid', caseUid).select();
  const removed = unwrap({ data, error }, 'remove');
  return { removed: removed.length };
}

export async function listCases(limit = 100) {
  const { data, error } = await cloud.database.from(TABLE)
    .select('*').order('created_at', { ascending: false }).limit(limit);
  return unwrap({ data, error }, 'list').map(rowToCase);
}

export async function stats() {
  const { count, error: e1 } = await cloud.database.from(TABLE)
    .select('*', { count: 'exact', head: true });
  unwrap({ data: null, error: e1 }, 'count');
  const { data, error: e2 } = await cloud.database.from(TABLE).select('type, agent');
  const rows = unwrap({ data, error: e2 }, 'stats');
  const byType = {}, agents = new Set();
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.agent) agents.add(r.agent);
  }
  return { total: count ?? rows.length, byType, agents: [...agents] };
}
