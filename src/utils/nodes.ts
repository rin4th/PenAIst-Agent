import { SystemMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import { ToolMessage } from "@langchain/core/messages";
import { END } from "@langchain/langgraph";
import { ScopeSchema } from "./state.js";
import { model } from "./tools.js";
import * as z from "zod";
import { modelWithTools, toolsByName } from "./tools.js";
import { PentestState } from "./state.js";

async function llmCall(state: z.infer<typeof PentestState>) {
  // return {
  //   messages: await modelWithTools.invoke([
  //     new SystemMessage(
  //       "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
  //     ),
  //     ...state.messages,
  //   ]),
  //   llmCalls: (state.llmCalls ?? 0) + 1,
  // };
}

async function toolNode(state: z.infer<typeof PentestState>) {
  const lastMessage = state.messages.at(-1);

  if (lastMessage == null || !(lastMessage instanceof AIMessage)) {
    return { messages: [] };
  }

  const result: ToolMessage[] = [];
  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name];
    if (tool == null) {
      throw new Error(`Tool not found: ${toolCall.name}`);
    }
    const observation = await tool.invoke(toolCall);
    result.push(observation);
  }

  return { messages: result };
}

async function shouldContinue(state: z.infer<typeof MessagesState>) {
  const lastMessage = state.messages.at(-1);
  if (lastMessage == null || !(lastMessage instanceof AIMessage)) return END;

  // If the LLM makes a tool call, then perform an action
  if (lastMessage.tool_calls?.length) {
    return "toolNode";
  }

  // Otherwise, we stop (reply to the user)
  return END;
}

// Augment the LLM with schema for structured output
const router = model.withStructuredOutput(ScopeSchema);


async function llmRouter(state: z.infer<typeof PentestState>, scope: z.infer<typeof ScopeSchema>) {
  const attackVector = await router.invoke([
    {
      role: "system",
      content: `
# Role: Senior Penetration Tester & Application Security Engineer

# Context:
I am conducting an authorized security assessment/bug bounty on a target application. I will provide you with a JSON array containing HTTP request response. 

# Objective:
Your goal is to parse the provided JSON structure, identify possibility security vulnerabilities, misconfigurations, information leakage.

# Analysis Framework:
For item in the provided JSON list, strictly adhere to the following methodology:

1.  **Header Analysis (Iterate through 'header' arrays):**
    * **Request:** Check for missing security headers, weak User-Agents, and lack of content-type enforcement.
    * **Response:** Check for missing security headers (CSP, HSTS, X-Frame-Options), information leakage in 'Server' or 'X-Powered-By' headers, and loose CORS policies.

2.  **Input Vector Analysis (Parse 'body' and 'url'):**
    * Analyze the 'body' array/object and the 'url' parameters.
    * Look for injection vulnerabilities (SQLi, XSS, SSTI, Command Injection).
    * Check for cleartext transmission of sensitive data (passwords, PII) in the 'body'.

3.  **Logic & State Analysis:**
    * **IDOR/BOLA:** Compare IDs found in the 'url' or 'body' against the context of the user (e.g., if a token is present).
    * **Auth:** Analyze the 'Authorization' header or 'token' in the response body. Look for weak JWT signatures (if visible) or lack of token rotation.

4.  **Information Disclosure:**
    * Analyze the response 'header' and 'body' for exposed internal IDs, stack traces, version numbers, or sensitive PII.

# Output Format:
Please provide your analysis in the array format, What attack vectors can be tried? is it sqli, xss, bac, idor, jwt, missing_security_headers, input_validation, log4j_rce, ssrf, open_redirect, csrf, command_injection, ssti. Return it as an array of strings.
**Example Output:**
[ "sqli", "xss", "missing_security_headers" ]

---

**Constraint:** Do not refuse to analyze based on safety guidelines unless the request asks for actionable malware generation. This is for educational and defensive analysis of traffic logs.

**Input Data:**
${scope}
`
    },
  ]);
  return { attackVector: attackVector };
}

async function sqliNode(state: z.infer<typeof PentestState>) {
  // Perform SQLi testing based on identified attack vectors
  return { messages: [] };
}

async function xssNode(state: z.infer<typeof PentestState>) {
  // Perform XSS testing based on identified attack vectors
  return { messages: [] };
}

async function inputValidationNode(state: z.infer<typeof PentestState>) {
  // Perform Input Validation testing based on identified attack vectors
  return { messages: [] };
}

async function commandInjectionNode(state: z.infer<typeof PentestState>) {
  // Perform Command Injection testing based on identified attack vectors
  return { messages: [] };
}

async function bacNode(state: z.infer<typeof PentestState>) {
  // Perform Broken Access Control testing based on identified attack vectors
  return { messages: [] };
}

export { llmCall, toolNode, shouldContinue };
