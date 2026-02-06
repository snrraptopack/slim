import Groq from "groq-sdk";
import { key } from "./key";
import { createStreamingParser } from "../src/index"; // Relative import since we are in the repo

const groq = new Groq({ apiKey: key });

const MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-20b",
    "qwen/qwen-2.5-32b" // Corrected model name
];

const PROMPT = `
You are a system controller.
Output pure YAML.

tools:
  search(query:string,limit:number)
  create_alert(severity:"critical"|"medium",details:{source:string,code:number})

sys_cmd:
  -type:<search|create_alert>
  args:{key:value}

use the tools to help assist the user    
`;

async function runDemo() {
    // Define the discriminated union of intent shapes
    type SearchIntent = {
        type: 'search';
        query: string;
        limit: number;
    };

    type AlertIntent = {
        type: 'create_alert';
        severity: 'low' | 'high' | 'critical';
        details: { source: string; code: number };
    };

    type SystemIntent = SearchIntent | AlertIntent;

    // The document shape
    interface SystemOutput {
        thought: string;
        sys_cmd?: SystemIntent;
    }

    const parser = createStreamingParser<SystemIntent['type'], SystemOutput>({
        intentKey: 'sys_cmd'
    });

    const stream = await groq.chat.completions.create({
        messages: [
            { role: "system", content: PROMPT },
            {
                role: "user",
                content: "Investigate the database latency and flag any critical errors."
            }
        ],
        model: MODELS[0],
        stream: true,
        stop: null
    });

    process.stdout.write("Stream: ");

    // Handler receives the specific 'payload' object
    parser.onIntentReady((type, payload) => {
        console.log(`\n\nPOLYMORPHIC INTENT DETECTED: [${type}]`);

        // TypeScript doesn't know the exact shape here without casting, 
        // but at runtime 'payload' is the specific object for that intent.
        console.log("   Payload Shape:", JSON.stringify(payload, null, 2));

        if (type === 'create_alert') {
            const alert = payload as AlertIntent; // Safe cast if we trust the parser
            console.log(`   (>> Triggering PagerDuty: ${alert.severity?.toUpperCase()} alert from ${alert.details?.source})`);
        } else if (type === 'search') {
            const search = payload as SearchIntent;
            console.log(`   (>> ElasticSearch Query: "${search.query}" limit=${search.limit})`);
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
    runDemo();
}
