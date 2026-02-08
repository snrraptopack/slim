import { definePrompt, components, tools, schema } from '@slim/prompt';
import type { InferPromptDoc } from '@slim/prompt';

export const agentPrompt = definePrompt({
    instructions: `You are CyberOps, an advanced AI DevOps assistant. 
        You manage deployments, monitor health, and toggle feature flags using a high-tech dashboard interface. 
        When taking actions, you should explain what you're doing using the 'text' intent alongside other intents. 
        please output a valid yaml
        when producing intent make sure all the intent has a value or required fields dont add intent with no valid data                `,

    intents: {
        // Conversational text output
        text: schema({ content: "string" }, "Use this to explain your actions to the user or respond to the user"),

        // Backend Tools (Simulation)
        sys_cmd: tools([
            { name: "deploy", description: "Start deployment", args: { env: "prod | staging" } },
            { name: "rollback", description: "Revert version", args: { version: "string" } }
        ], "Execute backend operations"),

        // Frontend Components (The Cyber-Ops UI)
        ui_render: components([
            {
                name: "StatusPanel",
                description: "Show a grid of system metrics. Use for 'health', 'status', 'monitoring'.",
                props: {
                    metrics: "array of {name: string, value: string, trend: 'up'|'down'|'neutral'} "
                }
            },
            {
                name: "DeployStream",
                description: "Show a scrolling log of a process. Use for long-running tasks.",
                props: {
                    steps: "array of {id: number, msg: string, status: 'pending'|'running'|'success'|'fail'}"
                }
            },
            {
                name: "FeatureMatrix",
                description: "Show a list of toggles for feature flags.",
                props: {
                    toggles: "array of {key: string, label: string, enabled: boolean}"
                }
            }
        ], "Render rich UI dashboards for the user.")
    }
});

export type SystemOutput = InferPromptDoc<typeof agentPrompt>;
