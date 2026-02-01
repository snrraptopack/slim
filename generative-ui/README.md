# YAML-Lite Generative UI Documentation

## Overview

This system enables LLMs to generate structured UI definitions using YAML-Lite syntax. The output is parsed into JSON suitable for rendering with any UI framework (React, Svelte, Vue, etc.).

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   LLM       │ ──▶ │  YAML-Lite   │ ──▶ │   Parser    │ ──▶ │  Component   │
│  (Gemini)   │     │   Output     │     │  (AST→IR)   │     │  Renderer    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

---

## Reserved Property Names

⚠️ **CRITICAL**: These property names have special meaning and should NOT be reused:

| Property | Reserved For | Alternative Name |
|----------|--------------|------------------|
| `type` | Component type (e.g., `Button`, `Card`) | Use `kind`, `inputType`, `chartType` |
| `id` | Registry registration for refs | Use `componentId`, `elementId` |
| `ref` | Reference to registered component | Use `reference`, `link` |
| `children` | Nested child components | Use `items`, `content` for non-UI |

### Example of Naming Collision

**❌ WRONG** - `type` prop conflicts with component type:
```yaml
- type: Chart
  type: line       # ← Overwrites "Chart" with "line"!
```

**✅ CORRECT** - Use `kind` for chart style:
```yaml
- type: Chart
  kind: line       # ← No conflict
```

---

## Component Definitions

### Naming Convention

Use `kind`, `inputType`, `variant`, or descriptive names instead of `type` for props.

```yaml
COMPONENTS:
  # Layout
  Card: {title?, subtitle?, elevation?: 0-4, padding?: num}
  Grid: {columns: num, gap?: num}
  Stack: {direction: row|column, gap?: num, align?: start|center|end}
  
  # Content
  Text: {content: str, variant?: h1|h2|h3|body|caption}
  Image: {src: str, alt?: str, width?: num, height?: num}
  Icon: {name: str, size?: num, color?: str}
  Divider: {thickness?: num, color?: str}
  Spacer: {height?: num, width?: num}
  
  # Data Display
  Chart: {kind: line|bar|pie, data: {labels: str[], values: num[]}}
  Table: {columns: str[], rows: any[][]}
  List: {items: str[], ordered?: bool}
  
  # Inputs
  Input: {name: str, inputType?: text|number|email|password, label?, placeholder?, required?}
  Select: {name: str, options: str[], label?, required?}
  Button: {label: str, action?: str, variant?: primary|secondary|danger}
  Form: {submitAction: str, children: [...]}
```

---

## ID/Ref System

### Registering Components

Any object with an `id` property gets registered in the parser's registry:

```yaml
components:
  - id: btn_primary     # ← Registered as "btn_primary"
    type: Button
    label: Submit
    variant: primary
```

### Referencing Components

Use `ref: id` to inline the registered component:

```yaml
ui:
  type: Card
  children:
    - ref: btn_primary  # ← Resolved to full Button definition
```

### Auto-Resolution in Arrays

Strings in arrays that match registry IDs are auto-resolved:

```yaml
children:
  - btn_primary         # ← Auto-resolved (no ref: needed)
  - other_component
```

---

## Children Arrays

### Valid Patterns

```yaml
children:
  # 1. Reference (for reusable components)
  - ref: header_component
  
  # 2. String ID (auto-resolved if in registry)
  - btn_primary
  
  # 3. Inline definition (for one-off components)
  - type: Text
    content: Hello World
    variant: body
```

### Mixing Refs and Inline

```yaml
children:
  - ref: icon_star          # Reference
  - type: Text              # Inline
    content: Welcome
  - type: Spacer            # Inline
    height: 16
  - ref: action_buttons     # Reference
```

---

## Inline JSON Values

The parser supports inline JSON arrays and objects:

```yaml
data:
  labels: ["Jan", "Feb", "Mar", "Apr"]    # ← Parsed as array
  values: [100, 150, 120, 180]            # ← Parsed as array
  config: {"enabled": true}               # ← Parsed as object
```

---

## Prompt Template

### Full System Prompt

```
YAML UI generator.

PATTERNS:
- id: name → registers object
- ref: name → inlines registered object  
- type: X + props → inline component

CHILDREN (mix refs + inline):
  children:
    - ref: btn_id           # reusable
    - type: Text            # one-off
      content: Hello

COMPONENTS:
  Card: {title?, subtitle?, elevation?: 0-4, padding?: num}
  Grid: {columns: num, gap?: num}
  Stack: {direction: row|column, gap?: num, align?: start|center|end}
  Text: {content: str, variant?: h1|h2|h3|body|caption}
  Button: {label: str, action?: str, variant?: primary|secondary|danger}
  Icon: {name: str, size?: num, color?: str}
  Image: {src: str, alt?: str, width?: num, height?: num}
  Input: {name: str, inputType?: text|number|email|password, label?, placeholder?, required?}
  Select: {name: str, options: str[], label?, required?}
  Form: {submitAction: str, children: [...]}
  Chart: {kind: line|bar|pie, data: {labels: str[], values: num[]}}
  Table: {columns: str[], rows: any[][]}
  List: {items: str[], ordered?}
  Divider: {thickness?, color?}
  Spacer: {height?, width?}

OUTPUT: YAML only. No fences. No explanation.
```

---

## Common Gotchas

### 1. Property Name Collisions

| Component | Problematic | Fixed |
|-----------|-------------|-------|
| Chart | `type: line` | `kind: line` |
| Input | `type: email` | `inputType: email` |

### 2. Code Fences in Output

LLMs often wrap output in ` ```yaml `. Strip them before parsing:

```typescript
function stripCodeFences(text: string): string {
    return text
        .replace(/^```(?:yaml|yml)?\s*\n?/gm, '')
        .replace(/\n?```\s*$/gm, '')
        .trim();
}
```

### 3. Inline Arrays Need Quotes

```yaml
# ❌ May fail
labels: [Jan, Feb, Mar]

# ✅ Works
labels: ["Jan", "Feb", "Mar"]
```

### 4. Children as Object vs Array

```yaml
# ✅ Multiple children = array
children:
  - type: Text
  - type: Button

# ⚠️ Single child can become object if not careful
children:
  - type: Text    # Keep the dash!
```

---

## Token Efficiency

| Format | Approximate Tokens | Notes |
|--------|-------------------|-------|
| JSON Schema (function calling) | 400+ | Verbose, includes metadata |
| YAML-Lite | ~160 | 60% fewer tokens |
| Compact prompt | ~400 | System prompt overhead |

**Cost savings**: At $0.075/1M tokens (Flash-Lite), YAML-Lite saves ~$45K annually at 1M requests/day.

---

## File Structure

```
slim/
├── src/
│   ├── tokenizer.ts    # Lexical analysis
│   ├── parser.ts       # AST generation
│   ├── ir-builder.ts   # JSON IR with ref resolution
│   └── index.ts        # Public API
├── generative-ui/
│   ├── key.ts          # API key config
│   └── test.ts         # Test runner
├── PROMPT.txt          # Compact system prompt
└── README.md
```

---

## Next Steps

1. **Build Component Renderer** - Map parsed JSON to React/Svelte components
2. **Add Action Handlers** - Handle button clicks, form submissions
3. **Stream Progressive UI** - Render components as they're parsed
4. **Test with Flash-Lite** - Verify works on models without function calling
