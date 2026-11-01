/**
 * apphost-port types.
 *
 * A core subset of the Render MCP surface: services, deploys, env
 * vars and logs against the Render REST API. HTTP access is
 * described by a minimal response surface so tests can inject a fake
 * fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface ListServicesOptions { limit?: number; type?: string; }
export interface GetServiceOptions { service_id: string; }
export interface CreateServiceOptions { name: string; repo: string; owner_id: string; branch?: string; type?: string; }
export interface UpdateServiceOptions { service_id: string; name?: string; branch?: string; auto_deploy?: boolean; }
export interface DeleteServiceOptions { service_id: string; }
export interface SuspendServiceOptions { service_id: string; }
export interface ResumeServiceOptions { service_id: string; }
export interface ListDeploysOptions { service_id: string; limit?: number; }
export interface GetDeployOptions { service_id: string; deploy_id: string; }
export interface TriggerDeployOptions { service_id: string; clear_cache?: boolean; }
export interface ListEnvVarsOptions { service_id: string; }
export interface ListServiceLogsOptions { service_id: string; limit?: number; }
