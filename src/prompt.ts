/**
 * AUWGENT Functional Prompt Engine
 * 
 * A pure-functional toolkit for building LLM system prompts.
 * FOCUS: Intent-First Architecture.
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface PromptDef<TIntents extends Record<string, IntentDef> = Record<string, IntentDef>> {
    instructions: string;
    sections?: Record<string, string>;
    variables?: Record<string, any>;

    // The Core: Intents define the "Active capabilities"
    intents: TIntents;

    // Optional: Global output wrapper (e.g. if everything is inside a 'thought' block)
    output?: Record<string, any>;
}

export type IntentDef =
    | { kind: 'tools', value: readonly ToolDef[], description?: string }
    | { kind: 'components', value: readonly ComponentDef[], description?: string }
    | { kind: 'schema', value: any, description?: string };

export interface ToolDef {
    name: string;
    description: string;
    args: Record<string, string | object>;
}

export interface ComponentDef {
    name: string;
    description: string; // Critical for GenUI annotation
    props: Record<string, string | object>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE INFERENCE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extracts the Document shape from a Prompt Definition.
 * Returns { [IntentKey]: { type: ToolName, args: any } | ... }
 */
export type InferPromptDoc<P extends PromptDef> = {
    [K in keyof P['intents']]?: InferIntent<P['intents'][K]>
} & (P['output'] extends Record<string, any> ? P['output'] : {});

type InferIntent<I extends IntentDef> =
    I extends { kind: 'tools', value: readonly ToolDef[] } ? {
        type: I['value'][number]['name'];
        args: Record<string, any>; // Hard to infer exact args from string definitons without Zod
    } :
    I extends { kind: 'components', value: readonly ComponentDef[] } ? {
        component: I['value'][number]['name'];
        props: Record<string, any>;
    } :
    I extends { kind: 'schema', value: infer S } ? S : never;


// ═══════════════════════════════════════════════════════════════════════════
// BUILDER FUNCTIONS (The "Reasonable API")
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Define a set of Tools.
 */
export function tools<const T extends readonly ToolDef[]>(defs: T, desc?: string): { kind: 'tools', value: T, description?: string } {
    return { kind: 'tools', value: defs, description: desc };
}

/**
 * Define a set of GenUI Components.
 */
export function components<const T extends readonly ComponentDef[]>(defs: T, desc?: string): { kind: 'components', value: T, description?: string } {
    return { kind: 'components', value: defs, description: desc };
}

/**
 * Define a raw schema intent (for structured data that isn't a tool/component).
 */
export function schema<T>(def: T, desc?: string): { kind: 'schema', value: T, description?: string } {
    return { kind: 'schema', value: def, description: desc };
}

/**
 * Helper to define the prompt structure.
 * This function is pure and just returns the config object.
 */
export function definePrompt<const T extends PromptDef>(config: T): T {
    return config;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILER
// ═══════════════════════════════════════════════════════════════════════════

export function compilePrompt(def: PromptDef, vars: Record<string, any> = {}): string {
    const sections: string[] = [];
    const context = { ...(def.variables || {}), ...vars };

    // Helper: Simple moustache interpolation
    const interpolate = (text: string) => {
        return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
            const val = context[key.trim()];
            return val !== undefined ? String(val) : `{{${key}}}`; // Leave unmatched keys
        });
    };

    // 1. Instructions (System Persona)
    if (def.instructions) {
        sections.push(`# SYSTEM\n${interpolate(def.instructions)}`);
    }

    // 2. Capabilities (Tools & Components)
    // We categorize them clearly for the LLM
    const toolIntents: { key: string, tools: ToolDef[], description?: string }[] = [];
    const compIntents: { key: string, comps: ComponentDef[], description?: string }[] = [];

    for (const [key, intent] of Object.entries(def.intents)) {
        if (intent.kind === 'tools') {
            toolIntents.push({ key, tools: intent.value as ToolDef[], description: intent.description });
        }
        else if (intent.kind === 'components') {
            compIntents.push({ key, comps: intent.value as ComponentDef[], description: intent.description });
        }
    }

    // Render Tools Section
    if (toolIntents.length > 0) {
        const toolsDoc = toolIntents.map(t => {
            const list = t.tools.map(tool => {
                const args = Object.entries(tool.args)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(', ');
                return `- ${tool.name}(${args})\n  ${interpolate(tool.description)}`;
            }).join('\n');
            const desc = t.description ? `> ${interpolate(t.description)}\n` : '';
            return `## [${t.key}] Callable Tools\n${desc}${list}`;
        }).join('\n\n');

        sections.push(`# TOOLS\nThe following tools are available. \nIf the user question requires **outside knowledge** or **actions**, look here:\n\n${toolsDoc}`);
    }

    // Render Components Section
    if (compIntents.length > 0) {
        const compDoc = compIntents.map(c => {
            const list = c.comps.map(comp => {
                const props = Object.entries(comp.props)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(', ');
                return `- ${comp.name}(${props})\n  Usage: ${interpolate(comp.description)}`;
            }).join('\n');
            const desc = c.description ? `> ${interpolate(c.description)}\n` : '';
            return `## [${c.key}] UI Components\n${desc}${list}`;
        }).join('\n\n');

        sections.push(`# UI COMPONENTS\nThe following visual components are available.\nIf you are **responding to the user** and can visualize the answer, look here:\n\n${compDoc}`);
    }

    // 3. Context Sections
    if (def.sections) {
        const contextBlocks = Object.entries(def.sections)
            .map(([k, v]) => `### ${interpolate(k)}\n${interpolate(v)}`)
            .join('\n\n');
        sections.push(`# CONTEXT\n${contextBlocks}`);
    }

    // 4. The Protocol (Explicit YAML Schema)
    let protocol = `# PROTOCOL (YAML)\nOutput a valid YAML object with EXACTLY ONE of the following keys (do not mix them):`;

    // Option 1: Tools
    toolIntents.forEach(t => {
        const toolNames = t.tools.map(x => x.name).join(' | ');
        protocol += `\n\n# Option: System Command (Tools Only)\n`;
        protocol += `${t.key}:\n  - type: ${toolNames}\n    args: { ...matches signature... }`;
    });

    // Option 2: Components
    compIntents.forEach(c => {
        const compNames = c.comps.map(x => x.name).join(' | ');
        protocol += `\n\n# Option: UI Render (Frontend Only)\n`;
        protocol += `${c.key}:\n  component: ${compNames}\n  props: { ...matches signature... }`;
    });

    // Option 3: Other schema
    for (const [key, intent] of Object.entries(def.intents)) {
        if (intent.kind === 'schema') {
            const desc = intent.description ? ` (${interpolate(intent.description)})` : '';
            protocol += `\n\n# Option: ${key}${desc}\n${formatSchema({ [key]: intent.value }, 0)}`;
        }
    }

    sections.push(protocol);

    return sections.join('\n\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════

function formatTools(tools: ToolDef[]): string {
    return tools.map(t => {
        const args = Object.entries(t.args)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
        return `- ${t.name}(${args})\n  ${t.description || ''}`;
    }).join('\n');
}

function formatComponents(comps: ComponentDef[]): string {
    return comps.map(c => {
        const props = Object.entries(c.props)
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
        return `- <${c.name} />\n  Usage: ${c.description}\n  Props: { ${props} }`;
    }).join('\n');
}

const formatSchema = (obj: any, depth: number): string => {
    if (typeof obj === 'string') return obj;
    if (typeof obj !== 'object' || obj === null) return String(obj);

    const indent = '  '.repeat(depth);

    // Handle Array
    if (Array.isArray(obj)) {
        return obj.map((item, index) => {
            // For simple scalars in list
            if (typeof item !== 'object' || item === null) {
                return `${indent}- ${item}`;
            }
            // Heuristic: Format the item at depth 0, but prefix the first line with "- " 
            // and subsequent lines with "  "
            // The item itself will be indented relative to the DASH
            const itemStr = formatSchema(item, 0);
            const lines = itemStr.split('\n');
            const [first, ...rest] = lines;
            const restIndented = rest.map(l => `${indent}  ${l}`).join('\n');

            // Critical fix: The first line must be indented to match the parent
            // e.g. "  - key: val"
            const firstLine = `${indent}- ${first}`;

            return rest.length > 0
                ? `${firstLine}\n${restIndented}`
                : firstLine;
        }).join('\n');
    }

    // Handle Object
    return Object.entries(obj)
        .map(([k, v]) => {
            if (typeof v !== 'object' || v === null) return `${indent}${k}: ${v}`;
            // If v is array, we want:
            // key:
            //   - item
            if (Array.isArray(v)) {
                return `${indent}${k}:\n${formatSchema(v, depth + 1)}`;
            }
            // If v is object
            return `${indent}${k}:\n${formatSchema(v, depth + 1)}`;
        })
        .join('\n');
}
