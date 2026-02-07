<script lang="ts">
    /**
     * @component FeatureMatrix
     * @description Interactive toggle matrix for system features.
     */

    interface Toggle {
        key: string;
        label: string;
        enabled: boolean;
        desc?: string;
    }

    let { toggles = [] }: { toggles: Toggle[] } = $props();
</script>

<div
    class="grid grid-cols-1 gap-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
>
    <!-- Header -->
    <div
        class="bg-zinc-950 p-3 border-b border-zinc-800 flex justify-between items-center"
    >
        <span class="text-zinc-400 text-xs font-mono uppercase tracking-widest"
            >System Configuration</span
        >
        <div class="flex gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-zinc-700"></div>
        </div>
    </div>

    <!-- Toggles -->
    {#each toggles as toggle}
        <div
            class="flex items-center justify-between p-4 bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors border-b last:border-0 border-zinc-800/50 group"
        >
            <div class="flex flex-col">
                <span
                    class="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors"
                >
                    {toggle.label}
                </span>
                {#if toggle.desc}
                    <span class="text-xs text-zinc-500">{toggle.desc}</span>
                {/if}
            </div>

            <!-- Cyber Switch -->
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
                class="relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                class:bg-blue-600={toggle.enabled}
                class:shadow-[0_0_10px_rgba(37,99,235,0.4)]={toggle.enabled}
                class:bg-zinc-700={!toggle.enabled}
                aria-pressed={toggle.enabled}
            >
                <span
                    class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-sm"
                    class:translate-x-5={toggle.enabled}
                    class:translate-x-0={!toggle.enabled}
                >
                </span>
            </button>
        </div>
    {/each}
</div>
