import { StateGraph, START, END } from "@langchain/langgraph";
import { PentestState, routeSchema } from "./utils/state.js";
import { llmCall, toolNode, shouldContinue } from "./utils/nodes.js";
import { HumanMessage } from "@langchain/core/messages";
import { modelWithTools, model } from "./utils/tools.js";
import { z } from "zod";
import * as fs from "node:fs/promises";


const agent = new StateGraph(MessagesState)
  .addNode("llmCall", llmCall)
  .addNode("toolNode", toolNode)
  .addEdge(START, "llmCall")
  .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
  .addEdge("toolNode", "llmCall")
  .compile();

// Invoke

const result = await agent.invoke({
  messages: [new HumanMessage("Add 3 and 4.")],
});

for (const message of result.messages) {
  console.log(`[${message.type}]: ${message.text}`);
}



// Augment the LLM with schema for structured output
const router = model.withStructuredOutput(routeSchema);


async function llmRouter(state: z.infer<typeof PentestState>){
  const attackVector = await router.invoke([
    {
      role: "system",
      content: "Route the input to story, joke, or poem based on the user's request."
    },
    {
      role: "user",
      content: state.messages.map((msg) => msg.text).join("\n")
    }
  ])
}
























const drawableGraph = await agent.getGraphAsync();
const image = await drawableGraph.drawMermaidPng();
const imageBuffer = new Uint8Array(await image.arrayBuffer());

await fs.writeFile("graph.png", imageBuffer);