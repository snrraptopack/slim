/**
 * AUWGENT YAML-Lite — IR Builder
 * 
 * Transforms AST to typed IR (JSON-compatible).
 * Handles type coercion and reference resolution.
 */

import type {
    ASTNode,
    MappingNode,
    SequenceNode,
    ScalarNode,
    EmptyNode,
    RefNode,
    IRValue,
    IRObject,
    IRArray,
    IRRef,
    IRResult,
    IRError,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE COERCION
// ═══════════════════════════════════════════════════════════════════════════

/** Coerce a string value to appropriate type */
function coerceValue(value: string, quoted: boolean): string | number | boolean | null | unknown[] | Record<string, unknown> {
    // Quoted strings stay as strings
    if (quoted) {
        return value;
    }

    // Trim for comparison
    const trimmed = value.trim();

    // Null - but NOT empty string (empty string should stay as empty string)
    if (trimmed === 'null' || trimmed === 'Null' || trimmed === 'NULL' || trimmed === '~') {
        return null;
    }

    // Empty string (after trimming whitespace from untrimmed value)
    if (trimmed === '' && value === '') {
        return '';
    }

    // Boolean
    if (trimmed === 'true' || trimmed === 'True' || trimmed === 'TRUE') {
        return true;
    }
    if (trimmed === 'false' || trimmed === 'False' || trimmed === 'FALSE') {
        return false;
    }

    // Number (integer)
    if (/^-?\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        if (Number.isSafeInteger(num)) {
            return num;
        }
    }

    // Number (float)
    if (/^-?\d+\.\d+$/.test(trimmed)) {
        const num = parseFloat(trimmed);
        if (Number.isFinite(num)) {
            return num;
        }
    }

    // Scientific notation
    if (/^-?\d+\.?\d*[eE][+-]?\d+$/.test(trimmed)) {
        const num = parseFloat(trimmed);
        if (Number.isFinite(num)) {
            return num;
        }
    }

    // Inline JSON array: ["a", "b"] or [1, 2, 3]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch {
            // Not valid JSON, keep as string
        }
    }

    // Inline JSON object: {"key": "value"}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'object' && parsed !== null) {
                return parsed;
            }
        } catch {
            // Not valid JSON, keep as string
        }
    }

    // Default to string
    return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// IR BUILDER CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class IRBuilder {
    private registry: Map<string, IRValue> = new Map();
    private unresolvedRefs: string[] = [];
    private errors: IRError[] = [];
    private currentPath: string[] = [];

    /** Build IR from AST */
    build(ast: ASTNode | null): IRResult {
        this.registry.clear();
        this.unresolvedRefs = [];
        this.errors = [];
        this.currentPath = [];

        let value = ast ? this.transformNode(ast) : null;

        // Resolve references (inline resolved values)
        if (value !== null) {
            this.resolveRefs(value);
            // Lift ref-only objects: replace {ref: resolved} with just resolved
            value = this.liftRefOnlyObjects(value);
        }

        return {
            value: value ?? {},
            registry: new Map(this.registry),
            unresolvedRefs: [...this.unresolvedRefs],
            errors: [...this.errors],
        };
    }

    /** Transform an AST node to IR */
    private transformNode(node: ASTNode): IRValue {
        switch (node.kind) {
            case 'scalar':
                return this.transformScalar(node);
            case 'mapping':
                return this.transformMapping(node);
            case 'sequence':
                return this.transformSequence(node);
            case 'ref':
                return this.transformRef(node);
            case 'empty':
                return this.transformEmpty(node);
            default:
                return null;
        }
    }

    private transformScalar(node: ScalarNode): IRValue {
        return coerceValue(node.value, node.quoted) as IRValue;
    }

    private transformMapping(node: MappingNode): IRObject {
        const obj: IRObject = {};
        let nodeId: string | null = null;

        for (const entry of node.entries) {
            this.currentPath.push(entry.key);

            const value = this.transformNode(entry.value);
            obj[entry.key] = value;

            // Track id for registry
            if (entry.key === 'id' && typeof value === 'string') {
                nodeId = value;
            }

            this.currentPath.pop();
        }

        // Register node if it has an id
        if (nodeId !== null) {
            this.registry.set(nodeId, obj);
        }

        return obj;
    }

    private transformSequence(node: SequenceNode): IRArray {
        const arr: IRArray = [];

        for (let i = 0; i < node.items.length; i++) {
            const item = node.items[i];
            if (item) {
                this.currentPath.push(`[${i}]`);
                arr.push(this.transformNode(item));
                this.currentPath.pop();
            }
        }

        return arr;
    }

    private transformRef(node: RefNode): IRRef {
        return { $ref: node.target };
    }

    private transformEmpty(node: EmptyNode): IRObject | IRArray {
        return node.hint === 'sequence' ? [] : {};
    }

    /** Resolve $ref placeholders in the IR by inlining resolved values */
    private resolveRefs(value: IRValue, visited: Set<object> = new Set()): void {
        if (value === null || typeof value !== 'object') {
            return;
        }

        // Prevent cycles
        if (visited.has(value)) {
            return;
        }
        visited.add(value);

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                const item = value[i];
                if (item === undefined) continue;

                // Auto-resolve string refs in arrays: if string matches registry, inline it
                if (typeof item === 'string' && this.registry.has(item)) {
                    value[i] = this.deepCopy(this.registry.get(item)!);
                    continue;
                }

                if (this.isRef(item)) {
                    const resolved = this.registry.get(item.$ref);
                    if (resolved !== undefined) {
                        // Inline the resolved value (deep copy to avoid shared mutations)
                        value[i] = this.deepCopy(resolved);
                    } else {
                        this.unresolvedRefs.push(item.$ref);
                    }
                } else {
                    this.resolveRefs(item, visited);
                }
            }
        } else {
            for (const key of Object.keys(value)) {
                const child = (value as IRObject)[key];
                if (child === undefined) continue;
                if (this.isRef(child)) {
                    const resolved = this.registry.get(child.$ref);
                    if (resolved !== undefined) {
                        // Inline the resolved value (deep copy to avoid shared mutations)
                        (value as IRObject)[key] = this.deepCopy(resolved);
                    } else {
                        this.unresolvedRefs.push(child.$ref);
                    }
                } else {
                    this.resolveRefs(child, visited);
                }
            }
        }
    }

    /** Deep copy a value to avoid shared mutations */
    private deepCopy(value: IRValue): IRValue {
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map(item => this.deepCopy(item));
        }
        const copy: IRObject = {};
        for (const key of Object.keys(value)) {
            const child = (value as IRObject)[key];
            if (child !== undefined) {
                copy[key] = this.deepCopy(child);
            }
        }
        return copy;
    }

    /** 
     * Lift ref-only objects: when an object has only a "ref" key,
     * replace the entire object with the ref's value.
     * This turns {"ref": {...resolved...}} into just {...resolved...}
     */
    private liftRefOnlyObjects(value: IRValue): IRValue {
        if (value === null || typeof value !== 'object') {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map(item => this.liftRefOnlyObjects(item));
        }

        // Check if this is a ref-only object (has only "ref" key)
        const keys = Object.keys(value);
        if (keys.length === 1 && keys[0] === 'ref') {
            const refValue = (value as IRObject)['ref'];
            // Lift the ref value up, recursively processing it
            // If ref is undefined (shouldn't happen), return null
            return refValue !== undefined ? this.liftRefOnlyObjects(refValue) : null;
        }

        // Recursively process all children
        const result: IRObject = {};
        for (const key of keys) {
            const child = (value as IRObject)[key];
            if (child !== undefined) {
                result[key] = this.liftRefOnlyObjects(child);
            }
        }
        return result;
    }

    /** Check if value is a reference */
    private isRef(value: unknown): value is IRRef {
        return (
            typeof value === 'object' &&
            value !== null &&
            '$ref' in value &&
            typeof (value as IRRef).$ref === 'string'
        );
    }

    /** Add an IR error */
    private addError(message: string): void {
        this.errors.push({
            message,
            severity: 'error',
            path: [...this.currentPath],
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/** Build IR from AST */
export function buildIR(ast: ASTNode | null): IRResult {
    const builder = new IRBuilder();
    return builder.build(ast);
}
