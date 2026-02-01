/**
 * AUWGENT YAML-Lite — Streaming Demonstration
 * 
 * Shows chunk-by-chunk parsing like an LLM streaming tokens.
 */

import { createStreamingParser } from './src/index';

// Simulate LLM streaming tokens
const chunks = [
    "tool",
    "_call:\n",
    "  name",
    ": web_search\n",
    "  parameters:\n",
    "    query: AI news\n",
    "    limit: 10\n",
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Streaming Parser Demo — Chunk by Chunk');
console.log('═══════════════════════════════════════════════════════════════\n');

const stream = createStreamingParser();

for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Chunk ${i + 1}: ${JSON.stringify(chunk)}`);

    stream.write(chunk);

    // peek() gives us the current partial result
    const partial = stream.peek();
    console.log(`  → ${JSON.stringify(partial)}`);
    console.log();
}

console.log('Final result:');
const final = stream.end();
console.log(JSON.stringify(final, null, 2));

// Demo 2: Multi-agent workflow
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  Multi-Agent Workflow Demo');
console.log('═══════════════════════════════════════════════════════════════\n');

const workflowYaml = `workflow:
  name: customer_support
  agents:
    - id: classifier
      role: intent_classification
    - id: researcher
      role: information_gathering
    - id: responder
      role: response_generation

agent: classifier
thinking:
  analysis: "User asking about refund"
  intent: customer_service
  confidence: 0.95

structured_output:
  schema: classification
  data:
    intent: refund_inquiry
    entities:
      product_id: "P-12345"
      order_id: "ORD-2024-001"
    next_agent: researcher

tool_calls:
  - name: database_query
    parameters:
      table: orders
      order_id: "ORD-2024-001"
  - name: policy_lookup
    parameters:
      policy_type: refund
`;

const stream2 = createStreamingParser();

// Simulate word-by-word streaming
const words = workflowYaml.split(/(?<=\n)|(?=\n)/);
let accumulated = '';

console.log('Streaming word by word...\n');

for (const word of words) {
    stream2.write(word);
    accumulated += word;

    // Check when we have usable data
    const partial = stream2.peek() as any;

    // Check for key moments
    if (partial?.workflow?.name && !accumulated.includes('agents:')) {
        console.log('✓ Got workflow name:', partial.workflow.name);
    }
    if (partial?.agent && !accumulated.includes('thinking:')) {
        console.log('✓ Got agent ID:', partial.agent);
    }
    if (partial?.thinking?.confidence) {
        console.log('✓ Got thinking with confidence:', partial.thinking.confidence);
    }
    if (partial?.tool_calls?.length === 2 && accumulated.includes('policy_type: refund')) {
        console.log('✓ Got both tool calls!');
    }
}

console.log('\nFinal workflow result:');
const finalWorkflow = stream2.end();
console.log(JSON.stringify(finalWorkflow, null, 2));
