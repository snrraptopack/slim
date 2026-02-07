<script lang="ts" module>
    export interface GenUIComponent {
        component: string;
        props: Record<string, any>;
        children?: GenUIComponent[];
    }
</script>

<script lang="ts">
    import { COMPONENT_MAP } from "./registry";
    import Self from "./DynamicRenderer.svelte";

    /**
     * @component DynamicRenderer
     * @description The engine that turns JSON into UI. Supports recursion via 'children' prop.
     */

    let { data }: { data: GenUIComponent } = $props();

    // specific hack for partial streaming:
    // sometimes 'component' is undefined if the stream just started
    let Component = $derived(
        data?.component ? COMPONENT_MAP[data.component] : null,
    );

    $effect(() => {
        console.log("DynamicRenderer Data:", $state.snapshot(data));
        console.log("Resolved Component:", Component);
    });
</script>

{#if Component}
    <div class="gen-ui-wrapper animate-in fade-in zoom-in-95 duration-300">
        <!--
            Magic: Spread props directly to the component.
            If the component expects 'metrics', and data.props has 'metrics', it just works.
        -->
        <!-- svelte-ignore svelte_component_deprecated -->
        <svelte:component this={Component} {...data.props}>
            <!-- Recursive Slot Rendering -->
            {#if data.children && Array.isArray(data.children)}
                {#each data.children as child, i}
                    <Self data={child} />
                {/each}
            {/if}
        </svelte:component>
    </div>
{:else if data?.component}
    <!-- Fallback for unknown components -->
    <div
        class="p-4 border border-red-500/50 bg-red-500/10 text-red-500 rounded font-mono text-xs"
    >
        [UNKNOWN COMPONENT: {data.component}]
    </div>
{/if}
