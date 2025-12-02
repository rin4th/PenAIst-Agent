import { MessagesZodMeta, task } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";
import { type BaseMessage } from "@langchain/core/messages";
import * as z from "zod";

const MessagesState = z.object({
  messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta as unknown as any),
  llmCalls: z.number().optional(),
});

const routeSchema = z.object({
  step: z.enum(["poem", "story", "joke"]).describe(
    "The next step in the routing process"
  ),
});

const TaskSchema = z.object({
  id: z.string(),
  case: z.enum(["crawl", "xss_probe", "sqli_probe"]),
  target: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
});

const FindingSchema = z.object({
  id: z.string(),
  kind: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  cvss: z.string().optional(),
  url: z.url(),
  evidenceSummary: z.string().optional(),
});

const RequestSchema = z.object({
  method: z.string(),
  url: z.url(),
  header: z.array(z.object({})),
  body: z.array(z.object({})).optional(),
});

const ResponseSchema = z.object({
  statusCode: z.number(),
  header: z.array(z.object({})),
  body: z.array(z.object({})).optional(),
});

const ScopeSchema = z.object({
  name: z.string(),
  request: RequestSchema,
  response: ResponseSchema,
});

const InputState = z.object({
  scope: z.array(ScopeSchema),
  isIFA: z.boolean().optional(),
  additionalInfo: z.string().optional(),
});

const OutputState = z.object({
  findings: z.array(FindingSchema).optional(),
  reports: z.array(z.object({})).optional(),
});

const PentestState = z.object({
  messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta),
  input: InputState,
  output: OutputState.optional(),
  tasks: z.array(TaskSchema).optional(),

});

export { PentestState, ScopeSchema };