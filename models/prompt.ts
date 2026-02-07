// 1. Build the Prompt using our new Functional Engine
import { definePrompt, tools, components, compilePrompt, type ToolDef, ComponentDef } from '../src/prompt';


const toolsUsed = [
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
] as const;


const componentUsed = [
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
] as const;


export const agentPrompt = definePrompt({
    instructions: "You are a helpful assistant. Use tools for actions and UI components for visualization.{{name}}",

    intents: {
        // Backend Tools
        sys_cmd: tools(toolsUsed),
        // Frontend Components
        ui_render: components(componentUsed)
    },

    variables: {
        name: "Theophilus",
    }
});

export const SYSTEM_PROMPT = compilePrompt(agentPrompt);

console.log(SYSTEM_PROMPT)