/**
 * YAML-Lite Generative UI Type Definitions
 * 
 * These types define the exact schema for each UI component.
 * The LLM learns these from the prompt and generates matching output.
 */

// ═══════════════════════════════════════════════════════════════════════════
// BASE TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BaseComponent {
    id?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface CardComponent extends BaseComponent {
    type: 'Card';
    title?: string;
    subtitle?: string;
    elevation?: 0 | 1 | 2 | 3 | 4;
    padding?: number;
    children?: UIComponent[];
}

export interface GridComponent extends BaseComponent {
    type: 'Grid';
    columns: number;
    gap?: number;
    children?: UIComponent[];
}

export interface StackComponent extends BaseComponent {
    type: 'Stack';
    direction: 'row' | 'column';
    gap?: number;
    align?: 'start' | 'center' | 'end' | 'stretch';
    children?: UIComponent[];
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface TextComponent extends BaseComponent {
    type: 'Text';
    content: string;
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
}

export interface ImageComponent extends BaseComponent {
    type: 'Image';
    src: string;
    alt?: string;
    width?: number;
    height?: number;
}

export interface IconComponent extends BaseComponent {
    type: 'Icon';
    name: string;
    size?: number;
    color?: string;
}

export interface DividerComponent extends BaseComponent {
    type: 'Divider';
    thickness?: number;
    color?: string;
}

export interface SpacerComponent extends BaseComponent {
    type: 'Spacer';
    height?: number;
    width?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA DISPLAY COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface ChartData {
    labels: string[];
    values: number[];
}

export interface ChartComponent extends BaseComponent {
    type: 'Chart';
    kind: 'line' | 'bar' | 'pie';
    data: ChartData;
}

export interface TableComponent extends BaseComponent {
    type: 'Table';
    columns: string[];
    rows: (string | number)[][];
}

export interface ListComponent extends BaseComponent {
    type: 'List';
    items: string[];
    ordered?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface InputComponent extends BaseComponent {
    type: 'Input';
    name: string;
    inputType?: 'text' | 'number' | 'email' | 'password';
    label?: string;
    placeholder?: string;
    required?: boolean;
}

export interface SelectComponent extends BaseComponent {
    type: 'Select';
    name: string;
    options: string[];
    label?: string;
    required?: boolean;
}

export interface ButtonComponent extends BaseComponent {
    type: 'Button';
    label: string;
    action?: string;
    variant?: 'primary' | 'secondary' | 'danger';
}

export interface FormComponent extends BaseComponent {
    type: 'Form';
    submitAction: string;
    children?: UIComponent[];
}

// ═══════════════════════════════════════════════════════════════════════════
// UNION TYPE
// ═══════════════════════════════════════════════════════════════════════════

export type UIComponent =
    | CardComponent
    | GridComponent
    | StackComponent
    | TextComponent
    | ImageComponent
    | IconComponent
    | DividerComponent
    | SpacerComponent
    | ChartComponent
    | TableComponent
    | ListComponent
    | InputComponent
    | SelectComponent
    | ButtonComponent
    | FormComponent;

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

export function isCard(c: UIComponent): c is CardComponent {
    return c.type === 'Card';
}

export function isStack(c: UIComponent): c is StackComponent {
    return c.type === 'Stack';
}

export function isGrid(c: UIComponent): c is GridComponent {
    return c.type === 'Grid';
}

export function isText(c: UIComponent): c is TextComponent {
    return c.type === 'Text';
}

export function isButton(c: UIComponent): c is ButtonComponent {
    return c.type === 'Button';
}

export function isInput(c: UIComponent): c is InputComponent {
    return c.type === 'Input';
}

export function isForm(c: UIComponent): c is FormComponent {
    return c.type === 'Form';
}

export function isChart(c: UIComponent): c is ChartComponent {
    return c.type === 'Chart';
}

export function isImage(c: UIComponent): c is ImageComponent {
    return c.type === 'Image';
}

export function isDivider(c: UIComponent): c is DividerComponent {
    return c.type === 'Divider';
}

export function isSpacer(c: UIComponent): c is SpacerComponent {
    return c.type === 'Spacer';
}

export function isSelect(c: UIComponent): c is SelectComponent {
    return c.type === 'Select';
}

export function isTable(c: UIComponent): c is TableComponent {
    return c.type === 'Table';
}

export function isList(c: UIComponent): c is ListComponent {
    return c.type === 'List';
}

export function isIcon(c: UIComponent): c is IconComponent {
    return c.type === 'Icon';
}
