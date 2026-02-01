import { GoogleGenAI, GenerateContentResponseUsageMetadata } from "@google/genai";
import { parseToJSON } from "../src/index";
import {TempKey1} from "./key"

interface SupportActionArgs {
	customerSummary: string;
	action: string;
	actionParameters: Record<string, unknown>;
	followUp: string;
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// function requireApiKey(): string {
// 	const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
// 	if (!key) {
// 		throw new Error("Set GEMINI_API_KEY or GOOGLE_API_KEY before running this demo.");
// 	}
// 	return key;
// }

const customerScenario = `Customer email excerpt:
"Hi team, I received widgets order ORD-2024-884 two days late and one item arrived cracked. I need to know if I'm still eligible for a refund and whether you can ship a replacement."

Internal context:
- Customer tier: Gold support
- Product catalog id: CX-4488 widget kit
- Latest policy: refund allowed within 45 days if damage documented
`;

const yamlInstruction = `YAML:
text: <empathetic msg>
tool_call:
  name: supportAction
  parameters: {customerSummary: str, action: "policy_lookup"|"order_refund", actionParameters: {orderId, productId, refundWindow, notes}, followUp: str}

Be concise.`;

async function runYamlDemo(): Promise<void> {
	const ai = new GoogleGenAI({ apiKey: TempKey1 });
	const { createStreamingParser } = await import("../src/index");
	const parser = createStreamingParser();

	console.log("\n🔄 Streaming YAML-Lite parsing...\n");

	const stream = await ai.models.generateContentStream({
		model: MODEL,
		contents: [
			{
				role: "user",
				parts: [
					{
						text: `${customerScenario}\n${yamlInstruction}\n`,
					},
				],
			},
		],
		config: {
			temperature: 0.2,
		},
	});

	let aggregatedYaml = "";
	let usage: GenerateContentResponseUsageMetadata | undefined;
	let chunkCount = 0;
	let toolNameDetected = false;
	let actionDetected = false;

	for await (const chunk of stream) {
		if (chunk.text) {
			chunkCount++;
			aggregatedYaml += chunk.text;
			parser.write(chunk.text);

			const snapshot = parser.peek() as Record<string, any>;
			const toolCall = snapshot.tool_call;

			if (toolCall?.name && !toolNameDetected) {
				toolNameDetected = true;
				console.log(`📦 Chunk ${chunkCount}: Tool name detected: ${toolCall.name}`);
			}

			if (toolCall?.parameters?.action && !actionDetected) {
				actionDetected = true;
				console.log(`📦 Chunk ${chunkCount}: Action detected: ${toolCall.parameters.action}`);
			}

			if (toolCall?.parameters?.actionParameters?.orderId && chunkCount <= 5) {
				console.log(`📦 Chunk ${chunkCount}: OrderId: ${toolCall.parameters.actionParameters.orderId}`);
			}
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

	const toolCall = finalParsed.tool_call as { name?: string; parameters?: SupportActionArgs } | undefined;
	if (!toolCall || toolCall.name !== "supportAction" || !toolCall.parameters) {
		throw new Error("Parsed YAML-Lite missing expected tool_call block.");
	}

	console.log("\nParsed tool call:\n");
	console.dir({ name: toolCall.name, args: toolCall.parameters }, { depth: null });

	reportUsage(usage);
}

function reportUsage(usage?: GenerateContentResponseUsageMetadata): void {
	if (!usage) return;
	const { promptTokenCount, candidatesTokenCount, totalTokenCount } = usage;
	console.log("\nToken usage (YAML-Lite prompt):");
	console.log({ promptTokenCount, candidatesTokenCount, totalTokenCount });
}

if (import.meta.main) {
	runYamlDemo().catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
}
