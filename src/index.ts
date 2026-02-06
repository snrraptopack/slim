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
import type { ParserOptions, IRValue, IRResult, ParseResult, StreamingParser } from './types';

/**
 * Parse YAML-Lite string and convert to JSON-compatible value.
 * 
 * @example
 * ```typescript
 * const json = parseToJSON(`
 * intent:
 *   type: tool_call
 *   name: search
 *   args:
 *     query: hello
 * `);
 * // { intent: { type: 'tool_call', name: 'search', args: { query: 'hello' } } }
 * ```
 */
export function parseToJSON(input: string, options?: ParserOptions): IRValue {
    const parser = new Parser(options);
    parser.write(input);
    const result = parser.end();

    const irBuilder = new IRBuilder();
    const ir = irBuilder.build(result.ast);

    return ir.value;
}

/**
 * Parse YAML-Lite with full result including AST, IR, and diagnostics.
 * 
 * @example
 * ```typescript
 * const result = parseWithDiagnostics(input);
 * if (result.ir.unresolvedRefs.length > 0) {
 *   console.warn('Unresolved refs:', result.ir.unresolvedRefs);
 * }
 * ```
 */
export function parseWithDiagnostics(
    input: string,
    options?: ParserOptions
): {
    parse: ParseResult;
    ir: IRResult;
} {
    const parser = new Parser(options);
    parser.write(input);
    const parseResult = parser.end();

    const irBuilder = new IRBuilder();
    const irResult = irBuilder.build(parseResult.ast);

    return {
        parse: parseResult,
        ir: irResult,
    };
}

/**
 * Create a streaming parser with JSON output.
 * 
 * @example
 * ```typescript
 * type MyIntent = 'tool_call' | 'final_answer';
 * type MyDoc = { intent: { type: MyIntent } };
 * 
 * const stream = createStreamingParser<MyIntent, MyDoc>();
 * stream.onIntentReady((type) => {
 *   // type is typed as 'tool_call' | 'final_answer'
 * });
 * 
 * stream.write('intent:\n');
 * stream.write('  type: tool_call\n');
 * 
 * const result = stream.end(); // Typed as MyDoc
 * ```
 */
export function createStreamingParser<TIntent = string, TDoc = unknown>(options?: ParserOptions): StreamingParser<TIntent, TDoc> {
    const parser = new Parser(options);
    const irBuilder = new IRBuilder();
    let intentHandler: ((type: TIntent, payload: Record<string, any>) => void) | null = null;

    parser.on('intent_ready', (data: unknown) => {
        const { type, node } = data as { type: TIntent, node: any };

        let payload: Record<string, any> = {};
        if (node) {
            try {
                const buildResult = irBuilder.build(node);
                payload = buildResult.value as Record<string, any>;
            } catch (e) {
                // Ignore errors
            }
        }

        if (intentHandler && type) {
            intentHandler(type, payload);
        }
    });

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

        onIntentReady(handler: (intentType: TIntent, payload: Record<string, any>) => void): void {
            intentHandler = handler;
        },

        on(event: string, handler: (...args: any[]) => void): void {
            if (event === 'intent_ready') {
                this.onIntentReady(handler as any);
            } else {
                parser.on(event as any, handler);
            }
        },

        off(event: string, handler: (data: unknown) => void): void {
            parser.off(event as any, handler);
        },

        reset(): void {
            parser.reset();
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

