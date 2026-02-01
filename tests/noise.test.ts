import { describe, it, expect } from 'bun:test';
import { extractYAML, parseToJSON } from '../src/index';

describe('LLM Noise Removal (extractYAML)', () => {
    it('should strip preambles and trailing text', () => {
        const dirty = `Sure! Here is the JSON you requested for the UI:

type: Card
title: Stock Dashboard
children:
  - type: Text
    content: Hello World

I hope this helps! Let me know if you need anything else.`;

        const clean = extractYAML(dirty);
        expect(clean).toContain('type: Card');
        expect(clean).not.toContain('Sure!');
        expect(clean).not.toContain('I hope this helps');

        const json = parseToJSON(clean) as any;
        expect(json.type).toBe('Card');
        expect(json.title).toBe('Stock Dashboard');
        expect(json.children[0].content).toBe('Hello World');
    });

    it('should handle code fences', () => {
        const dirty = `Here is the UI component:
\`\`\`yaml
type: Button
label: Click Me
\`\`\`
Trailing text here.`;

        const clean = extractYAML(dirty);
        expect(clean).toBe('type: Button\nlabel: Click Me');

        const json = parseToJSON(clean) as any;
        expect(json.type).toBe('Button');
        expect(json.label).toBe('Click Me');
    });

    it('should handle mixed content with list items', () => {
        const dirty = `Okay, here is a list of items:
- Item 1
- Item 2
- Item 3
That's it.`;

        const clean = extractYAML(dirty);
        expect(clean).toBe('- Item 1\n- Item 2\n- Item 3');

        const json = parseToJSON(clean) as any;
        expect(Array.isArray(json)).toBe(true);
        expect(json).toHaveLength(3);
        expect(json[0]).toBe('Item 1');
    });
});

describe('Multiline Strings (| syntax)', () => {
    it('should parse multiline strings', () => {
        const yaml = `
description: |
  This is a
  multiline string
  with multiple lines.
next_key: value
`;
        const json = parseToJSON(yaml) as any;
        expect(json.description).toBe('This is a\nmultiline string\nwith multiple lines.');
        expect(json.next_key).toBe('value');
    });

    it('should handle multiline strings at the end of document', () => {
        const yaml = `
text: |
  Line 1
  Line 2`;
        const json = parseToJSON(yaml) as any;
        expect(json.text).toBe('Line 1\nLine 2');
    });

    it('should handle empty multiline strings', () => {
        const yaml = `
text: |
next: k`;
        const json = parseToJSON(yaml) as any;
        expect(json.text).toBe('');
        expect(json.next).toBe('k');
    });

    it('should handle multiline comments', () => {
        const yaml = `
key1: value1
# This is a comment
# Another comment line
key2: value2`;
        const json = parseToJSON(yaml) as any;
        expect(json.key1).toBe('value1');
        expect(json.key2).toBe('value2');
    });

    it('should handle inline comments', () => {
        const yaml = `
name: John  # This is the name
age: 30     # Age in years
city: NYC   # City of residence`;
        const json = parseToJSON(yaml) as any;
        expect(json.name).toBe('John');
        expect(json.age).toBe(30);
        expect(json.city).toBe('NYC');
    });
});
