import { MessagesZodMeta, task } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";
import { type BaseMessage } from "@langchain/core/messages";
import * as z from "zod";

const MessagesState = z.object({
  messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta as unknown as any),
  llmCalls: z.number().default(0),
});

const routeSchema = z.object({
  step: z.enum(["poem", "story", "joke"]).describe(
    "The next step in the routing process"
  ),
});

const AVSchema = z.object({
  name: z.array(z.string()).describe(
    "Array of attack node names (sqliNode, xssNode, commandInjectionNode, inputValidationNode, bacNode)"
  )
});

const AttackVectorSchema = z.object({
  name: z.enum(["sqliNode", "xssNode", "inputValidationNode", "commandInjectionNode", "bacNode"]).describe("Name of the attack vector"),
  description: z.string().describe("Description of the attack vector"),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).describe("Status of the attack vector"),
  recommendation: z.string().describe("Recommendation to mitigate the attack vector"),
});

const TaskSchema = z.object({
  case: z.enum(["crawl", "xss_probe", "sqli_probe"]),
  target: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
});

const FindingSchema = z.object({
  kind: z.string(),
  severity: z.enum(["N/A","low", "medium", "high", "critical"]).default("N/A"),
  cvss: z.string().default("N/A"),
  url: z.url(),
  evidenceSummary: z.string().default("N/A"),
});

const RequestSchema = z.object({
  method: z.string(),
  url: z.url(),
  header:  z.record(z.string(), z.string()).default({}),
  body: z.record(z.string(), z.any()).default({}),
});

const ResponseSchema = z.object({
  statusCode: z.string(),
  header:  z.record(z.string(), z.string()).default({}),
  body: z.record(z.string(), z.any()).default({}),
});

const ScopeSchema = z.object({
  name: z.string(),
  request: RequestSchema,
  response: ResponseSchema,
  attackVector: z.array(AttackVectorSchema),
  idxAV: z.number().default(0),
});

const InputState = z.object({
  scope: z.array(ScopeSchema),
  idxScope: z.number().default(0),
  isIFA: z.boolean().default(false),
  additionalInfo: z.string().default("N/A"),
});

const OutputState = z.object({
  findings: z.array(FindingSchema).default([]),
  reports: z.array(z.object({})).default([]),
});

const PentestState = z.object({
  messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta as unknown as any),
  input: InputState,
  output: OutputState.default({findings: [], reports: []}),

});

export {
  MessagesState,
  routeSchema,
  AVSchema,
  AttackVectorSchema,
  TaskSchema,
  FindingSchema,
  RequestSchema,
  ResponseSchema,
  ScopeSchema,
  InputState,
  OutputState,
  PentestState
};
