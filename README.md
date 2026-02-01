
---

## ✨ Structured Output Format (YAML-Lite)

Auwgent uses a **deterministic, streaming-friendly YAML subset** as the **model-facing structured output format**, which is then **parsed and compiled into a canonical JSON IR** for execution.

This design is intentional and unlocks:

* Streaming execution (tool calls mid-generation)
* Deterministic agent behavior
* Cross-language runtime parity
* Middleware hooks during parsing
* Generative UI composition with identity & references

> **Important:** This is **not full YAML**.
> It is a **restricted, explicit, agent-oriented language** designed for reliability and portability.

---

## Why YAML (and not JSON)?

* Large Language Models are **more reliable at emitting YAML**
* Indentation provides **natural streaming boundaries**
* Fewer syntax failures during generation
* Human-readable for debugging, audits, and teaching

Internally, all YAML is converted into **validated JSON IR** before execution.

---

## Supported YAML Features

### ✅ Core Structure

* Indentation-based blocks (spaces only, fixed indent)
* Mappings (`key: value`)
* Sequences (`- item`)
* Scalars (strings, numbers, booleans, null)
* Single-line quoted strings
* Comments (`#`)
* Empty blocks auto-initialized (`args:` → `{}`)

### ✅ Partial & Streaming Documents

* Incomplete documents are accepted
* Open blocks are auto-closed
* Execution can begin **before generation finishes**

This enables **low-latency agent execution** and live UI updates.

---

## Explicit References (Generative UI)

Auwgent supports **explicit identity and references** for generative UI composition.

```yaml
component:
  id: header
  type: Text
  props:
    value: "Hello"

component:
  id: page
  type: Column
  children:
    - ref: header
```

### Reference model

* `id` defines identity
* `ref` references an existing or forward-declared node
* References are resolved **after parsing**, never during parsing
* Supports forward references and scoped resolution

This enables:

* Incremental UI composition
* Shared identity (not copy-paste)
* Reactive updates and reuse

> YAML anchors (`&` / `*`) are **intentionally not supported**.

---

## Agent Intent Example

```yaml
intent:
  type: tool_call
  name: search
  args:
    query: "middleware agent frameworks"
```

The intent becomes executable as soon as its block is complete —
Auwgent does **not** wait for the full response.

---

## Explicitly Unsupported YAML Features

To guarantee determinism and streaming safety, the following are **not supported**:

* Anchors & aliases (`&`, `*`)
* Flow style (`{}`, `[]`)
* Multiline scalars (`|`, `>`)
* Tags (`!!type`)
* Multiple documents (`---`)
* Implicit or magic references

---

## Design Philosophy

> **YAML is only the surface syntax.
> The JSON IR is the contract.**

By separating:

* **Model output**
* **Parsing**
* **Validation**
* **Execution**

Auwgent behaves more like a **language runtime** than a prompt wrapper.

---

