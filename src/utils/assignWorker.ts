import { Send } from "@langchain/langgraph";
import { PentestState } from "./state.js";
import * as z from "zod";

import { InputValidationState } from "./av_state.js";
import { SQLIState } from "./av_state.js";
import { BACState } from "./av_state.js";


// Map of subgraphs


export async function assignWorker(state: z.infer<typeof PentestState>) {
  console.log("🔀 AssignWorker: Creating worker tasks...");
  
  const currentScopeIdx = state.input.idxScope;
  const currentScope = state.input.scope[currentScopeIdx];
  
  console.log(`📍 Processing scope: ${currentScope.name}`);
  console.log(`📋 Attack vectors: ${currentScope.attackVector.map(av => av.name).join(", ")}`);
  
  const sends = [];
  const parentState = state;
  
  // Create Send() for each attack vector with mapped state
  for (const av of currentScope.attackVector) {
    console.log(`  ➡️ Creating worker for: ${av.name}`);

    // pass parent state to subgraph state
    
    // Map PentestState to subgraph-specific state
    const [SubgraphSchema, kind] = mapToSubgraphState(currentScope, av);

    // ✅ buat state data dengan field wajib terisi
    const base = {
      messages: parentState.messages ?? [],
      input: parentState.input,
      output: parentState.output,
    };

    const subgraphState =
      kind === "bac"
        ? SubgraphSchema.parse({
            ...base,
            state: {
              vulnerabilityDetails: "Generic broken access control vulnerability",
              sessionType: "",
              testCases: [],
            },
          })
        : kind === "inputValidation"
        ? SubgraphSchema.parse({
            ...base,
            state: {
              issueDescription: "Generic input validation issue",
              affectedParameters:
                parentState.input.scope[parentState.input.idxScope]?.request.body?.map((param: any) => ({
                  paramName: param,
                  typeIssue: "Generic issue",
                })) || [],
            },
          })
        : SubgraphSchema.parse({
            ...base,
            state: {}, // SQLIState kalau memang state-nya nggak wajib/beda
          });




    // Create Send with the compiled subgraph name
    sends.push(
      new Send(av.name, subgraphState)
    );
  }
  
  console.log(`✅ Created ${sends.length} worker tasks`);
  
  return sends;
}

// Helper function to map main state to subgraph state
function mapToSubgraphState(scope: any, attackVector: any): [any, string] {
  switch (attackVector.name) {
    case "sqliNode":
      return [SQLIState, "sqli"];
    case "inputValidationNode":
      return [InputValidationState, "inputValidation"];
    case "bacNode":
      return [BACState, "bac"];
    default:
      throw new Error(`Unknown attack vector: ${attackVector.name}`);
  }
}
