import { definePrompt, tools, sections, schema, tool_call } from './prompt';

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE CONTRACT (Component Catalog)
// ═══════════════════════════════════════════════════════════════════════════

export interface ComponentDef {
    name: string;
    description: string; // Crucial for the LLM!
    props: Record<string, string>; // e.g. "title: string, data: object[]"
    examples?: string[];
}

// Imagine this is shared between Frontend and Backend
export const COMPONENT_CATALOG: ComponentDef[] = [
    {
        name: "StockChart",
        description: "Visualizes stock price history. Use when user asks for specific stock performance.",
        props: {
            symbol: "string (e.g. AAPL)",
            period: "'1D' | '1M' | '1Y'",
            showVolume: "boolean"
        }
    },
    {
        name: "NewsFeed",
        description: "A list of recent news articles. Use for market updates or specific topics.",
        props: {
            topic: "string",
            limit: "number (max 5)"
        }
    }
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE BRIDGE (Prompt Generator)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Converts the Component Catalog into a specialized "Prompt Fragment"
 * that teaches the LLM how to use these components.
 */
export function genUiFragment(catalog: ComponentDef[]) {

    // We don't just dump them as tools. 
    // We treat them as a special "UI Protocol".

    const componentDocs = catalog.map(c => {
        const propList = Object.entries(c.props)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');

        return `- Component: ${c.name}\n  Usage: ${c.description}\n  Props: { ${propList} }`;
    }).join('\n\n');

    return definePrompt(
        // 1. Define the 'ui_render' schema strictly
        schema({
            ui_render: {
                component: "string (Must be one of the available components)",
                props: "object (Match the component props exactly)"
            }
        }),

        // 2. Inject the Component Knowledge
        sections({
            "AVAILABLE_UI_COMPONENTS": componentDocs,
            "UI_RULES": "Only use ui_render when the user explicitly needs a visual widget. Otherwise use text."
        })
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE USAGE (Putting it together)
// ═══════════════════════════════════════════════════════════════════════════

/*
 * Example of how the Developer uses this in their main Agent file.
 */
// import { compilePrompt, instructions } from './prompt';

// const baseBot = definePrompt(
//     instructions("You are a financial assistant.")
// );

// // Merge the GenUI capabilities!
// const agentPrompt = definePrompt(
//     baseBot,
//     genUiFragment(COMPONENT_CATALOG)
// );

// const finalSystemString = compilePrompt(agentPrompt);
