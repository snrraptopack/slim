import Groq from "groq-sdk";
import { key } from "./key";
import { createStreamingParser } from "../src/index"; // Relative import since we are in the repo
import { agentPrompt, SYSTEM_PROMPT } from "./prompt";
import { InferPromptDoc } from "../src/prompt";

const groq = new Groq({ apiKey: key });

const MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-20b",
    "qwen/qwen-2.5-32b" // Corrected model name
];


// 1. Build the Prompt using our new Functional Engine
// Note: We are importing the prompt definition from a separate file 'prompt.ts' 
// if it existed, but here we define it inline or assume it is available.
// Since the user edited 'models/prompt.ts' earlier (Step 1645), we should import from THERE.

async function main() {
    // 2. Infer types directly from the Prompt Def
    type SystemOutput = InferPromptDoc<typeof agentPrompt>;

    // We can also extract specific intent types if we want strict checking
    type SysCmdIntent = NonNullable<SystemOutput['sys_cmd']>;
    type UiRenderIntent = NonNullable<SystemOutput['ui_render']>;

    type Intent = SysCmdIntent["type"] | UiRenderIntent["component"]

    const parser = createStreamingParser<Intent, SystemOutput>({
        intentKey: ['sys_cmd', 'ui_render'] // Listen for both!
    });

    const stream = await groq.chat.completions.create({
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: "Find high database latency and create a critical alert for it."
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
    });

    // parser.onIntentReady((type, payload) => {
    //     console.log(`\n\nPOLYMORPHIC INTENT DETECTED: [${type}]`);

    //     // TypeScript doesn't know the exact shape here without casting, 
    //     // but at runtime 'payload' is the specific object for that intent.
    //     console.log("   Payload Shape:", JSON.stringify(payload, null, 2));

    //     if (type === 'create_alert') {
    //         const alert = payload as AlertIntent; // Safe cast if we trust the parser
    //         console.log(`   (>> Triggering PagerDuty: ${alert.severity?.toUpperCase()} alert from ${alert.details?.source})`);
    //     } else if (type === 'search') {
    //         const search = payload as SearchIntent;
    //         console.log(`   (>> ElasticSearch Query: "${search.query}" limit=${search.limit})`);
    //     }
    // });

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
