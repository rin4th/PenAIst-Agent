import { SystemMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import { ToolMessage } from "@langchain/core/messages";
import { END } from "@langchain/langgraph";
import * as z from "zod";
import { modelWithTools, toolsByName } from "./tools.js";
import { MessagesState } from "./state.js";

async function llmCall(state: z.infer<typeof MessagesState>) {
  return {
    messages: await modelWithTools.invoke([
      new SystemMessage(
        "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
      ),
      ...state.messages,
    ]),
    llmCalls: (state.llmCalls ?? 0) + 1,
  };
}

async function toolNode(state: z.infer<typeof MessagesState>) {
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

export { llmCall, toolNode, shouldContinue };
