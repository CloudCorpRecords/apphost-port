# apphost-port

Render services as MCP tools, talking to the Render REST API.
apphost-port is a clean-room rebuild of the core surface of the
Render MCP server, under a new name: fresh code, no copied branding.
The original is Render's official hosted MCP (remote/OAuth); hosted
OAuth is NOT reproduced — this rebuild is an API-key REST client for
the same API.

## Tools (core subset, 12)

`list_services`, `get_service`, `create_service`, `update_service`,
`delete_service`, `suspend_service`, `resume_service`,
`list_deploys`, `get_deploy`, `trigger_deploy`, `list_env_vars`,
`list_service_logs`.

Not in this subset: static sites / cron jobs / background workers
creation depth beyond the generic create_service, Postgres and Key
Value (Redis-compatible) data services, disks, blueprints/IaC sync,
metrics depth, log streams/sinks, custom domains management,
team/user admin, billing, deploy hooks and webhooks admin, SSH/shell
access.

## Setup

Create an API key in your Render dashboard and set it:

```bash
export RENDER_API_KEY=rnd_...
```

Optionally override the API base with `RENDER_API_BASE_URL`
(default `https://api.render.com/v1`). Without the key, every tool
call fails with an error naming the missing variable.
`create_service` requires the workspace `owner_id` and defaults the
service `type` to `web_service`.

## CLI

```bash
npx @reneturcios/apphost-port list_services '{"limit":10}'
npx @reneturcios/apphost-port mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "apphost-port": {
      "command": "npx",
      "args": ["-y", "@reneturcios/apphost-port", "mcp"],
      "env": { "RENDER_API_KEY": "rnd_..." }
    }
  }
}
```

## Docker

```bash
docker run -i -e RENDER_API_KEY ghcr.io/cloudcorprecords/apphost-port
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
