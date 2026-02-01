import {
	GoogleGenAI,
	GenerateContentResponseUsageMetadata,
	FunctionCallingConfigMode,
    type FunctionDeclaration,
	Type,
} from "@google/genai";

import {TempKey1} from "./key"

interface SupportActionArgs {
	customerSummary: string;
	action: string;
	actionParameters: Record<string, unknown>;
	followUp: string;
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";



const supportActionDeclaration: FunctionDeclaration = {
	name: "supportAction",
	description: "Route customer support cases to the correct backend policy or refund workflow and draft messaging. Include a conversational response to show the customer.",
	parameters: {
		type: Type.OBJECT,
		required: ["text", "customerSummary", "action", "actionParameters", "followUp"],
		properties: {
			text: {
				type: Type.STRING,
				description: "Empathetic conversational response to show the customer immediately.",
			},
			customerSummary: {
				type: Type.STRING,
				description: "Brief CRM-friendly summary (<= 30 words).",
			},
			action: {
				type: Type.STRING,
				description: "Workflow to trigger, e.g. policy_lookup or order_refund.",
			},
			actionParameters: {
				type: Type.OBJECT,
				description: "Arguments needed to execute the workflow.",
				properties: {
					orderId: { type: Type.STRING },
					productId: { type: Type.STRING },
					refundWindow: { type: Type.STRING },
					notes: { type: Type.STRING },
				},
			},
			followUp: {
				type: Type.STRING,
				description: "Short empathetic follow-up message to send back to the customer.",
			},
		},
	},
};

const customerScenario = `Customer email excerpt:
"Hi team, I received widgets order ORD-2024-884 two days late and one item arrived cracked. I need to know if I'm still eligible for a refund and whether you can ship a replacement."

Internal context:
- Customer tier: Gold support
- Product catalog id: CX-4488 widget kit
- Latest policy: refund allowed within 45 days if damage documented
`;

async function runJsonDemo(): Promise<void> {
	const ai = new GoogleGenAI({ apiKey: TempKey1 });

	console.log("\n🔄 Streaming official function calling...\n");

	const stream = await ai.models.generateContentStream({
		model: MODEL,
		contents: [
			{
				role: "user",
				parts: [
					{
						text: `${customerScenario}
Return a structured plan using the provided schema.
- customerSummary: brief recap for CRM notes (<= 30 words)
- intent: tool call to either policy_lookup or order_refund
- followUp: short empathetic message to send back\n`,
					},
				],
			},
		],
		config: {
			temperature: 0.2,
			tools: [
				{
					functionDeclarations: [supportActionDeclaration],
				},
			],
			toolConfig: {
				functionCallingConfig: {
					mode: FunctionCallingConfigMode.ANY,
					allowedFunctionNames: [supportActionDeclaration.name!],
				},
			},
		},
	});

	let fnCall: any;
	let usage: GenerateContentResponseUsageMetadata | undefined;
	let chunkCount = 0;

	for await (const chunk of stream) {
		chunkCount++;
		if (chunk.functionCalls && chunk.functionCalls.length > 0) {
			fnCall = chunk.functionCalls[0];
			console.log(`📦 Chunk ${chunkCount}: Function call detected`);
			console.log(`   Name: ${fnCall.name}`);
			if (fnCall.args) {
				const keys = Object.keys(fnCall.args);
				console.log(`   Args keys: [${keys.join(", ")}]`);
			}
		}
		if (chunk.usageMetadata) {
			usage = chunk.usageMetadata;
		}
	}

	if (!fnCall || !fnCall.args) {
		throw new Error("Model response did not contain a function call with arguments.");
	}

	const args = fnCall.args as unknown as SupportActionArgs & { text?: string };

	if (args.text) {
		console.log("\n💬 Conversational response:\n");
		console.log(args.text);
	}

	console.log("\n✅ Final function calling output:\n");
	console.log(JSON.stringify(fnCall, null, 2));

	console.log("\nParsed arguments:\n");
	console.dir(args, { depth: null });

	reportUsage(usage);
}

function reportUsage(usage?: GenerateContentResponseUsageMetadata): void {
	if (!usage) return;
	const { promptTokenCount, candidatesTokenCount, totalTokenCount } = usage;
	console.log("\nToken usage (official function calling):");
	console.log({ promptTokenCount, candidatesTokenCount, totalTokenCount });
}

if (import.meta.main) {
	runJsonDemo().catch(error => {
		console.error(error);
		process.exitCode = 1;
	});
}
