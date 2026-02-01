import { GoogleGenAI, GenerateContentResponseUsageMetadata } from "@google/genai";
import { createStreamingParser } from "../src/index";
import {TempKey1} from "./key"

// Ultra-compact YAML inspired by BAML's type-definition prompting
const MODEL = "gemini-2.5-flash";

const customerScenario = `Customer email excerpt:
"Hi team, I received widgets order ORD-2024-884 two days late and one item arrived cracked. I need to know if I'm still eligible for a refund and whether you can ship a replacement."

Internal context:
- Customer tier: Gold support
- Product catalog id: CX-4488 widget kit
- Latest policy: refund allowed within 45 days if damage documented
`;

// Ultra-compact schema - removed all type hints and descriptions
const yamlInstruction = `Output:
text: <response>
tool_call:
  name: supportAction
  params:
    summary: <30w>
    action: policy_lookup|order_refund
    args:
      orderId: <str>
      productId: <str>
      refundWindow: <str>
      notes: <str>
    followUp: <msg>

No quotes. No fences.`;

async function runUltraCompactDemo(): Promise<void> {
	const ai = new GoogleGenAI({ apiKey: TempKey1 });

	console.log(`\n🚀 Testing Ultra-Compact YAML on ${MODEL}\n`);

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

	console.log("\n✅ Ultra-Compact YAML:\n");
	if (finalParsed.tool_call) {
		const yamlMatch = aggregatedYaml.match(/(tool_call:[\s\S]*)/);
		if (yamlMatch) {
			console.log(yamlMatch[1].trim());
		}
	}

	const toolCall = finalParsed.tool_call as Record<string, any> | undefined;
	if (toolCall) {
		console.log("\nParsed tool call:\n");
		// Map ultra-compact keys to full names for compatibility
		const params = toolCall.params || toolCall.parameters;
		const args = params?.args || params?.actionParameters;
		console.dir({ 
			name: toolCall.name, 
			args: {
				customerSummary: params?.summary,
				action: params?.action,
				actionParameters: args,
				followUp: params?.followUp
			}
		}, { depth: null });
	}

	console.log("\nToken usage (Ultra-Compact YAML):");
	if (usage) {
		console.log({ promptTokenCount: usage.promptTokenCount, candidatesTokenCount: usage.candidatesTokenCount, totalTokenCount: usage.totalTokenCount });
	}
}

runUltraCompactDemo().catch(console.error);
