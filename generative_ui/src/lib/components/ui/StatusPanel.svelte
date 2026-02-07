<script lang="ts">
    /**
     * @component StatusPanel
     * @description A high-tech dashboard grid showing system metrics.
     */

    interface Metric {
        name: string;
        value: string;
        trend: "up" | "down" | "neutral";
        delta?: string;
    }

    let { metrics = [] }: { metrics: Metric[] } = $props();
</script>

<div
    class="grid grid-cols-2 gap-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg backdrop-blur-sm shadow-xl font-mono"
>
    {#each metrics as m}
        <div
            class="flex flex-col p-3 bg-zinc-950 border border-zinc-800/80 rounded group hover:border-zinc-700 transition-colors"
        >
            <span class="text-xs text-zinc-500 uppercase tracking-wider mb-1"
                >{m.name}</span
            >
            <div class="flex items-end justify-between">
                <span class="text-2xl font-bold text-zinc-100">{m.value}</span>
                {#if m.trend === "up"}
                    <span
                        class="text-emerald-500 text-xs mb-1 flex items-center gap-1"
                    >
                        ▲ {m.delta || ""}
                    </span>
                {:else if m.trend === "down"}
                    <span
                        class="text-rose-500 text-xs mb-1 flex items-center gap-1"
                    >
                        ▼ {m.delta || ""}
                    </span>
                {:else}
                    <span class="text-zinc-500 text-xs mb-1">-</span>
                {/if}
            </div>
            <!-- Decorative line -->
            <div class="w-full h-0.5 mt-2 bg-zinc-900 overflow-hidden relative">
                <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-700 to-transparent w-1/2 animate-pulse"
                ></div>
            </div>
        </div>
    {/each}
</div>
