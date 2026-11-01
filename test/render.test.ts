import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiBaseFromEnv,
  apiKeyFromEnv,
  createService,
  deleteService,
  getDeploy,
  getService,
  listDeploys,
  listEnvVars,
  listServiceLogs,
  listServices,
  resumeService,
  suspendService,
  triggerDeploy,
  updateService,
} from "../src/render.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded { url: string; method: string; headers: Record<string, string>; body: unknown; }

function fakeFetch(steps: Array<{ match: string; payload: unknown; status?: number; rawText?: string }>) {
  const calls: Recorded[] = [];
  const fn: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body });
    const step = steps.find((s) => url.includes(s.match)) ?? { match: "", payload: {} };
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => step.rawText ?? (step.payload === null || step.payload === undefined ? "" : JSON.stringify(step.payload)),
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://api.render.com/v1";
const KEY = "rnd_testkey";

describe("apphost-port core", () => {
  it("names the env var when the API key is missing", () => {
    assert.throws(() => apiKeyFromEnv({}), /RENDER_API_KEY environment variable is required/);
    assert.equal(apiKeyFromEnv({ RENDER_API_KEY: " x " }), "x");
    assert.equal(apiBaseFromEnv({}), "https://api.render.com/v1");
    assert.equal(apiBaseFromEnv({ RENDER_API_BASE_URL: "https://example.test/v1/" }), "https://example.test/v1");
  });

  it("list_services gets /services with Bearer and accept headers", async () => {
    const { fn, calls } = fakeFetch([{ match: "/services", payload: [] }]);
    await listServices(fn, KEY, BASE, { limit: 10, type: "web_service" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.render.com/v1/services?limit=10&type=web_service");
    assert.equal(calls[0].headers.Authorization, "Bearer rnd_testkey");
    assert.equal(calls[0].headers.Accept, "application/json");
    await listServices(fn, KEY, BASE, {});
    assert.equal(calls[1].url, "https://api.render.com/v1/services");
  });

  it("get_service gets /services/{id}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/services/srv-1", payload: { id: "srv-1" } }]);
    await getService(fn, KEY, BASE, { service_id: "srv-1" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1");
  });

  it("create_service posts ownerId and defaults type to web_service", async () => {
    const { fn, calls } = fakeFetch([{ match: "/services", payload: { id: "srv-2" } }]);
    await createService(fn, KEY, BASE, { name: "api", repo: "https://github.com/acme/api", owner_id: "tea-1" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.render.com/v1/services");
    assert.deepEqual(calls[0].body, { name: "api", repo: "https://github.com/acme/api", ownerId: "tea-1", type: "web_service" });
    await createService(fn, KEY, BASE, { name: "worker", repo: "https://github.com/acme/w", owner_id: "tea-1", branch: "main", type: "background_worker" });
    assert.deepEqual(calls[1].body, { name: "worker", repo: "https://github.com/acme/w", ownerId: "tea-1", branch: "main", type: "background_worker" });
  });

  it("update_service patches only provided fields with autoDeploy yes/no mapping", async () => {
    const { fn, calls } = fakeFetch([{ match: "/services/srv-1", payload: { id: "srv-1" } }]);
    await updateService(fn, KEY, BASE, { service_id: "srv-1", name: "renamed", auto_deploy: true });
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1");
    assert.deepEqual(calls[0].body, { name: "renamed", autoDeploy: "yes" });
    await updateService(fn, KEY, BASE, { service_id: "srv-1", branch: "dev", auto_deploy: false });
    assert.deepEqual(calls[1].body, { branch: "dev", autoDeploy: "no" });
    await updateService(fn, KEY, BASE, { service_id: "srv-1" });
    assert.deepEqual(calls[2].body, {});
  });

  it("delete_service deletes and returns {status} on 204 empty body", async () => {
    const { fn, calls } = fakeFetch([{ match: "/services/srv-1", payload: null, rawText: "", status: 204 }]);
    const out = (await deleteService(fn, KEY, BASE, { service_id: "srv-1" })) as Record<string, unknown>;
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1");
    assert.deepEqual(out, { status: 204 });
  });

  it("suspend_service posts to /suspend", async () => {
    const { fn, calls } = fakeFetch([{ match: "/suspend", payload: {} }]);
    await suspendService(fn, KEY, BASE, { service_id: "srv-1" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1/suspend");
    assert.equal(calls[0].body, undefined);
  });

  it("resume_service posts to /resume", async () => {
    const { fn, calls } = fakeFetch([{ match: "/resume", payload: {} }]);
    await resumeService(fn, KEY, BASE, { service_id: "srv-1" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1/resume");
  });

  it("list_deploys gets /deploys with optional limit", async () => {
    const { fn, calls } = fakeFetch([{ match: "/deploys", payload: [] }]);
    await listDeploys(fn, KEY, BASE, { service_id: "srv-1" });
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1/deploys");
    await listDeploys(fn, KEY, BASE, { service_id: "srv-1", limit: 5 });
    assert.equal(calls[1].url, "https://api.render.com/v1/services/srv-1/deploys?limit=5");
  });

  it("get_deploy gets /deploys/{deploy_id}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/deploys/dep-1", payload: { id: "dep-1" } }]);
    await getDeploy(fn, KEY, BASE, { service_id: "srv-1", deploy_id: "dep-1" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1/deploys/dep-1");
  });

  it("trigger_deploy posts clearCache mapping", async () => {
    const { fn, calls } = fakeFetch([{ match: "/deploys", payload: { id: "dep-2" } }]);
    await triggerDeploy(fn, KEY, BASE, { service_id: "srv-1", clear_cache: true });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1/deploys");
    assert.deepEqual(calls[0].body, { clearCache: "clear" });
    await triggerDeploy(fn, KEY, BASE, { service_id: "srv-1" });
    assert.deepEqual(calls[1].body, { clearCache: "do_not_clear" });
    await triggerDeploy(fn, KEY, BASE, { service_id: "srv-1", clear_cache: false });
    assert.deepEqual(calls[2].body, { clearCache: "do_not_clear" });
  });

  it("list_env_vars gets /env-vars", async () => {
    const { fn, calls } = fakeFetch([{ match: "/env-vars", payload: [{ key: "A" }] }]);
    await listEnvVars(fn, KEY, BASE, { service_id: "srv-1" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1/env-vars");
  });

  it("list_service_logs gets /logs with optional limit", async () => {
    const { fn, calls } = fakeFetch([{ match: "/logs", payload: { logs: [] } }]);
    await listServiceLogs(fn, KEY, BASE, { service_id: "srv-1" });
    assert.equal(calls[0].url, "https://api.render.com/v1/services/srv-1/logs");
    await listServiceLogs(fn, KEY, BASE, { service_id: "srv-1", limit: 100 });
    assert.equal(calls[1].url, "https://api.render.com/v1/services/srv-1/logs?limit=100");
  });

  it("surfaces upstream error status and message", async () => {
    const { fn } = fakeFetch([{ match: "/services", payload: { message: "unauthorized" }, status: 401 }]);
    await assert.rejects(() => listServices(fn, KEY, BASE, {}), /Render API error 401: unauthorized/);
  });

  it("returns {status} for an empty successful body", async () => {
    const { fn } = fakeFetch([{ match: "/suspend", payload: null, rawText: "", status: 200 }]);
    const out = (await suspendService(fn, KEY, BASE, { service_id: "srv-1" })) as Record<string, unknown>;
    assert.deepEqual(out, { status: 200 });
  });
});
