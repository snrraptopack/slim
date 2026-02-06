/**
 * AUWGENT YAML-Lite — Type Definitions
 * 
 * Core types for the streaming parser pipeline:
 *   Tokenizer → Parser → IR Builder → JSON
 */

// ═══════════════════════════════════════════════════════════════════════════
// TOKENIZER TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Token types emitted by the tokenizer */
export type TokenType =
    | 'KEY'           // Identifier before colon
    | 'COLON'         // :
    | 'DASH'          // - (sequence item)
    | 'SCALAR'        // Unquoted value
    | 'QUOTED'        // "value" or 'value'
    | 'INDENT'        // Indentation increase
    | 'DEDENT'        // Indentation decrease
    | 'NEWLINE'       // Line terminator
    | 'COMMENT'       // # comment (usually stripped)
    | 'EOF';          // End of input

/** A single token from the tokenizer */
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
    /** Indent level (number of 2-space units) */
    indent: number;
}

/** Position tracking for error messages */
export interface Position {
    line: number;
    column: number;
    offset: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// AST TYPES (Parser Output)
// ═══════════════════════════════════════════════════════════════════════════

/** Base AST node with position info */
export interface ASTNodeBase {
    /** Line where node starts (1-indexed) */
    line: number;
    /** Column where node starts (1-indexed) */
    column: number;
}

/** Scalar value node (all values are strings at AST level) */
export interface ScalarNode extends ASTNodeBase {
    kind: 'scalar';
    value: string;
    /** Whether the value was quoted in source */
    quoted: boolean;
}

/** Mapping (object) node */
export interface MappingNode extends ASTNodeBase {
    kind: 'mapping';
    entries: MappingEntry[];
}

/** A single key-value pair in a mapping */
export interface MappingEntry {
    key: string;
    value: ASTNode;
    line: number;
    column: number;
}

/** Sequence (array) node */
export interface SequenceNode extends ASTNodeBase {
    kind: 'sequence';
    items: ASTNode[];
}

/** Reference node (ref: some_id) */
export interface RefNode extends ASTNodeBase {
    kind: 'ref';
    target: string;
}

/** Empty block node (auto-initialized) */
export interface EmptyNode extends ASTNodeBase {
    kind: 'empty';
    /** Hint: 'mapping' or 'sequence' based on context */
    hint?: 'mapping' | 'sequence';
}

/** Union of all AST node types */
export type ASTNode =
    | ScalarNode
    | MappingNode
    | SequenceNode
    | RefNode
    | EmptyNode;

/** Parse result containing the AST and any errors */
export interface ParseResult {
    ast: ASTNode | null;
    errors: ParseError[];
    /** Whether the document was complete (vs partial) */
    complete: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// IR TYPES (After Type Coercion)
// ═══════════════════════════════════════════════════════════════════════════

/** JSON-compatible output types */
export type IRValue =
    | string
    | number
    | boolean
    | null
    | IRObject
    | IRArray
    | IRRef;

/** Object in IR */
export interface IRObject {
    [key: string]: IRValue;
}

/** Array in IR */
export type IRArray = IRValue[];

/** Reference placeholder in IR (resolved later or kept as-is) */
export interface IRRef {
    $ref: string;
}

/** IR build result */
export interface IRResult {
    value: IRValue;
    /** All nodes with id fields, keyed by id */
    registry: Map<string, IRValue>;
    /** Unresolved references */
    unresolvedRefs: string[];
    errors: IRError[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Severity levels for errors */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/** Parse-time error */
export interface ParseError {
    message: string;
    severity: ErrorSeverity;
    line: number;
    column: number;
    /** Source context (the problematic line) */
    context?: string;
}

/** IR building error */
export interface IRError {
    message: string;
    severity: ErrorSeverity;
    path: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSER EVENTS (Middleware Hooks)
// ═══════════════════════════════════════════════════════════════════════════

/** Event types for middleware */
export type ParserEventType =
    | 'line'            // New line started
    | 'indent'          // Indentation increased
    | 'dedent'          // Indentation decreased
    | 'key'             // Key parsed
    | 'value'           // Value parsed
    | 'block_start'     // Block (mapping/sequence) started
    | 'block_end'       // Block ended
    | 'intent_ready';   // Intent block is complete and executable

/** Parser event for middleware */
export interface ParserEvent {
    type: ParserEventType;
    data: unknown;
    position: Position;
}

/** Middleware function signature */
export type ParserMiddleware = (event: ParserEvent) => void;

// ═══════════════════════════════════════════════════════════════════════════
// PARSER OPTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Configuration for the parser */
export interface ParserOptions {
    /** Number of spaces per indent level (default: 2) */
    indentSize?: number;

    /** Allow tabs (default: false) */
    allowTabs?: boolean;

    /** Emit comments as tokens (default: false) */
    preserveComments?: boolean;

    /** Middleware functions to call on events */
    middleware?: ParserMiddleware[];

    /** Enable strict mode (fail on any warning) */
    strict?: boolean;

    /** Schema for intent validation */
    intentSchema?: IntentSchema;

    /** 
     * The key name(s) that trigger the `intent_ready` event.
     * Can be a single string or array of strings.
     * Default: "intent"
     */
    intentKey?: string | string[];
}

/** Schema for validating intent blocks */
export interface IntentSchema {
    /** Required keys for the intent to be executable */
    requiredKeys: string[];

    /** Known intent types */
    knownTypes?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// STREAMING API TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Streaming parser instance */
/** Streaming parser instance */
export interface StreamingParser<TIntent = string, TDoc = unknown> {
    /** Write a chunk of input */
    write(chunk: string): void;

    /** Signal end of input, returns final result */
    end(): TDoc;

    /** Get current partial result (without ending) */
    peek(): TDoc;

    /** Reset parser state */
    reset(): void;

    /** Subscribe to parser events */
    /** Subscribe to parser events */
    on(event: 'intent_ready', handler: (intentType: TIntent, payload: Record<string, any>) => void): void;
    on(event: ParserEventType, handler: (data: any) => void): void;

    /** Unsubscribe from parser events */
    off(event: ParserEventType, handler: (data: any) => void): void;

    // Helper specific to intent
    onIntentReady(handler: (intentType: TIntent, payload: Record<string, any>) => void): void;
}
