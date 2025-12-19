import { MessagesZodMeta, task } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";
import { type BaseMessage } from "@langchain/core/messages";
import * as z from "zod";
import { InputState } from "./state.ts";
import { OutputState } from "./state.ts";

const PentestState = z.object({
  messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta as unknown as any),
  input: InputState,
  output: OutputState.default({findings: [], reports: []}),

});

const SqliSchema = z.object({
  payload: z.string().describe("The SQL injection payload to be used."),
  parameter: z.array(z.object({})).describe("List of parameters should be tested for SQL injection."),
});

const InputValidationSchema = z.object({
  issueDescription: z.string().describe("Description of the input validation issue."),
  affectedParameters: z.array(z.object({
    paramName: z.object({}).describe("The name and value of the affected parameter."),
    typeIssue: z.string().describe("The type of issue affecting the parameter."),
  })).describe("List of parameters affected by input validation issues.").default([]),
  totalParam: z.number().describe("Total number of parameters in the request."),
});

const BACSchema = z.object({
  vulnerabilityDetails: z.string().describe("Details about the broken access control vulnerability."),
  sessionType: z.string().describe("Type of session management used (e.g., JWT, cookieSession, Custom Header)."),
  testCases: z.array(z.string()).describe("Test cases have been tried the broken access control.").default([]),
});

const SQLIState = z.object({
    messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta as unknown as any),
    input: SqliSchema,
    output: OutputState.default({findings: [], reports: []}),
    state: SqliSchema,
});

const BACState = z.object({
    messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta as unknown as any),
    input: InputState,
    output: OutputState.default({findings: [], reports: []}),
    state: BACSchema,
});

const InputValidationState = z.object({
    messages: z
    .array(z.custom<BaseMessage>())
    .register(registry, MessagesZodMeta as unknown as any),
    input: InputState,
    output: OutputState.default({findings: [], reports: []}),
    state: InputValidationSchema,
});

export {
    PentestState,
    InputValidationSchema,
    SqliSchema,
    SQLIState,
    BACSchema,
    BACState,
    InputValidationState
}