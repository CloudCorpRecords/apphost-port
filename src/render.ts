/**
 * apphost-port core: a 12-tool core subset of the Render MCP server
 * surface, implemented clean-room against the public Render REST API
 * (https://api.render.com/v1, base overridable via
 * RENDER_API_BASE_URL).
 *
 * Auth: RENDER_API_KEY, sent as `Authorization: Bearer`, with
 * `Accept: application/json` on every request. A missing key is an
 * error naming the variable. All HTTP goes through an injected
 * FetchFn so the wire behaviour is fully testable offline.
 *
 * Note: the original is Render's official hosted MCP (remote/OAuth);
 * hosted OAuth NOT reproduced — this is an API-key REST client for
 * the same API.
 */
import type {
  CreateServiceOptions,
  DeleteServiceOptions,
  FetchFn,
  GetDeployOptions,
  GetServiceOptions,
  ListDeploysOptions,
  ListEnvVarsOptions,
  ListServiceLogsOptions,
  ListServicesOptions,
  ResumeServiceOptions,
  SuspendServiceOptions,
  TriggerDeployOptions,
  UpdateServiceOptions,
} from "./types.js";

export const VERSION = "0.1.0";
export const DEFAULT_API_BASE = "https://api.render.com/v1";

export function apiKeyFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.RENDER_API_KEY;
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) throw new Error("RENDER_API_KEY environment variable is required");
  return key;
}
export const tokenFromEnv = apiKeyFromEnv;

export function apiBaseFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.RENDER_API_BASE_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

interface RequestSpec { method: string; path: string; body?: unknown; }

async function apiRequest(fetchFn: FetchFn, key: string, base: string, spec: RequestSpec): Promise<unknown> {
  const res = await fetchFn(`${base}${spec.path}`, {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { message?: string; errors?: Array<{ message?: string }> };
      if (typeof parsed.message === "string") detail = parsed.message;
      else if (typeof parsed.errors?.[0]?.message === "string") detail = parsed.errors[0].message;
    } catch { /* keep raw */ }
    throw new Error(`Render API error ${res.status}: ${detail}`);
  }
  if (!text) return { status: res.status };
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) if (value !== undefined) out[key] = value;
  return out;
}
const enc = encodeURIComponent;

export async function listServices(fetchFn: FetchFn, key: string, base: string, opts: ListServicesOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "GET", path: `/services${query({ limit: opts.limit, type: opts.type })}` });
}
export async function getService(fetchFn: FetchFn, key: string, base: string, opts: GetServiceOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "GET", path: `/services/${enc(opts.service_id)}` });
}
export async function createService(fetchFn: FetchFn, key: string, base: string, opts: CreateServiceOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, {
    method: "POST",
    path: "/services",
    body: clean({ name: opts.name, repo: opts.repo, ownerId: opts.owner_id, branch: opts.branch, type: opts.type ?? "web_service" }),
  });
}
export async function updateService(fetchFn: FetchFn, key: string, base: string, opts: UpdateServiceOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, {
    method: "PATCH",
    path: `/services/${enc(opts.service_id)}`,
    body: clean({
      name: opts.name,
      branch: opts.branch,
      autoDeploy: opts.auto_deploy === undefined ? undefined : opts.auto_deploy ? "yes" : "no",
    }),
  });
}
export async function deleteService(fetchFn: FetchFn, key: string, base: string, opts: DeleteServiceOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "DELETE", path: `/services/${enc(opts.service_id)}` });
}
export async function suspendService(fetchFn: FetchFn, key: string, base: string, opts: SuspendServiceOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "POST", path: `/services/${enc(opts.service_id)}/suspend` });
}
export async function resumeService(fetchFn: FetchFn, key: string, base: string, opts: ResumeServiceOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "POST", path: `/services/${enc(opts.service_id)}/resume` });
}
export async function listDeploys(fetchFn: FetchFn, key: string, base: string, opts: ListDeploysOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "GET", path: `/services/${enc(opts.service_id)}/deploys${query({ limit: opts.limit })}` });
}
export async function getDeploy(fetchFn: FetchFn, key: string, base: string, opts: GetDeployOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "GET", path: `/services/${enc(opts.service_id)}/deploys/${enc(opts.deploy_id)}` });
}
export async function triggerDeploy(fetchFn: FetchFn, key: string, base: string, opts: TriggerDeployOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, {
    method: "POST",
    path: `/services/${enc(opts.service_id)}/deploys`,
    body: { clearCache: opts.clear_cache ? "clear" : "do_not_clear" },
  });
}
export async function listEnvVars(fetchFn: FetchFn, key: string, base: string, opts: ListEnvVarsOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "GET", path: `/services/${enc(opts.service_id)}/env-vars` });
}
export async function listServiceLogs(fetchFn: FetchFn, key: string, base: string, opts: ListServiceLogsOptions): Promise<unknown> {
  return apiRequest(fetchFn, key, base, { method: "GET", path: `/services/${enc(opts.service_id)}/logs${query({ limit: opts.limit })}` });
}

export async function callTool(fetchFn: FetchFn, key: string, base: string, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_services": return listServices(fetchFn, key, base, args as unknown as ListServicesOptions);
    case "get_service": return getService(fetchFn, key, base, args as unknown as GetServiceOptions);
    case "create_service": return createService(fetchFn, key, base, args as unknown as CreateServiceOptions);
    case "update_service": return updateService(fetchFn, key, base, args as unknown as UpdateServiceOptions);
    case "delete_service": return deleteService(fetchFn, key, base, args as unknown as DeleteServiceOptions);
    case "suspend_service": return suspendService(fetchFn, key, base, args as unknown as SuspendServiceOptions);
    case "resume_service": return resumeService(fetchFn, key, base, args as unknown as ResumeServiceOptions);
    case "list_deploys": return listDeploys(fetchFn, key, base, args as unknown as ListDeploysOptions);
    case "get_deploy": return getDeploy(fetchFn, key, base, args as unknown as GetDeployOptions);
    case "trigger_deploy": return triggerDeploy(fetchFn, key, base, args as unknown as TriggerDeployOptions);
    case "list_env_vars": return listEnvVars(fetchFn, key, base, args as unknown as ListEnvVarsOptions);
    case "list_service_logs": return listServiceLogs(fetchFn, key, base, args as unknown as ListServiceLogsOptions);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
