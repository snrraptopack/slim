import { parseToJSON } from './src/index';

const yaml = `
intents:
  - type: workflow
    name: gather_context
    args: { id: "INC-123" }
  - type: tool_call
    name: search
    args: { query: "latest incident report", limit: 10 }
parallel: true
`;

const result = parseToJSON(yaml);
console.log(JSON.stringify(result, null, 2));
