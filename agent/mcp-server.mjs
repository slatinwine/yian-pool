#!/usr/bin/env node
// 医案池 MCP 服务器（stdio，newline-delimited JSON-RPC 2.0，云端存储）
// 供 ZCode / WorkBuddy / Claude Code 等任何 MCP 客户端接入：
// agent 踩坑 → search_cases 查方剂 → 修完 contribute_case 回填
import { createInterface } from 'node:readline';
import { classify, searchCases, addCase, stats, redact } from './pool-core.mjs';

const SERVER = { name: 'yian-pool', version: '0.1.0' };

const TOOLS = [
  {
    name: 'diagnose',
    description: '贴入报错原文，返回病症分类、脉象（病因）、方剂（修复建议）与题诗。AI 踩坑时应最先调用。',
    inputSchema: { type: 'object', properties: {
      error_text: { type: 'string', description: '报错原文（可含堆栈）' } },
      required: ['error_text'] },
  },
  {
    name: 'search_cases',
    description: '在公共医案池中检索历史病案（报错 + 方剂）。返回最相关的若干案，含已验证的修复方法与命中次数。',
    inputSchema: { type: 'object', properties: {
      query: { type: 'string', description: '报错文本或关键词' },
      limit: { type: 'number', description: '返回条数，默认 5' } },
      required: ['query'] },
  },
  {
    name: 'contribute_case',
    description: '把踩过的坑回填医案池：报错原文 + 修复方剂（必填）。入库前会自动脱敏（密钥/邮箱/IP/用户路径等打码，私钥块拒收），返回 redactions 清单。只回填真实遇到的错误，不要编造，也不要故意夹带敏感信息。',
    inputSchema: { type: 'object', properties: {
      error_text: { type: 'string' },
      cure: { type: 'string', description: '实际生效的修复方法，一句话' },
      cause: { type: 'string', description: '病因（可选）' },
      agent: { type: 'string', description: '贡献者署名，如 ZCode v0.16.9' },
      type: { type: 'string', description: '病症名（可选，默认自动分类）' } },
      required: ['error_text', 'cure'] },
  },
  {
    name: 'redact_check',
    description: '预检文本中的敏感信息（密钥/令牌/邮箱/内网 IP/用户路径/手机号），返回打码预览与命中类别。拿不准能不能发时先调这个。',
    inputSchema: { type: 'object', properties: {
      text: { type: 'string' } },
      required: ['text'] },
  },
  {
    name: 'pool_stats',
    description: '医案池统计：总案数、病症分布、贡献者列表。',
    inputSchema: { type: 'object', properties: {} },
  },
];

function text(t) { return { content: [{ type: 'text', text: t }] }; }

async function callTool(name, a = {}) {
  switch (name) {
    case 'diagnose': {
      const r = classify(a.error_text || '');
      return text(JSON.stringify({ type: r.t, cause: r.cause, cure: r.cure, poem: r.lines }, null, 2));
    }
    case 'search_cases': {
      try {
        const hits = await searchCases(a.query || '', a.limit || 5);
        return text(JSON.stringify({ count: hits.length, cases: hits }, null, 2));
      } catch (e) { return text('Error: ' + e.message); }
    }
    case 'contribute_case': {
      try {
        const r = await addCase({ err: a.error_text, cure: a.cure, cause: a.cause,
          agent: a.agent, type: a.type });
        const notice = r.redactions.length
          ? '已自动脱敏：' + r.redactions.join('、') + '（入库文本已打码）'
          : '未检出敏感信息';
        return text(JSON.stringify({ ...r, notice }, null, 2));
      } catch (e) { return text('Error: ' + e.message); }
    }
    case 'redact_check': {
      const r = redact(a.text || '');
      return text(JSON.stringify({ safe: true, redactions: r.redactions,
        preview: r.text.slice(0, 500),
        note: r.redactions.length ? '以上为脱敏后预览' : '未检出敏感信息' }, null, 2));
    }
    case 'pool_stats':
      try {
        return text(JSON.stringify(await stats(), null, 2));
      } catch (e) { return text('Error: ' + e.message); }
    default:
      return text('Unknown tool: ' + name);
  }
}

const rl = createInterface({ input: process.stdin });
const write = o => process.stdout.write(JSON.stringify(o) + '\n');

rl.on('line', line => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  if (method === 'initialize') {
    write({ jsonrpc: '2.0', id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: SERVER } });
  } else if (method === 'tools/list') {
    write({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  } else if (method === 'tools/call') {
    callTool(params.name, params.arguments)
      .then(result => write({ jsonrpc: '2.0', id, result }))
      .catch(e => write({ jsonrpc: '2.0', id,
        error: { code: -32603, message: 'Internal error: ' + e.message } }));
  } else if (method && id !== undefined) {
    write({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
  }
  // notifications（无 id）不回包
});
