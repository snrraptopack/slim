# Auwgent YAML-Lite: The In-Depth Guide

Welcome to the definitive guide for the Auwgent YAML-Lite parser. This document provides a comprehensive look at the architecture, mechanics, and features of the engine that powers Auwgent's structured output.

---

## 1. Philosophy & The Vision

YAML-Lite was built with a single goal: **LLM-First Streaming Logic**. 

Traditional JSON or standard YAML parsers are designed for *static* or *batch* data. In the world of LLMs, data arrives in unpredictable "chunks," and waiting for a closing bracket `}` or `]` is unacceptable for real-time Agentic loops.

### The "Virtual Completion" Pattern
The core innovation of Auwgent is **Virtual Completion**. At any point in time, even if the model has only typed `intent:\n  type: se`, our parser can "peek" into the future, simulate the closing of the current object, and return a valid JSON object like `{ intent: { type: "se" } }`.

---

## 2. Core Architecture Deep Dive

The parser is implemented as a strict three-layer linear pipeline. Each layer is decoupled and serves a specific transformation role.

### Layer 1: The Tokenizer (Lexer)
The Tokenizer is the only part of the system that "sees" characters. It is a **Stateful Lexer**.

*   **Buffering System**: When a chunk arrives (e.g., `sea`), the tokenizer analyzes it. If the chunk doesn't end a token (e.g., no space or colon), it buffers the characters. When the next chunk arriving (`rch:`) is processed, it combines them to emit a single `VALUE(search)` token.
*   **Indentation Tracking**: The tokenizer is responsible for translating the "whitespace" at the start of lines into `INDENT` and `DEDENT` tokens. This is the foundation of YAML's hierarchy.
*   **Safety**: It ensures that individual tokens are never emitted in a broken state.

### Layer 2: The Parser (The Event Loop)
The Parser is a **Recursive-Descent Stack Machine**. It consumes tokens and builds an **Abstract Syntax Tree (AST)**.

*   **The Frame Stack**: The parser maintains a `stack` of "Frames". Each frame represents an open level of nesting (a `mapping` or a `sequence`).
*   **Context Awareness**: If the parser sees a `DASH (-)` token, it knows it must be in a sequence frame. If it sees a `KEY`, it switches to mapping context.
*   **Event Emission**: This is where the "Event-Driven" magic happens. As the parser identifies a `KEY` token, it immediately triggers the `on('key')` listeners. It doesn't wait for the value; it emits as soon as the grammar rule matches.

### Layer 3: The IR Builder (The Interpreter)
The IR Builder takes the AST and translates it into a standard JavaScript object (the **Intermediate Representation**).

*   **Type Coercion**: It automatically translates strings like `"100"` to `100` (number) or `"true"` to `true` (boolean) unless they were quoted in the source.
*   **Reference Resolution (`$ref`)**: Supports YAML anchors and aliases. It maintains a registry of IDs and can "inline" values when a `ref: some_id` is encountered, enabling complex, non-linear data structures.
*   **Flow-Style Parsing**: It includes a specialized sub-parser for "inline" objects like `{ x: 1, y: 2 }`, making it compatible with both block-style and flow-style YAML.

---

## 3. Streaming Method Reference

The `StreamingParser` instance is your primary interface. Here is a detailed look at every method.

### `write(chunk: string): void`
This is the entry point for data.
*   **Chunks**: You can pass strings of any length (from 1 character to 1MB).
*   **Execution**: It runs the Tokenizer and Parser loops synchronously. By the time `write()` returns, all events relevant to that chunk have already fired.
*   **Event Precedence**: Because execution is synchronous, you **must** call `.on()` or `.onIntent()` **before** your first `write()`.

> [!IMPORTANT]
> **Synchronous Execution Trap**
>
> Unlike Node.js streams which buffer events, this parser fires events immediately. If you write data before subscribing, the events are lost forever.

```typescript
// ❌ WRONG: Writing before listening
parser.write("intent: search"); // Event fires and vanishes!
parser.onIntent('sys_cmd', ...); // Too late.

// ✅ CORRECT: Subscribe first
parser.onIntent('sys_cmd', ...); // Ready and waiting
parser.write("intent: search"); // Caught!
```

### `peek(): TDoc`
The most powerful tool in the toolkit.
*   **Partial Reality**: It builds a temporary JavaScript object from the current state of the AST.
*   **Zero Side-Effects**: Calling `peek()` does not advance the parser or consume data. You can call it repeatedly.
*   **Normalization**: It automatically handles incomplete keys or values. For example, if the LLM is mid-word, `peek()` returns the word so far. If a property has no value yet, it returns `{}` or `null` depending on the schema hint.

### `end(): TDoc`
Signals that the stream is dead.
*   **Cleanup**: It flushes any pending buffers in the tokenizer and adds an implicit `EOF`.
*   **Validation**: It performs final safety checks. If the indentation is inconsistent (e.g., the model stopped mid-indent), it attempts to recover or logs a diagnostic error.

### `reset(): void`
Clears everything.
*   **Lifecycle**: Use this if you want to reuse the same object for a new LLM request. It clears the AST, the Tokenizer buffers, and all event listeners.

---

## 4. The Event System Reference

Auwgent uses a layered event system to provide both power and convenience.

### 4.1 Low-Level Grammar Events
Use these for building middleware, logging, or "raw" observers.

| Event | Data Pattern | Description |
| :--- | :--- | :--- |
| `key` | `{ key: string }` | Emitted the moment a key is finalized. |
| `value` | `{ value: any, quoted: bool }` | Emitted when a scalar (string, num, bool) is parsed. |
| `block_start` | `{ kind: 'mapping' \| 'sequence' }` | Emitted when we step into a new depth level. |
| `block_end` | `{ kind: 'mapping' \| 'sequence' }` | Emitted when we step out of a depth level. |
| `indent` | `{ level: number }` | Emitted when the whitespace level increases. |
| `dedent` | `{ level: number }` | Emitted when the whitespace level decreases. |

### 4.2 High-Level Agentic Events
These are the events you will use 99% of the time in your application.

#### `onIntent(key, handler)`
Subscribes to a specific "Intent" defined in your layout (e.g., `sys_cmd` or `ui_render`).
*   **Strict Typing**: The payload is automatically narrowed to the specific union member.
*   **Logic**:
    1.  Parser tracks the `intentKey` (e.g., `sys_cmd`).
    2.  When the `sys_cmd` block **finishes** (model moves to a lower indent), this fires. 

```typescript
parser.onIntent('sys_cmd', (cmd) => {
    // cmd.type is "search" | "create_alert"
    // cmd.args is fully populated
});
```

#### `onIntentPartial(handler)`
The "GenUI" event. It fires on **every** `.write()` if there is an active intent.
*   **Payload**: A partial object of the current intent.
*   **Utility**: Use this to stream model outputs directly to React/Svelte components before they are finished.

---

## 5. Streaming Mechanics & Edge Cases

Streaming YAML is difficult because of its reliance on whitespace. Here is how we handle common edge cases:

### Case A: Key split across chunks
*   Chunk 1: `compon`
*   Chunk 2: `ent: StockCard`
*   **Result**: Parser buffers `compon`, waits, then emits `KEY(component)` and `VALUE(StockCard)`.

### Case B: Colon split
*   Chunk 1: `component`
*   Chunk 2: `: StockCard`
*   **Result**: Parser handles this by deferring the "Key Transition" until the colon is seen.

### Case C: Undefined Idents
If the model starts an intent but emits no content:
```yaml
sys_cmd:
ui_render:
```
The parser detects that `sys_cmd` has no body and treats it as an `EmptyNode`, which becomes `{}` in the IR.

---

## 6. TypeScript Integration & The "Source of Truth"

The real power of Auwgent is the connection between your **Instructions** and your **Code**.

### The Flow
1.  **Define**: Use `definePrompt` and `tools()` to describe your agent.
2.  **Compile**: `compilePrompt` generates the YAML schema the LLM needs to follow.
3.  **Infer**: `InferPromptDoc<typeof yourPrompt>` creates a TypeScript type.
4.  **Parse**: `createStreamingParser<SystemOutput>()` uses that type to enforce safety.

```typescript
// All these stay in sync automatically!
parser.onIntent('sys_cmd', (cmd) => {
    // cmd.args.query is inferred as 'string' because 
    // it was defined as 'string' in the prompt!
});
```

---

## 7. Performance & Optimization

The parser is optimized for low-latency streaming.

*   **Memory Recycling**: The `Parser` and `IRBuilder` instances can be reset and reused.
*   **Non-Blocking**: Processing a single token takes microseconds. The bottleneck will always be your LLM's network latency.
*   **Throughput**: Validated against 1MB+ YAML payloads with nested depths of 20+ levels.

---

## 8. Troubleshooting

### 1. "Payload is undefined" or "Dot notation fails"
*   **Reason**: You are likely using `onIntentReady` which returns a large Union.
*   **Fix**: Use `onIntent('key', handler)` instead. It narrows the type to exactly what you need.

### 2. "I missed an intent event"
*   **Reason**: You called `.write()` before subscribing.
*   **Fix**: Always move your `.on(...)` and `.onIntent(...)` calls immediately after the parser creation.

### 3. "The parser is emitting too many partials"
*   **Reason**: You are calling `onIntentPartial` but the model is emitting character-by-character.
*   **Fix**: Throttle your UI updates. Usually updating the UI once every 100ms is enough for a smooth experience.

---

## 9. Best Practices for Developers

1.  **Use `as const`**: Always define your tool and component arrays `as const`. This is required for TypeScript to see the literal strings instead of just `string`.
2.  **Centralize Types**: Use the `InferPromptDoc` pattern. Never manually write your intent types. If you change a tool in your prompt, your parser code should immediately show a red squiggly if it's no longer compatible.
3.  **Handle Errors Gracefully**: Listen to the `error` event. LLMs are not perfect; sometimes they will hallucinate indentation. The parser is robust, but your app should know if a block was malformed.

---

*This guide is part of the Auwgent core documentation. For more information, visit the [README](../README.md).*
