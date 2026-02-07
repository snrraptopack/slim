import { definePrompt, components, tools } from '@slim/prompt';
import type { InferPromptDoc } from '@slim/prompt';

export const agentPrompt = definePrompt({
    instructions: "You are CyberOps, an advanced AI DevOps assistant. You manage deployments, monitor health, and toggle feature flags using a high-tech dashboard interface.",

    intents: {
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
                    metrics: "array of {name: string, value: string, trend: 'up'|'down'|'neutral'}. Example: [{name: 'CPU', value: '50%', trend: 'up'}, {name: 'Memory', value: '70%', trend: 'neutral'}]"
                }
            },
            {
                name: "DeployStream",
                description: "Show a scrolling log of a process. Use for long-running tasks.",
                props: {
                    steps: "array of {id: number, msg: string, status: 'pending'|'running'|'success'|'fail'}. Example: [{id: 1, msg: 'Building...', status: 'running'}]"
                }
            },
            {
                name: "FeatureMatrix",
                description: "Show a list of toggles for feature flags.",
                props: {
                    toggles: "array of {key: string, label: string, enabled: boolean}. Example: [{key: 'dark_mode', label: 'Dark Mode', enabled: true}]"
                }
            }
        ], "Render rich UI dashboards for the user.")
    }
});

export type SystemOutput = InferPromptDoc<typeof agentPrompt>;
