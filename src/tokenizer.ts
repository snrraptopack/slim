/**
 * AUWGENT YAML-Lite — Streaming Tokenizer
 * 
 * Converts input string into a stream of tokens.
 * Handles indentation tracking and emits INDENT/DEDENT tokens.
 */

import type { Token, TokenType, Position, ParserOptions } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TOKENIZER STATE
// ═══════════════════════════════════════════════════════════════════════════

interface TokenizerState {
    /** Current position in input */
    pos: number;
    /** Current line (1-indexed) */
    line: number;
    /** Current column (1-indexed) */
    column: number;
    /** Stack of indent levels */
    indentStack: number[];
    /** Current indent level */
    currentIndent: number;
    /** Pending tokens to emit */
    pending: Token[];
    /** Whether we're at line start */
    atLineStart: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOKENIZER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class Tokenizer {
    private input: string = '';
    private state: TokenizerState;
    private options: Required<Pick<ParserOptions, 'indentSize' | 'allowTabs' | 'preserveComments'>>;
    private finishing = false;

    constructor(options: ParserOptions = {}) {
        this.options = {
            indentSize: options.indentSize ?? 2,
            allowTabs: options.allowTabs ?? false,
            preserveComments: options.preserveComments ?? false,
        };
        this.state = this.createInitialState();
    }

    private createInitialState(): TokenizerState {
        return {
            pos: 0,
            line: 1,
            column: 1,
            indentStack: [0],
            currentIndent: 0,
            pending: [],
            atLineStart: true,
        };
    }

    /** Reset tokenizer state */
    reset(): void {
        this.input = '';
        this.state = this.createInitialState();
    }

    /** Add input to tokenize */
    write(chunk: string): void {
        this.input += chunk;
    }

    /** Get current position */
    getPosition(): Position {
        return {
            line: this.state.line,
            column: this.state.column,
            offset: this.state.pos,
        };
    }

    /** Check if more input is available */
    hasMore(): boolean {
        return this.state.pos < this.input.length || this.state.pending.length > 0;
    }

    /** Get next token (or null if exhausted) */
    next(): Token | null {
        // Return pending tokens first (like DEDENT tokens)
        if (this.state.pending.length > 0) {
            return this.state.pending.shift()!;
        }

        // Check if we have more input
        if (this.state.pos >= this.input.length) {
            return null;
        }

        // At line start, handle indentation
        if (this.state.atLineStart) {
            return this.tokenizeLineStart();
        }

        // Otherwise, tokenize content
        return this.tokenizeContent();
    }

    /** Tokenize all remaining input */
    tokenizeAll(): Token[] {
        const tokens: Token[] = [];
        let token: Token | null;
        while ((token = this.next()) !== null) {
            tokens.push(token);
        }
        // Emit remaining DEDENTs and EOF
        tokens.push(...this.finalize());
        return tokens;
    }

    /** Finalize tokenization (emit closing DEDENTs and EOF) */
    finalize(): Token[] {
        const tokens: Token[] = [];

        // Flush any pending partial tokens now that no more input will arrive
        this.finishing = true;
        let token: Token | null;
        while ((token = this.next()) !== null) {
            tokens.push(token);
        }
        this.finishing = false;

        // Emit DEDENTs for all open blocks
        while (this.state.indentStack.length > 1) {
            this.state.indentStack.pop();
            tokens.push(this.createToken('DEDENT', ''));
        }

        // Emit EOF
        tokens.push(this.createToken('EOF', ''));

        return tokens;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE METHODS
    // ─────────────────────────────────────────────────────────────────────────

    private tokenizeLineStart(): Token | null {
        const indent = this.consumeIndent();
        const indentLevel = Math.floor(indent / this.options.indentSize);
        const currentLevel = this.state.indentStack[this.state.indentStack.length - 1] ?? 0;

        this.state.atLineStart = false;

        // Check for blank line or comment-only line
        if (this.peekChar() === '\n' || this.peekChar() === '\r') {
            return this.tokenizeNewline();
        }

        if (this.peekChar() === '#') {
            return this.tokenizeComment();
        }

        // Handle indent level changes
        if (indentLevel > currentLevel) {
            // Indent increase (should only be by 1)
            this.state.indentStack.push(indentLevel);
            this.state.currentIndent = indentLevel;
            const token = this.createToken('INDENT', '  '.repeat(indentLevel - currentLevel));
            return token;
        } else if (indentLevel < currentLevel) {
            // Dedent - may need multiple DEDENT tokens
            // First, update state to target level
            this.state.currentIndent = indentLevel;

            // Create DEDENT tokens for each level we're closing
            while (
                this.state.indentStack.length > 1 &&
                (this.state.indentStack[this.state.indentStack.length - 1] ?? 0) > indentLevel
            ) {
                this.state.indentStack.pop();
                // DEDENT token carries the target indent level
                this.state.pending.push(this.createToken('DEDENT', ''));
            }
            return this.state.pending.shift() ?? this.tokenizeContent();
        }

        // Same level, continue with content
        this.state.currentIndent = indentLevel;
        return this.tokenizeContent();
    }

    private tokenizeContent(): Token | null {
        this.skipSpaces();

        const char = this.peekChar();

        if (char === '') {
            return null;
        }

        // Newline
        if (char === '\n' || char === '\r') {
            return this.tokenizeNewline();
        }

        // Comment
        if (char === '#') {
            return this.tokenizeComment();
        }

        // Dash (sequence item)
        if (char === '-' && this.peekChar(1) === ' ') {
            this.advance(); // consume -
            return this.createToken('DASH', '-');
        }

        // Quoted string
        if (char === '"' || char === "'") {
            return this.tokenizeQuotedString(char);
        }

        // Colon (check for key:value separator)
        if (char === ':') {
            this.advance();
            return this.createToken('COLON', ':');
        }

        // Pipe for multiline string (|)
        if (char === '|') {
            return this.tokenizeMultilineString();
        }

        // Flow object { ... } or flow array [ ... ] - capture as single scalar
        if (char === '{' || char === '[') {
            return this.tokenizeFlowCollection(char);
        }

        // Key or unquoted scalar
        return this.tokenizeKeyOrScalar();
    }

    private tokenizeFlowCollection(openChar: string): Token {
        const startCol = this.state.column;
        const closeChar = openChar === '{' ? '}' : ']';
        let value = '';
        let depth = 0;

        while (this.state.pos < this.input.length) {
            const char = this.peekChar();

            if (char === openChar) depth++;
            if (char === closeChar) depth--;

            value += char;
            this.advance();

            if (depth === 0) break;

            // Don't span multiple lines
            if (char === '\n' || char === '\r') {
                break;
            }
        }

        return {
            type: 'SCALAR',
            value: value.trim(),
            line: this.state.line,
            column: startCol,
            indent: this.state.currentIndent,
        };
    }

    private tokenizeMultilineString(): Token {
        const startCol = this.state.column;
        this.advance(); // consume |

        // Skip to end of line
        while (this.state.pos < this.input.length) {
            const c = this.peekChar();
            if (c === '\n' || c === '\r') break;
            if (c !== ' ') break; // Ignore trailing spaces/modifiers after |
            this.advance();
        }

        // Consume newline
        if (this.peekChar() === '\r') this.advance();
        if (this.peekChar() === '\n') {
            this.advance();
            this.state.line++;
            this.state.column = 1;
        }

        // Determine the indent level of the multiline content
        const baseIndent = this.measureIndent();
        if (baseIndent === 0) {
            // No indented content, return empty string
            return {
                type: 'SCALAR',
                value: '',
                line: this.state.line,
                column: startCol,
                indent: this.state.currentIndent,
            };
        }

        const lines: string[] = [];

        // Read all lines that are indented at least baseIndent
        while (this.state.pos < this.input.length) {
            const lineIndent = this.measureIndent();

            // If line is less indented (and not empty), we're done
            if (lineIndent < baseIndent && this.peekChar() !== '\n' && this.peekChar() !== '\r') {
                break;
            }

            // Skip the base indent
            for (let i = 0; i < baseIndent && this.peekChar() === ' '; i++) {
                this.advance();
            }

            // Read the line content
            let lineContent = '';
            while (this.state.pos < this.input.length) {
                const c = this.peekChar();
                if (c === '\n' || c === '\r') break;
                lineContent += c;
                this.advance();
            }

            lines.push(lineContent);

            // Consume newline
            if (this.peekChar() === '\r') this.advance();
            if (this.peekChar() === '\n') {
                this.advance();
                this.state.line++;
                this.state.column = 1;
                this.state.atLineStart = true;
            } else {
                break;
            }
        }

        return {
            type: 'SCALAR',
            value: lines.join('\n'),
            line: this.state.line,
            column: startCol,
            indent: this.state.currentIndent,
        };
    }

    private tokenizeKeyOrScalar(): Token | null {
        const startCol = this.state.column;
        const startPos = this.state.pos;
        const startLine = this.state.line;
        let value = '';

        // Read until we hit a delimiter
        while (this.state.pos < this.input.length) {
            const char = this.peekChar();

            // Stop at newline, comment, or colon (for keys)
            if (char === '\n' || char === '\r' || char === '#') {
                break;
            }

            // Colon followed by space or EOL indicates key
            if (char === ':') {
                const next = this.peekChar(1);
                if (next === ' ' || next === '\n' || next === '\r' || next === '') {
                    break;
                }
            }

            value += char;
            this.advance();
        }

        const reachedEOF = this.state.pos >= this.input.length;

        if (reachedEOF && !this.finishing) {
            // Incomplete token; rewind and wait for more input
            this.state.pos = startPos;
            this.state.column = startCol;
            this.state.line = startLine;
            return null;
        }

        value = value.trim();

        // Determine if this is a key (followed by colon) or scalar
        if (this.peekChar() === ':') {
            return {
                type: 'KEY',
                value,
                line: this.state.line,
                column: startCol,
                indent: this.state.currentIndent,
            };
        }

        return {
            type: 'SCALAR',
            value,
            line: this.state.line,
            column: startCol,
            indent: this.state.currentIndent,
        };
    }

    private tokenizeQuotedString(quote: string): Token {
        const startCol = this.state.column;
        this.advance(); // consume opening quote

        let value = '';
        let closed = false;

        while (this.state.pos < this.input.length) {
            const char = this.peekChar();

            if (char === quote) {
                closed = true;
                this.advance(); // consume closing quote
                break;
            }

            // Handle escape sequences
            if (char === '\\' && this.state.pos + 1 < this.input.length) {
                this.advance(); // consume backslash
                const escaped = this.peekChar();
                switch (escaped) {
                    case 'n': value += '\n'; break;
                    case 't': value += '\t'; break;
                    case 'r': value += '\r'; break;
                    case '\\': value += '\\'; break;
                    case '"': value += '"'; break;
                    case "'": value += "'"; break;
                    default: value += escaped; // keep as-is for unknown escapes
                }
                this.advance();
                continue;
            }

            // Don't allow multiline
            if (char === '\n' || char === '\r') {
                break;
            }

            value += char;
            this.advance();
        }

        return {
            type: 'QUOTED',
            value,
            line: this.state.line,
            column: startCol,
            indent: this.state.currentIndent,
        };
    }

    private tokenizeComment(): Token {
        const startCol = this.state.column;
        let value = '';

        this.advance(); // consume #

        while (this.state.pos < this.input.length) {
            const char = this.peekChar();
            if (char === '\n' || char === '\r') {
                break;
            }
            value += char;
            this.advance();
        }

        // If not preserving comments, skip to newline tokenization
        if (!this.options.preserveComments) {
            return this.tokenizeNewline();
        }

        return {
            type: 'COMMENT',
            value: value.trim(),
            line: this.state.line,
            column: startCol,
            indent: this.state.currentIndent,
        };
    }

    private tokenizeNewline(): Token {
        const token = this.createToken('NEWLINE', '\n');

        // Handle \r\n
        if (this.peekChar() === '\r') {
            this.advance();
        }
        if (this.peekChar() === '\n') {
            this.advance();
        }

        this.state.line++;
        this.state.column = 1;
        this.state.atLineStart = true;

        return token;
    }

    private consumeIndent(): number {
        let spaces = 0;

        while (this.state.pos < this.input.length) {
            const char = this.peekChar();

            if (char === ' ') {
                spaces++;
                this.advance();
            } else if (char === '\t') {
                if (!this.options.allowTabs) {
                    // Treat tabs as spaces but could emit warning
                    spaces += this.options.indentSize;
                } else {
                    spaces += this.options.indentSize;
                }
                this.advance();
            } else {
                break;
            }
        }

        return spaces;
    }

    /** Measure indent at current position without consuming */
    private measureIndent(): number {
        let spaces = 0;
        let offset = 0;
        while (true) {
            const char = this.input[this.state.pos + offset];
            if (char === ' ') {
                spaces++;
                offset++;
            } else if (char === '\t' && this.options.allowTabs) {
                spaces += this.options.indentSize;
                offset++;
            } else {
                break;
            }
        }
        return spaces;
    }

    private skipSpaces(): void {
        while (this.peekChar() === ' ') {
            this.advance();
        }
    }

    private peekChar(offset: number = 0): string {
        return this.input[this.state.pos + offset] ?? '';
    }

    private advance(): void {
        if (this.state.pos < this.input.length) {
            this.state.pos++;
            this.state.column++;
        }
    }

    private createToken(type: TokenType, value: string): Token {
        return {
            type,
            value,
            line: this.state.line,
            column: this.state.column,
            indent: this.state.currentIndent,
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/** Tokenize a complete string */
export function tokenize(input: string, options?: ParserOptions): Token[] {
    const tokenizer = new Tokenizer(options);
    tokenizer.write(input);
    return tokenizer.tokenizeAll();
}
