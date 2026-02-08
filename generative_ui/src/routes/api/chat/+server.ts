
import { json } from '@sveltejs/kit';
import Groq from 'groq-sdk';
import { key } from '@models/key';
import { agentPrompt } from '$lib/agent';
import { compilePrompt } from '@slim/prompt';

// Initialize Groq client
const groq = new Groq({ apiKey: key });

// Compile the prompt ONCE at module load
const SYSTEM_PROMPT = compilePrompt(agentPrompt);

console.log(SYSTEM_PROMPT)

export async function POST({ request }) {
    console.log("[API /api/chat] Request received");
    try {
        const { messages } = await request.json();
        console.log("[API /api/chat] Messages:", JSON.stringify(messages).slice(0, 200));

        // 1. Create Streaming Completion
        const stream = await groq.chat.completions.create({
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...messages
            ],
            model: "llama-3.3-70b-versatile",
            stream: true,
            temperature: 0.7,
            max_tokens: 4096,
            stop: null
        });

        // 2. Return ReadableStream to Client
        const readable = new ReadableStream({
            async start(controller) {
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        controller.enqueue(new TextEncoder().encode(content));
                    }
                }
                controller.close();
            }
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });

    } catch (err) {
        console.error("Groq API Error:", err);
        return json({ error: "Failed to generate response" }, { status: 500 });
    }
}
