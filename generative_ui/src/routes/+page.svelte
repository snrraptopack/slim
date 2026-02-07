<script lang="ts">
    import { ChatStore } from "$lib/stores/chat.svelte";
    import DynamicRenderer from "$lib/gen-ui/DynamicRenderer.svelte";
    import { onMount } from "svelte";

    // Init Store
    const chat = new ChatStore();
    let text = $state("");
    let messagesEnd: HTMLDivElement;

    // Scroll to bottom effect
    $effect(() => {
        if (chat.messages.length) {
            messagesEnd?.scrollIntoView({ behavior: "smooth" });
        }
    });

    function handleSubmit() {
        if (!text.trim()) return;
        chat.sendMessage(text);
        text = "";
    }
</script>

<div class="flex flex-col h-screen max-w-4xl mx-auto p-4 md:p-8 font-inter">
    <!-- Header -->
    <header class="mb-8 text-center space-y-2">
        <h1
            class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400"
        >
            CyberOps AI
        </h1>
        <p class="text-zinc-500 font-mono text-sm tracking-wide">
            GENERATIVE UI DEMO // POWERED BY SLIM
        </p>
    </header>

    <!-- Message List -->
    <div class="flex-1 overflow-y-auto mb-6 space-y-6 pr-2 custom-scrollbar">
        {#each chat.messages as msg}
            <div
                class="flex flex-col gap-2 {msg.role === 'user'
                    ? 'items-end'
                    : 'items-start'}"
            >
                <!-- Avatar / Label -->
                <span class="text-xs uppercase font-mono text-zinc-600 mb-1">
                    {msg.role === "user" ? "YOU" : "SYSTEM"}
                </span>

                {#if msg.content}
                    <div
                        class="px-4 py-2 rounded-2xl max-w-lg shadow-sm
                        {msg.role === 'user'
                            ? 'bg-zinc-800 text-zinc-100 rounded-tr-none'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-none'}"
                    >
                        {msg.content}
                    </div>
                {/if}

                <!-- Generative UI Components -->
                {#if msg.components}
                    {#each msg.components as compData}
                        <div class="w-full max-w-2xl mt-2">
                            <DynamicRenderer data={compData} />
                        </div>
                    {/each}
                {/if}
            </div>
        {/each}

        <div bind:this={messagesEnd}></div>
    </div>

    <!-- Input Area -->
    <form
        onsubmit={(e) => {
            e.preventDefault();
            handleSubmit();
        }}
        class="relative group"
    >
        <input
            bind:value={text}
            placeholder="Command system (e.g. 'Show status', 'Deploy app')..."
            class="w-full bg-zinc-900/50 border border-zinc-800 rounded-full px-6 py-4
                   text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50
                   focus:ring-1 focus:ring-emerald-500/50 transition-all shadow-lg backdrop-blur"
            disabled={chat.isStreaming}
        />

        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button
            type="submit"
            class="absolute right-2 top-2 p-2 bg-emerald-600 hover:bg-emerald-500 text-white
                       rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!text.trim() || chat.isStreaming}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg
            >
        </button>
    </form>
</div>

<style>
    :global(body) {
        background-color: #09090b; /* zinc-950 */
    }
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #27272a;
        border-radius: 3px;
    }
</style>
