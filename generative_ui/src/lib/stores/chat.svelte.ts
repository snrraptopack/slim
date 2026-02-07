import { createStreamingParser } from '@slim/index';
import type { SystemOutput } from '../agent';


// Svelte 5 State
export class ChatStore {
    messages = $state<{ role: 'user' | 'assistant' | 'system', content?: string, components?: any[] }[]>([]);
    isStreaming = $state(false);

    // Internal Parser - Listen for ALL intent types including text
    private parser = createStreamingParser<SystemOutput>({ intentKey: ['text', 'ui_render', 'sys_cmd'] });

    // active interaction state
    private currentMessageIndex = -1;

    constructor() {
        this.setupParser();
    }

    private setupParser() {
        // Listen for PARTIAL updates - Realtime (no debounce)
        this.parser.onIntentPartial((type, payload) => {
            if (this.currentMessageIndex === -1) return;

            const msg = this.messages[this.currentMessageIndex];

            // Handle text intent
            if (type === 'text') {
                const textPayload = payload as any;
                if (textPayload.content) {
                    msg.content = textPayload.content;
                }
            }
            // Handle UI render intent
            else if (type === 'ui_render') {
                const uiPayload = payload as any;
                if (!uiPayload.component) return;

                if (!msg.components) msg.components = [];

                const existingIdx = msg.components.findIndex((c: any) => c.component === uiPayload.component);

                if (existingIdx >= 0) {
                    // Update existing component props
                    msg.components[existingIdx].props = uiPayload.props || {};
                } else {
                    // Add new component
                    msg.components.push({
                        component: uiPayload.component,
                        props: uiPayload.props || {},
                        children: []
                    });
                }
            }
            // Handle sys_cmd intent (just log, don't interfere with UI)
            else if (type === 'sys_cmd') {
                console.log('[ChatStore] System Command:', payload);
            }
        });
    }

    async sendMessage(text: string) {
        // 1. Add User Message
        this.messages.push({ role: 'user', content: text });

        // 2. Add Bot Placeholder
        this.messages.push({ role: 'assistant', components: [] });
        this.currentMessageIndex = this.messages.length - 1;
        this.isStreaming = true;

        // 3. Reset Parser (no need to recreate, just reset state)
        this.parser.reset();

        // 5. Call Real API
        await this.streamResponse(text);
    }

    private async streamResponse(userText: string) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: this.messages.map(m => ({
                        role: m.role,
                        content: typeof m.content === 'string' ? m.content : ''
                    }))
                })
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log("[ChatStore] Stream done.");
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                console.log("[ChatStore] Chunk received:", chunk);


                this.parser.write(chunk);
            }

            console.log(this.parser.end());

        } catch (err) {
            console.error("Stream Error:", err);
            this.messages.push({ role: 'system', content: "Error generating response." });
        } finally {
            this.isStreaming = false;
            this.currentMessageIndex = -1;
        }
    }
}
