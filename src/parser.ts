/**
 * AUWGENT YAML-Lite — Stack-Based Parser
 * 
 * Transforms token stream into an AST.
 * Supports partial documents and emits middleware events.
 */

import { Tokenizer, tokenize } from './tokenizer';
import type {
    Token,
    TokenType,
    ASTNode,
    MappingNode,
    MappingEntry,
    SequenceNode,
    ScalarNode,
    EmptyNode,
    RefNode,
    ParseResult,
    ParseError,
    ParserEvent,
    ParserEventType,
    ParserMiddleware,
    ParserOptions,
    Position,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// PARSER STATE
// ═══════════════════════════════════════════════════════════════════════════

interface ParserFrame {
    type: 'mapping' | 'sequence' | 'root';
    node: MappingNode | SequenceNode;
    indent: number;
    /** Current key waiting for value (mapping only) */
    pendingKey?: string;
    pendingKeyPos?: { line: number; column: number };
}

interface ParserState {
    /** Stack of open blocks */
    stack: ParserFrame[];
    /** All parse errors */
    errors: ParseError[];
    /** Event listeners */
    listeners: Map<ParserEventType, Set<(data: unknown) => void>>;
    /** Whether intent has been emitted */
    emittedIntents: Set<ASTNode>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class Parser {
    private tokenizer: Tokenizer;
    private tokens: Token[] = [];
    private pos: number = 0;
    private state: ParserState;
    private options: ParserOptions;
    private intentKeys: string[];

    constructor(options: ParserOptions = {}) {
        this.options = options;
        this.tokenizer = new Tokenizer(options);
        this.state = this.createInitialState();

        const keys = options.intentKey ?? 'intent';
        this.intentKeys = Array.isArray(keys) ? keys : [keys];
    }

    private createInitialState(): ParserState {
        return {
            stack: [],
            errors: [],
            listeners: new Map(),
            emittedIntents: new Set(),
        };
    }

    /** Reset parser state */
    reset(): void {
        // Preserve listeners across resets
        const listeners = this.state.listeners;

        this.tokenizer.reset();
        this.tokens = [];
        this.pos = 0;
        this.state = this.createInitialState();
        this.state.listeners = listeners;  // Restore listeners
    }

    /** Subscribe to parser events */
    on(event: ParserEventType, handler: (data: unknown) => void): void {
        if (!this.state.listeners.has(event)) {
            this.state.listeners.set(event, new Set());
        }
        this.state.listeners.get(event)!.add(handler);
    }

    /** Unsubscribe from parser events */
    off(event: ParserEventType, handler: (data: unknown) => void): void {
        this.state.listeners.get(event)?.delete(handler);
    }

    /** Emit a parser event */
    private emit(type: ParserEventType, data: unknown, position: Position): void {
        const event: ParserEvent = { type, data, position };

        console.log('[Parser.emit]', type, 'listeners:', this.state.listeners.get(type)?.size || 0);

        // Call registered listeners
        this.state.listeners.get(type)?.forEach(handler => handler(data));

        // Call middleware
        this.options.middleware?.forEach(mw => mw(event));
    }

    /** Write a chunk of input (streaming) */
    write(chunk: string): void {
        console.log('[Parser.write] INCREMENTAL PARSE - chunk length:', chunk.length);
        this.tokenizer.write(chunk);

        // Parse any new tokens that are available
        let token: Token | null;
        while ((token = this.tokenizer.next()) !== null) {
            this.tokens.push(token);
        }

        // Parse the accumulated tokens (without ending)
        this.parseTokens(false);
    }

    /** Parse without ending (peek at current state) */
    peek(): ParseResult {
        // Tokenize available input
        let token: Token | null;
        while ((token = this.tokenizer.next()) !== null) {
            this.tokens.push(token);
        }

        // Parse tokens
        return this.parseTokens(false);
    }

    /** End parsing and get final result */
    end(): ParseResult {
        // Get remaining tokens including finalization
        let token: Token | null;
        while ((token = this.tokenizer.next()) !== null) {
            this.tokens.push(token);
        }
        this.tokens.push(...this.tokenizer.finalize());

        // Parse all tokens
        return this.parseTokens(true);
    }

    /** Parse tokens into AST */
    private parseTokens(complete: boolean): ParseResult {
        // Initialize root frame if needed
        if (this.state.stack.length === 0) {
            // Check if document starts with a dash (root-level sequence)
            const firstNonCommentToken = this.tokens.find(t => t && t.type !== 'COMMENT' && t.type !== 'NEWLINE');
            const isRootSequence = firstNonCommentToken?.type === 'DASH';

            if (isRootSequence) {
                this.pushFrame('sequence', 0);
            } else {
                this.pushFrame('root', 0);
            }
        }

        while (this.pos < this.tokens.length) {
            const token = this.tokens[this.pos];
            if (token) {
                this.processToken(token);
            }
            this.pos++;
        }

        // Build result
        const rootFrame = this.state.stack[0];
        const ast = rootFrame ? this.frameToNode(rootFrame) : null;

        return {
            ast,
            errors: [...this.state.errors],
            complete,
        };
    }

    /** Process a single token */
    private processToken(token: Token): void {
        const pos: Position = {
            line: token.line,
            column: token.column,
            offset: 0,
        };

        switch (token.type) {
            case 'KEY':
                this.handleKey(token, pos);
                break;

            case 'COLON':
                // Colon is expected after key, nothing special to do
                break;

            case 'SCALAR':
            case 'QUOTED':
                this.handleValue(token, pos);
                break;

            case 'DASH':
                this.handleDash(token, pos);
                break;

            case 'INDENT':
                this.handleIndent(token, pos);
                break;

            case 'DEDENT':
                this.handleDedent(token, pos);
                break;

            case 'NEWLINE':
                this.handleNewline(token, pos);
                break;

            case 'EOF':
                this.handleEOF(pos);
                break;

            case 'COMMENT':
                // Comments are typically stripped, but emit event
                this.emit('line', { comment: token.value }, pos);
                break;
        }
    }

    private handleKey(token: Token, pos: Position): void {
        this.emit('key', { key: token.value }, pos);

        const frame = this.currentFrame();

        // Ensure we're in a mapping context
        if (frame.type !== 'mapping' && frame.type !== 'root') {
            // We're in a sequence but got a key - this is a mapping inside sequence
            // The pending sequence item should become a mapping
            this.pushFrame('mapping', token.indent);
        }

        const mappingFrame = this.currentFrame();
        if (mappingFrame.type === 'mapping' || mappingFrame.type === 'root') {
            // If there's already a pending key, save it as empty block
            if (mappingFrame.pendingKey && mappingFrame.pendingKeyPos) {
                const emptyNode: EmptyNode = {
                    kind: 'empty',
                    hint: 'mapping',
                    line: mappingFrame.pendingKeyPos.line,
                    column: mappingFrame.pendingKeyPos.column,
                };
                this.addMappingEntry(mappingFrame, mappingFrame.pendingKey, emptyNode, mappingFrame.pendingKeyPos);
            }

            // Store new pending key
            mappingFrame.pendingKey = token.value;
            mappingFrame.pendingKeyPos = { line: token.line, column: token.column };
        }
    }

    private handleValue(token: Token, pos: Position): void {
        const value = token.value;
        const quoted = token.type === 'QUOTED';

        this.emit('value', { value, quoted }, pos);

        const frame = this.currentFrame();

        if (frame.type === 'mapping' || frame.type === 'root') {
            // Complete the pending key-value pair
            if (frame.pendingKey) {
                const scalarNode: ScalarNode = {
                    kind: 'scalar',
                    value,
                    quoted,
                    line: token.line,
                    column: token.column,
                };

                this.addMappingEntry(frame, frame.pendingKey, scalarNode, frame.pendingKeyPos!);
                frame.pendingKey = undefined;
                frame.pendingKeyPos = undefined;
            }
        } else if (frame.type === 'sequence') {
            // Add scalar to sequence
            const scalarNode: ScalarNode = {
                kind: 'scalar',
                value,
                quoted,
                line: token.line,
                column: token.column,
            };
            (frame.node as SequenceNode).items.push(scalarNode);
        }
    }

    private handleDash(token: Token, pos: Position): void {
        this.emit('block_start', { type: 'sequence_item' }, pos);

        // Pop any frames with higher indent (e.g., mapping from previous sequence item)
        while (this.state.stack.length > 1) {
            const topFrame = this.currentFrame();
            if (topFrame.indent <= token.indent) {
                break;
            }
            this.popFrame(pos);
        }

        const frame = this.currentFrame();

        // Peek at next token to determine if this is a scalar or mapping item
        const nextToken = this.tokens[this.pos + 1];
        const isScalarItem = nextToken && (nextToken.type === 'SCALAR' || nextToken.type === 'QUOTED');
        const isKeyItem = nextToken && nextToken.type === 'KEY';
        const isDashItem = nextToken && nextToken.type === 'DASH';

        // If we have a pending key, this dash starts a sequence as its value
        if ((frame.type === 'mapping' || frame.type === 'root') && frame.pendingKey) {
            // Create sequence for this key
            const seqNode: SequenceNode = {
                kind: 'sequence',
                items: [],
                line: token.line,
                column: token.column,
            };

            this.addMappingEntry(frame, frame.pendingKey, seqNode, frame.pendingKeyPos!);
            frame.pendingKey = undefined;
            frame.pendingKeyPos = undefined;

            // Push sequence frame
            this.state.stack.push({
                type: 'sequence',
                node: seqNode,
                indent: token.indent,
            });

            // Only create mapping frame if next token is KEY (not scalar or dash)
            if (isKeyItem) {
                // Create a new mapping for this sequence item
                const itemMapping: MappingNode = {
                    kind: 'mapping',
                    entries: [],
                    line: token.line,
                    column: token.column,
                };
                seqNode.items.push(itemMapping);

                // Push mapping frame for the sequence item (at indent+1 to match content level)
                this.state.stack.push({
                    type: 'mapping',
                    node: itemMapping,
                    indent: token.indent + 1,
                });
            } else if (isDashItem) {
                // Nested sequence: create an inner sequence for this item
                const innerSeq: SequenceNode = {
                    kind: 'sequence',
                    items: [],
                    line: token.line,
                    column: token.column,
                };
                seqNode.items.push(innerSeq);

                // Push sequence frame for the inner sequence
                this.state.stack.push({
                    type: 'sequence',
                    node: innerSeq,
                    indent: token.indent + 1,
                });
            }
            // For scalar items, handleValue will add to sequence directly
        } else if (frame.type === 'sequence') {
            // Already in a sequence
            if (isKeyItem) {
                // Create new item mapping
                const itemMapping: MappingNode = {
                    kind: 'mapping',
                    entries: [],
                    line: token.line,
                    column: token.column,
                };
                (frame.node as SequenceNode).items.push(itemMapping);

                // Push mapping frame for the sequence item (at indent+1 to match content level)
                this.state.stack.push({
                    type: 'mapping',
                    node: itemMapping,
                    indent: token.indent + 1,
                });
            } else if (isDashItem) {
                // Nested sequence: create an inner sequence for this item
                const innerSeq: SequenceNode = {
                    kind: 'sequence',
                    items: [],
                    line: token.line,
                    column: token.column,
                };
                (frame.node as SequenceNode).items.push(innerSeq);

                // Push sequence frame for the inner sequence
                this.state.stack.push({
                    type: 'sequence',
                    node: innerSeq,
                    indent: token.indent + 1,
                });
            }
            // For scalar items, handleValue will add to sequence directly
        } else {
            // Top-level sequence or unexpected
            if (frame.type === 'root') {
                // Root is actually a sequence
                const seqNode: SequenceNode = {
                    kind: 'sequence',
                    items: [],
                    line: token.line,
                    column: token.column,
                };
                frame.node = seqNode as any;
                frame.type = 'sequence' as any;
            }
        }
    }

    private handleIndent(token: Token, pos: Position): void {
        this.emit('indent', { level: token.indent }, pos);

        const frame = this.currentFrame();

        // If we have a pending key with no inline value, check what comes next
        if ((frame.type === 'mapping' || frame.type === 'root') && frame.pendingKey) {
            // Peek at the next token to see if it's a sequence (DASH) or mapping (KEY)
            const nextToken = this.tokens[this.pos + 1];

            if (nextToken && nextToken.type === 'DASH') {
                // Let handleDash create the sequence
                return;
            }

            // Create a nested mapping for this key
            const nestedMapping: MappingNode = {
                kind: 'mapping',
                entries: [],
                line: token.line,
                column: token.column,
            };

            this.addMappingEntry(frame, frame.pendingKey, nestedMapping, frame.pendingKeyPos!);
            frame.pendingKey = undefined;
            frame.pendingKeyPos = undefined;

            // Push nested mapping frame
            this.state.stack.push({
                type: 'mapping',
                node: nestedMapping,
                indent: token.indent,
            });
        }
    }

    private handleDedent(token: Token, pos: Position): void {
        this.emit('dedent', { level: token.indent }, pos);

        // Close frames until we're at the right indent level
        while (this.state.stack.length > 1) {
            const frame = this.currentFrame();
            if (frame.indent <= token.indent) {
                break;
            }
            this.popFrame(pos);
        }

        // Check if intent is newly ready after closing a block
        this.checkIntentReady(pos);
    }

    private handleNewline(token: Token, pos: Position): void {
        this.emit('line', {}, pos);

        const frame = this.currentFrame();

        // If we have a pending key with no value, it's an empty block
        if ((frame.type === 'mapping' || frame.type === 'root') && frame.pendingKey) {
            // Check next token to determine if it's empty mapping or sequence
            const nextToken = this.tokens[this.pos + 1];

            if (nextToken && (nextToken.type === 'DEDENT' || nextToken.type === 'EOF')) {
                // Empty block - default to empty mapping
                const emptyNode: EmptyNode = {
                    kind: 'empty',
                    hint: 'mapping',
                    line: token.line,
                    column: token.column,
                };

                this.addMappingEntry(frame, frame.pendingKey, emptyNode, frame.pendingKeyPos!);
                frame.pendingKey = undefined;
                frame.pendingKeyPos = undefined;
            }
            // Otherwise, the value will come from the indented block
        }
    }

    private handleEOF(pos: Position): void {
        // Close all remaining frames
        while (this.state.stack.length > 1) {
            this.popFrame(pos);
        }

        // Handle any pending key in root
        const rootFrame = this.state.stack[0];
        if (rootFrame && rootFrame.pendingKey) {
            const emptyNode: EmptyNode = {
                kind: 'empty',
                hint: 'mapping',
                line: pos.line,
                column: pos.column,
            };
            this.addMappingEntry(rootFrame, rootFrame.pendingKey, emptyNode, rootFrame.pendingKeyPos!);
            rootFrame.pendingKey = undefined;
        }

        // Check for intent readiness
        this.checkIntentReady(pos);
    }

    /** Push a new frame onto the stack */
    private pushFrame(type: 'mapping' | 'sequence' | 'root', indent: number): void {
        const node: MappingNode | SequenceNode = type === 'sequence'
            ? { kind: 'sequence', items: [], line: 0, column: 0 }
            : { kind: 'mapping', entries: [], line: 0, column: 0 };

        this.state.stack.push({
            type: type === 'root' ? 'mapping' : type,
            node,
            indent,
        });
    }

    /** Pop a frame from the stack */
    private popFrame(pos: Position): void {
        const frame = this.state.stack.pop();
        if (frame) {
            this.emit('block_end', { type: frame.type }, pos);
        }
    }

    /** Get current frame */
    private currentFrame(): ParserFrame {
        return this.state.stack[this.state.stack.length - 1]!;
    }

    /** Add entry to mapping */
    private addMappingEntry(
        frame: ParserFrame,
        key: string,
        value: ASTNode,
        keyPos: { line: number; column: number }
    ): void {
        const mapping = frame.node as MappingNode;

        // Check for special ref key
        if (key === 'ref' && value.kind === 'scalar') {
            // Replace scalar with ref node
            const refNode: RefNode = {
                kind: 'ref',
                target: value.value,
                line: value.line,
                column: value.column,
            };
            mapping.entries.push({
                key,
                value: refNode,
                line: keyPos.line,
                column: keyPos.column,
            });
        } else {
            mapping.entries.push({
                key,
                value,
                line: keyPos.line,
                column: keyPos.column,
            });
        }
    }

    /** Check if intent is ready to execute */
    private checkIntentReady(pos: Position): void {
        const rootFrame = this.state.stack[0];
        if (!rootFrame || rootFrame.node.kind !== 'mapping') return;

        const entries = (rootFrame.node as MappingNode).entries;

        // Find first matching key
        const intentEntry = entries.find(e => this.intentKeys.includes(e.key));

        if (intentEntry) {
            // Helper to process a potential intent mapping
            const processIntentNode = (node: ASTNode) => {
                if (this.state.emittedIntents.has(node)) return;

                if (node.kind === 'mapping') {
                    const intentEntries = (node as MappingNode).entries;
                    const typeEntry = intentEntries.find(e => e.key === 'type');

                    if (typeEntry) {
                        this.state.emittedIntents.add(node);
                        this.emit('intent_ready', {
                            type: typeEntry.value.kind === 'scalar'
                                ? (typeEntry.value as ScalarNode).value
                                : null,
                            node: node
                        }, pos);
                    }
                }
            };

            // Check if it's a list of intents or a single intent
            if (intentEntry.value.kind === 'sequence') {
                const seq = intentEntry.value as SequenceNode;
                for (const item of seq.items) {
                    processIntentNode(item);
                }
            } else {
                processIntentNode(intentEntry.value);
            }
        }
    }

    /** Convert frame to final node */
    private frameToNode(frame: ParserFrame): ASTNode {
        return frame.node;
    }

    /** Add a parse error */
    private addError(message: string, line: number, column: number): void {
        this.state.errors.push({
            message,
            severity: 'error',
            line,
            column,
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Parse a complete string */
export function parse(input: string, options?: ParserOptions): ParseResult {
    const parser = new Parser(options);
    parser.write(input);
    return parser.end();
}

/** Create a streaming parser */
export function createParser(options?: ParserOptions): Parser {
    return new Parser(options);
}
