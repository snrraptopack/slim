/**
 * AUWGENT YAML-Lite — Public API
 * 
 * Main entry point for the parser library.
 */

// Re-export types
export type {
    // Token types
    Token,
    TokenType,
    Position,

    // AST types
    ASTNode,
    ScalarNode,
    MappingNode,
    MappingEntry,
    SequenceNode,
    RefNode,
    EmptyNode,
    ParseResult,
    ParseError,

    // IR types
    IRValue,
    IRObject,
    IRArray,
    IRRef,
    IRResult,
    IRError,

    // Event types
    ParserEvent,
    ParserEventType,
    ParserMiddleware,

    // Options
    ParserOptions,
    IntentSchema,
    StreamingParser,
} from './types';

// Re-export tokenizer
export { Tokenizer, tokenize } from './tokenizer';

// Re-export parser
export { Parser, parse, createParser } from './parser';

// Re-export IR builder
export { IRBuilder, buildIR } from './ir-builder';

// ═══════════════════════════════════════════════════════════════════════════
// HIGH-LEVEL API
// ═══════════════════════════════════════════════════════════════════════════

import { Parser } from './parser';
import { IRBuilder } from './ir-builder';
import type { ParserOptions, IRValue, IRResult, ParseResult, StreamingParser, MappingNode, InferDiscriminator, InferPayload } from './types';

/**
 * Create a streaming parser with JSON output.
 * 
 * @example
 * ```typescript
 * // Automatic inference!
 * const stream = createStreamingParser<MyDoc>();
 * stream.onIntentReady((type, payload) => {
 *   // type is inferred
 *   // payload is inferred
 * });
 * ```
 */
export function createStreamingParser<TDoc = unknown, TIntent = InferDiscriminator<TDoc>, TPayload = InferPayload<TDoc>>(options?: ParserOptions): StreamingParser<TIntent, TDoc, TPayload> {
    const parser = new Parser(options);
    const irBuilder = new IRBuilder();
    let intentHandler: ((type: TIntent, payload: TPayload) => void) | null = null;
    let partialHandler: ((type: TIntent, payload: TPayload) => void) | null = null;

    // START: Custom Intent Maps
    const specificHandlers = new Map<string, (payload: any) => void>();
    // END: Custom Intent Maps

    // Track active intent state for partial updates (now supports multiple)
    let activeIntents = new Map<string, { node: any, type: TIntent }>();

    // Debounce state
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceMs = 0;

    // Helper to emit partial updates for all active intents
    const emitPartials = () => {
        if (!partialHandler) return;

        console.log('[StreamParser] emitPartials called, activeIntents:', activeIntents.size);

        for (const [key, intent] of activeIntents) {
            try {
                const buildResult = irBuilder.build(intent.node);
                const payload = buildResult.value as unknown as TPayload;
                console.log('[StreamParser] Emitting partial for:', intent.type, payload);
                partialHandler(intent.type, payload);
            } catch (e) {
                // Ignore build errors during partial construction
            }
        }
    };

    // Debounced version
    const emitPartialsDebounced = () => {
        if (debounceMs > 0) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(emitPartials, debounceMs);
        } else {
            emitPartials();
        }
    };

    // 1. Listen for START of an intent
    parser.on('intent_ready', (data: unknown) => {
        // ... (existing comments) ...

        const { type, node } = data as { type: TIntent, node: any };

        let payload: TPayload = {} as TPayload;
        if (node) {
            try {
                const buildResult = irBuilder.build(node);
                payload = buildResult.value as unknown as TPayload;
            } catch (e) {
                // Ignore errors
            }
        }

        // Global Handler
        if (intentHandler && type) {
            intentHandler(type, payload);
        }

        // Specific Handler (using 'type' which is 'intentKey')
        const key = type as unknown as string;
        const specific = specificHandlers.get(key);
        if (specific) {
            specific(payload);
        }

        // clear active state for this intent
        activeIntents.delete(key);
    });

    // 2. Listen for granular updates to trigger partial rebuilds (Multi-Intent Support)
    const checkForActiveIntent = () => {
        const p = parser as any;
        const stack = p.state.stack;

        const root = stack[0];
        if (!root || root.node.kind !== 'mapping') return;

        const intentKeys = Array.isArray(p.intentKeys) ? p.intentKeys : [p.intentKeys];
        const entries = (root.node as MappingNode).entries;

        // Find ALL entries that match our intent keys (multi-intent support)
        const intentEntries = entries.filter(e => intentKeys.includes(e.key));

        console.log('[StreamParser] checkForActiveIntent found:', intentEntries.length, 'intents');

        // Update active intents map
        for (const entry of intentEntries) {
            const intentType = entry.key as unknown as TIntent;
            activeIntents.set(entry.key, { node: entry.value, type: intentType });
        }

        // Emit partials for all active intents
        if (activeIntents.size > 0) {
            emitPartialsDebounced();
        }
    };

    // Hook into value and block_end to trigger checks
    parser.on('value', checkForActiveIntent);
    parser.on('block_end', checkForActiveIntent);

    return {
        write(chunk: string): void {
            parser.write(chunk);
        },

        peek(): TDoc {
            const result = parser.peek();
            return irBuilder.build(result.ast).value as TDoc;
        },

        end(): TDoc {
            const result = parser.end();
            return irBuilder.build(result.ast).value as TDoc;
        },

        onIntentReady(handler: (intentType: TIntent, payload: TPayload) => void): void {
            intentHandler = handler;
        },

        onIntent<K extends keyof TDoc>(intent: K, handler: (payload: NonNullable<TDoc[K]>) => void): void {
            // We cast the handler to loose type for storage
            specificHandlers.set(intent as string, handler as any);
        },

        onIntentPartial(handler: (intentType: TIntent, payload: TPayload) => void, options?: { debounceMs?: number }): void {
            partialHandler = handler;
            if (options?.debounceMs) {
                debounceMs = options.debounceMs;
            }
        },

        on(event: string, handler: (...args: any[]) => void): void {
            if (event === 'intent_ready') {
                this.onIntentReady(handler as any);
            } else if (event === 'intent_partial') {
                partialHandler = handler as any;
            } else {
                parser.on(event as any, handler);
            }
        },

        off(event: string, handler: (data: unknown) => void): void {
            parser.off(event as any, handler);
        },

        reset(): void {
            parser.reset();
            activeIntents.clear();
        }
    };
}

/**
 * Validate YAML-Lite input without full parsing.
 * Returns true if valid, or array of errors if invalid.
 */
export function validate(input: string, options?: ParserOptions): true | ParseError[] {
    const parser = new Parser({ ...options, strict: true });
    parser.write(input);
    const result = parser.end();

    if (result.errors.length === 0) {
        return true;
    }

    return result.errors;
}

/**
 * Extract clean YAML from LLM output that may contain conversational noise.
 * 
 * Handles common LLM behaviors:
 * - Preambles: "Sure!", "Okay, here's the YAML:", "Here you go:"
 * - Code fences: ```yaml ... ``` or ``` ... ```
 * - Trailing text: "Let me know if you need anything else!"
 * - Mixed content before/after the YAML block
 * 
 * @example
 * ```typescript
 * const dirty = `Sure! Here's your UI:
 * \`\`\`yaml
 * type: Card
 * title: Hello
 * \`\`\`
 * Let me know if you need changes!`;
 * 
 * const clean = extractYAML(dirty);
 * // "type: Card\ntitle: Hello"
 * ```
 */
export function extractYAML(input: string): string {
    let text = input;

    // Strip code fences
    const fenceMatch = text.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)```/);
    if (fenceMatch && fenceMatch[1]) {
        return fenceMatch[1].trim();
    }

    // Skip lines until we hit something that looks like YAML
    const lines = text.split('\n');
    let start = 0;
    let end = lines.length;

    // Find start: first line with "key:" or "- "
    for (let i = 0; i < lines.length; i++) {
        const t = (lines[i] ?? '').trim();
        if (/^[a-zA-Z_]\w*:/.test(t) || /^-\s/.test(t)) {
            start = i;
            break;
        }
    }

    // Find end: last line with YAML content (has indent, "key:", or "- ")
    for (let i = lines.length - 1; i >= start; i--) {
        const line = lines[i] ?? '';
        const t = line.trim();
        if (!t) continue;
        if (/^\s/.test(line) || /^[a-zA-Z_]\w*:/.test(t) || /^-\s/.test(t)) {
            end = i + 1;
            break;
        }
    }

    return lines.slice(start, end).join('\n').trim();
}

import type { ParseError } from './types';

