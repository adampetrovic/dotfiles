#!/usr/bin/env node
import http from 'node:http';
import https from 'node:https';

const DEFAULT_SSE_URL = 'http://127.0.0.1:64342/sse';
const sseUrl = new URL(process.env.IDEA_MCP_URL || DEFAULT_SSE_URL);
const timeoutMs = Number(process.env.IDEA_MCP_TIMEOUT || 30000);
const clientName = 'pi-intellij-idea-mcp-client';
const clientVersion = '0.1.0';

function usage() {
  console.error(`Usage:
  idea-mcp-client.mjs doctor
  idea-mcp-client.mjs server-info
  idea-mcp-client.mjs list-tools
  idea-mcp-client.mjs list-tool-names
  idea-mcp-client.mjs describe-tool <tool-name>
  idea-mcp-client.mjs call-tool <tool-name> [json-args]

Environment:
  IDEA_MCP_URL       SSE URL shown by IDEA MCP Server settings (default ${DEFAULT_SSE_URL})
  IDEA_MCP_TIMEOUT   Request timeout in ms (default 30000)

Examples:
  ./scripts/idea-mcp-client.mjs doctor
  ./scripts/idea-mcp-client.mjs list-tool-names
  ./scripts/idea-mcp-client.mjs describe-tool search_symbol
  ./scripts/idea-mcp-client.mjs call-tool get_project_modules '{"projectPath":"/Users/apetrovic/code/tdp-os"}'
`);
  process.exit(2);
}

const [cmd, toolName, jsonArgs = '{}'] = process.argv.slice(2);
const valid = new Set(['doctor', 'server-info', 'list-tools', 'list-tool-names', 'describe-tool', 'call-tool']);
if (!cmd || !valid.has(cmd)) usage();
if ((cmd === 'describe-tool' || cmd === 'call-tool') && !toolName) usage();

let parsedArgs = {};
if (cmd === 'call-tool') {
  try {
    parsedArgs = JSON.parse(jsonArgs);
  } catch (err) {
    console.error(`Invalid JSON args: ${err.message}`);
    process.exit(2);
  }
}

const transport = sseUrl.protocol === 'https:' ? https : http;
let endpointPath = null;
let endpointUrl = null;
let buffer = '';
let nextId = 1;
const pending = new Map();
let initializedResult = null;

function withTimeout(promise, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs);
    }),
  ]);
}

function postJson(obj) {
  if (!endpointUrl) throw new Error('MCP endpoint is not available yet');
  const data = JSON.stringify(obj);
  const lib = endpointUrl.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(endpointUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} from MCP endpoint: ${body}`));
        } else {
          resolve({ statusCode: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendRequest(method, params = {}) {
  const id = nextId++;
  const promise = new Promise((resolve, reject) => {
    pending.set(id, { method, resolve, reject });
  });
  postJson({ jsonrpc: '2.0', id, method, params }).catch((err) => {
    const p = pending.get(id);
    if (p) {
      pending.delete(id);
      p.reject(err);
    }
  });
  return withTimeout(promise, method);
}

async function sendNotification(method, params = {}) {
  await postJson({ jsonrpc: '2.0', method, params });
}

function output(value) {
  console.log(JSON.stringify(value, null, 2));
}

function summarizeTools(tools) {
  return tools.map((tool) => ({
    name: tool.name,
    description: (tool.description || '').split('\n')[0].trim(),
    params: Object.keys(tool.inputSchema?.properties || {}),
  }));
}

async function runCommand() {
  initializedResult = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: clientName, version: clientVersion },
  });
  await sendNotification('notifications/initialized');

  if (cmd === 'server-info') {
    output(initializedResult);
    return;
  }

  const toolsResult = await sendRequest('tools/list');
  const tools = toolsResult.tools || [];

  if (cmd === 'doctor') {
    output({
      ok: true,
      sseUrl: sseUrl.toString(),
      messageEndpoint: endpointPath,
      serverInfo: initializedResult.serverInfo,
      protocolVersion: initializedResult.protocolVersion,
      toolCount: tools.length,
      sampleTools: tools.slice(0, 12).map((tool) => tool.name),
    });
  } else if (cmd === 'list-tools') {
    output(toolsResult);
  } else if (cmd === 'list-tool-names') {
    output(summarizeTools(tools));
  } else if (cmd === 'describe-tool') {
    const tool = tools.find((candidate) => candidate.name === toolName);
    if (!tool) throw new Error(`Tool not found: ${toolName}`);
    output(tool);
  } else if (cmd === 'call-tool') {
    const result = await sendRequest('tools/call', { name: toolName, arguments: parsedArgs });
    output(result);
  }
}

function handleJsonRpcMessage(data) {
  let msg;
  try {
    msg = JSON.parse(data);
  } catch (err) {
    throw new Error(`Invalid JSON-RPC payload from SSE: ${err.message}\n${data}`);
  }
  if (msg.id != null && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(`${p.method} failed: ${JSON.stringify(msg.error)}`));
    else p.resolve(msg.result);
  }
}

function handleSseEvent(raw) {
  const lines = raw.split('\n');
  let event = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  const data = dataLines.join('\n');
  if (!data) return;

  if (event === 'endpoint') {
    endpointPath = data;
    endpointUrl = new URL(endpointPath, sseUrl);
    runCommand().then(() => {
      process.exit(0);
    }).catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
      process.exit();
    });
  } else {
    handleJsonRpcMessage(data);
  }
}

const req = transport.get(sseUrl, { headers: { accept: 'text/event-stream' } }, (res) => {
  if (res.statusCode !== 200) {
    console.error(`SSE connection failed: HTTP ${res.statusCode}`);
    res.resume();
    process.exit(1);
  }
  const contentType = res.headers['content-type'] || '';
  if (!contentType.includes('text/event-stream')) {
    console.error(`Unexpected content-type from SSE endpoint: ${contentType}`);
  }
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    try {
      buffer = (buffer + chunk).replace(/\r\n/g, '\n');
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleSseEvent(event);
      }
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error(`Could not connect to IDEA MCP SSE at ${sseUrl}: ${err.message}`);
  process.exit(1);
});

setTimeout(() => {
  console.error(`Timed out connecting to IDEA MCP SSE at ${sseUrl}`);
  process.exit(1);
}, timeoutMs).unref();
