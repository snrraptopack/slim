import { GoogleGenAI, GenerateContentResponseUsageMetadata } from "@google/genai";
import { createStreamingParser } from "../src/index";
import {TempKey1} from "./key"

const MODEL = "gemini-2.5-flash";

const customerScenario = `Customer email excerpt:
"Hi team, I received widgets order ORD-2024-884 two days late and one item arrived cracked. I need to know if I'm still eligible for a refund and whether you can ship a replacement."

Internal context:
- Customer tier: Gold support
- Product catalog id: CX-4488 widget kit
- Latest policy: refund allowed within 45 days if damage documented
`;

// Minimal TS type, ask for terse YAML
const yamlInstruction = `YAML:
text: <empathetic msg>
tool_call:
  name: supportAction
  parameters: {customerSummary: str, action: "policy_lookup"|"order_refund", actionParameters: {orderId, productId, refundWindow, notes}, followUp: str}

Be concise.`;

async function runTsSchemaDemo(): Promise<void> {
	const ai = new GoogleGenAI({ apiKey: TempKey1 });

	console.log(`\n🎯 Testing TS-Schema-to-YAML on ${MODEL}\n`);

	const stream = await ai.models.generateContentStream({
		model: MODEL,
		contents: [
			{ role: "user", parts: [{ text: customerScenario }] },
			{ role: "user", parts: [{ text: yamlInstruction }] },
		],
	});

	const parser = createStreamingParser();
	let usage: GenerateContentResponseUsageMetadata | undefined;
	let aggregatedYaml = "";

	for await (const chunk of stream) {
		if (chunk.text) {
			aggregatedYaml += chunk.text;
			parser.write(chunk.text);
		}
		if (chunk.usageMetadata) {
			usage = chunk.usageMetadata;
		}
	}

	const finalParsed = parser.end() as Record<string, any>;

	const responseText = finalParsed.text as string | undefined;
	if (responseText) {
		console.log("💬 Conversational response:\n");
		console.log(responseText);
	}

	console.log("\n✅ TS-Schema YAML output:\n");
	if (finalParsed.tool_call) {
		const yamlMatch = aggregatedYaml.match(/(tool_call:[\s\S]*)/);
		if (yamlMatch) {
			console.log(yamlMatch[1]?.trim());
		}
	}

	const toolCall = finalParsed.tool_call as Record<string, any> | undefined;
	if (toolCall) {
		console.log("\nParsed tool call:\n");
		console.dir({ name: toolCall.name, args: toolCall.parameters }, { depth: null });
	}

	console.log("\nToken usage (TS-Schema → YAML):");
	if (usage) {
		console.log({ promptTokenCount: usage.promptTokenCount, candidatesTokenCount: usage.candidatesTokenCount, totalTokenCount: usage.totalTokenCount });
	}
}

runTsSchemaDemo().catch(console.error);
