/**
 * AUWGENT YAML-Lite — Test Suite
 */

import { describe, it, expect } from 'bun:test';
import {
    tokenize,
    parse,
    parseToJSON,
    createStreamingParser,
    parseWithDiagnostics,
} from '../src/index';

// ═══════════════════════════════════════════════════════════════════════════
// TOKENIZER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Tokenizer', () => {
    it('should tokenize simple key-value', () => {
        const tokens = tokenize('key: value\n');
        const types = tokens.map(t => t.type);

        expect(types).toContain('KEY');
        expect(types).toContain('COLON');
        expect(types).toContain('SCALAR');
        expect(types).toContain('EOF');
    });

    it('should track indentation', () => {
        const tokens = tokenize('a:\n  b: 1\n');
        const types = tokens.map(t => t.type);

        expect(types).toContain('INDENT');
        expect(types).toContain('DEDENT');
    });

    it('should tokenize quoted strings', () => {
        const tokens = tokenize('key: "hello: world"\n');
        const quoted = tokens.find(t => t.type === 'QUOTED');

        expect(quoted).toBeDefined();
        expect(quoted?.value).toBe('hello: world');
    });

    it('should handle sequence dashes', () => {
        const tokens = tokenize('- item\n');
        const types = tokens.map(t => t.type);

        expect(types).toContain('DASH');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// PARSER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Parser', () => {
    it('should parse simple mapping', () => {
        const result = parse('key: value\n');

        expect(result.ast).toBeDefined();
        expect(result.ast?.kind).toBe('mapping');
    });

    it('should parse nested mappings', () => {
        const result = parse(`
parent:
  child: value
`);

        expect(result.ast?.kind).toBe('mapping');
        expect(result.errors).toHaveLength(0);
    });

    it('should parse sequences', () => {
        const result = parse(`
items:
  - a
  - b
  - c
`);

        expect(result.ast?.kind).toBe('mapping');
    });

    it('should handle partial documents', () => {
        const result = parse('key:');

        expect(result.ast).toBeDefined();
        // Partial doc should still parse
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// IR BUILDER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('IR Builder', () => {
    it('should convert to JSON', () => {
        const json = parseToJSON(`
name: test
count: 42
enabled: true
`);

        expect(json).toEqual({
            name: 'test',
            count: 42,
            enabled: true,
        });
    });

    it('should handle null values', () => {
        const json = parseToJSON(`
empty: null
tilde: ~
`);

        expect((json as any).empty).toBe(null);
        expect((json as any).tilde).toBe(null);
    });

    it('should preserve quoted strings', () => {
        const json = parseToJSON(`
number: "42"
bool: "true"
`);

        expect((json as any).number).toBe('42');
        expect((json as any).bool).toBe('true');
    });

    it('should track references', () => {
        const result = parseWithDiagnostics(`
component:
  id: header
  type: Text
reference:
  ref: header
`);

        expect(result.ir.registry.has('header')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// STREAMING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Streaming Parser', () => {
    it('should parse incrementally', () => {
        const stream = createStreamingParser();

        stream.write('intent:\n');
        stream.write('  type: tool_call\n');

        const partial = stream.peek();
        expect(partial).toBeDefined();

        stream.write('  name: search\n');

        const final = stream.end();
        expect((final as any).intent.type).toBe('tool_call');
        expect((final as any).intent.name).toBe('search');
    });

    it('should emit intent_ready event', () => {
        const stream = createStreamingParser();
        let intentType: string | null = null;

        stream.onIntentReady((type) => {
            intentType = type;
        });

        stream.write('intent:\n');
        stream.write('  type: respond\n');
        stream.end();

        expect(intentType).toBe('respond');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Integration', () => {
    it('should parse complex document', () => {
        const json = parseToJSON(`
intent:
  type: tool_call
  name: search
  args:
    query: hello world
    limit: 10
    filters:
      category: news
      enabled: true
`);

        const intent = (json as any).intent;
        expect(intent.type).toBe('tool_call');
        expect(intent.name).toBe('search');
        expect(intent.args.query).toBe('hello world');
        expect(intent.args.limit).toBe(10);
        expect(intent.args.filters.category).toBe('news');
        expect(intent.args.filters.enabled).toBe(true);
    });

    it('should handle UI components', () => {
        const json = parseToJSON(`
components:
  - id: header
    type: Text
    props:
      content: Hello
  - id: button
    type: Button
    props:
      label: Click me
`);

        const components = (json as any).components;
        expect(components).toHaveLength(2);
        expect(components[0].id).toBe('header');
        expect(components[1].type).toBe('Button');
    });

    it('should handle empty blocks', () => {
        const json = parseToJSON("args:\nchildren:\n");

        expect((json as any).args).toEqual({});
        expect((json as any).children).toEqual({});
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPLEX EDGE CASE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Complex Edge Cases', () => {
    it('should handle deeply nested structures (4+ levels)', () => {
        const json = parseToJSON("level1:\n  level2:\n    level3:\n      level4:\n        value: deep\n");

        const result = json as any;
        expect(result.level1.level2.level3.level4.value).toBe('deep');
    });

    it('should handle multiple sibling sequences', () => {
        const json = parseToJSON("fruits:\n  - apple\n  - banana\nvegetables:\n  - carrot\n  - broccoli\n");

        const result = json as any;
        expect(result.fruits).toHaveLength(2);
        expect(result.vegetables).toHaveLength(2);
        expect(result.fruits[0]).toBe('apple');
        expect(result.vegetables[1]).toBe('broccoli');
    });

    it('should handle nested sequences of mappings', () => {
        const json = parseToJSON("users:\n  - name: Alice\n    roles:\n      - admin\n      - editor\n  - name: Bob\n    roles:\n      - viewer\n");

        const result = json as any;
        expect(result.users).toHaveLength(2);
        expect(result.users[0].name).toBe('Alice');
        expect(result.users[0].roles).toHaveLength(2);
        expect(result.users[0].roles[0]).toBe('admin');
        expect(result.users[1].roles[0]).toBe('viewer');
    });

    it('should handle mixed content at same level', () => {
        const json = parseToJSON("config:\n  name: app\n  version: 1.0\n  enabled: true\n  count: 42\n  empty:\n");

        const result = json as any;
        expect(result.config.name).toBe('app');
        expect(result.config.version).toBe(1.0);
        expect(result.config.enabled).toBe(true);
        expect(result.config.count).toBe(42);
        expect(result.config.empty).toEqual({});
    });

    it('should handle comments between lines', () => {
        const json = parseToJSON("# Header comment\nkey1: value1\n# Middle comment\nkey2: value2\n");

        const result = json as any;
        expect(result.key1).toBe('value1');
        expect(result.key2).toBe('value2');
    });

    it('should handle special string values', () => {
        const json = parseToJSON("url: https://example.com/path?query=1\nemail: user@domain.com\npath: /usr/local/bin\n");

        const result = json as any;
        expect(result.url).toBe('https://example.com/path?query=1');
        expect(result.email).toBe('user@domain.com');
        expect(result.path).toBe('/usr/local/bin');
    });

    it('should preserve quoted numbers as strings', () => {
        const json = parseToJSON("zipcode: \"12345\"\nphone: \"555-1234\"\nid: \"007\"\n");

        const result = json as any;
        expect(result.zipcode).toBe('12345');
        expect(result.phone).toBe('555-1234');
        expect(result.id).toBe('007');
    });

    it('should handle numeric edge cases', () => {
        const json = parseToJSON("integer: 42\nfloat: 3.14\nnegative: -100\nzero: 0\n");

        const result = json as any;
        expect(result.integer).toBe(42);
        expect(result.float).toBe(3.14);
        expect(result.negative).toBe(-100);
        expect(result.zero).toBe(0);
    });

    it('should handle boolean variations', () => {
        const json = parseToJSON("t1: true\nf1: false\nT1: True\nF1: False\n");

        const result = json as any;
        expect(result.t1).toBe(true);
        expect(result.f1).toBe(false);
        expect(result.T1).toBe(true);
        expect(result.F1).toBe(false);
    });

    it('should handle null variations', () => {
        const json = parseToJSON("n1: null\nn2: ~\nn3: Null\n");

        const result = json as any;
        expect(result.n1).toBe(null);
        expect(result.n2).toBe(null);
        expect(result.n3).toBe(null);
    });

    it('should handle quoted strings with special characters', () => {
        const json = parseToJSON("colon: \"has: colon\"\nhash: \"has # hash\"\nquote: \"has \\\"quote\\\"\"\n");

        const result = json as any;
        expect(result.colon).toBe('has: colon');
        expect(result.hash).toBe('has # hash');
        expect(result.quote).toBe('has "quote"');
    });

    it('should handle sequence with inline scalar values', () => {
        const json = parseToJSON("numbers:\n  - 1\n  - 2\n  - 3\nbools:\n  - true\n  - false\n");

        const result = json as any;
        expect(result.numbers).toEqual([1, 2, 3]);
        expect(result.bools).toEqual([true, false]);
    });

    it('should handle complex agent intent structure', () => {
        const json = parseToJSON("intent:\n  type: multi_step\n  steps:\n    - action: fetch\n      url: https://api.example.com\n      headers:\n        auth: bearer token\n    - action: transform\n      format: json\n    - action: respond\n      content: Done\n");

        const result = json as any;
        expect(result.intent.type).toBe('multi_step');
        expect(result.intent.steps).toHaveLength(3);
        expect(result.intent.steps[0].action).toBe('fetch');
        expect(result.intent.steps[0].headers.auth).toBe('bearer token');
        expect(result.intent.steps[2].content).toBe('Done');
    });

    it('should handle real generative UI component tree', () => {
        const json = parseToJSON("root:\n  id: app\n  type: Container\n  props:\n    layout: vertical\n    padding: 16\n  children:\n    - id: header\n      type: Text\n      props:\n        content: Welcome\n        size: large\n    - id: form\n      type: Form\n      children:\n        - id: input1\n          type: TextInput\n          props:\n            placeholder: Enter name\n        - id: submit\n          type: Button\n          props:\n            label: Submit\n            variant: primary\n");

        const result = json as any;
        expect(result.root.type).toBe('Container');
        expect(result.root.props.padding).toBe(16);
        expect(result.root.children).toHaveLength(2);
        expect(result.root.children[0].type).toBe('Text');
        expect(result.root.children[1].children).toHaveLength(2);
        expect(result.root.children[1].children[1].props.variant).toBe('primary');
    });

    it('should handle id/ref tracking', () => {
        const result = parseWithDiagnostics("components:\n  - id: shared_style\n    color: blue\n  - id: button1\n    style:\n      ref: shared_style\n  - id: button2\n    style:\n      ref: shared_style\n");

        expect(result.ir.registry.has('shared_style')).toBe(true);
        expect(result.ir.registry.has('button1')).toBe(true);
        expect(result.ir.registry.has('button2')).toBe(true);
    });

    it('should detect unresolved references', () => {
        const result = parseWithDiagnostics("link:\n  ref: nonexistent_id\n");

        expect(result.ir.unresolvedRefs).toContain('nonexistent_id');
    });

    it('should handle empty sequences', () => {
        const result = parse("items:\n  -\n  -\n");

        // Empty sequence items should be handled gracefully
        expect(result.errors).toHaveLength(0);
    });

    it('should handle keys with numbers', () => {
        const json = parseToJSON("item1: first\nitem2: second\nitem100: hundredth\n");

        const result = json as any;
        expect(result.item1).toBe('first');
        expect(result.item2).toBe('second');
        expect(result.item100).toBe('hundredth');
    });

    it('should handle underscore and hyphen in keys', () => {
        const json = parseToJSON("snake_case: value1\nkebab-case: value2\nmixed_kebab-case: value3\n");

        const result = json as any;
        expect(result.snake_case).toBe('value1');
        expect(result['kebab-case']).toBe('value2');
        expect(result['mixed_kebab-case']).toBe('value3');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// STREAMING STRESS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Streaming Stress Tests', () => {
    it('should handle character-by-character streaming', () => {
        const input = "key: value\n";
        const stream = createStreamingParser();

        // Feed one character at a time
        for (const char of input) {
            stream.write(char);
        }

        const result = stream.end();
        expect((result as any).key).toBe('value');
    });

    it('should handle line-by-line streaming', () => {
        const stream = createStreamingParser();

        stream.write("config:\n");
        stream.write("  name: app\n");
        stream.write("  version: 1.0\n");

        const result = stream.end();
        expect((result as any).config.name).toBe('app');
        expect((result as any).config.version).toBe(1.0);
    });

    it('should provide partial results via peek', () => {
        const stream = createStreamingParser();

        stream.write("first: 1\n");
        const partial1 = stream.peek();
        expect((partial1 as any).first).toBe(1);

        stream.write("second: 2\n");
        const partial2 = stream.peek();
        expect((partial2 as any).second).toBe(2);

        const final = stream.end();
        expect((final as any).first).toBe(1);
        expect((final as any).second).toBe(2);
    });

    it('should handle streaming with sequences', () => {
        const stream = createStreamingParser();

        stream.write("items:\n");
        stream.write("  - first\n");

        const partial = stream.peek();
        expect((partial as any).items).toHaveLength(1);

        stream.write("  - second\n");

        const final = stream.end();
        expect((final as any).items).toHaveLength(2);
    });
});
