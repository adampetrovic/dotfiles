#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const DEFAULT_SERVER = '/Applications/Fantastical.app/Contents/Helpers/FantasticalMCP.app/Contents/MacOS/FantasticalMCP';
const serverCommand = process.env.FANTASTICAL_MCP_COMMAND || DEFAULT_SERVER;
const timeoutMs = Number(process.env.FANTASTICAL_MCP_TIMEOUT || 30000);
const clientInfo = { name: 'pi-fantastical-mcp-client', version: '0.1.0' };
const readOnlyTools = new Set(['queryCalendars', 'queryCalendarSets', 'queryCalendarItems', 'findAvailableTimes']);
const mutationTools = new Set(['createCalendarItem', 'modifyCalendarItem', 'deleteCalendarItem']);

function usage() {
  console.error(`Usage:
  fantastical-mcp-client.mjs doctor
  fantastical-mcp-client.mjs server-info
  fantastical-mcp-client.mjs list-tools
  fantastical-mcp-client.mjs list-tool-names
  fantastical-mcp-client.mjs describe-tool <tool-name>
  fantastical-mcp-client.mjs call-tool <tool-name> [json-args] [--confirm]
  fantastical-mcp-client.mjs call-tools '<json-array-of-{name,arguments}>'

Environment:
  FANTASTICAL_MCP_COMMAND  MCP server executable (default: ${DEFAULT_SERVER})
  FANTASTICAL_MCP_TIMEOUT  Request timeout in ms (default: 30000)

Mutating tools require --confirm after the user has approved the exact action.
`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const confirmed = argv.includes('--confirm');
const positional = argv.filter((arg) => arg !== '--confirm');
const [command, toolName, jsonArgs = '{}'] = positional;
const validCommands = new Set(['doctor', 'server-info', 'list-tools', 'list-tool-names', 'describe-tool', 'call-tool', 'call-tools']);

if (!command || !validCommands.has(command)) usage();
if ((command === 'describe-tool' || command === 'call-tool') && !toolName) usage();
if (command !== 'call-tool' && confirmed) usage();
let maxPositional = 1;
if (command === 'describe-tool' || command === 'call-tools') maxPositional = 2;
if (command === 'call-tool') maxPositional = 3;
if (positional.length > maxPositional) usage();
if (command === 'call-tool' && mutationTools.has(toolName) && !confirmed) {
  console.error(`${toolName} is mutating and requires --confirm after explicit user approval.`);
  process.exit(2);
}

let parsedArgs = {};
if (command === 'call-tool') {
  try {
    parsedArgs = JSON.parse(jsonArgs);
    if (!parsedArgs || Array.isArray(parsedArgs) || typeof parsedArgs !== 'object') {
      throw new Error('arguments must be a JSON object');
    }
  } catch (error) {
    console.error(`Invalid JSON arguments: ${error.message}`);
    process.exit(2);
  }
}

let batchCalls;
if (command === 'call-tools') {
  try {
    batchCalls = JSON.parse(toolName);
    if (!Array.isArray(batchCalls) || batchCalls.length === 0) {
      throw new Error('expected a nonempty JSON array of {name,arguments} calls');
    }
    for (const [index, call] of batchCalls.entries()) {
      if (!call || typeof call !== 'object' || Array.isArray(call)
          || !readOnlyTools.has(call.name)) {
        throw new Error(`call ${index}: only known read-only tools are allowed`);
      }
      if (!call.arguments || typeof call.arguments !== 'object' || Array.isArray(call.arguments)
          || Object.keys(call).some((key) => key !== 'name' && key !== 'arguments')) {
        throw new Error(`call ${index}: expected {name,arguments} with arguments as a JSON object`);
      }
    }
  } catch (error) {
    console.error(`Invalid batch: ${error.message}`);
    process.exit(2);
  }
}

function output(value) {
  console.log(JSON.stringify(value, null, 2));
}

function summarizeTools(tools) {
  return tools.map((tool) => ({
    name: tool.name,
    title: tool.annotations?.title,
    description: (tool.description || '').split('\n')[0].trim(),
    parameters: Object.keys(tool.inputSchema?.properties || {}),
    required: tool.inputSchema?.required || [],
    readOnly: tool.annotations?.readOnlyHint === true,
    destructive: tool.annotations?.destructiveHint === true,
  }));
}

await access(serverCommand, constants.X_OK).catch((error) => {
  throw new Error(`Fantastical MCP executable is unavailable at ${serverCommand}: ${error.message}`);
});

const child = spawn(serverCommand, [], { stdio: ['pipe', 'pipe', 'pipe'] });
const lines = createInterface({ input: child.stdout });
let nextId = 1;
let closed = false;
let stderr = '';
const pending = new Map();

child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => {
  stderr = (stderr + chunk).slice(-8192);
});

function request(method, params = {}) {
  if (closed) return Promise.reject(new Error(`Fantastical MCP is closed during ${method}`));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method} after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, { method, resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, (error) => {
      if (!error) return;
      const entry = pending.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.delete(id);
      reject(error);
    });
  });
}

function notify(method, params = {}) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
}

lines.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  if (message.id == null || !pending.has(message.id)) return;
  const entry = pending.get(message.id);
  clearTimeout(entry.timer);
  pending.delete(message.id);
  if (message.error) {
    entry.reject(new Error(`${entry.method} failed: ${JSON.stringify(message.error)}`));
  } else {
    entry.resolve(message.result);
  }
});

const processClosed = new Promise((resolve) => {
  child.once('close', (code, signal) => {
    closed = true;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`Fantastical MCP exited during ${entry.method} (code ${code}, signal ${signal})`));
    }
    pending.clear();
    resolve();
  });
});

child.once('error', (error) => {
  for (const entry of pending.values()) {
    clearTimeout(entry.timer);
    entry.reject(error);
  }
  pending.clear();
});

async function listAllTools() {
  const tools = [];
  let cursor;
  do {
    const result = await request('tools/list', cursor ? { cursor } : {});
    tools.push(...(result.tools || []));
    cursor = result.nextCursor;
  } while (cursor);
  return tools;
}

async function callBatch(tools) {
  const available = new Set(tools.map((tool) => tool.name));
  const results = [];
  let next = 0;
  async function worker() {
    while (next < batchCalls.length) {
      const index = next++;
      const call = batchCalls[index];
      try {
        if (!available.has(call.name)) throw new Error(`Tool not found: ${call.name}`);
        const result = await request('tools/call', call);
        results[index] = { name: call.name, ok: !result?.isError, result };
      } catch (error) {
        results[index] = { name: call.name, ok: false, error: error.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, batchCalls.length) }, worker));
  output({ results });
  if (results.some((result) => !result.ok)) process.exitCode = 1;
}

async function close() {
  if (closed) return;
  child.stdin.end();
  await Promise.race([
    processClosed,
    new Promise((resolve) => setTimeout(() => {
      if (!closed) child.kill('SIGTERM');
      resolve();
    }, 1000)),
  ]);
}

try {
  const initialized = await request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo,
  });
  notify('notifications/initialized');

  if (command === 'server-info') {
    output(initialized);
  } else {
    const tools = await listAllTools();
    if (command === 'doctor') {
      output({
        ok: true,
        command: serverCommand,
        serverInfo: initialized.serverInfo,
        protocolVersion: initialized.protocolVersion,
        toolCount: tools.length,
        tools: tools.map((tool) => tool.name),
      });
    } else if (command === 'list-tools') {
      output({ tools });
    } else if (command === 'list-tool-names') {
      output(summarizeTools(tools));
    } else if (command === 'describe-tool') {
      const tool = tools.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`Tool not found: ${toolName}`);
      output(tool);
    } else if (command === 'call-tools') {
      await callBatch(tools);
    } else if (command === 'call-tool') {
      const tool = tools.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`Tool not found: ${toolName}`);
      const result = await request('tools/call', { name: toolName, arguments: parsedArgs });
      output(result);
      if (result?.isError) process.exitCode = 1;
    }
  }
} catch (error) {
  const diagnostic = stderr.trim() ? `\nServer stderr:\n${stderr.trim()}` : '';
  console.error(`${error.message}${diagnostic}`);
  process.exitCode = 1;
} finally {
  await close();
}
