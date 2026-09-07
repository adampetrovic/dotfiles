#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

const SERVER = new URL('./ops-sherpa-mcp.sh', import.meta.url).pathname;
const TIMEOUT_MS = Number(process.env.MCP_CLIENT_TIMEOUT || 30000);

function usage() {
  console.error(`Usage:
  ops-sherpa-mcp-client.mjs list-tools
  ops-sherpa-mcp-client.mjs call-tool <tool-name> [json-args]

Examples:
  ./scripts/ops-sherpa-mcp-client.mjs list-tools
  ./scripts/ops-sherpa-mcp-client.mjs call-tool list_alerts '{"limit":5}'

Notes:
  - Starts the configured Ops Sherpa MCP stdio server directly; no Codex needed.
  - Never pass secrets as arguments; use environment/mise/atlas as configured.
  - Tool argument schemas are discoverable via list-tools.
`);
  process.exit(2);
}

const [cmd, toolName, jsonArgs = '{}'] = process.argv.slice(2);
if (!cmd || !['list-tools', 'call-tool'].includes(cmd)) usage();
if (cmd === 'call-tool' && !toolName) usage();

let toolArgs;
try {
  toolArgs = JSON.parse(jsonArgs);
} catch (err) {
  console.error(`Invalid JSON args: ${err.message}`);
  process.exit(2);
}

const child = spawn(SERVER, [], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
});

child.stderr.on('data', (buf) => {
  // Preserve server warnings/errors, but the server/wrapper should already avoid printing secrets.
  process.stderr.write(buf);
});

let buffer = '';
let nextId = 1;
const pending = new Map();

function send(msg) {
  child.stdin.write(`${JSON.stringify(msg)}\n`);
}

function request(method, params = {}) {
  const id = nextId++;
  send({ jsonrpc: '2.0', id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer, method });
  });
}

function notify(method, params = {}) {
  send({ jsonrpc: '2.0', method, params });
}

function handleMessage(msg) {
  if (msg.id != null && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.error) p.reject(new Error(`${p.method} failed: ${JSON.stringify(msg.error)}`));
    else p.resolve(msg.result);
  }
}

function parseLines() {
  while (true) {
    const idx = buffer.indexOf('\n');
    if (idx === -1) return;
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    handleMessage(JSON.parse(line));
  }
}

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString('utf8');
  try {
    parseLines();
  } catch (err) {
    console.error(err.message);
    child.kill();
    process.exit(1);
  }
});

child.on('exit', (code, signal) => {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error(`MCP server exited before response: code=${code} signal=${signal}`));
  }
  pending.clear();
});

try {
  await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'ops-sherpa-direct-client', version: '0.1.0' },
  });
  notify('notifications/initialized');

  if (cmd === 'list-tools') {
    const result = await request('tools/list');
    console.log(JSON.stringify(result, null, 2));
  } else {
    const result = await request('tools/call', { name: toolName, arguments: toolArgs });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  child.stdin.end();
  await sleep(100);
  child.kill();
}
