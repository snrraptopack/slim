# Auwgent YAML-Lite Usage Guide

This guide explains how to install, stream, and extend the YAML-Lite parser that powers Auwgent's structured output pipeline.

## 1. Installation

1. Install [Bun](https://bun.sh) v1.0 or later.
2. Clone this repository and install dependencies:

```
bun install
```

The project ships with a `bun.lock` for deterministic installs. Consumers should also have TypeScript 5 available because the public API exports TypeScript types.

## 2. Repository Layout

- `src/` — tokenizer, parser, IR builder, and high-level helpers
- `tests/` — Bun test suite (unit, integration, streaming stress tests)
- `fixtures/` — YAML-Lite samples used by the fixture runner
- `output/` — generated JSON from fixtures
- `demo-streaming.ts` — executable streaming walkthrough
- `run-fixtures.ts` — converts every fixture to JSON

## 3. Core API

All public exports live in `src/index.ts`.

### 3.1 `parseToJSON`

```ts
import { parseToJSON } from './src/index';

const input = `intent:\n  type: tool_call\n  name: search\n  args:\n    query: hello world\n`;
const json = parseToJSON(input);

console.log(json.intent.name); // "search"
```

`parseToJSON` consumes the entire string, parses it, builds the IR, and returns a JSON-compatible value.

### 3.2 `parseWithDiagnostics`

```ts
import { parseWithDiagnostics } from './src/index';

const result = parseWithDiagnostics(input);

console.log(result.parse.ast); // AST root node
console.log(result.ir.registry); // id/ref registry
console.log(result.ir.unresolvedRefs); // unresolved references
```

This helper is ideal when you need error reporting or must inspect the AST/IR simultaneously.

### 3.3 `createStreamingParser`

```ts
import { createStreamingParser } from './src/index';

const stream = createStreamingParser();

stream.write('tool');
stream.write('_call:\n');
stream.write('  name: web_search\n');

console.log(stream.peek());
// { tool_call: { name: 'web_search' } }

stream.write('  parameters:\n    query: AI news\n    limit: 10\n');

const final = stream.end();
// { tool_call: { name: 'web_search', parameters: { query: 'AI news', limit: 10 } } }
```

Key capabilities:

- Accepts arbitrarily sized chunks via `write(chunk)`
- `peek()` returns a snapshot without consuming buffered input
- `end()` finalizes parsing, resolves references, and returns the JSON IR
- `onIntentReady(handler)` fires the moment an intent block structurally completes

## 4. Streaming Workflow

1. Call `createStreamingParser()` at the start of each conversation.
2. Forward model output chunks to `write(chunk)` exactly as they arrive.
3. Use `peek()` for progressive UI or tool routing. The tokenizer buffers incomplete tokens, so partial snapshots never flatten nested structures.
4. Call `end()` when the model signals completion (e.g., `<END>` token). If the stream ends mid-block the parser may throw; continue using `peek()` for partial state.
5. For long-running chats, reuse the same parser instance per session.

### 4.1 Partial Documents

- Mappings without bodies (e.g., `args:`) become `{}` automatically.
- Sequence placeholders (`-`) become `[]`.
- Unterminated documents still produce valid partial IR through `peek()`.

### 4.2 Middleware

Pass `ParserOptions.middleware` when constructing the parser to observe events:

```ts
const stream = createStreamingParser({
  middleware: [event => {
    if (event.type === 'intent_ready') {
      console.log('Intent ready:', event.data);
    }
  }],
});
```

Middleware receives `{ type, data, position }` and must be side-effect free.

## 5. Command Reference

| Command | Purpose |
| --- | --- |
| `bun test` | Runs the entire Bun-powered test suite (unit, integration, stress, streaming variations) |
| `bun run demo-streaming.ts` | Streams a canned conversation and prints incremental `peek()` results |
| `bun run run-fixtures.ts` | Converts fixtures to JSON IR and writes results to `output/` |

## 6. Streaming Test Matrix

Automated Bun tests cover the following scenarios:

- Character-by-character streaming
- Line-by-line streaming
- Chunk splits where keys and colons arrive separately
- Chunk sizes `[1, 2, 4, 8, full]` compared against `parseToJSON`
- Large 20-step workflows with repeating chunk patterns to validate sustained throughput

Add custom regressions in `tests/parser.test.ts` under **Streaming Chunk Variations** whenever the tokenizer or grammar evolves.

## 7. Performance Notes

- The tokenizer defers emitting keys/scalars until delimiters arrive, ensuring snapshots stay nested even if chunks end mid-token.
- `peek()` rebuilds the IR; throttle calls if the model emits single characters to avoid redundant work.
- `createStreamingParser` keeps parser and IR builder instances alive for minimal allocations.

## 8. Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| Keys leak to the root object | Chunk split between key and colon before tokenizer fix | Upgrade to the latest tokenizer or stream full `key:` lines |
| `end()` throws on partial input | Generator stopped mid-block | Continue using `peek()` until generation completes |
| Missing `intent_ready` events | Handler registered after chunks were processed | Register `onIntentReady` immediately after creating the parser |

## 9. Contributing

1. Install dependencies (`bun install`).
2. Implement your changes.
3. Add or update streaming regression tests.
4. Run `bun test` and (optionally) `bun run demo-streaming.ts` for smoke verification.
5. Submit a PR with a summary of the grammar or streaming behavior change.
