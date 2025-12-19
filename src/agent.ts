import { StateGraph, START, END } from "@langchain/langgraph";
import { PentestState, ScopeSchema } from "./utils/state.js";
import { orchestrator } from "./utils/nodes.js";
import { HumanMessage } from "@langchain/core/messages";
import { model } from "./utils/tools.js";
import { assignWorker } from "./utils/assignWorker.js";
import { compiledBACSubgraph } from "./utils/bacNodes.js";
import { aggregateResults, nextScope, routeAfterAggregation } from "./utils/nodes.js";
import * as fs from "node:fs/promises";
import { CompiledGraph } from "@langchain/langgraph";


const agent = new StateGraph(PentestState)
  .addNode("orchestrator", orchestrator)
  .addNode("aggregateResults", aggregateResults)
  .addNode("nextScope", nextScope)
  .addNode("bacNode",  compiledBACSubgraph)
  .addEdge(START, "orchestrator")
  .addConditionalEdges(
    "orchestrator",
    assignWorker, 
    [
      "bacNode"
    ]
  )
  .addEdge("bacNode", "aggregateResults")
  .addConditionalEdges(
    "aggregateResults",
    routeAfterAggregation,
    ["nextScope", END]
  )
  .addEdge("nextScope", "orchestrator")
  .compile();
  
// for (const message of result.messages) {
//   console.log(`[${message.type}]: ${message.text}`);
// }

const scopes = [
  {
    name: "View Profile",
    request: {
      method: "GET",
      url: "http://127.0.0.1:5000/user/profile/alice",
      header: {
        Host: "127.0.0.1:5000",
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbGljZSIsImlhdCI6MTc2NjExMjg2MH0.BvJkHpnesbyQnCdo4s3Jh0YC0y_n7FzRkbkTw06nj6A",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        Referer: "http://127.0.0.1:5000/",
      },
      body: {},
    },
    response: {
      statusCode: "200",
      header: {
        "Content-Type": "application/json",
        "Content-Length": "133",
      },
      body: {
        user: {
          id: 2,
          username: "bob",
          password: "hunter2",
          bio: "Breaking access control on weekends.",
        },
      },
    },
    attackVector: [],
    idxAV: 0,
  },
];



export function createInitialPentestState(scopes: any[]) {
  return {
    messages: [],
    input: {
      scope: scopes.map(scope => ({
        ...scope,
        attackVector: scope.attackVector || [],
        idxAV: scope.idxAV || 0
      })),
      idxScope: 0,
      isIFA: false,
      additionalInfo: "N/A"
    },
    output: {
      findings: [],
      reports: []
    }
  };
}
const initialState = createInitialPentestState(scopes);

const result = await agent.invoke(initialState, { recursionLimit: 100 });

const drawableGraph = await agent.getGraphAsync();
const image = await drawableGraph.drawMermaidPng();
const imageBuffer = new Uint8Array(await image.arrayBuffer());

await fs.writeFile("graph.png", imageBuffer);