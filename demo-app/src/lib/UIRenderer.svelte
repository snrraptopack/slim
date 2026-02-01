<script lang="ts">
    import type {
        UIComponent,
        CardComponent,
        StackComponent,
        GridComponent,
        TextComponent,
        ButtonComponent,
        InputComponent,
        FormComponent,
        ImageComponent,
        IconComponent,
        DividerComponent,
        SpacerComponent,
        ChartComponent,
        TableComponent,
        ListComponent,
        SelectComponent,
    } from "./ui-types";

    interface Props {
        component: UIComponent;
    }

    let { component }: Props = $props();

    // Type-safe children getter for container components
    function getChildren(
        comp: CardComponent | StackComponent | GridComponent | FormComponent,
    ): UIComponent[] {
        return comp.children ?? [];
    }
</script>

{#if component.type === "Card"}
    {@const card = component as CardComponent}
    <div
        class="card"
        style:padding="{card.padding ?? 16}px"
        style:box-shadow="0 {(card.elevation ?? 1) * 2}px {(card.elevation ??
            1) * 4}px rgba(0,0,0,0.1)"
    >
        {#if card.title}
            <h3 class="card-title">{card.title}</h3>
        {/if}
        {#if card.subtitle}
            <p class="card-subtitle">{card.subtitle}</p>
        {/if}
        {#each getChildren(card) as child}
            <!-- svelte-ignore svelte_self_deprecated -->
            <svelte:self component={child} />
        {/each}
    </div>
{:else if component.type === "Stack"}
    {@const stack = component as StackComponent}
    <div
        class="stack"
        style:flex-direction={stack.direction ?? "column"}
        style:gap="{stack.gap ?? 8}px"
        style:align-items={stack.align ?? "stretch"}
    >
        {#each getChildren(stack) as child}
            <!-- svelte-ignore svelte_self_deprecated -->
            <svelte:self component={child} />
        {/each}
    </div>
{:else if component.type === "Grid"}
    {@const grid = component as GridComponent}
    <div
        class="grid"
        style:grid-template-columns="repeat({grid.columns ?? 2}, 1fr)"
        style:gap="{grid.gap ?? 8}px"
    >
        {#each getChildren(grid) as child}
            <!-- svelte-ignore svelte_self_deprecated -->
            <svelte:self component={child} />
        {/each}
    </div>
{:else if component.type === "Text"}
    {@const text = component as TextComponent}
    {#if text.variant === "h1"}
        <h1>{text.content}</h1>
    {:else if text.variant === "h2"}
        <h2>{text.content}</h2>
    {:else if text.variant === "h3"}
        <h3>{text.content}</h3>
    {:else if text.variant === "caption"}
        <small>{text.content}</small>
    {:else}
        <p>{text.content}</p>
    {/if}
{:else if component.type === "Button"}
    {@const btn = component as ButtonComponent}
    <button
        class="btn btn-{btn.variant ?? 'primary'}"
        onclick={() => console.log("Action:", btn.action)}
    >
        {btn.label}
    </button>
{:else if component.type === "Input"}
    {@const input = component as InputComponent}
    <div class="input-group">
        {#if input.label}
            <label for={input.name}>{input.label}</label>
        {/if}
        <input
            type={input.inputType ?? "text"}
            name={input.name}
            id={input.name}
            placeholder={input.placeholder ?? ""}
            required={input.required ?? false}
        />
    </div>
{:else if component.type === "Select"}
    {@const select = component as SelectComponent}
    <div class="input-group">
        {#if select.label}
            <label for={select.name}>{select.label}</label>
        {/if}
        <select
            name={select.name}
            id={select.name}
            required={select.required ?? false}
        >
            {#each select.options as option}
                <option value={option}>{option}</option>
            {/each}
        </select>
    </div>
{:else if component.type === "Form"}
    {@const form = component as FormComponent}
    <form
        onsubmit={(e) => {
            e.preventDefault();
            console.log("Submit:", form.submitAction);
        }}
    >
        {#each getChildren(form) as child}
            <!-- svelte-ignore svelte_self_deprecated -->
            <svelte:self component={child} />
        {/each}
    </form>
{:else if component.type === "Image"}
    {@const img = component as ImageComponent}
    <img
        src={img.src}
        alt={img.alt ?? ""}
        width={img.width}
        height={img.height}
        class="image"
    />
{:else if component.type === "Icon"}
    {@const icon = component as IconComponent}
    <span
        class="icon"
        style:font-size="{icon.size ?? 24}px"
        style:color={icon.color ?? "currentColor"}
    >
        {icon.name}
    </span>
{:else if component.type === "Divider"}
    {@const divider = component as DividerComponent}
    <hr
        class="divider"
        style:border-width="{divider.thickness ?? 1}px"
        style:border-color={divider.color ?? "#eee"}
    />
{:else if component.type === "Spacer"}
    {@const spacer = component as SpacerComponent}
    <div
        class="spacer"
        style:height="{spacer.height ?? 16}px"
        style:width="{spacer.width}px"
    ></div>
{:else if component.type === "Chart"}
    {@const chart = component as ChartComponent}
    <div class="chart">
        <div class="chart-header">{chart.kind} chart</div>
        <div class="chart-bars">
            {#each chart.data.values as value, i}
                {@const maxVal = Math.max(...chart.data.values)}
                <div class="chart-bar" style:height="{(value / maxVal) * 100}%">
                    <span class="chart-label">{chart.data.labels[i]}</span>
                </div>
            {/each}
        </div>
    </div>
{:else if component.type === "Table"}
    {@const table = component as TableComponent}
    <table class="table">
        <thead>
            <tr>
                {#each table.columns as col}
                    <th>{col}</th>
                {/each}
            </tr>
        </thead>
        <tbody>
            {#each table.rows as row}
                <tr>
                    {#each row as cell}
                        <td>{cell}</td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
{:else if component.type === "List"}
    {@const list = component as ListComponent}
    {#if list.ordered}
        <ol>
            {#each list.items as item}
                <li>{item}</li>
            {/each}
        </ol>
    {:else}
        <ul>
            {#each list.items as item}
                <li>{item}</li>
            {/each}
        </ul>
    {/if}
{:else}
    <div class="unknown">Unknown component type</div>
{/if}

<style>
    /* Card */
    .card {
        background: white;
        border-radius: 16px;
        padding: 24px;
    }
    .card-title {
        margin: 0 0 8px 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #111;
    }
    .card-subtitle {
        margin: 0 0 20px 0;
        color: #666;
        font-size: 1rem;
    }

    /* Stack & Grid */
    .stack {
        display: flex;
        width: 100%;
    }
    .grid {
        display: grid;
        width: 100%;
    }

    /* Typography */
    h1 {
        margin: 0 0 16px 0;
        font-size: 2rem;
        font-weight: 700;
        color: #111;
    }
    h2 {
        margin: 0 0 12px 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: #111;
    }
    h3 {
        margin: 0 0 8px 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: #111;
    }
    p {
        margin: 0 0 12px 0;
        font-size: 1rem;
        line-height: 1.6;
        color: #333;
    }
    small {
        color: #888;
        font-size: 0.875rem;
    }

    /* Buttons */
    .btn {
        padding: 14px 28px;
        border: none;
        border-radius: 10px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
    }
    .btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .btn-primary {
        background: #2563eb;
        color: white;
    }
    .btn-secondary {
        background: #f3f4f6;
        color: #374151;
    }
    .btn-danger {
        background: #dc2626;
        color: white;
    }

    /* Inputs */
    .input-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 20px;
    }
    .input-group label {
        font-size: 0.95rem;
        font-weight: 500;
        color: #374151;
    }
    .input-group input,
    .input-group select {
        padding: 14px 16px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        font-size: 1rem;
        background: #f9fafb;
        transition: all 0.15s;
    }
    .input-group input:focus,
    .input-group select:focus {
        outline: none;
        border-color: #2563eb;
        background: white;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .input-group input::placeholder {
        color: #9ca3af;
    }

    /* Image */
    .image {
        border-radius: 12px;
        object-fit: cover;
    }

    /* Divider */
    .divider {
        border: none;
        border-top: 1px solid #e5e7eb;
        margin: 24px 0;
    }

    /* Spacer */
    .spacer {
        flex-shrink: 0;
    }

    /* Chart */
    .chart {
        background: #f8fafc;
        border-radius: 12px;
        padding: 24px;
        border: 1px solid #e2e8f0;
    }
    .chart-header {
        font-size: 1rem;
        font-weight: 500;
        color: #475569;
        margin-bottom: 16px;
        text-transform: capitalize;
    }
    .chart-bars {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        height: 140px;
    }
    .chart-bar {
        flex: 1;
        background: linear-gradient(to top, #2563eb, #60a5fa);
        border-radius: 6px 6px 0 0;
        min-height: 16px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding-bottom: 8px;
    }
    .chart-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: white;
    }

    /* Table */
    .table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
    }
    .table th,
    .table td {
        padding: 14px 16px;
        text-align: left;
        border-bottom: 1px solid #e5e7eb;
    }
    .table th {
        font-weight: 600;
        background: #f9fafb;
        color: #374151;
    }
    .table td {
        color: #4b5563;
    }

    /* Unknown */
    .unknown {
        padding: 16px;
        background: #fef3c7;
        border-radius: 8px;
        color: #92400e;
        font-size: 0.9rem;
    }
</style>
