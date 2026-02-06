# YAML-Lite Prompt Guide for LLM Agents

## System Prompt Template

```
You are an AI agent. Respond ONLY in YAML-Lite format.

## Available Tools
- search(query: str, top_k?: int)
- fetch_incident(id: str)
- summarize(text: str, max_length?: int)

## Available Workflows  
- gather_context(id: str)
- incident_review(id: str, priority?: str)

## Output Schema
text: <your response to the user>
parallel: <true if intents should run in parallel>
intent:
  type: tool_call | workflow | respond | question
  name: <tool or workflow name>
  args: { key: value }
intents:
  - type: <type>
    name: <name>
    args: { key: value }
question: <follow-up question if needed>

## Examples

Plain response:
text: Here is what I found.

Tool call:
text: Let me search for that.
intent:
  type: tool_call
  name: search
  args: { query: "latest news", top_k: 5 }

Multiple parallel calls:
text: Running both searches.
parallel: true
intents:
  - type: tool_call
    name: search
    args: { query: "incidents" }
  - type: tool_call
    name: fetch_incident
    args: { id: "INC-123" }

Be concise. Output YAML only.
```

---

## Output Style Examples

### 1. Plain Response
```yaml
text: Here is the summary you requested.
```

### 2. Single Tool Call
```yaml
text: I'll look that up now.
intent:
  type: tool_call
  name: search
  args: { query: "latest incident report" }
```

### 3. Single Workflow
```yaml
text: Pulling incident context.
intent:
  type: workflow
  name: gather_context
  args: { id: "INC-123" }
```

### 4. Multiple Intents (Serial)
```yaml
text: I'll fetch context then summarize.
intents:
  - type: workflow
    name: gather_context
    args: { id: "INC-123" }
  - type: tool_call
    name: summarize_history
    args: { id: "INC-123", limit: 3 }
```

### 5. Multiple Intents (Parallel)
```yaml
text: Running both in parallel.
parallel: true
intents:
  - type: tool_call
    name: fetch_incident
    args: { id: "INC-123" }
  - type: tool_call
    name: summarize_history
    args: { id: "INC-123", limit: 3 }
```

### 6. Question + Tool Call
```yaml
text: I can proceed after one detail.
question: Which environment is affected?
intent:
  type: tool_call
  name: fetch_incident
  args: { id: "INC-123" }
```

### 7. Workflow Plan with Steps
```yaml
text: Here is my plan.
workflow:
  name: incident_review
  steps:
    - intent:
        type: tool_call
        name: fetch_incident
        args: { id: "INC-123" }
    - intent:
        type: tool_call
        name: summarize_history
        args: { id: "INC-123", limit: 3 }
    - intent:
        type: respond
        message: Summary is ready.
```

---

## Compact Prompt (Token-Efficient)

```
System: You are an agent. Output YAML-Lite only.

Tools: search(q,k) | fetch_incident(id) | summarize(text,len)
Workflows: gather_context(id) | incident_review(id,priority)

Schema:
text: str
parallel: bool
intent: {type: tool_call|workflow|respond|question, name: str, args: {...}}
intents: [intent, ...]
question: str

Example:
text: Searching now.
intent:
  type: tool_call
  name: search
  args: { query: "news", top_k: 5 }

Be concise.
```

---

## Parser Notes

**Supported:**
- Inline flow objects: `{ key: "value", count: 5 }`
- Inline arrays: `[1, 2, "three"]`
- Multiline strings: `|` syntax
- Type coercion: numbers, booleans, null
- References: `id:` / `ref:`

**Not Supported:**
- YAML anchors/aliases (`&`, `*`)
- Tags (`!!timestamp`)
- Multiple documents (`---`)

**Noise Handling:**
Use `extractYAML()` to strip LLM preambles ("Sure!", "Here you go:") and code fences before parsing.
