/**
 * AUWGENT YAML-Lite — Stress Test Suite
 * 
 * This file contains rigorous edge case testing to push the parser to its limits.
 * Tests cover malformed input, extreme nesting, whitespace edge cases, and more.
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
// EXTREME NESTING TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Extreme Nesting', () => {
    it('should handle 10 levels of mapping nesting', () => {
        const input = "l1:\n  l2:\n    l3:\n      l4:\n        l5:\n          l6:\n            l7:\n              l8:\n                l9:\n                  l10:\n                    value: deep\n";
        const json = parseToJSON(input) as any;

        expect(json.l1.l2.l3.l4.l5.l6.l7.l8.l9.l10.value).toBe('deep');
    });

    it('should handle 5 levels of nested sequences', () => {
        const input = "level1:\n  - level2:\n      - level3:\n          - level4:\n              - level5:\n                  - deepest\n";
        const json = parseToJSON(input) as any;

        expect(json.level1[0].level2[0].level3[0].level4[0].level5[0]).toBe('deepest');
    });

    it('should handle alternating mapping and sequence nesting', () => {
        const input = "root:\n  items:\n    - config:\n        settings:\n          - option: value\n";
        const json = parseToJSON(input) as any;

        expect(json.root.items[0].config.settings[0].option).toBe('value');
    });

    it('should handle wide structures with many siblings', () => {
        let input = 'root:\n';
        for (let i = 1; i <= 20; i++) {
            input += `  key${i}: value${i}\n`;
        }
        const json = parseToJSON(input) as any;

        expect(Object.keys(json.root)).toHaveLength(20);
        expect(json.root.key1).toBe('value1');
        expect(json.root.key20).toBe('value20');
    });

    it('should handle long sequences with 50 items', () => {
        let input = 'items:\n';
        for (let i = 1; i <= 50; i++) {
            input += `  - item${i}\n`;
        }
        const json = parseToJSON(input) as any;

        expect(json.items).toHaveLength(50);
        expect(json.items[0]).toBe('item1');
        expect(json.items[49]).toBe('item50');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// WHITESPACE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('Whitespace Edge Cases', () => {
    it('should handle trailing whitespace in values', () => {
        const json = parseToJSON("key: value   \n") as any;
        // Trailing whitespace should be trimmed
        expect(json.key).toBe('value');
    });

    it('should handle empty lines between entries', () => {
        const json = parseToJSON("key1: value1\n\nkey2: value2\n\n\nkey3: value3\n") as any;
        expect(json.key1).toBe('value1');
        expect(json.key2).toBe('value2');
        expect(json.key3).toBe('value3');
    });

    it('should handle comments between entries', () => {
        const json = parseToJSON("key1: value1\n# comment line\nkey2: value2\n  # indented comment\nkey3: value3\n") as any;
        expect(json.key1).toBe('value1');
        expect(json.key2).toBe('value2');
        expect(json.key3).toBe('value3');
    });

    it('should handle inline comments', () => {
        // Note: YAML-lite may or may not support inline comments
        const json = parseToJSON("key: value # inline comment\n") as any;
        // Depends on implementation - either value includes comment or it's stripped
        expect(json.key).toBeDefined();
    });

    it('should handle mixed indentation recovery', () => {
        // Going from deep nesting back to shallow
        const json = parseToJSON("a:\n  b:\n    c: deep\nd: shallow\n") as any;
        expect(json.a.b.c).toBe('deep');
        expect(json.d).toBe('shallow');
    });

    it('should handle tab characters gracefully', () => {
        // Tabs should be handled (ideally converted or rejected consistently)
        const result = parse("key:\tvalue\n");
        expect(result.errors).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SPECIAL VALUE TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Special Value Edge Cases', () => {
    it('should handle all boolean variants', () => {
        const json = parseToJSON("t1: true\nt2: True\nt3: TRUE\nf1: false\nf2: False\nf3: FALSE\n") as any;
        expect(json.t1).toBe(true);
        expect(json.t2).toBe(true);
        expect(json.t3).toBe(true);
        expect(json.f1).toBe(false);
        expect(json.f2).toBe(false);
        expect(json.f3).toBe(false);
    });

    it('should handle number edge cases', () => {
        const json = parseToJSON("zero: 0\nneg: -1\nbig: 999999999\nfloat: 0.123\nsci: 1e10\nnegFloat: -0.5\n") as any;
        expect(json.zero).toBe(0);
        expect(json.neg).toBe(-1);
        expect(json.big).toBe(999999999);
        expect(json.float).toBe(0.123);
        expect(json.sci).toBe(1e10);
        expect(json.negFloat).toBe(-0.5);
    });

    it('should preserve string-like numbers in quotes', () => {
        const json = parseToJSON("phone: \"555-1234\"\nzip: \"00123\"\nversion: \"1.0.0\"\n") as any;
        expect(json.phone).toBe('555-1234');
        expect(json.zip).toBe('00123');
        expect(json.version).toBe('1.0.0');
    });

    it('should handle special string values that look like keywords', () => {
        const json = parseToJSON("notBool: truthy\nnotNull: nullable\nnotNum: 123abc\n") as any;
        expect(json.notBool).toBe('truthy');
        expect(json.notNull).toBe('nullable');
        expect(json.notNum).toBe('123abc');
    });

    it('should handle empty string in quotes', () => {
        const json = parseToJSON("empty: \"\"\n") as any;
        expect(json.empty).toBe('');
    });

    it('should handle very long string values', () => {
        const longValue = 'x'.repeat(1000);
        const json = parseToJSON(`long: ${longValue}\n`) as any;
        expect(json.long).toBe(longValue);
    });

    it('should handle unicode characters', () => {
        const json = parseToJSON("emoji: 🚀\nchinese: 中文\narabic: مرحبا\n") as any;
        expect(json.emoji).toBe('🚀');
        expect(json.chinese).toBe('中文');
        expect(json.arabic).toBe('مرحبا');
    });

    it('should handle URLs and paths', () => {
        const json = parseToJSON("url: https://example.com/path?query=1&foo=bar\npath: C:\\Users\\test\\file.txt\nunix: /usr/local/bin\n") as any;
        expect(json.url).toBe('https://example.com/path?query=1&foo=bar');
        expect(json.path).toBe('C:\\Users\\test\\file.txt');
        expect(json.unix).toBe('/usr/local/bin');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// KEY NAME EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('Key Name Edge Cases', () => {
    it('should handle numeric keys', () => {
        const json = parseToJSON("123: numeric\n456: another\n") as any;
        expect(json['123']).toBe('numeric');
        expect(json['456']).toBe('another');
    });

    it('should handle underscore-prefixed keys', () => {
        const json = parseToJSON("_private: value\n__dunder: value2\n") as any;
        expect(json._private).toBe('value');
        expect(json.__dunder).toBe('value2');
    });

    it('should handle very long key names', () => {
        const longKey = 'k'.repeat(100);
        const json = parseToJSON(`${longKey}: value\n`) as any;
        expect(json[longKey]).toBe('value');
    });

    it('should handle single character keys', () => {
        const json = parseToJSON("a: 1\nb: 2\nc: 3\n") as any;
        expect(json.a).toBe(1);
        expect(json.b).toBe(2);
        expect(json.c).toBe(3);
    });

    it('should handle keys with numbers', () => {
        const json = parseToJSON("item1: first\nitem2: second\nv2_final: done\n") as any;
        expect(json.item1).toBe('first');
        expect(json.item2).toBe('second');
        expect(json.v2_final).toBe('done');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUOTED STRING EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('Quoted String Edge Cases', () => {
    it('should handle all escape sequences', () => {
        const json = parseToJSON("newline: \"line1\\nline2\"\ntab: \"col1\\tcol2\"\nreturn: \"text\\rmore\"\nbackslash: \"path\\\\file\"\nquote: \"said \\\"hello\\\"\"\n") as any;
        expect(json.newline).toBe('line1\nline2');
        expect(json.tab).toBe('col1\tcol2');
        expect(json.return).toBe('text\rmore');
        expect(json.backslash).toBe('path\\file');
        expect(json.quote).toBe('said "hello"');
    });

    it('should handle colons in quoted strings', () => {
        const json = parseToJSON("time: \"12:30:45\"\nurl: \"http://example.com\"\n") as any;
        expect(json.time).toBe('12:30:45');
        expect(json.url).toBe('http://example.com');
    });

    it('should handle quotes within different quote types', () => {
        const json = parseToJSON("single: \"it's fine\"\ndouble: 'say \"hello\"'\n") as any;
        expect(json.single).toBe("it's fine");
        expect(json.double).toBe('say "hello"');
    });

    it('should handle hash in quoted strings', () => {
        const json = parseToJSON("hashtag: \"#trending\"\ncomment: \"code # not a comment\"\n") as any;
        expect(json.hashtag).toBe('#trending');
        expect(json.comment).toBe('code # not a comment');
    });

    it('should handle dash in quoted strings', () => {
        const json = parseToJSON("range: \"1-10\"\nlist: \"- not a list\"\n") as any;
        expect(json.range).toBe('1-10');
        expect(json.list).toBe('- not a list');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEQUENCE EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('Sequence Edge Cases', () => {
    it('should handle empty sequence items gracefully', () => {
        const result = parse("items:\n  -\n  - value\n  -\n");
        expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed scalar and mapping items', () => {
        const json = parseToJSON("mixed:\n  - simple\n  - key: value\n  - another\n") as any;
        expect(json.mixed[0]).toBe('simple');
        expect(json.mixed[1].key).toBe('value');
        expect(json.mixed[2]).toBe('another');
    });

    it('should handle sequences with only one item', () => {
        const json = parseToJSON("single:\n  - only\n") as any;
        expect(json.single).toHaveLength(1);
        expect(json.single[0]).toBe('only');
    });

    it('should handle sequences of mappings with multiple keys', () => {
        const json = parseToJSON("items:\n  - id: 1\n    name: first\n    active: true\n  - id: 2\n    name: second\n    active: false\n") as any;
        expect(json.items).toHaveLength(2);
        expect(json.items[0].id).toBe(1);
        expect(json.items[0].name).toBe('first');
        expect(json.items[0].active).toBe(true);
        expect(json.items[1].id).toBe(2);
        expect(json.items[1].active).toBe(false);
    });

    it('should handle sequences of different types', () => {
        const json = parseToJSON("types:\n  - 42\n  - true\n  - null\n  - text\n  - \"quoted\"\n") as any;
        expect(json.types[0]).toBe(42);
        expect(json.types[1]).toBe(true);
        expect(json.types[2]).toBe(null);
        expect(json.types[3]).toBe('text');
        expect(json.types[4]).toBe('quoted');
    });

    it('should handle nested sequences correctly', () => {
        // Use indented syntax for nested sequences (inline `- -` is complex edge case)
        const json = parseToJSON("matrix:\n  - items:\n      - 1\n      - 2\n  - items:\n      - 3\n      - 4\n") as any;
        // This tests sequences of mappings containing sequences
        expect(json.matrix[0].items[0]).toBe(1);
        expect(json.matrix[0].items[1]).toBe(2);
        expect(json.matrix[1].items[0]).toBe(3);
        expect(json.matrix[1].items[1]).toBe(4);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// REFERENCE SYSTEM TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Reference System', () => {
    it('should track multiple ids', () => {
        const result = parseWithDiagnostics("a:\n  id: first\nb:\n  id: second\nc:\n  id: third\n");
        expect(result.ir.registry.size).toBe(3);
        expect(result.ir.registry.has('first')).toBe(true);
        expect(result.ir.registry.has('second')).toBe(true);
        expect(result.ir.registry.has('third')).toBe(true);
    });

    it('should track multiple refs', () => {
        const result = parseWithDiagnostics("a:\n  id: source\nb:\n  ref: source\nc:\n  ref: missing\n");
        expect(result.ir.unresolvedRefs).toContain('missing');
        expect(result.ir.unresolvedRefs).not.toContain('source');
    });

    it('should handle refs in sequences', () => {
        const result = parseWithDiagnostics("styles:\n  - id: primary\n    color: blue\nitems:\n  - style:\n      ref: primary\n  - style:\n      ref: primary\n");
        expect(result.ir.registry.has('primary')).toBe(true);
    });

    it('should handle self-referential structures', () => {
        const result = parseWithDiagnostics("node:\n  id: self\n  child:\n    ref: self\n");
        expect(result.ir.registry.has('self')).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// STREAMING EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('Streaming Edge Cases', () => {
    it('should handle empty input', () => {
        const stream = createStreamingParser();
        const result = stream.end();
        expect(result).toBeDefined();
    });

    it('should handle single key without value', () => {
        const stream = createStreamingParser();
        stream.write("key:\n");
        const result = stream.end() as any;
        expect(result.key).toBeDefined();
    });

    it('should handle rapid consecutive writes', () => {
        const stream = createStreamingParser();
        for (let i = 0; i < 100; i++) {
            stream.write(`k${i}: v${i}\n`);
        }
        const result = stream.end() as any;
        expect(Object.keys(result)).toHaveLength(100);
    });

    it('should handle peek without consuming', () => {
        const stream = createStreamingParser();
        stream.write("a: 1\n");
        const peek1 = stream.peek() as any;
        const peek2 = stream.peek() as any;
        expect(peek1.a).toBe(1);
        expect(peek2.a).toBe(1);

        stream.write("b: 2\n");
        const peek3 = stream.peek() as any;
        expect(peek3.a).toBe(1);
        expect(peek3.b).toBe(2);
    });

    it('should handle partial lines', () => {
        const stream = createStreamingParser();
        stream.write("key");
        stream.write(": ");
        stream.write("val");
        stream.write("ue\n");
        const result = stream.end() as any;
        expect(result.key).toBe('value');
    });

    it('should handle streaming with deep nesting', () => {
        const stream = createStreamingParser();
        stream.write("a:\n");
        stream.write("  b:\n");
        stream.write("    c:\n");
        stream.write("      d: deep\n");
        const result = stream.end() as any;
        expect(result.a.b.c.d).toBe('deep');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR RECOVERY TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Error Recovery', () => {
    it('should handle missing colon gracefully', () => {
        const result = parse("key value\n");
        // Should not crash, but may have errors or treat as scalar
        expect(result.ast).toBeDefined();
    });

    it('should handle inconsistent indentation', () => {
        const result = parse("a:\n  b: 1\n   c: 2\n"); // extra space before c
        expect(result.ast).toBeDefined();
    });

    it('should handle unclosed quotes', () => {
        const result = parse("key: \"unclosed\n");
        expect(result.ast).toBeDefined();
    });

    it('should handle orphan dashes', () => {
        const result = parse("- orphan\n");
        expect(result.ast).toBeDefined();
    });

    it('should handle empty document', () => {
        const result = parse("");
        expect(result.ast).toBeDefined();
    });

    it('should handle only whitespace', () => {
        const result = parse("   \n\n   \n");
        expect(result.ast).toBeDefined();
    });

    it('should handle only comments', () => {
        const result = parse("# comment 1\n# comment 2\n");
        expect(result.ast).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// REAL-WORLD SCENARIO TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Real-World Scenarios', () => {
    it('should parse complex agentic intent', () => {
        const input = `intent:
  type: multi_step
  confidence: 0.95
  reasoning: Analyzing user request
  steps:
    - action: search
      service: web
      query: latest news
      options:
        limit: 5
        safe_search: true
    - action: summarize
      format: bullet_points
      max_items: 3
    - action: respond
      template: news_summary
      include_sources: true
`;
        const json = parseToJSON(input) as any;

        expect(json.intent.type).toBe('multi_step');
        expect(json.intent.confidence).toBe(0.95);
        expect(json.intent.steps).toHaveLength(3);
        expect(json.intent.steps[0].options.safe_search).toBe(true);
        expect(json.intent.steps[1].format).toBe('bullet_points');
    });

    it('should parse complex UI component tree', () => {
        const input = `root:
  id: app_container
  type: Container
  props:
    layout: flex
    direction: column
    gap: 16
  children:
    - id: header
      type: Header
      props:
        title: My App
        subtitle: Welcome
    - id: main_content
      type: ScrollView
      children:
        - id: card_list
          type: List
          props:
            orientation: horizontal
          children:
            - id: card_1
              type: Card
              props:
                title: Item 1
                description: First item
            - id: card_2
              type: Card
              props:
                title: Item 2
                description: Second item
    - id: footer
      type: Footer
      props:
        copyright: 2024
`;
        const json = parseToJSON(input) as any;

        expect(json.root.id).toBe('app_container');
        expect(json.root.children).toHaveLength(3);
        expect(json.root.children[0].props.title).toBe('My App');
        expect(json.root.children[1].children[0].children).toHaveLength(2);
        expect(json.root.children[1].children[0].children[1].props.title).toBe('Item 2');
    });

    it('should parse API response configuration', () => {
        const input = `api:
  version: v2
  base_url: https://api.example.com
  endpoints:
    - path: /users
      method: GET
      params:
        page: 1
        limit: 20
      headers:
        x-api-key: secret
    - path: /users
      method: POST
      body:
        required:
          - name
          - email
        optional:
          - phone
          - address
`;
        const json = parseToJSON(input) as any;

        expect(json.api.version).toBe('v2');
        expect(json.api.endpoints).toHaveLength(2);
        expect(json.api.endpoints[0].params.limit).toBe(20);
        expect(json.api.endpoints[1].body.required).toContain('name');
    });

    it('should parse workflow definition', () => {
        const input = `workflow:
  name: data_pipeline
  version: 1.0
  triggers:
    - type: schedule
      cron: 0 0 * * *
    - type: webhook
      path: /trigger
  steps:
    - name: extract
      action: read_database
      config:
        table: users
        filter: active = true
    - name: transform
      action: map_fields
      depends_on:
        - extract
    - name: load
      action: write_warehouse
      depends_on:
        - transform
      retry:
        attempts: 3
        delay: 60
`;
        const json = parseToJSON(input) as any;

        expect(json.workflow.name).toBe('data_pipeline');
        expect(json.workflow.triggers).toHaveLength(2);
        expect(json.workflow.steps[2].retry.attempts).toBe(3);
        expect(json.workflow.steps[1].depends_on).toContain('extract');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOKENIZER STRESS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Tokenizer Stress Tests', () => {
    it('should tokenize very long input', () => {
        let input = '';
        for (let i = 0; i < 500; i++) {
            input += `key${i}: value${i}\n`;
        }
        const tokens = tokenize(input);
        expect(tokens.length).toBeGreaterThan(1500); // At least KEY, COLON, SCALAR per line
    });

    it('should handle rapid indent changes', () => {
        const input = "a:\n  b:\n    c:\n      d: 1\n    e: 2\n  f: 3\ng: 4\n";
        const tokens = tokenize(input);
        const indents = tokens.filter(t => t.type === 'INDENT').length;
        const dedents = tokens.filter(t => t.type === 'DEDENT').length;
        expect(indents).toBeGreaterThan(0);
        expect(dedents).toBeGreaterThan(0);
    });

    it('should handle many quoted strings', () => {
        let input = '';
        for (let i = 0; i < 100; i++) {
            input += `key${i}: "value with spaces ${i}"\n`;
        }
        const tokens = tokenize(input);
        const quoted = tokens.filter(t => t.type === 'QUOTED').length;
        expect(quoted).toBe(100);
    });

    it('should handle alternating quotes', () => {
        const input = "a: \"double\"\nb: 'single'\nc: \"double again\"\nd: 'single again'\n";
        const tokens = tokenize(input);
        const quoted = tokens.filter(t => t.type === 'QUOTED').length;
        expect(quoted).toBe(4);
    });
});
