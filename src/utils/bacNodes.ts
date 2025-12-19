import { SystemMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import { ToolMessage } from "@langchain/core/messages";
import { END, Send } from "@langchain/langgraph";
import { AttackVectorSchema, AVSchema } from "./state.js";
import { model } from "./tools.js";
import * as z from "zod";
import { toolNode, tools, extractHttpResponse } from "./tools.js";
import { PentestState } from "./state.js";
import { BACSchema, BACState } from "./av_state.js";
import { StateGraph, START } from "@langchain/langgraph";
import { toolsCondition } from "@langchain/langgraph/prebuilt";
import { fi } from "zod/locales";

const analyzer = model.withStructuredOutput(BACSchema);
const toolCaller = model.bindTools(tools);

// define nodes for broken access control subgraph
async function BACAnalyzer(state: z.infer<typeof BACState>) {
  console.log("BACAnalyzer START");
  
  const attackScenario = await analyzer.invoke([
    {
      type: "system", 
      content: `You are a professional penetration tester analyzing HTTP requests to identify access control mechanisms and suggesting specific, actionable security test cases.

Your task is to:
1. Examine the provided HTTP request and determine the access control mechanism being used
2. Provide SPECIFIC, ACTIONABLE penetration testing test cases with exact steps

Look for these indicators:
1. JWT (JSON Web Token): "Authorization: Bearer" header with JWT pattern (three base64 parts separated by dots)
2. cookieSession: Session cookies like "PHPSESSID", "JSESSIONID", "connect.sid", "session_id" in Cookie header
3. Custom Header: Custom authentication headers like "X-Auth-Token", "X-API-Key", "X-Session-Id", "X-Custom-Auth"

HTTP Request to analyze:
{request_data}

You must respond in the following JSON format ONLY:
{
  "sessionType": "JWT|cookieSession|Custom Header",
  "testCases": [
    "specific actionable test case 1",
    "specific actionable test case 2",
    "specific actionable test case 3"
  ]
}

IMPORTANT: Test cases must be SPECIFIC and ACTIONABLE. Use this format for each test case:
"[Action]: [Exact manipulation] - [Expected result to check]"

Examples of GOOD test cases:

For JWT:
Decode first the header and payload using base64url decoding to inspect token contents. Then identify the following test cases:
- "Remove entire Authorization header - check if request still succeeds"
- "Delete signature portion (keep only header.payload.) - test if accepted"
- "Decode header, change algorithm to 'none' in header, re-encode and remove signature - bypass signature verification"
- "Modify 'alg' from RS256 to HS256 - attempt algorithm confusion attack"
- "Change 'sub' claim to another user ID - test horizontal privilege escalation"
- "Set 'exp' to future date - test if expiration validation works"
- "Replace entire token with another user's token - test authorization boundaries"
- "Decode payload, change role from 'user' to 'admin', re-encode without signing - test privilege escalation"

For cookieSession:
- "Remove session cookie entirely - check if authentication is bypassed"
- "Set session cookie to random value like 'test123' - test session validation"
- "Copy session cookie to another browser/IP - test session hijacking protection"
- "Modify session cookie value by changing one character - test integrity check"
- "Set custom session ID before login - test session fixation vulnerability"
- "Wait for session timeout period then reuse old cookie - test expiration enforcement"
- "Login twice and check if old session is invalidated - test concurrent session handling"
- "Decode base64 session data and modify user ID - test session data tampering"

For Custom Header:
- "Remove custom authentication header completely - check if request succeeds"
- "Set header value to empty string - test empty value validation"
- "Change header value to 'null' or 'undefined' - test null handling"
- "Modify one character in API key/token - test validation strictness"
- "Use header value from different user account - test horizontal privilege escalation"
- "Send request without the header but with valid cookie - test fallback mechanisms"
- "Change header name case (X-API-Key to x-api-key) - test case sensitivity"
- "Inject SQL/XSS payload in header value - test input sanitization"

Provide actionable test cases for the identified session type.
Return ONLY the JSON object, no additional text or markdown formatting.
`
    },
    {
      type: "user", 
      content: `Analyze the following HTTP request 
      ${JSON.stringify(state.input.scope[state.input.idxScope].request)}`
    },
    ...state.messages,
  ]);

    console.log("BACAnalyzer RESULT:", attackScenario);
    return {
        ...state,
        state: {
            sessionType: attackScenario.sessionType,
            testCases: attackScenario.testCases
        }
    }
}

async function toolCallerNode(state: z.infer<typeof BACState>) {
    console.log("toolCallerNode START");
    const result = await toolCaller.invoke([
        {
            type: "system",
            content: `You are a professional penetration tester executing security test cases using Burp Suite.

Your task is to execute the provided test case by manipulating the HTTP request according to the test case instructions and sending it via Burp Suite.

CONTEXT:
- Session Type: {session_type}
- HTTP Version: {http_version}
- Original Request: {original_request}
- Test Case to Execute: {test_case}

INSTRUCTIONS:
1. Analyze the test case and understand what manipulation needs to be done
2. Apply the exact manipulation described in the test case to the original request
3. Use the appropriate Burp Suite tool based on HTTP version:
   - For HTTP/1.1 or HTTP/1.0: Use send_http1_request
   - For HTTP/2: Use send_http2_request

MANIPULATION GUIDELINES:

For JWT test cases:
- "Remove entire Authorization header": Delete the entire "Authorization: Bearer ..." line
- "Delete signature portion": Remove everything after the second dot in JWT (header.payload.)
- "Change 'alg' to 'none'": Decode header, change algorithm to "none", re-encode, remove signature
- "Modify 'alg' from RS256 to HS256": Decode header, change "alg":"RS256" to "alg":"HS256"
- "Change 'sub' claim": Decode payload, modify 'sub' value, re-encode (keep signature invalid)
- "Change 'role' to 'admin'": Decode payload, modify role value, re-encode
- "Remove 'Bearer' prefix": Send only the token without "Bearer " prefix
- "Set 'exp' to future": Decode payload, change exp timestamp to far future

For cookieSession test cases:
- "Remove session cookie": Delete the session cookie from Cookie header
- "Set cookie to random value": Replace session ID with random string like "test123456"
- "Change last character": Modify the last character of session ID
- "Set custom session ID": Replace session ID with custom value like "attacker_session"
- "Modify cookie value": Change one or more characters in the cookie value
- "Use another user's cookie": Replace with a different session ID (simulated)

For Custom Header test cases:
- "Remove custom header": Delete the entire custom authentication header line
- "Set header to empty string": Keep header name but set value to ""
- "Change to 'null'": Set header value to the string "null"
- "Modify one character": Change one character in the header value
- "Change header case": Modify the header name case (e.g., X-API-Key to x-api-key)
- "Inject special characters": Add characters like <script>, ' OR '1'='1, etc.

IMPORTANT:
- Preserve all other headers and request structure
- Maintain proper HTTP syntax
- Keep the request method, path, and HTTP version intact
- Only modify what the test case specifically asks for

Now execute the test case by calling the appropriate Burp Suite tool with the manipulated request.
`
        },
        {
            type: "user",
            content: `Here is the context:
            - Session Type: ${state.state.sessionType}
            - HTTP Version: HTTP/1.1
            - Original Request: ${JSON.stringify(state.input.scope[state.input.idxScope].request)}
            - Test Case to Execute: ${state.state.testCases[0]}`
        },
        ...state.messages,
    ]);
    console.log(state.input.scope[state.input.idxScope].request);
    const call = result.tool_calls?.[0];
    if (!call) throw new Error("No tool call returned by model");

    // jalankan tool benerannya
    const tool = tools.find((t) => t.name === call.name);
    if (!tool) throw new Error(`Tool not found: ${call.name}`);

    const toolResult = await tool.invoke(call.args);

    console.log("toolCallerNode RESULT RAW:", toolResult);
    const responseJSON = await extractHttpResponse(toolResult);
    console.log("toolCallerNode RESULT EXTRACTED RESPONSE:", responseJSON);
    if (!responseJSON) throw new Error("Failed to extract HTTP response");

    return {
    ...state,
    input: {
        ...state.input,
        scope: state.input.scope.map((item, i) =>
        i === state.input.idxScope
            ? { ...item, response: responseJSON }
            : item
        ),
    },
    };
}

async function sendToOrganizer(state: z.infer<typeof BACState>) {
    console.log("sendToOrganizer START");
    const response = await toolCaller.invoke([
        {
            type: "system",
            content: `You are a professional penetration tester analyzing HTTP responses to determine if a security vulnerability exists.

Your task is to:
1. Analyze the HTTP response from the test case execution
2. Determine if the application is VULNERABLE or SECURE
3. If vulnerable, send the request to Burp Organizer with a descriptive note

CONTEXT:
- Session Type: {session_type}
- Test Case: {test_case}
- Target Port: {target_port}
- uses HTTPS: {uses_https}
- Target Host: {target_host}

ORIGINAL REQUEST:
{original_request}

RESPONSE RECEIVED:
{response}

VULNERABILITY ANALYSIS CRITERIA:

For JWT Tests:
- VULNERABLE if:
  * Request succeeds without Authorization header (status 200-299)
  * Request succeeds with invalid/removed signature
  * Request succeeds with algorithm set to "none"
  * Privilege escalation successful (role changed from user to admin and request succeeds)
  * Modified claims accepted without proper validation
- SECURE if:
  * Returns 401 Unauthorized or 403 Forbidden
  * Returns error message about invalid token/signature
  * Rejects tampered tokens properly

For Cookie Session Tests:
- VULNERABLE if:
  * Request succeeds without session cookie (status 200-299)
  * Accepts random/invalid session IDs
  * Session fixation possible (custom session ID accepted)
  * Modified session data accepted
  * No proper session validation
- SECURE if:
  * Returns 401/403 without valid session
  * Rejects invalid session IDs
  * Properly validates session integrity

For Custom Header Tests:
- VULNERABLE if:
  * Request succeeds without authentication header (status 200-299)
  * Accepts empty or null header values
  * No proper header validation
  * Accepts modified/invalid tokens
  * XSS/SQL injection in header not sanitized
- SECURE if:
  * Returns 401/403 without valid header
  * Properly validates header values
  * Rejects tampered values

RESPONSE ANALYSIS INDICATORS:
- Status Code: 200-299 (Success), 401 (Unauthorized), 403 (Forbidden), 400 (Bad Request)
- Response Body: Look for success messages, error messages, authentication failures
- Response Headers: Check for security headers, session management
- Content: Check if sensitive data is exposed, if action was performed

YOUR ANALYSIS MUST:
1. Examine the response status code, headers, and body
2. Determine if the test indicates a vulnerability based on the criteria above
3. Provide clear reasoning for your conclusion

IF VULNERABLE:
Call send_to_organizer_with_note tool with these parameters:
- request: the modified request that was sent
- host: the target host
- note: Format EXACTLY as "[VULN][BAC][{http_method} {endpoint} - {test_case_summary}]"
  
  Examples of correct note format:
  - "[VULN][BAC][GET /api/users - JWT signature removal accepted]"
  - "[VULN][BAC][POST /api/profile - Request succeeds without authentication header]"
  - "[VULN][BAC][GET /dashboard - Session cookie bypass possible]"
  - "[VULN][BAC][DELETE /api/user/123 - Privilege escalation via JWT role manipulation]"

IF SECURE:
Call send_to_organizer_with_note tool with these parameters:
- request: the modified request that was sent
- host: the target host
- note: Format EXACTLY as "[SECURE][BAC][{http_method} {endpoint} - {test_case_summary}]"
  
  Examples of correct note format:
  - "[SECURE][BAC][GET /api/users - Properly rejects invalid JWT signature]"
  - "[SECURE][BAC][POST /login - Requires valid authentication header]"
  - "[SECURE][BAC][GET /dashboard - Session validation working correctly]"

IMPORTANT RULES:
1. BAC stands for "Broken Access Control"
2. Note format must start with [VULN] or [SECURE], then [BAC], then [{METHOD} {endpoint} - {description}]
3. Keep the test case summary concise but descriptive (max 80 characters)
4. ALWAYS call send_to_organizer_with_note tool - never just return text analysis
5. Extract HTTP method from the request (GET, POST, PUT, DELETE, etc.)
6. Extract endpoint/path from the request
7. Be decisive - choose either VULN or SECURE based on the evidence

Now analyze the response and call send_to_organizer_with_note with the appropriate note then return .`
        },
        {
            type: "user",
            content: `Here is the context:
            - Session Type: ${state.state.sessionType}
            - Test Case: ${state.state.testCases[0]}
            - Target Port: ${state.input.scope[state.input.idxScope].request.url.startsWith("https") ? "443" : "80"}
            - Uses HTTPS: ${state.input.scope[state.input.idxScope].request.url.startsWith("https")}
            - Target Host: ${new URL(state.input.scope[state.input.idxScope].request.url).host}
            - Request: ${JSON.stringify(state.input.scope[state.input.idxScope].request)}
            - Response: ${JSON.stringify(state.input.scope[state.input.idxScope].response)}`
        },
        ...state.messages,
    ]);
    console.log(state.input.scope[state.input.idxScope].request);
    console.log(state.input.scope[state.input.idxScope].response);
    console.log("sendToOrganizer RAW RESPONSE:", response);
    const call = response.tool_calls?.[0];
    if (!call) throw new Error("No tool call returned by model");

    // jalankan tool benerannya
    const tool = tools.find((t) => t.name === call.name);
    if (!tool) throw new Error(`Tool not found: ${call.name}`);

    const toolResult = await tool.invoke(call.args);
    console.log("sendToOrganizer RESULT:", toolResult);
    return { ...state  };
}

async function aggregateResults(state: z.infer<typeof BACState>) {
    console.log("aggregateResults START");
    const finding = await analyzer.invoke([
        {
            type: "system",
            content: `You are a professional penetration tester analyzing HTTP responses to determine if a security vulnerability exists.

Your task is to:
1) Analyze the HTTP response from the test case execution
2) Determine if the test indicates a security finding (Broken Access Control related)
3) Return a single JSON object that matches FindingSchema exactly

CONTEXT:
- Session Type: {session_type}
- Test Case: {test_case}
- HTTP Method: {http_method}
- Endpoint: {endpoint}

ORIGINAL REQUEST:
{original_request}

MODIFIED REQUEST (sent):
{modified_request}

RESPONSE RECEIVED:
{response}

VULNERABILITY ANALYSIS CRITERIA:

For JWT Tests:
- VULNERABLE if:
  * Request succeeds without Authorization header (status 200-299)
  * Request succeeds with invalid/removed signature
  * Request succeeds with algorithm set to "none"
  * Privilege escalation successful (role changed from user to admin and request succeeds)
  * Modified claims accepted without proper validation
- SECURE if:
  * Returns 401 Unauthorized or 403 Forbidden
  * Returns error message about invalid token/signature
  * Rejects tampered tokens properly

For Cookie Session Tests:
- VULNERABLE if:
  * Request succeeds without session cookie (status 200-299)
  * Accepts random/invalid session IDs
  * Session fixation possible (custom session ID accepted)
  * Modified session data accepted
  * No proper session validation
- SECURE if:
  * Returns 401/403 without valid session
  * Rejects invalid session IDs
  * Properly validates session integrity

For Custom Header Tests:
- VULNERABLE if:
  * Request succeeds without authentication header (status 200-299)
  * Accepts empty or null header values
  * No proper header validation
  * Accepts modified/invalid tokens
  * XSS/SQL injection in header not sanitized
- SECURE if:
  * Returns 401/403 without valid header
  * Properly validates header values
  * Rejects tampered values

RESPONSE ANALYSIS INDICATORS:
- Status Code: 200-299 (Success), 401 (Unauthorized), 403 (Forbidden), 400 (Bad Request)
- Response Body: Look for success messages, error messages, authentication failures
- Response Headers: Check for security headers, session management
- Content: Check if sensitive data is exposed, if action was performed

OUTPUT REQUIREMENTS (MUST FOLLOW):
Return ONLY a valid JSON object matching this schema:

FindingSchema:
- kind: string
- severity: one of ["N/A","low","medium","high","critical"] (default "N/A")
- cvss: string (default "N/A")
- url: a valid URL string
- evidenceSummary: string (default "N/A")

How to fill fields:
- kind:
  Use a concise label. Examples:
  - "BAC: JWT bypass"
  - "BAC: Session cookie bypass"
  - "BAC: Missing auth header accepted"
  - "BAC: Privilege escalation"
  - "BAC: Access control enforced" (if secure)
- severity:
  - critical: clear privilege escalation / admin action accessible
  - high: protected resource accessible without auth (200-299)
  - medium: partial bypass / inconsistent enforcement / info exposure with auth impact
  - low: suspicious but limited impact
  - "N/A": clearly secure / no finding
- cvss:
  Put a plausible CVSS vector/string if vulnerable, else "N/A"
- url:
  Construct from target host + {endpoint}. If host is not available, use {endpoint} only if it is already an absolute URL; otherwise set "N/A" is NOT allowed because url must be valid — so prefer using "http://{host}{endpoint}" when host exists, or "http://localhost{endpoint}" as a fallback.
- evidenceSummary:
  Summarize the proof in 1–3 sentences:
  include status code, what was removed/modified, and what sensitive effect occurred.
  Keep it short.

Decision rule:
- If criteria indicates VULNERABLE => produce a finding with severity != "N/A"
- If criteria indicates SECURE => produce a finding with severity "N/A" and kind "BAC: Access control enforced"

Now analyze the response and return ONLY the JSON object.
`        },
        {
            type: "user",
            content: `Here is the context:
            - Session Type: ${state.state.sessionType}
            - Test Case: ${state.state.testCases[0]}
            - HTTP Method: ${state.input.scope[state.input.idxScope].request.method}
            - Endpoint: ${new URL(state.input.scope[state.input.idxScope].request.url).pathname}
            - Original Request: ${JSON.stringify(state.input.scope[state.input.idxScope].request)}
            - Response: ${JSON.stringify(state.input.scope[state.input.idxScope].response)}`
        },
        ...state.messages,
    ]);
    console.log("aggregateResults RESULT:", finding);
    return {
        ...state,
        output: {
            ...state.output,
            findings: [...state.output.findings, finding]
        },
        state: {
            ...state.state,
            testCases: state.state.testCases.slice(1)
        }
    }
}

async function checkTestCasesLeft(state: z.infer<typeof BACState>) {
    console.log("checkTestCasesLeft START");
    if (state.state.testCases.length > 0) {
        console.log("Test cases remaining, looping back to toolCaller");
        return "toolCaller";
    } else {
        console.log("No test cases left, proceeding to END");
        return END;
    }
}


const bacSubgraph = new StateGraph(BACState)
    .addNode("analyzer", BACAnalyzer)
    .addNode("sendToOrganizer", sendToOrganizer)
    .addNode("aggregateResults", aggregateResults)
    .addNode("toolCaller", toolCallerNode)
    .addEdge(START, "analyzer")
    .addEdge(
    "analyzer",
    "toolCaller")
    .addEdge(
    "toolCaller",
    "sendToOrganizer")
    .addEdge("sendToOrganizer", "aggregateResults")
    .addConditionalEdges(
        "aggregateResults",
        checkTestCasesLeft,
        ["toolCaller", END]
    );
export const compiledBACSubgraph = bacSubgraph.compile();

