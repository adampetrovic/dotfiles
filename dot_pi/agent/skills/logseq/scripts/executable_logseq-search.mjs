#!/usr/bin/env node
/* Work around @logseq/cli@0.4.3 search expecting block.title while Logseq API returns block/content. */

const token = process.env.LOGSEQ_API_SERVER_TOKEN;
if (!token) {
  console.error('LOGSEQ_API_SERVER_TOKEN is not set');
  process.exit(2);
}

const args = process.argv.slice(2);
let limit = 20;
let json = false;
const terms = [];

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if ((arg === '-l' || arg === '--limit') && args[i + 1]) {
    limit = Number(args[++i]);
  } else if (arg === '--json') {
    json = true;
  } else if (arg === '-h' || arg === '--help') {
    console.log('Usage: logseq-search [--limit N] [--json] <search terms>');
    process.exit(0);
  } else {
    terms.push(arg);
  }
}

const query = terms.join(' ').trim();
if (!query) {
  console.error('Usage: logseq-search [--limit N] [--json] <search terms>');
  process.exit(2);
}

const res = await fetch('http://127.0.0.1:12315/api', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    method: 'logseq.app.search',
    args: [query, { limit, 'enable-snippet?': false }],
  }),
});

if (!res.ok) {
  console.error(`Logseq API returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
const items = [];

for (const block of data.blocks ?? []) {
  items.push({
    type: 'block',
    uuid: block['block/uuid'],
    page: block['block/page'],
    content: block['block/content'] ?? block.title ?? '',
  });
}

for (const block of data['pages-content'] ?? []) {
  items.push({
    type: 'page-content',
    uuid: block['block/uuid'],
    snippet: block['block/snippet'] ?? '',
  });
}

for (const page of data.pages ?? []) {
  items.push({ type: 'page', page });
}

if (json) {
  console.log(JSON.stringify({ query, hasMore: Boolean(data['has-more?']), count: items.length, items }, null, 2));
} else {
  console.log(`Search found ${items.length} results${data['has-more?'] ? ' (has more)' : ''}:`);
  for (const item of items.slice(0, limit)) {
    if (item.type === 'page') {
      console.log(`[page] ${item.page}`);
    } else if (item.type === 'block') {
      console.log(`[block ${item.uuid}] ${item.content.replace(/\n/g, '\\n')}`);
    } else {
      console.log(`[page-content ${item.uuid}] ${item.snippet.replace(/\$pfts_[^$]*>|\$<pfts_[^$]*\$/g, '').replace(/\n/g, '\\n')}`);
    }
  }
}
