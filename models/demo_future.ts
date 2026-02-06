import { definePrompt, tools, schema, compilePrompt } from '../src/prompt';

// Example 1: "Ask User" Intent
// This is trivial with `schema()`
const askUserIntent = schema({
    question: "string",
    style: "modal|inline",
    timeout: "number?"
}, "Use this when you need clarification from the user");


// Example 2: Parallel/Sequential Execution
// The standard tools() builder assumes a simple list [Action, Action].
// If we want metadata like { execution: 'parallel', actions: [...] }, we need schema()
// BUT we lose the auto-generated tool docs if we just use raw schema.
// Here is a workaround: Define tools separately, then reference them in schema.

const myTools = [
    { name: "fetch_data", args: { url: "string" } },
    { name: "process_data", args: { id: "string" } }
];

// We manually build the tool schema part
const toolSchema = {
    mode: "parallel|sequential",
    steps: [
        {
            tool: "fetch_data",
            args: { url: "string" }
        },
        {
            tool: "process_data",
            args: { id: "string" }
        }
    ]
};

const complexAgent = definePrompt({
    instructions: "You are an advanced agent.",
    intents: {
        // Simple Interaction
        ask_user: askUserIntent,

        // Complex Execution
        // We use schema() but we need to verify if this is enough context for the LLM
        sys_cmd: schema(toolSchema, "Execute tasks with explicit parallelism")
    }
});

console.log(compilePrompt(complexAgent));
