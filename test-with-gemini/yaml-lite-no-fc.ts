import { GoogleGenAI, GenerateContentResponseUsageMetadata } from "@google/genai";
import { createStreamingParser } from "../src/index";
import {TempKey1} from "./key"

interface SupportActionArgs {
	customerSummary: string;
	action: string;
	actionParameters: Record<string, unknown>;
	followUp: string;
}

// Model that does NOT support function calling
const MODEL = "gemini-2.0-flash-lite";

const customerScenario = `Customer email excerpt:
"Hi team, I received widgets order ORD-2024-884 two days late and one item arrived cracked. I need to know if I'm still eligible for a refund and whether you can ship a replacement."

Internal context:
- Customer tier: Gold support
- Product catalog id: CX-4488 widget kit
- Latest policy: refund allowed within 45 days if damage documented
`;

const yamlInstruction = `Output YAML:
text: <empathetic response>
tool_call:
  name: supportAction
  parameters:
    customerSummary: <30 words max>
    action: <policy_lookup|order_refund>
    actionParameters:
      orderId: <string>
      productId: <string>
      refundWindow: <string>
      notes: <string>
    followUp: <short message>

No quotes unless needed. No fences.`;

async function runYamlLiteDemo(): Promise<void> {
	const ai = new GoogleGenAI({ apiKey: TempKey1 });

	console.log(`\n🧪 Testing YAML-Lite on ${MODEL} (NO function calling support)\n`);

	const stream = await ai.models.generateContentStream({
		model: MODEL,
		contents: [
			{ role: "user", parts: [{ text: yamlInstruction }] },
			{ role: "user", parts: [{ text: customerScenario }] },
		],
	});

	const parser = createStreamingParser();
	let toolName: string | undefined;
	let action: string | undefined;
	let orderId: string | undefined;
	let usage: GenerateContentResponseUsageMetadata | undefined;
	let aggregatedYaml = "";

	console.log("📡 Streaming chunks...\n");

	let chunkCount = 0;
	for await (const chunk of stream) {
		chunkCount++;
		const text = chunk.text;
		if (!text) continue;

		aggregatedYaml += text;
		parser.write(text);

		const partial = parser.peek() as Record<string, any>;

		if (!toolName && partial.tool_call?.name) {
			toolName = partial.tool_call.name;
			console.log(`[Chunk ${chunkCount}] 🔧 Tool name detected: ${toolName}`);
		}
		if (!action && partial.tool_call?.parameters?.action) {
			action = partial.tool_call.parameters.action;
			console.log(`[Chunk ${chunkCount}] 🎯 Action detected: ${action}`);
		}
		if (!orderId && partial.tool_call?.parameters?.actionParameters?.orderId) {
			orderId = partial.tool_call.parameters.actionParameters.orderId;
			console.log(`[Chunk ${chunkCount}] 📦 Order ID detected: ${orderId}`);
		}

		if (chunk.usageMetadata) {
			usage = chunk.usageMetadata;
		}
	}

	const finalParsed = parser.end() as Record<string, any>;

	const responseText = finalParsed.text as string | undefined;
	if (responseText) {
		console.log("\n💬 Conversational response:\n");
		console.log(responseText);
	}

	console.log("\n✅ YAML-Lite tool call:\n");
	if (finalParsed.tool_call) {
		// Show just the tool_call portion in YAML format
		const yamlMatch = aggregatedYaml.match(/(tool_call:[\s\S]*)/);
		if (yamlMatch) {
			console.log(yamlMatch[1].trim());
		}
	} else {
		console.log(aggregatedYaml.trim());
	}

	const toolCall = finalParsed.tool_call as Record<string, any> | undefined;
	if (toolCall) {
		console.log("\nParsed tool call:\n");
		console.dir({ name: toolCall.name, args: toolCall.parameters }, { depth: null });
	}

	console.log("\nToken usage (YAML-Lite on non-function-calling model):");
	if (usage) {
		console.log({ promptTokenCount: usage.promptTokenCount, candidatesTokenCount: usage.candidatesTokenCount, totalTokenCount: usage.totalTokenCount });
	}
}

runYamlLiteDemo().catch(console.error);
