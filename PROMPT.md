# Functional Prompt Engine

The **Auwgent Functional Prompt Engine** is a type-safe, composable toolkit for building LLM system prompts. It enforces an "Intent-First" architecture, ensuring that your agent's capabilities (Tools, UI) are strictly defined and automatically documented for the model.

## Features

- **Intent-First Design**: Define *what* your agent can do (Intents), not just a list of functions.
- **Generative UI Support**: First-class support for `components()` alongside `tools()`.
- **Dynamic Interpolation**: Inject runtime variables like `{{user_name}}` into instructions.
- **Type Inference**: Derive TypeScript types directly from your prompt definition.
- **Auto-Protocol**: Automatically generates the YAML schema/protocol for the LLM.

## Usage

### 1. Define the Agent

```typescript
import { definePrompt, tools, components, compilePrompt } from './src/prompt';

const agent = definePrompt({
    instructions: "You are a helpful assistant for {{company}}.",
    
    // Define Capabilities (Intents)
    intents: {
        // Backend Tools
        sys_cmd: tools([
            { name: "search", description: "Query the web", args: { query: "string" } }
        ]),

        // Frontend Components
        ui_render: components([
            { name: "StockCard", description: "Display stock price", props: { symbol: "string" } }
        ])
    }
});
```

### 2. Compile with Context

Inject variables at runtime.

```typescript
const systemPrompt = compilePrompt(agent, {
    company: "Acme Corp"
});
```

**Output:**
```yaml
# SYSTEM
You are a helpful assistant for Acme Corp.

# TOOLS
# ... (Auto-generated tool docs)

# UI COMPONENTS
# ... (Auto-generated component docs)

# PROTOCOL (YAML)
sys_cmd:
  - type: search
    args: { ... }
ui_render:
  component: StockCard
  props: { ... }
```

### 3. Type Inference (Zero Duplication)

Don't write TypeScript interfaces manually. Infer them!

```typescript
import type { InferPromptDoc } from './src/prompt';

// Automatically equals: { sys_cmd?: { type: 'search', ... }, ui_render?: ... }
type AgentOutput = InferPromptDoc<typeof agent>;
```

## Advanced

### Custom Descriptions
You can override the default description for any intent group.

```typescript
sys_cmd: tools([...], "Use these only for dangerous actions.")
```

### Folder-Based Composition
Since `definePrompt` is plain JavaScript/Object-based, you can import fragments from other files.

```typescript
import { adminTools } from './capabilities/admin';
import { commonUI } from './capabilities/ui';

const bot = definePrompt({
    intents: {
        sys_cmd: adminTools,
        ui_render: commonUI
    }
});
```

### Advanced Schema & Lists

You can use `schema()` to define complex, nested structures (including lists) for advanced agent behaviors like parallel execution plans. Arrays are automatically formatted as clean YAML lists.

```typescript
const planSchema = {
    steps: [
        { tool: "search", args: { q: "foo" } },
        { tool: "analyze", args: { data: "bar" } }
    ]
};

// ...
sys_cmd: schema(planSchema, "Execute tasks in parallel")
```

**Output:**
```yaml
sys_cmd:
  steps:
    - tool: search
      args: { q: foo }
    - tool: analyze
      args: { data: bar }
```
