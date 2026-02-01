<script lang="ts">
  import UIRenderer from "./lib/UIRenderer.svelte";
  import type { UIComponent } from "./lib/ui-types";
  import { createStreamingParser } from "./lib/parser/index";

  interface Message {
    role: "user" | "assistant";
    content: string;
    ui?: UIComponent;
    streaming?: boolean;
  }

  let prompt = $state("");
  let isLoading = $state(false);
  let messages = $state<Message[]>([]);
  let error = $state("");

  const API_KEY = "AIzaSyAEr1WOYe-UkqSif2cgD5muhHbbx2lOwfU";

  const SYSTEM_PROMPT = `YAML UI generator.

PATTERNS:
- id: name → registers object
- ref: name → inlines registered object  
- type: X + props → inline component

CHILDREN (mix refs + inline):
  children:
    - ref: btn_id
    - type: Text
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

OUTPUT: YAML only. No fences. No explanation.`;

  function stripCodeFences(text: string): string {
    return text
      .replace(/^```(?:yaml|yml)?\s*\n?/gm, "")
      .replace(/\n?```\s*$/gm, "")
      .trim();
  }

  async function sendMessage() {
    if (!prompt.trim() || isLoading) return;

    const userMessage = prompt.trim();
    prompt = "";

    messages = [...messages, { role: "user", content: userMessage }];
    const assistantIdx = messages.length;
    messages = [
      ...messages,
      { role: "assistant", content: "", streaming: true },
    ];

    isLoading = true;
    error = "";

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const streamParser = createStreamingParser();

      const stream = await ai.models.generateContentStream({
        model: "gemini-2.0-flash",
        contents: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          { role: "user", parts: [{ text: userMessage }] },
        ],
        config: { temperature: 0.3 },
      });

      let fullText = "";

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          const cleanText = stripCodeFences(fullText);
          streamParser.write(text);

          try {
            const currentUI = streamParser.peek() as UIComponent;
            messages[assistantIdx] = {
              role: "assistant",
              content: cleanText,
              ui:
                currentUI && Object.keys(currentUI).length > 0
                  ? currentUI
                  : undefined,
              streaming: true,
            };
            messages = [...messages];
          } catch {}
        }
      }

      const cleanYaml = stripCodeFences(fullText);
      const finalUI = streamParser.end() as UIComponent;

      messages[assistantIdx] = {
        role: "assistant",
        content: cleanYaml,
        ui: finalUI,
        streaming: false,
      };
      messages = [...messages];
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      messages = messages.slice(0, -1);
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    messages = [];
    error = "";
  }
</script>

<div class="container">
  {#if messages.length === 0}
    <!-- Welcome Screen -->
    <div class="welcome">
      <div class="welcome-header">
        <h1>✨ Generative UI</h1>
        <p>Describe any UI component and watch it build in real-time</p>
      </div>

      <div class="quick-prompts">
        <button
          onclick={() => {
            prompt = "Create a login form with email and password fields";
            sendMessage();
          }}
        >
          📝 Login Form
        </button>
        <button
          onclick={() => {
            prompt = "Show a stock dashboard for AAPL at $189.50 with a chart";
            sendMessage();
          }}
        >
          📊 Stock Dashboard
        </button>
        <button
          onclick={() => {
            prompt =
              "Create a user profile card for John Doe with avatar and edit button";
            sendMessage();
          }}
        >
          👤 Profile Card
        </button>
        <button
          onclick={() => {
            prompt = "Create a signup form with name, email, and password";
            sendMessage();
          }}
        >
          ✏️ Signup Form
        </button>
      </div>
    </div>
  {:else}
    <!-- Chat Messages -->
    <div class="chat-area">
      <button class="clear-btn" onclick={clearChat}>Clear Chat</button>

      {#each messages as msg}
        <div class="message {msg.role}">
          <div class="message-content">
            {#if msg.role === "user"}
              <div class="user-bubble">{msg.content}</div>
            {:else}
              <div class="assistant-response">
                {#if msg.ui}
                  <div class="ui-container" class:streaming={msg.streaming}>
                    <UIRenderer component={msg.ui} />
                    {#if msg.streaming}
                      <div class="streaming-badge">● Generating</div>
                    {/if}
                  </div>
                {:else if msg.streaming}
                  <div class="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                {/if}

                {#if !msg.streaming && msg.content}
                  <details class="yaml-source">
                    <summary>View YAML source</summary>
                    <pre>{msg.content}</pre>
                  </details>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if error}
        <div class="error-msg">{error}</div>
      {/if}
    </div>
  {/if}

  <!-- Input Bar -->
  <div class="input-container">
    <div class="input-wrapper">
      <input
        type="text"
        bind:value={prompt}
        onkeydown={handleKeydown}
        placeholder="Describe the UI you want to create..."
        disabled={isLoading}
      />
      <button
        class="send-btn"
        onclick={sendMessage}
        disabled={isLoading || !prompt.trim()}
      >
        {#if isLoading}
          <div class="spinner"></div>
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #212121;
    color: #ececec;
    overflow-x: hidden;
  }

  /* Hide scrollbar but keep functionality */
  :global(::-webkit-scrollbar) {
    width: 0;
    background: transparent;
  }
  :global(body) {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 900px;
    margin: 0 auto;
  }

  /* Welcome Screen */
  .welcome {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 40px 20px;
  }

  .welcome-header {
    text-align: center;
    margin-bottom: 48px;
  }

  .welcome-header h1 {
    font-size: 2.5rem;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .welcome-header p {
    font-size: 1.1rem;
    color: #8e8e8e;
  }

  .quick-prompts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    max-width: 600px;
    width: 100%;
  }

  .quick-prompts button {
    padding: 16px 20px;
    background: #2f2f2f;
    border: 1px solid #424242;
    border-radius: 12px;
    color: #d1d1d1;
    font-size: 0.95rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }

  .quick-prompts button:hover {
    background: #383838;
    border-color: #555;
  }

  /* Chat Area */
  .chat-area {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    padding-bottom: 100px;
  }

  .clear-btn {
    display: block;
    margin: 0 auto 24px;
    padding: 8px 16px;
    background: transparent;
    border: 1px solid #444;
    border-radius: 20px;
    color: #888;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .clear-btn:hover {
    border-color: #666;
    color: #aaa;
  }

  .message {
    margin-bottom: 32px;
  }

  .message.user .message-content {
    display: flex;
    justify-content: flex-end;
  }

  .user-bubble {
    max-width: 75%;
    padding: 14px 20px;
    background: #2f5ddb;
    border-radius: 24px 24px 6px 24px;
    font-size: 1rem;
    line-height: 1.5;
  }

  .assistant-response {
    max-width: 100%;
  }

  .ui-container {
    background: #ffffff;
    border-radius: 20px;
    padding: 28px;
    color: #1a1a1a;
    position: relative;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  }

  .ui-container.streaming {
    animation: pulse-glow 2s infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 2px 12px rgba(47, 93, 219, 0.3);
    }
    50% {
      box-shadow: 0 2px 20px rgba(47, 93, 219, 0.5);
    }
  }

  .streaming-badge {
    position: absolute;
    top: 12px;
    right: 16px;
    font-size: 0.7rem;
    color: #2f5ddb;
    font-weight: 500;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0.4;
    }
  }

  .typing-indicator {
    display: flex;
    gap: 6px;
    padding: 20px 28px;
    background: #2f2f2f;
    border-radius: 20px;
    width: fit-content;
  }

  .typing-indicator span {
    width: 10px;
    height: 10px;
    background: #666;
    border-radius: 50%;
    animation: typing 1.4s infinite both;
  }
  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%,
    80%,
    100% {
      transform: scale(0.8);
      opacity: 0.4;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .yaml-source {
    margin-top: 12px;
    font-size: 0.85rem;
  }

  .yaml-source summary {
    color: #888;
    cursor: pointer;
    padding: 6px 0;
  }

  .yaml-source pre {
    margin-top: 8px;
    padding: 16px;
    background: #1a1a1a;
    border-radius: 12px;
    overflow-x: auto;
    font-size: 0.8rem;
    line-height: 1.5;
    color: #aaa;
  }

  .error-msg {
    background: rgba(220, 38, 38, 0.15);
    border: 1px solid #dc2626;
    border-radius: 12px;
    padding: 14px 18px;
    color: #fca5a5;
  }

  /* Input Bar */
  .input-container {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 20px;
    background: linear-gradient(transparent, #212121 30%);
  }

  .input-wrapper {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    gap: 12px;
    background: #2f2f2f;
    border: 1px solid #424242;
    border-radius: 28px;
    padding: 6px 6px 6px 20px;
  }

  .input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: #fff;
    font-size: 1rem;
    padding: 10px 0;
  }
  .input-wrapper input::placeholder {
    color: #777;
  }
  .input-wrapper input:focus {
    outline: none;
  }

  .send-btn {
    width: 44px;
    height: 44px;
    background: #2f5ddb;
    border: none;
    border-radius: 50%;
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .send-btn:hover:not(:disabled) {
    background: #3d6ce8;
  }
  .send-btn:disabled {
    background: #444;
    cursor: not-allowed;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid transparent;
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
