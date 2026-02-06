import { definePrompt, tools, components, compilePrompt } from '../src/prompt';

// --- SIMULATED FILE SYSTEM ---
// Imagine these are in 'prompts/identity.ts'
const identity = {
    instructions: "You are an assistant for {{company_name}}. Address the user as {{user_name}}.",
    variables: {
        company_name: "Acme Corp" // Default value
    }
};

// Imagine this is in 'prompts/tools.ts'
const coreTools = tools([
    { name: "lookup_user", description: "Fetch user details from database", args: { id: "string" } }
]);

// Imagine this is in 'prompts/ui.ts'
const coreUI = components([
    { name: "UserBadge", description: "Displays user status with a colored badge", props: { status: "string" } }
]);

// --- MAIN AGENT COMPOSITION ---
const dynamicAgent = definePrompt({
    ...identity, // Mixin identity

    intents: {
        sys_cmd: coreTools,
        ui_render: coreUI
    },

    sections: {
        "User Context": "User {{user_name}} has role: {{role}}.",
        "Session Info": "Current time: {{time}}"
    }
});

// --- RUNTIME COMPILATION ---
// We inject variables at runtime
const context = {
    user_name: "Neo",
    role: "The One",
    time: new Date().toISOString()
};

const finalPrompt = compilePrompt(dynamicAgent, context);

console.log(finalPrompt);
