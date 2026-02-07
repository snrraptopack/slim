import Groq from "groq-sdk";
import { key } from "./key";
import { createStreamingParser } from "../src/index"; // Relative import since we are in the repo
import { agentPrompt, SYSTEM_PROMPT } from "./prompt";
import { InferPromptDoc } from "../src/prompt";

const groq = new Groq({ apiKey: key });

const MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-20b",
    "qwen/qwen3-32b"
];


// 1. Build the Prompt using our new Functional Engine
// Note: We are importing the prompt definition from a separate file 'prompt.ts' 
// if it existed, but here we define it inline or assume it is available.
// Since the user edited 'models/prompt.ts' earlier (Step 1645), we should import from THERE.

async function main() {
    // 2. Infer types directly from the Prompt Def
    type SystemOutput = InferPromptDoc<typeof agentPrompt>;

    const parser = createStreamingParser<SystemOutput>({
        intentKey: ['sys_cmd', 'ui_render'] // Listen for both!
    });

    const stream = await groq.chat.completions.create({
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: "show me any weather deatails use any deatails you want"
            }
        ],
        model: MODELS[0],
        stream: true,
        stop: null
    });

    process.stdout.write("Stream: ");

    // Handler receives the specific 'payload' object
    parser.onIntentPartial((type, payload) => {
        console.log(`\nPartial update [${type}]:`, JSON.stringify(payload));

        if (type === "sys_cmd") {

        }
    });

    // parser.onIntentReady is replaced by strictly typed handlers:

    // 1. Handle Tools (sys_cmd)
    parser.onIntent('sys_cmd', (cmd) => {
        // 'cmd' is strictly typed as the Union of Tools
        if (cmd.type === 'search') {
            console.log(`   (>> ElasticSearch Query: "${cmd.args.query}" limit=${cmd.args.limit})`);
        }
        else if (cmd.type === 'create_alert') {
            console.log(`   (>> Triggering PagerDuty: ${cmd.args.severity} alert)`);
        }
    });

    // 2. Handle Components (ui_render)
    parser.onIntent('ui_render', (ui) => {
        // 'ui' is strictly typed as the Union of Components
        if (ui.component === 'StockCard') {
            console.log(`   (>> StockCard: ${ui.props.symbol} ${ui.props.period})`);
        }
        else if (ui.component === 'WeatherWidget') {
            console.log(`   (>> Weather: ${ui.props.city})`);
        }
    });

    try {
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                process.stdout.write(content);
                parser.write(content);
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }

    const final = parser.end();
    console.log("\n\n✅ Final Doc:", JSON.stringify(final, null, 2));
}

// Run if main module
if (import.meta.main) {
    main();
}
