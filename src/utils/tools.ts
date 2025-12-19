import { ChatAnthropic } from "@langchain/anthropic";
import dotenv from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";



dotenv.config();

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
})

// Define tools

const mcp = new MultiServerMCPClient({
  burp: { transport: "sse", url: "http://127.0.0.1:9876" },
});
const tools = await mcp.getTools();
const toolNode = new ToolNode(tools);

async function extractHttpResponse(result: any): {
  statusCode: string;
  header: Record<string, string>;
  body: Record<string, any>;
} | null {
  const raw =
    typeof result?.text === "string"
      ? result.text
      : typeof result === "string"
      ? result
      : Array.isArray(result?.content)
      ? result.content.map((c: any) => c?.text ?? "").join("")
      : typeof result?.content === "string"
      ? result.content
      : null;

  if (!raw) return null;

  const marker = "httpResponse=";
  const i = raw.indexOf(marker);
  if (i === -1) return null;

  const http = raw.slice(i + marker.length).trim();

  const [head, ...rest] = http.split("\r\n\r\n");
  const bodyText = rest.join("\r\n\r\n").trim();

  const statusLine = head.split("\r\n")[0] ?? "";
  const statusCode = statusLine.split(" ")[1] ?? "N/A";

  const headerLines = head.split("\r\n").slice(1);
  const headerObj: Record<string, string> = {};
  for (const line of headerLines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k) headerObj[k] = v;
  }

  let bodyObj: any = {};
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      bodyObj = typeof parsed === "object" && parsed !== null ? parsed : { value: parsed };
    } catch {
      bodyObj = { raw: bodyText };
    }
  }

  return {
    statusCode: String(statusCode),
    header: headerObj,
    body: bodyObj,
  };
}



export { tools, toolNode, model, extractHttpResponse };