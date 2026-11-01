/**
 * apphost-port MCP server. Core subset: 12 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiBaseFromEnv, apiKeyFromEnv, callTool, VERSION } from "./render.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  list_services: z.object({ limit: z.number().optional(), type: z.string().optional() }),
  get_service: z.object({ service_id: z.string() }),
  create_service: z.object({ name: z.string(), repo: z.string(), owner_id: z.string(), branch: z.string().optional(), type: z.string().optional() }),
  update_service: z.object({ service_id: z.string(), name: z.string().optional(), branch: z.string().optional(), auto_deploy: z.boolean().optional() }),
  delete_service: z.object({ service_id: z.string() }),
  suspend_service: z.object({ service_id: z.string() }),
  resume_service: z.object({ service_id: z.string() }),
  list_deploys: z.object({ service_id: z.string(), limit: z.number().optional() }),
  get_deploy: z.object({ service_id: z.string(), deploy_id: z.string() }),
  trigger_deploy: z.object({ service_id: z.string(), clear_cache: z.boolean().optional() }),
  list_env_vars: z.object({ service_id: z.string() }),
  list_service_logs: z.object({ service_id: z.string(), limit: z.number().optional() }),
};

export const TOOLS = [
  {
    name: "list_services",
    description: "List Render services.",
    inputSchema: { type: "object" as const, properties: { limit: { type: "number", description: "Maximum number of services to return." }, type: { type: "string", description: "Only return services of this type, such as web_service." } }, required: [] as string[] },
  },
  {
    name: "get_service",
    description: "Retrieve a single Render service by ID.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service to retrieve." } }, required: ["service_id"] },
  },
  {
    name: "create_service",
    description: "Create a Render service.",
    inputSchema: { type: "object" as const, properties: { name: { type: "string", description: "Name for the new service." }, repo: { type: "string", description: "Git repository URL to deploy for the service." }, owner_id: { type: "string", description: "ID of the owner (user or team) that will own the service." }, branch: { type: "string", description: "Git branch to deploy; if omitted the repository default branch is used." }, type: { type: "string", description: "Type of service to create, such as web_service; defaults to web_service." } }, required: ["name", "repo", "owner_id"] },
  },
  {
    name: "update_service",
    description: "Update a Render service by ID.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service to update." }, name: { type: "string", description: "New name for the service." }, branch: { type: "string", description: "Git branch the service should deploy from." }, auto_deploy: { type: "boolean", description: "Whether the service automatically deploys on new commits to its branch." } }, required: ["service_id"] },
  },
  {
    name: "delete_service",
    description: "Delete a Render service by ID.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service to delete." } }, required: ["service_id"] },
  },
  {
    name: "suspend_service",
    description: "Suspend a Render service by ID.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service to suspend." } }, required: ["service_id"] },
  },
  {
    name: "resume_service",
    description: "Resume a Render service by ID.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the suspended Render service to resume." } }, required: ["service_id"] },
  },
  {
    name: "list_deploys",
    description: "List deploys for a Render service.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service whose deploys to list." }, limit: { type: "number", description: "Maximum number of deploys to return." } }, required: ["service_id"] },
  },
  {
    name: "get_deploy",
    description: "Retrieve a single deploy for a Render service by ID.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service that owns the deploy." }, deploy_id: { type: "string", description: "ID of the deploy to retrieve." } }, required: ["service_id", "deploy_id"] },
  },
  {
    name: "trigger_deploy",
    description: "Trigger a new deploy for a Render service.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service to deploy." }, clear_cache: { type: "boolean", description: "Whether to clear the build cache for this deploy." } }, required: ["service_id"] },
  },
  {
    name: "list_env_vars",
    description: "List environment variables for a Render service.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service whose environment variables to list." } }, required: ["service_id"] },
  },
  {
    name: "list_service_logs",
    description: "List logs for a Render service.",
    inputSchema: { type: "object" as const, properties: { service_id: { type: "string", description: "ID of the Render service whose logs to list." }, limit: { type: "number", description: "Maximum number of log entries to return." } }, required: ["service_id"] },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "apphost-port", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const key = apiKeyFromEnv();
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, key, apiBaseFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
