export const env = {
  SIGNAL_CLI_API: process.env.SIGNAL_CLI_API ?? 'http://cli-rest-api:8080',
  PORTAINER_URL: process.env.PORTAINER_URL ?? 'https://docker.gewis.nl',
  PORTAINER_API_KEY: process.env.PORTAINER_API_KEY ?? '',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  STACK_NAME: process.env.STACK_NAME ?? 'signal',
  DOCKER_VERSION: process.env.DOCKER_VERSION ?? 'unknown',
  GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA ?? 'unknown',
  REPOSITORY: process.env.REPOSITORY ?? 'gewis/aquarius',
  SUDOSOS_API_URL: process.env.SUDOSOS_API_URL ?? 'https://sudosos.gewis.nl/api/v1',
  SUDOSOS_API_KEY: process.env.SUDOSOS_API_KEY ?? '',
  SUDOSOS_USER_ID: process.env.SUDOSOS_USER_ID ?? '',
  ADMIN_UUID: process.env.ADMIN_UUID ?? '',
  SERVICE_NAME: process.env.SERVICE_NAME ?? 'wrmwz8t7zkbujomdjgvu2accp',
  SUDOSOS_BACKEND_GH_URL: process.env.SUDOSOS_BACKEND_GH_URL ?? 'https://github.com/GEWIS/sudosos-backend',
  SUDOSOS_FRONTEND_GH_URL: process.env.SUDOSOS_FRONTEND_GH_URL ?? 'https://github.com/GEWIS/sudosos-frontend',
};
