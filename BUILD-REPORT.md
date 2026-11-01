# apphost-port — BUILD REPORT

Original: render (Render official hosted MCP) → Rebuild: apphost-port
Tier C core subset. Local only, nothing pushed or published.

## Scope
12 tools against the Render REST API (https://api.render.com/v1, base
overridable via RENDER_API_BASE_URL), Authorization: Bearer
RENDER_API_KEY with `Accept: application/json` on every request, all
HTTP behind an injectable FetchFn:
list_services (GET /services, limit/type query params), get_service
(GET /services/{id}), create_service (POST /services, ownerId mapping,
type defaults to web_service), update_service
(PATCH /services/{id}, provided fields only, auto_deploy mapped to
autoDeploy "yes"/"no"), delete_service (DELETE /services/{id},
204 empty body → {status}), suspend_service
(POST /services/{id}/suspend), resume_service
(POST /services/{id}/resume), list_deploys
(GET /services/{id}/deploys, limit query param), get_deploy
(GET /services/{id}/deploys/{deploy_id}), trigger_deploy
(POST /services/{id}/deploys, clear_cache mapped to clearCache
"clear"/"do_not_clear"), list_env_vars
(GET /services/{id}/env-vars), list_service_logs
(GET /services/{id}/logs, limit query param; docs-derived shape —
first check at live smoke).

Omitted groups (fixture `_source` lists them): static sites / cron
jobs / background workers creation depth beyond the generic
create_service, Postgres and Key Value (Redis-compatible) data
services, disks, blueprints/IaC sync, metrics depth, log
streams/sinks, custom domains management, team/user admin, billing,
deploy hooks and webhooks admin, SSH/shell access.

Ground truth: schemas are docs-derived from the public Render API
documentation (api.render.com/v1). Fixture:
harness/fixtures/render-tools-original.json (labelled core-subset).
The original is Render's official hosted MCP (remote/OAuth); hosted
OAuth NOT reproduced — this is an API-key REST client for the same
API.

## Verified (foreground, from disk)
- Tools: 12/12 — parity.json identical_tools = 12 = total.
- Unit tests: 15/15 pass (fake FetchFn; URL/method/Bearer + Accept
  headers/body shaping for every tool, ownerId + type default in
  create, autoDeploy yes/no mapping, clearCache mapping,
  provided-fields-only update, 204 {status} handling, upstream error
  surfacing, missing-key error, base override/trim).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0; unknown command exits 2 with Usage.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Missing-env checks: CLI list_services with RENDER_API_KEY unset
  → "error: RENDER_API_KEY environment variable is required",
  exit 1; stdio tools/call list_services with the key unset returned
  isError "RENDER_API_KEY environment variable is required".
- server.json description 57 chars (≤100); OCI entry has no version
  field; npm entry carries version 0.1.0; Dockerfile label
  io.github.CloudCorpRecords/apphost-port; full 19-file factory set
  present.

## Honest gaps
- No live Render call was made — request/response behaviour is
  fake-fetch proven only.
- list_service_logs uses a docs-derived shape
  (GET /services/{id}/logs?limit); it is the first check at live
  smoke — the real logs surface may differ in path or params.
- create_service covers the generic service-create body only;
  per-type creation depth (static sites, cron jobs, workers) is
  outside this subset.
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
- Hosted OAuth surface of the original remote server is not
  reproduced (see Scope).
