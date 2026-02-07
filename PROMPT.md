# Auwgent Functional Prompt Engine: The Master Guide

Welcome to the definitive reference for the **Auwgent Functional Prompt Engine**. 

This toolkit is not just a "string builder" for LLMs. It is a **Type-Safe Compiler** that transforms your high-level architectural constraints into two parallel outputs:
1.  **Strict TypeScript Interfaces** for your application code.
2.  **optimized YAML Protocols** for the Language Model.

By unifying these two worlds, Auwgent eliminates an entire class of "schema drift" bugs common in AI development.

---

## 1. Core Philosophy

### 1.1 Intent-First Architecture
In most systems, "Tools" are a bucket of functions. You throw `search`, `calculator`, `weather`, and `buy_stock` into one list and hope the LLM picks the right one.

Auwgent enforces **Intent-First Architecture**. An "Intent" is a **semantic group of capabilities**.
-   **Why?** LLMs perform significantly better when choices are hierarchical.
-   **How?** Instead of flat tools, you define *Modes* of operation (e.g., `sys_cmd` for backend work, `ui_render` for frontend work, `thinking` for internal monologue).
-   **Result**: The Parser can route the LLM's output to the correct subsystem (Database vs. React Client) *before* it even finishes parsing the arguments.

### 1.2 Zero-Duplication
**Rule**: You should never define a type twice.
In many stacks, you write:
1.  A prompt description: "This tool takes a user_id..."
2.  A JSON Schema: `{ type: "string", ... }`
3.  A TypeScript Interface: `interface Args { userId: string }`

In Auwgent, you write **once**:
```typescript
args: { userId: "string" }
```
The Engine generates the Description, the Schema/Protocol, and the Type automatically.

---

## 2. API Reference: The Definition Layer

The entry point to the system is `definePrompt`. This function is a "configuration macro" that accepts a `PromptDef` object.

### `definePrompt<T>(config: T): T`

**Purpose**: Acts as the root node of your Agent's definition. It doesn't "do" anything at runtime other than pass the config through, but it anchors the TypeScript inference engine.

**Parameters**:
-   `config`: The `PromptDef` object.

**Structure of `PromptDef`**:
```typescript
interface PromptDef {
    instructions: string;             // The "System Prompt" text
    intents: Record<string, Intent>;  // The Capabilities map
    variables?: Record<string, any>;  // Default variable values
    sections?: Record<string, string>;// Context injection blocks
    output?: Record<string, any>;     // Global output wrapper
}
```

---

## 3. API Reference: The Builder Layer

Auwgent comes with three "Builder" functions. These are helpers that construct the `Intent` objects. You **must** use these to ensure TypeScript correctly infers the literal types.

### 3.1 `tools(defs: ToolDef[], description?: string)`

**Purpose**: Defines a set of Backend/System tools.
**Effect**:
1.  **Protocol**: Generates a YAML structure where `type` is the discriminator.
2.  **Types**: Generates a Discriminated Union of all tools in the list.

**Example**:
```typescript
const myTools = tools([
    {
        name: "readFile",
        description: "Read from disk",
        args: { path: "string" }
    }
], "File System Access");
```

### 3.2 `components(defs: ComponentDef[], description?: string)`

**Purpose**: Defines a set of Frontend/GenUI components.
**Effect**:
1.  **Protocol**: Generates a YAML structure where `component` is the discriminator and `props` holds the arguments.
2.  **Types**: Generates a Discriminated Union of component descriptors.

**Difference from Tools**:
-   Tools use `type` / `args`.
-   Components use `component` / `props`.
This semantic distinction helps the LLM separate "Actions" from "Visuals".

### 3.3 `schema(structure: any, description?: string)`

**Purpose**: Defines a raw, arbitrary data structure.
**Use Case**:
-   Generating connection plans.
-   Generating structured summaries.
-   Extracting data.

**Example**:
```typescript
const planSchema = schema({
    steps: [
        { id: "number", action: "string" }
    ]
}, "A linear execution plan");
```

---

## 4. The Argument DSL (Type System)

Auwgent replaces JSON Schema with a "String DSL". This DSL is parsed by TypeScript at compile-time to generate types.

### 4.1 Primitive Types

| DSL String | TypeScript Type | Description |
| :--- | :--- | :--- |
| `"string"` | `string` | Any text. |
| `"number"` | `number` | Integers or Floats. |
| `"boolean"` | `boolean` | `true` or `false`. |
| `"object"` | `Record<string, any>` | A generic JSON object (use sparingly). |

### 4.2 Literal Types (Specific Strings)

If you use `as const` (which the builders do for you), literal strings are preserved.
-   `name: "search"` -> Type is `"search"`, not `string`.

### 4.3 Literal Unions (The Power Feature)

You can define a union of strings using the pipe `|` character.

**Syntax**: `"OptionA | OptionB | OptionC"`
**TS Type**: `'OptionA' | 'OptionB' | 'OptionC'`
**LLM Instruction**: "Must be one of: OptionA, OptionB, OptionC"

**Deep Dive Example**:
```typescript
args: {
    // LLM creates a NEW status
    status: "Pending | Active | Done",
    
    // LLM selects from EXISTING modes
    mode: "fast | accurate"
}
```

In your code:
```typescript
// payload.args.status is STRICTLY typed
if (payload.args.status === 'Active') { ... } 
```
If you typo `'Activ'`, TypeScript will scream at you. This is "Compile-Time Safety for AI".

### 4.4 Arrays

Currently, arrays are defined by wrapping the type in a real array:
```typescript
tags: ["string"]       // string[]
scores: ["number"]     // number[]
states: ["A | B"]      // ('A' | 'B')[]
```

---

## 5. The Variable System (`Mustache`)

Auwgent uses a logic-less Mustache syntax for variable interpolation.

### 5.1 Basic Interpolation
Anywhere in your strings (Instructions, Descriptions, Context), you can use `{{key}}`.

```typescript
instructions: "Hello {{username}}, welcome to {{app_name}}."
```

### 5.2 Runtime Compilation
Variables are resolved when you call `compilePrompt`.

```typescript
const prompt = compilePrompt(agentDef, {
    username: "Alice",
    app_name: "SuperBot"
});
```

### 5.3 Missing Variables behavior
If you reference `{{foo}}` but do not provide `foo` in the context:
-   **It does NOT crash.**
-   **It preserves the tag.** The output will literally contain `{{foo}}`.
-   **Why?** Sometimes you want to compile "partial prompts" and fill in the rest later, or let the LLM see the placeholder.

### 5.4 The `sections` Property
The `PromptDef` has a special `sections` property for "Big Context".

```typescript
sections: {
    "RAG Results": "{{rag_content}}",
    "Conversation History": "{{chat_history}}"
}
```
**Algorithm**:
1.  Compiler iterates over keys.
2.  Interpolates the values.
3.  Injects them into the `# CONTEXT` header section of the final prompt.
4.  Standardizes the format: `### Key\nValue`.

---

## 6. The Compilation Process (Internals)

What actually happens when you call `compilePrompt`?

1.  **Header Generation**:
    -   The `instructions` are cleaned and interpolated.
    -   Added under `# SYSTEM`.

2.  **Tool Documentation**:
    -   Iterates all `tools()` definitions.
    -   Formats them as bullet points: `- name(arg: type)`.
    -   Injects descriptions.
    -   Added under `# TOOLS`.

3.  **Component Documentation**:
    -   Iterates all `components()` definitions.
    -   Formats them as JSX-like signatures: `- <Name prop=type />`.
    -   Added under `# UI COMPONENTS`.

4.  **Context Injection**:
    -   Iterates `sections`.
    -   Added under `# CONTEXT`.

5.  **Protocol Generation (The Critical Step)**:
    -   The compiler translates your Intents into the **Exact YAML Schema** the parser expects.
    -   It tells the LLM: *"Output a YAML object with ONE of these keys..."*
    -   This is the "Contract" that binds the LLM to the Parser.

---

## 7. Deep Dive: Type Inference

The helper type `InferPromptDoc<T>` is what makes Auwgent unique.

```typescript
export type InferPromptDoc<P extends PromptDef> = {
    [K in keyof P['intents']]?: InferIntent<P['intents'][K]>
} & (P['output'] extends Record<string, any> ? P['output'] : {});
```

### How it works
1.  It maps over the keys of your `intents` object (`sys_cmd`, `ui_render`).
2.  It looks at the `kind` of the intent (`tools`, `components`, `schema`).
3.  It descends into the `value`.
4.  It converts the DSL strings (`"string"`, `"number"`) into TS types.
5.  It constructs a **Discriminated Union** for tools/components.

**Result**: A type that perfectly mirrors the runtime behavior of the Parser.

---

## 8. Prompt Engineering Patterns

Using Auwgent effectively requires a shift in mindset.

### Pattern 1: The "Router" Agent
An agent designed solely to decide "Who handles this?".

```typescript
intents: {
    route: tools([
        { name: "handover_to_sales", args: { ... } },
        { name: "handover_to_support", args: { ... } }
    ])
}
```

### Pattern 2: The "Reactor" Agent
An agent that mostly talks but occasionally triggers UI.

```typescript
intents: {
    // Only one intent for UI
    render: components([ ... ])
}
// Instructions emphasize "Being a conversational partner"
```

### Pattern 3: The "Thinker" Agent
An agent that must plan before acting.

```typescript
intents: {
    plan: schema({
        reasoning: "string",
        steps: ["string"]
    }, "ALWAYS output this first!"),
    
    act: tools([ ... ])
}
```

---

## 9. Troubleshooting & FAQ

### Q: Can I nest tools inside tools?
**A**: No. Tool calls are atomic. However, you can use `schema()` to define arbitrary nested structures if you need complex input objects (e.g. a `FilterConfig` object).

### Q: Why is my type `never`?
**A**: You likely forgot `as const` when defining your array, or you are using a DSL string that isn't supported (e.g. `"float"` instead of `"number"`).

### Q: Can I use standard JSON Schema?
**A**: Not directly in the DSL. The DSL is designed to be lighter and more LLM-friendly. "Token Efficient".

### Q: What if the LLM hallucinates a tool?
**A**: The Parser will parse it as a generic object. However, your `onIntent` handler receives the typed union. If you check `payload.type` and it's not in your union, TypeScript considers it valid (because it came from the network), but runtime validation logic (if you add `zod` etc) would fail.
*Note: We are adding runtime validation middleware in v2.*

### Q: Does this support streaming arguments?
**A**: Yes! The underlying parser supports `onIntentPartial`. Because the structure is defined, the parser knows exactly when `args` are being streamed and can provide partial updates.

---

## 10. Comparison with Other Approaches

| Feature | Raw String Prompt | Zod / JSON Schema | Auwgent Functional |
| :--- | :--- | :--- | :--- |
| **Type Safety** | ❌ None | ✅ Good | ✅ Excellent (Inferred) |
| **Maintainability** | ❌ Low | 🔸 Medium | ✅ High (Zero Dupe) |
| **LLM Output** | ❌ Unstructured | 🔸 Standard JSON | ✅ Optimized YAML |
| **Streaming** | ❌ Hard | ❌ Hard (JSON) | ✅ Native (YAML-Lite) |
| **Intent Architecture** | ❌ None | ❌ Flat | ✅ Built-in |

---

## 11. Conclusion

The Auwgent Functional Prompt Engine is the result of learnings from building large-scale agentic systems. By treating prompts as **Code**, we gain the safety, refactoring tools, and reliability of software engineering, applied to the probabilistic world of AI.

Start by defining your prompt. Let the engine handle the rest.
