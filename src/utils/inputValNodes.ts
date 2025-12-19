// import { SystemMessage } from "@langchain/core/messages";
// import { AIMessage } from "@langchain/core/messages";
// import { ToolMessage } from "@langchain/core/messages";
// import { END, Send } from "@langchain/langgraph";
// import { AttackVectorSchema, AVSchema } from "./state.js";
// import { model } from "./tools.js";
// import * as z from "zod";
// import { modelWithTools } from "./tools.js";
// import { PentestState } from "./state.js";
// import { InputValidationState } from "./av_state.js";
// import { StateGraph, START } from "@langchain/langgraph";

// const router = model.withStructuredOutput(InputValidationState);

// // define nodes for input validation subgraph
// async function InputValAnalyzer(state: z.infer<typeof InputValidationState>) {
//   console.log("InputValAnalyzer START");
  
//   const attackScenario = await router.invoke([
//     {
//       type: "system", 
//       content: ``
//     },
//     {
//       type: "user", 
//       content: `You are an input validation analysis tool. Analyze the following input validation issue and affected parameters:
//       ${JSON.stringify(state.)}`
//     },
//     ...state.messages,
//   ]);

// }


// const inputValSubgraph = new StateGraph(InputValidationState)
//   .addNode("checkHeaders", async (state) => {
//     console.log(`[InputVal] Checking headers on ${state.input.scope[state.input.idxScope].request.url}`);
//     // ... checking logic
//     return { status: "completed" };
//   })
//   .addEdge(START, "checkHeaders")
//   .addEdge("checkHeaders", END);

// export const compiledInputValSubgraph = inputValSubgraph.compile();

