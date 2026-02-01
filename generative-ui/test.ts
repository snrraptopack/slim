/**
 * Generative UI Test with Gemini
 * Tests our YAML-Lite prompt for UI generation
 */

import { GoogleGenAI } from "@google/genai";
import { createStreamingParser, parseToJSON } from "../src/index";
import { API_KEY } from "./key";

/** Strip code fences from LLM output */
function stripCodeFences(text: string): string {
    // Remove ```yaml or ``` at start and ``` at end
    return text
        .replace(/^```(?:yaml|yml)?\s*\n?/gm, '')
        .replace(/\n?```\s*$/gm, '')
        .trim();
}

// Models to test
const MODELS = {
    flash: "gemini-2.0-flash",
    flashLite: "gemini-2.0-flash-lite",  // No function calling!
};

// Our compact YAML-Lite UI prompt
const SYSTEM_PROMPT = `YAML UI generator.

PATTERNS:
- id: name → registers object
- ref: name → inlines registered object  
- type: X + props → inline component

CHILDREN (mix refs + inline):
  children:
    - ref: btn_id           # reusable
    - type: Text            # one-off
      content: Hello

COMPONENTS:
  Card: {title?, subtitle?, elevation?: 0-4, padding?: num}
  Grid: {columns: num, gap?: num}
  Stack: {direction: row|column, gap?: num, align?: start|center|end}
  Text: {content: str, variant?: h1|h2|h3|body|caption}
  Button: {label: str, action?: str, variant?: primary|secondary|danger}
  Icon: {name: str, size?: num, color?: str}
  Image: {src: str, alt?: str, width?: num, height?: num}
  Input: {name: str, inputType?: text|number|email|password, label?: str, placeholder?: str, required?: bool}
  Select: {name: str, options: str[], label?: str, required?: bool}
  Form: {submitAction: str, children: [...]}
  Chart: {kind: line|bar|pie, data: {labels: str[], values: num[]}}
  Table: {columns: str[], rows: any[][]}
  List: {items: str[], ordered?: bool}
  Divider: {thickness?: num, color?: str}
  Spacer: {height?: num, width?: num}

OUTPUT: YAML only. No fences. No explanation.`;

// Test scenarios
const TEST_CASES = [
    {
        name: "Simple Login Form",
        prompt: "Create a login form with email, password inputs and a submit button",
    },
    {
        name: "Stock Dashboard",
        prompt: "Create a dashboard showing AAPL stock price $189.50 (+2.3%) with a line chart and buy button",
    },
    {
        name: "User Profile Card",
        prompt: "Create a user profile card with avatar, name 'John Doe', email, and edit/logout buttons",
    },
];

async function testGenerativeUI(modelName: string, testCase: typeof TEST_CASES[0]) {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    console.log(`\n${"═".repeat(60)}`);
    console.log(`📱 ${testCase.name}`);
    console.log(`🤖 Model: ${modelName}`);
    console.log(`${"═".repeat(60)}\n`);

    console.log(`📝 Prompt: "${testCase.prompt}"\n`);

    const startTime = Date.now();

    // Stream the response
    const stream = await ai.models.generateContentStream({
        model: modelName,
        contents: [
            { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
            { role: "user", parts: [{ text: testCase.prompt }] },
        ],
        config: {
            temperature: 0.3,
        },
    });

    const parser = createStreamingParser();
    let rawYaml = "";
    let usage: any;

    // Progressive parsing
    let detectedComponents: string[] = [];

    for await (const chunk of stream) {
        const text = chunk.text;
        if (!text) continue;

        rawYaml += text;
        parser.write(text);

        // Check for progressive detection
        const partial = parser.peek() as Record<string, any>;

        if (partial.components && Array.isArray(partial.components)) {
            for (const comp of partial.components) {
                if (comp.id && !detectedComponents.includes(comp.id)) {
                    detectedComponents.push(comp.id);
                    console.log(`  📦 Component registered: ${comp.id} (${comp.type})`);
                }
            }
        }

        if (partial.ui?.type && !detectedComponents.includes("ui_root")) {
            detectedComponents.push("ui_root");
            console.log(`  🎨 UI root: ${partial.ui.type}`);
        }

        if (chunk.usageMetadata) {
            usage = chunk.usageMetadata;
        }
    }

    const elapsed = Date.now() - startTime;

    // Strip fences and re-parse for clean result
    const cleanYaml = stripCodeFences(rawYaml);
    const finalResult = parseToJSON(cleanYaml);

    console.log(`\n📄 Raw YAML:\n${"─".repeat(40)}`);
    console.log(cleanYaml);
    console.log(`${"─".repeat(40)}`);
    console.log(`${"─".repeat(40)}`);

    console.log(`\n✅ Parsed JSON:`);
    console.log(JSON.stringify(finalResult, null, 2));

    console.log(`\n📊 Stats:`);
    console.log(`  ⏱️  Time: ${elapsed}ms`);
    if (usage) {
        console.log(`  📥 Prompt tokens: ${usage.promptTokenCount}`);
        console.log(`  📤 Output tokens: ${usage.candidatesTokenCount}`);
        console.log(`  📦 Total tokens: ${usage.totalTokenCount}`);
    }

    return { rawYaml, parsed: finalResult, usage, elapsed };
}

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║          YAML-Lite Generative UI Test                        ║
╚══════════════════════════════════════════════════════════════╝
`);

    const model = MODELS.flash;

    for (const testCase of TEST_CASES) {
        try {
            await testGenerativeUI(model, testCase);
        } catch (error) {
            console.error(`❌ Error in "${testCase.name}":`, error);
        }
    }

    console.log(`\n${"═".repeat(60)}`);
    console.log("✨ All tests complete!");
}

main().catch(console.error);
