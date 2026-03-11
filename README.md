# aquarius

A Signal bot for GEWIS that bridges [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) with Portainer, SudoSOS, and the Wonderful platform.

Mention the bot in any Signal group it's registered in and it will respond to commands — managing Docker stacks, querying SudoSOS, and dispatching tasks to Wonderful.

## Prerequisites

- A running [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api) instance with the bot account registered
- Portainer with an API key
- (Optional) SudoSOS API credentials
- (Optional) Wonderful API credentials

## Configuration

All configuration is via environment variables.

| Variable | Default | Description |
|---|---|---|
| `SIGNAL_CLI_API` | `http://cli-rest-api:8080` | signal-cli REST API base URL |
| `PORTAINER_URL` | `https://docker.gewis.nl` | Portainer instance URL |
| `PORTAINER_API_KEY` | — | Portainer API key |
| `STACK_NAME` | `signal` | Name of the stack aquarius itself runs in |
| `SERVICE_NAME` | — | Docker service ID for self-update |
| `ADMIN_UUID` | — | Signal UUID of the admin user |
| `SUDOSOS_API_URL` | `https://sudosos.gewis.nl/api/v1` | SudoSOS API base URL |
| `SUDOSOS_API_KEY` | — | SudoSOS API key |
| `SUDOSOS_USER_ID` | — | SudoSOS user ID for the bot |
| `SUDOSOS_BACKEND_GH_URL` | `https://github.com/GEWIS/sudosos-backend` | Used for version reporting |
| `SUDOSOS_FRONTEND_GH_URL` | `https://github.com/GEWIS/sudosos-frontend` | Used for version reporting |
| `WONDERFUL_API_URL` | — | Wonderful API base URL |
| `WONDERFUL_API_KEY` | — | Wonderful API key |
| `WONDERFUL_WEBHOOK_URL` | — | Webhook URL for incoming Wonderful events |
| `WONDERFUL_WEBHOOK_SECRET` | — | Webhook signing secret |
| `WONDERFUL_POLL_INTERVAL_MS` | `2000` | Polling interval for task status |
| `WONDERFUL_POLL_TIMEOUT_MS` | `300000` | Max time to wait for a task to complete |
| `WONDERFUL_TERMINAL_GRACE_MS` | `20000` | Grace period after a task reaches terminal state |
| `REPOSITORY` | `gewis/aquarius` | Used in version/info output |
| `LOG_LEVEL` | `info` | Log level (`trace`, `debug`, `info`, `warn`, `error`) |

## Running

**Docker (recommended)**

```bash
docker build \
  --build-arg DOCKER_VERSION=1.0.0 \
  --build-arg GIT_COMMIT_SHA=$(git rev-parse --short HEAD) \
  --build-arg GIT_COMMIT_BRANCH=$(git branch --show-current) \
  -t aquarius .

docker run --env-file .env aquarius
```

**Local**

```bash
yarn install
yarn start
```

## Development

```bash
yarn install
yarn start       # run with tsx (no build step)
yarn test        # run tests with vitest
yarn lint        # eslint
yarn format      # prettier check
```

## License

MIT
