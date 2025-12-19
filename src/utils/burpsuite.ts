import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';


const transport = new SSEClientTransport(
  new URL("http://127.0.0.1:9876/sse")
);

const client = new Client({
  name: "mcp-burp-client",
  version: "1.0.0",
});

await client.connect(transport);

const tools = await client.listTools();
console.log("\nBurp Tools:");
console.log(JSON.stringify(tools, null, 2));
