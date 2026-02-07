import { createStreamingParser } from '@slim/index';
import type { SystemOutput } from '../agent';


// Svelte 5 State
export class ChatStore {
    messages = $state<{ role: 'user' | 'assistant' | 'system', content?: string, components?: any[] }[]>([]);
    isStreaming = $state(false);

    // Internal Parser - Listen for BOTH intent types
    private parser = createStreamingParser<SystemOutput>({ intentKey: ['ui_render', 'sys_cmd'] });

    // active interaction state
    private currentMessageIndex = -1;

    constructor() {
        this.setupParser();
    }

    private setupParser() {
        // Listen for PARTIAL updates (The GenUI Magic - fires during streaming)
        this.parser.onIntentPartial((type, payload) => {
            if (this.currentMessageIndex === -1) return;

            const msg = this.messages[this.currentMessageIndex];
            console.log("[ChatStore] onIntentPartial:", type, payload);

            if (type === 'ui_render') {
                const uiPayload = payload as any;
                if (!uiPayload.component) return;

                // Force reactivity by replacing the array
                msg.components = [{
                    component: uiPayload.component,
                    props: uiPayload.props || {},
                    children: []
                }];
            } else if (type === 'sys_cmd') {
                const toolPayload = payload as any;
                if (!toolPayload.type) return;

                if (toolPayload.type === 'deploy') {
                    msg.components = [{
                        component: 'DeployStream',
                        props: {
                            steps: [
                                { id: 1, msg: `Deploying to ${toolPayload.args?.env || 'unknown'}...`, status: 'running' },
                                { id: 2, msg: 'Building container...', status: 'pending' },
                                { id: 3, msg: 'Pushing to registry...', status: 'pending' }
                            ]
                        },
                        children: []
                    }];
                } else if (toolPayload.type === 'rollback') {
                    msg.components = [{
                        component: 'DeployStream',
                        props: {
                            steps: [
                                { id: 1, msg: `Rolling back to ${toolPayload.args?.version || 'unknown'}...`, status: 'running' }
                            ]
                        },
                        children: []
                    }];
                } else {
                    msg.content = `Executing: ${toolPayload.type}`;
                }
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

        // 3. Reset Parser
        this.parser.reset();

        // 4. Re-init parser to be safe
        this.parser = createStreamingParser<SystemOutput>({ intentKey: ['ui_render', 'sys_cmd'] });
        this.setupParser();

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
