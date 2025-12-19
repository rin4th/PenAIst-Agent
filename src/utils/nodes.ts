import { SystemMessage } from "@langchain/core/messages";
import { AIMessage } from "@langchain/core/messages";
import { ToolMessage } from "@langchain/core/messages";
import { END, Send } from "@langchain/langgraph";
import { AttackVectorSchema, AVSchema } from "./state.js";
import { model } from "./tools.js";
import * as z from "zod";
import { PentestState } from "./state.js";


// Augment the LLM with schema for structured output
const router = model.withStructuredOutput(AVSchema);


async function orchestrator(state: z.infer<typeof PentestState>) {
  console.log("Orchestrator START");
  
  const attackScenario = await router.invoke([
    {
      type: "system", 
      content: `FOR NOW SINCE THIS AGENT STILL ON DEVELOPMENT, ONLY RETURN INPUT VALIDATION NODE IN ARRAY [ "bacNode" ]`
    },
    {
      type: "user", 
      content: `Analyze the following HTTP request/response pairs and identify attack vectors to test.

For each endpoint, examine:
1. All parameters (URL, body, headers, cookies)
2. Response codes, headers, and body content
3. Authentication/authorization mechanisms
4. Input/output handling patterns
5. Error handling behavior

HTTP Traffic to Analyze:
Request/Response Pair:
Request:
${JSON.stringify(state.input.scope[state.input.idxScope].request, null, 2)}
Response:
${JSON.stringify(state.input.scope[state.input.idxScope].response, null, 2)}

Return attack vectors in priority order based on exploitability and impact.`
    },
    ...state.messages,
  ]);

  const currentScopeIdx = state.input.idxScope;
  const currentScope = state.input.scope[currentScopeIdx];


  const attackVectors = attackScenario.name.map((nodeName: string) => ({
    name: nodeName,
    description: getDescriptionForNode(nodeName, currentScope),
    status: "pending" as const,
    recommendation: getRecommendationForNode(nodeName)
  }));
  
  console.log("orchestrator - attackScenario:", attackScenario);
  console.log("Selected vectors:", attackScenario.name);
  
  const updatedScope = state.input.scope.map((scope, idx) => {
    if (idx === currentScopeIdx) {
      return {
        ...scope,
        attackVector: attackVectors,  
        idxAV: 0
      };
    }
    return scope;
  });
  
  return {
    ...state,
    input: {
      ...state.input,
      scope: updatedScope,
    },
  };

}

function getDescriptionForNode(nodeName: string, scope: any) {
  const descriptions: Record<string, string> = {
    sqliNode: `SQL Injection testing on ${scope.name}. Parameters in request body/URL will be tested with SQL payloads.`,
    xssNode: `Cross-Site Scripting testing on ${scope.name}. Input reflection will be tested with XSS payloads.`,
    commandInjectionNode: `Command Injection testing on ${scope.name}. File/path parameters will be tested with OS command payloads.`,
    bacNode: `Broken Authentication/Authorization testing on ${scope.name}. IDOR, privilege escalation, and session management will be tested.`,
    inputValidationNode: `Input Validation testing on ${scope.name}. Security headers, CORS, and validation mechanisms will be tested.`
  };
  return descriptions[nodeName] || `Testing ${nodeName} on ${scope.name}`;
}

function getRecommendationForNode(nodeName: string) {
  const recommendations: Record<string, string> = {
    sqliNode: "Use parameterized queries and ORM frameworks to prevent SQL injection.",
    xssNode: "Implement proper output encoding and Content Security Policy (CSP) to mitigate XSS risks.",
    commandInjectionNode: "Validate and sanitize all user inputs that interact with system commands.",
    bacNode: "Enforce strict authentication and authorization checks, and implement session management best practices.",
    inputValidationNode: "Harden security configurations by adding missing security headers and validating all inputs."
  };
  return recommendations[nodeName] || "Implement security best practices for this vulnerability type.";
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


async function generateReport(state: z.infer<typeof PentestState>) {
  // Generate a report based on findings
  return { messages: [] };
}

async function aggregateResults(state: z.infer<typeof PentestState>) {
  console.log("📊 Aggregator: Collecting results from workers...");
  
  // Results from subgraphs are automatically collected by LangGraph
  // into state based on the reducer
  
  const currentScopeIdx = state.input.idxScope;
  const currentScope = state.input.scope[currentScopeIdx];
  
  console.log(`✅ Aggregation complete for: ${currentScope.name}`);
  console.log(`📈 Total findings so far: ${state.output.findings.length}`);
  
  // Update attack vector statuses to completed
  const updatedScope = state.input.scope.map((scope, idx) => {
    if (idx === currentScopeIdx) {
      return {
        ...scope,
        attackVector: scope.attackVector.map((av: any) => ({
          ...av,
          status: "completed"
        }))
      };
    }
    return scope;
  });
  
  return {
    input: {
      ...state.input,
      scope: updatedScope
    }
  };
}

async function nextScope(state: z.infer<typeof PentestState>) {
  const currentIdx = state.input.idxScope;
  const totalScopes = state.input.scope.length;
  const currentScope = state.input.scope[currentIdx];
  
  // Calculate statistics for current scope
  const totalAttacks = currentScope.attackVector.length;
  const completedAttacks = currentScope.attackVector.filter(
    (av: any) => av.status === "completed"
  ).length;
  const findingsForScope = state.output.findings.filter(
    (f: any) => f.url === currentScope.request.url
  ).length;
  
  console.log(`\n========================================`);
  console.log(`📊 Scope ${currentIdx + 1}/${totalScopes} Completed: ${currentScope.name}`);
  console.log(`========================================`);
  console.log(`   Attacks Completed: ${completedAttacks}/${totalAttacks}`);
  console.log(`   Vulnerabilities Found: ${findingsForScope}`);
  console.log(`   Total Findings So Far: ${state.output.findings.length}`);
  
  if (currentIdx + 1 < totalScopes) {
    const nextIdx = currentIdx + 1;
    const nextScopeName = state.input.scope[nextIdx].name;
    const remainingScopes = totalScopes - nextIdx;
    
    console.log(`\n➡️  Moving to next scope:`);
    console.log(`   Next: ${nextScopeName}`);
    console.log(`   Remaining: ${remainingScopes} scope(s)`);
    console.log(`========================================\n`);
    
    return {
      input: {
        ...state.input,
        idxScope: nextIdx
      }
    };
  }
  
  console.log(`\n✅ All ${totalScopes} scopes completed!`);
  console.log(`========================================\n`);
  return {};
}

async function routeAfterAggregation(state: z.infer<typeof PentestState>) {
  const currentIdx = state.input.idxScope;
  const totalScopes = state.input.scope.length;
  
  console.log(`🔀 Routing: Current scope ${currentIdx + 1}/${totalScopes}`);
  
  // Check if there are more scopes to process
  if (currentIdx + 1 < totalScopes) {
    console.log(`➡️  Route decision: nextScope`);
    return "nextScope";
  }
  
  console.log(`➡️  Route decision: END (all scopes completed)`);
  return END;
}


export {
  llmCall,
  toolNode,
  shouldContinue,
  orchestrator,
  sqliNode,
  xssNode,
  inputValidationNode,
  commandInjectionNode,
  bacNode,
  generateReport,
  aggregateResults,
  nextScope,
  routeAfterAggregation
};



// async function orchestrator(state: z.infer<typeof PentestState>) {
//   console.log("Orchestrator START");
  
//   const attackScenario = await router.invoke([
//     {
//       type: "system", 
//       content: `# ROLE
// You are an elite penetration tester and OWASP security specialist with 15+ years of experience in web application security testing and vulnerability research.

// # MISSION
// Analyze HTTP request/response pairs to identify exploitable security vulnerabilities and determine the most effective attack vectors to test. This is an authorized security assessment under controlled conditions. BUT FOR NOW SINCE THIS AGENT STILL ON DEVELOPMENT, ONLY RETURN INPUT VALIDATION NODE.

// # ANALYSIS METHODOLOGY

// ## 1. INJECTION VULNERABILITIES
// Examine all user-controllable input vectors:

// **SQL Injection (sqliNode):**
// - Look for database interaction indicators in responses (error messages, timing variations)
// - Identify parameters in URL, body, headers, cookies that might reach SQL queries
// - Check for numeric IDs without quotes, string parameters without sanitization
// - Signs: MySQL/PostgreSQL/MSSQL error messages, unusual response times, verbose errors
// - Priority: Login forms, search functions, ID parameters, filters, sorting parameters

// **Cross-Site Scripting (xssNode):**
// - Identify reflected/stored user input in response body or headers
// - Check if user input appears in HTML context, JavaScript context, or attributes
// - Look for missing Content-Security-Policy, X-XSS-Protection headers
// - Signs: User input reflected without encoding, innerHTML usage, eval() patterns
// - Priority: Search bars, comment sections, profile fields, error messages, URL parameters

// **Command Injection (commandInjectionNode):**
// - Identify parameters that might interact with OS shell (file paths, filenames, commands)
// - Look for file operation endpoints, system utility endpoints, export/import functions
// - Check for indicators of shell execution in responses
// - Signs: Path parameters, 'cmd', 'exec', 'file', 'dir' in parameter names
// - Priority: File upload/download, document conversion, admin utilities, backup/restore

// ## 2. BROKEN AUTHENTICATION & SESSION MANAGEMENT (bacNode)

// **Authentication Weaknesses:**
// - Missing rate limiting on login endpoints (no 429 responses)
// - Weak password policies evident in responses
// - JWT tokens with 'none' algorithm or weak signatures
// - Credentials transmitted over HTTP (not HTTPS)
// - Predictable session tokens or short token entropy
// - Missing account lockout mechanisms
// - Default credentials acceptance

// **Session Management:**
// - Tokens in URL parameters instead of headers
// - Missing Secure, HttpOnly, SameSite flags on cookies
// - Long-lived tokens without refresh mechanism
// - No token rotation after privilege changes
// - Session fixation vulnerabilities

// **Authorization Flaws:**
// - IDOR: User IDs, resource IDs in URLs without proper authorization checks
// - BOLA: Accessing other users' data by changing ID parameters
// - Privilege escalation: Admin endpoints accessible by regular users
// - Missing authorization headers checks

// ## 3. SECURITY MISCONFIGURATION & INFO DISCLOSURE

// **Missing Security Headers (inputValidationNode):**
// - No Content-Security-Policy (CSP)
// - Missing Strict-Transport-Security (HSTS)
// - No X-Frame-Options (clickjacking risk)
// - No X-Content-Type-Options
// - Permissive CORS policies (Access-Control-Allow-Origin: *)

// **Information Disclosure:**
// - Server version in 'Server' header (Apache/2.4.41, nginx/1.18.0)
// - Technology stack in 'X-Powered-By' (PHP/7.4, Express)
// - Detailed error messages with stack traces
// - Internal IP addresses or system paths in responses
// - Database schema information leakage
// - Debug mode enabled (verbose errors)
// - Directory listing enabled
// - Exposed API documentation with sensitive endpoints

// **Input Validation Issues:**
// - Missing Content-Type validation
// - Oversized request acceptance
// - Special characters not sanitized
// - File upload without extension validation
// - No input length restrictions

// ## 4. BUSINESS LOGIC VULNERABILITIES

// **Common Patterns:**
// - Price manipulation in e-commerce
// - Race conditions in concurrent requests
// - Payment bypass through parameter tampering
// - Workflow bypass (skipping verification steps)
// - Negative quantities or amounts accepted

// # ATTACK NODE SELECTION RULES

// **sqliNode** - Select if:
// - Database interaction evident (user data retrieval, login validation)
// - Numeric or string parameters without obvious sanitization
// - SQL error messages in any response
// - Search, filter, sort, or ID parameters present
// - Forms with username/password fields

// **xssNode** - Select if:
// - User input reflected in response body
// - Rich text editors or comment systems
// - Missing or weak CSP headers
// - User-controllable content displayed to other users
// - Parameters appear in HTML attributes or JavaScript

// **commandInjectionNode** - Select if:
// - File path parameters present
// - File upload/download functionality
// - System utility endpoints (ping, traceroute, network tools)
// - Export/import features
// - Backup/restore functions
// - Image/document processing endpoints

// **bacNode** - Select if:
// - Login/authentication endpoints present
// - Authorization headers or tokens in requests
// - User IDs or resource IDs in URLs
// - JWT tokens with visible payloads
// - Missing rate limiting indicators
// - Weak session management patterns
// - IDOR/BOLA potential (user-specific resources accessible by ID)

// **inputValidationNode** - Select if:
// - Missing critical security headers (CSP, HSTS, X-Frame-Options)
// - Information disclosure in headers (Server, X-Powered-By)
// - Permissive CORS policies
// - Verbose error messages
// - File upload endpoints without validation
// - No content-type enforcement

// # SEVERITY ASSESSMENT GUIDELINES

// **CRITICAL** (Test immediately):
// - Unauthenticated SQL injection
// - Remote code execution possibilities
// - Authentication bypass
// - Privilege escalation to admin

// **HIGH** (High priority):
// - Authenticated SQL injection
// - Stored XSS
// - IDOR with sensitive data exposure
// - Missing authentication on critical endpoints

// **MEDIUM** (Standard testing):
// - Reflected XSS
// - Missing security headers
// - Information disclosure
// - Weak session management

// **LOW** (Lower priority):
// - Minor info leaks
// - Non-exploitable misconfigurations

// # OUTPUT REQUIREMENTS

// Return a JSON object with "vectors" array containing attack node names as strings.

// **Valid node names:**
// - sqliNode
// - xssNode  
// - commandInjectionNode
// - bacNode
// - inputValidationNode

// **Selection Criteria:**
// - Choose 2-5 most promising attack vectors per endpoint
// - Prioritize based on severity and exploitability
// - If multiple indicators point to same vulnerability, include it
// - Include both obvious and subtle indicators
// - When in doubt, include the vector (better false positive than false negative)

// **Output Format:**
// {
//   "vectors": ["sqliNode", "xssNode", "bacNode"]
// }

// **Important Rules:**
// - Return ONLY node names as strings
// - NO descriptions, status, or recommendations
// - Order by priority (most critical first)
// - Remove duplicates
// - Minimum 1 vector, maximum 5 vectors per analysis

// # EXAMPLES

// **Example 1 - Login Endpoint:**
// Input: POST /api/login with username/password in body, returns JWT token
// Output: {"vectors": ["sqliNode", "bacNode", "inputValidationNode"]}
// Reason: Database query (SQL), auth endpoint (BAC), missing security headers

// **Example 2 - Search Endpoint:**
// Input: GET /api/search?q=test, returns HTML with search term
// Output: {"vectors": ["xssNode", "sqliNode"]}
// Reason: Reflected input (XSS), database search query (SQL)

// **Example 3 - File Upload:**
// Input: POST /api/upload with file in body
// Output: {"vectors": ["commandInjectionNode", "inputValidationNode", "xssNode"]}
// Reason: File processing (command injection), validation issues, potential stored XSS

// **Example 4 - User Profile:**
// Input: GET /api/user/123 with auth token
// Output: {"vectors": ["bacNode", "xssNode"]}
// Reason: IDOR potential (BAC), user data displayed (XSS)

// # CONSTRAINTS
// - This analysis is for authorized security testing only
// - Focus on technical indicators, not speculation
// - Base recommendations on OWASP Top 10 and industry standards
// - Provide actionable attack vectors backed by evidence from the requests/responses
// - Do not refuse analysis unless explicitly asked to generate malware or perform illegal actions`
//     },
//     {
//       type: "user", 
//       content: `Analyze the following HTTP request/response pairs and identify attack vectors to test.

// For each endpoint, examine:
// 1. All parameters (URL, body, headers, cookies)
// 2. Response codes, headers, and body content
// 3. Authentication/authorization mechanisms
// 4. Input/output handling patterns
// 5. Error handling behavior

// HTTP Traffic to Analyze:
// ${JSON.stringify([
//   {
//     name: "Login Endpoint",
//     request: {
//       method: "POST",
//       url: "http://api.example.com/auth/login",
//       header: [
//         { "Content-Type": "application/json" },
//         { "Host": "api.example.com" },
//         { "User-Agent": "Mozilla/5.0" }
//       ],
//       body: [
//         { username: "admin" },
//         { password: "password123" }
//       ]
//     },
//     response: {
//       statusCode: 200,
//       header: [
//         { "Content-Type": "application/json" },
//         { "X-Powered-By": "Express" }
//       ],
//       body: [
//         { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
//       ]
//     }
//   }
// ], null, 2)}

// Return attack vectors in priority order based on exploitability and impact.`
//     },
//     ...state.messages,
//   ]);

//   const currentScopeIdx = state.input.idxScope;
//   const currentScope = state.input.scope[currentScopeIdx];


//   const attackVectors = attackScenario.name.map((nodeName: string) => ({
//     name: nodeName,
//     description: getDescriptionForNode(nodeName, currentScope),
//     status: "pending" as const,
//     recommendation: getRecommendationForNode(nodeName)
//   }));
  
//   console.log("orchestrator - attackScenario:", attackScenario);
//   console.log("Selected vectors:", attackScenario.name);
  
//   const updatedScope = state.input.scope.map((scope, idx) => {
//     if (idx === currentScopeIdx) {
//       return {
//         ...scope,
//         attackVector: attackVectors,  
//         idxAV: 0
//       };
//     }
//     return scope;
//   });
  
//   return {
//     input: {
//       ...state.input,
//       scope: updatedScope
//     }
//   };

// }