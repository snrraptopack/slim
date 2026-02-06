// 1. Build the Prompt using our new Functional Engine
import { definePrompt, tools, components, compilePrompt } from '../src/prompt';

export const agentPrompt = definePrompt({
    instructions: "You are a helpful assistant. Use tools for actions and UI components for visualization.",

    intents: {
        // Backend Tools
        sys_cmd: tools([
            {
                name: "search",
                description: "Search web for information",
                args: { query: "string", limit: "number" }
            },
            {
                name: "create_alert",
                description: "Create system alert",
                args: { severity: "critical|info", details: "object" }
            }
        ]),

        // Frontend Components
        ui_render: components([
            {
                name: "StockCard",
                description: "Visualizes stock price history",
                props: { symbol: "string", period: "1D|1W|1M" }
            },
            {
                name: "WeatherWidget",
                description: "Shows weather forecast",
                props: { city: "string", unit: "C|F" }
            }
        ])
    }
});

export const SYSTEM_PROMPT = compilePrompt(agentPrompt);

console.log(SYSTEM_PROMPT)