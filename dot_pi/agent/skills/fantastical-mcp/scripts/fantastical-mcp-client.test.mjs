import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const exec = promisify(execFile);
const sourceClient = fileURLToPath(new URL('./executable_fantastical-mcp-client.mjs', import.meta.url));
const client = existsSync(sourceClient) ? sourceClient
  : fileURLToPath(new URL('./fantastical-mcp-client.mjs', import.meta.url));
const reads = ['queryCalendars', 'queryCalendarSets', 'queryCalendarItems', 'findAvailableTimes'];
const mutations = ['createCalendarItem', 'modifyCalendarItem', 'deleteCalendarItem'];
const mockSource = `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
const log = (value) => appendFileSync(process.env.MOCK_LOG, JSON.stringify(value) + '\\n');
log({ started: true });
const reply = (id, result) => console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
const names = ['queryCalendars', 'queryCalendarSets', 'queryCalendarItems', 'findAvailableTimes',
  'createCalendarItem', 'modifyCalendarItem', 'deleteCalendarItem'];
let active = 0;
let received = 0;
let queue = [];
function respond(message) {
  const args = message.params.arguments;
  if (args.mode === 'exit') process.exit(1);
  if (args.mode === 'hang') return;
  active--;
  if (args.mode === 'rpc') {
    console.log(JSON.stringify({ jsonrpc: '2.0', id: message.id,
      error: { code: -32000, message: 'mock failure' } }));
  } else {
    reply(message.id, { isError: args.mode === 'tool-error', marker: args.marker,
      content: [{ type: 'text', text: 'synthetic response' }] });
  }
}
createInterface({ input: process.stdin }).on('line', (line) => {
  const message = JSON.parse(line);
  log(message);
  if (message.method === 'initialize') reply(message.id, { protocolVersion: '2024-11-05' });
  if (message.method === 'tools/list') {
    // Exercise discovery pagination without repeating it for each call.
    const selected = process.env.MOCK_MISSING ? names.filter((name) => name !== 'findAvailableTimes') : names;
    reply(message.id, message.params.cursor
      ? { tools: selected.slice(2).map((name) => ({ name })) }
      : { tools: selected.slice(0, 2).map((name) => ({ name })), nextCursor: 'page2' });
  }
  if (message.method === 'tools/call') {
    active++;
    received++;
    log({ active });
    if (process.env.MOCK_BARRIER && received <= 3) {
      queue.push(message);
      if (received === 3) {
        for (const queued of queue.reverse()) respond(queued);
        queue = [];
      }
    } else respond(message);
  }
});
`;

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'fantastical-client-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const server = join(dir, 'mock.mjs');
  const log = join(dir, 'requests.jsonl');
  await writeFile(server, mockSource);
  await chmod(server, 0o755);
  return {
    async run(args, env = {}) {
      try {
        const result = await exec(process.execPath, [client, ...args], {
          env: { ...process.env, FANTASTICAL_MCP_COMMAND: server,
            FANTASTICAL_MCP_TIMEOUT: '2000', MOCK_LOG: log, ...env },
          timeout: 10000,
        });
        return { ...result, code: 0 };
      } catch (error) {
        return { stdout: error.stdout, stderr: error.stderr, code: error.code };
      }
    },
    async logs() {
      try {
        return (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
    },
  };
}
const call = (name, arguments_ = {}) => ({ name, arguments: arguments_ });
const batch = (calls) => ['call-tools', JSON.stringify(calls)];

test('one initialization/discovery, concurrency exactly three, results in input order', async (t) => {
  const f = await fixture(t);
  const calls = Array.from({ length: 8 }, (_, marker) => call(reads[marker % 4], { marker }));
  const response = await f.run(batch(calls), { MOCK_BARRIER: '1' });
  assert.equal(response.code, 0, response.stderr);
  const { results } = JSON.parse(response.stdout);
  assert.deepEqual(results.map((entry) => entry.result.marker), calls.map((entry) => entry.arguments.marker));
  assert.ok(results.every((entry) => entry.ok));
  const logs = await f.logs();
  assert.equal(logs.filter((entry) => entry.started).length, 1);
  assert.equal(logs.filter((entry) => entry.method === 'initialize').length, 1);
  assert.equal(logs.filter((entry) => entry.method === 'notifications/initialized').length, 1);
  assert.equal(logs.filter((entry) => entry.method === 'tools/list').length, 2);
  assert.equal(logs.filter((entry) => entry.method === 'tools/call').length, 8);
  assert.equal(Math.max(...logs.filter((entry) => entry.active).map((entry) => entry.active)), 3);
});

test('rejects every unsafe or malformed batch before server startup', async (t) => {
  const f = await fixture(t);
  const invalid = [
    ...mutations.map((name) => batch([call('queryCalendars'), call(name)])),
    batch([call('unknownTool')]), batch([]), batch({}), batch([null]),
    batch([call('queryCalendars', [])]), batch([call('queryCalendars', null)]),
    batch([{ name: 'queryCalendars' }]),
    batch([{ ...call('queryCalendars'), confirm: true }]),
    ['call-tools', '{'], ['call-tools'], [...batch([call('queryCalendars')]), '--confirm'],
  ];
  for (const args of invalid) {
    const response = await f.run(args);
    assert.equal(response.code, 2, JSON.stringify(args));
  }
  assert.deepEqual(await f.logs(), []);
});

test('preserves tool and RPC failures, missing tools, and successful branches', async (t) => {
  const f = await fixture(t);
  const response = await f.run(batch([
    call('queryCalendars', { marker: 1 }),
    call('queryCalendarSets', { mode: 'rpc' }),
    call('queryCalendarItems', { mode: 'tool-error' }),
    call('findAvailableTimes', { durationMinutes: 60 }),
    call('queryCalendars', { marker: 5 }),
  ]), { MOCK_MISSING: '1' });
  assert.equal(response.code, 1);
  const { results } = JSON.parse(response.stdout);
  assert.deepEqual(results.map((entry) => entry.ok), [true, false, false, false, true]);
  assert.match(results[1].error, /mock failure/);
  assert.equal(results[2].result.isError, true);
  assert.match(results[3].error, /Tool not found/);
  assert.equal(results[4].result.marker, 5);
});

test('a timed-out branch does not discard later reads', async (t) => {
  const f = await fixture(t);
  const response = await f.run(batch([
    call('queryCalendars', { mode: 'hang' }),
    ...Array.from({ length: 4 }, (_, marker) => call('queryCalendarItems', { marker })),
  ]));
  assert.equal(response.code, 1);
  const { results } = JSON.parse(response.stdout);
  assert.match(results[0].error, /Timed out/);
  assert.ok(results.slice(1).every((entry) => entry.ok));
});

test('server exit is captured for each branch', async (t) => {
  const f = await fixture(t);
  const response = await f.run(batch(Array.from({ length: 5 }, () => call('queryCalendars', { mode: 'exit' }))));
  assert.equal(response.code, 1);
  const { results } = JSON.parse(response.stdout);
  assert.equal(results.length, 5);
  assert.ok(results.every((entry) => !entry.ok && typeof entry.error === 'string'));
});

test('existing commands and mutation confirmation gate remain intact without any writes', async (t) => {
  const f = await fixture(t);
  for (const name of mutations) {
    assert.equal((await f.run(['call-tool', name, '{}'])).code, 2);
  }
  assert.deepEqual(await f.logs(), []);
  for (const args of [
    ['doctor'], ['server-info'], ['list-tools'], ['list-tool-names'],
    ['describe-tool', 'queryCalendars'], ['call-tool', 'queryCalendars', '{}'],
  ]) {
    const response = await f.run(args);
    assert.equal(response.code, 0, response.stderr);
    assert.doesNotThrow(() => JSON.parse(response.stdout));
  }
  assert.ok((await f.logs()).filter((entry) => entry.method === 'tools/call')
    .every((entry) => reads.includes(entry.params.name)));
});
