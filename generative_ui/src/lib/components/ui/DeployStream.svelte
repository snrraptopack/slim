<script lang="ts">
    /**
     * @component DeployStream
     * @description A scrolling terminal-like log for deployment processes.
     */

    interface Step {
        id: number;
        msg: string;
        status: "pending" | "running" | "done" | "error";
    }

    let { steps: stepsRaw = [] }: { steps: Step[] } = $props();

    // Use $state as requested for explicit reactivity
    let steps = $state<Step[]>([]);

    $effect(() => {
        // Sync state with props
        steps = stepsRaw;
        console.log("[DeployStream] Steps sync:", steps.length);
    });
</script>

<div
    class="flex flex-col gap-1 p-4 bg-black border border-zinc-800 rounded-lg font-mono text-sm text-zinc-200 max-h-[300px] overflow-y-auto custom-scrollbar shadow-inner"
>
    {#each steps as step}
        <div
            class="flex items-center gap-3 p-2 rounded hover:bg-zinc-900/50 transition-colors"
        >
            <!-- Icon Status -->
            <div class="w-4 flex justify-center">
                {#if step.status === "done"}
                    <div
                        class="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    ></div>
                {:else if step.status === "error"}
                    <div class="w-2 h-2 bg-rose-500 rounded-sm"></div>
                {:else if step.status === "running"}
                    <div
                        class="w-2 h-2 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin"
                    ></div>
                {:else}
                    <div class="w-2 h-2 bg-zinc-800 rounded-full"></div>
                {/if}
            </div>

            <!-- Message -->
            <span
                class:text-zinc-500={step.status === "pending"}
                class:text-zinc-300={step.status === "running"}
                class:text-emerald-400={step.status === "done"}
                class:text-rose-400={step.status === "error"}
            >
                {step.msg}
            </span>

            <!-- Time (Simulated) -->
            {#if step.status === "done"}
                <span
                    class="ml-auto text-xs text-zinc-700 opacity-0 animate-fade-in"
                    >[OK]</span
                >
            {/if}
        </div>
    {/each}
    {#if steps.length === 0}
        <div class="text-zinc-700 italic px-2">Waiting for stream...</div>
    {/if}
</div>

<style>
    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    .animate-fade-in {
        animation: fade-in 0.5s forwards;
    }

    /* Custom Scrollbar for Terminals */
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: #09090b;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #27272a;
        border-radius: 3px;
    }
</style>
