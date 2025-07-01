export const env = {
  SIGNAL_CLI_API: process.env.SIGNAL_CLI_API ?? 'http://cli-rest-api:8080',
  PORTAINER_URL: process.env.PORTAINER_URL ?? 'https://docker.gewis.nl',
  PORTAINER_API_KEY: process.env.PORTAINER_API_KEY ?? '',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  STACK_NAME: process.env.STACK_NAME ?? 'signal',
  DOCKER_VERSION: process.env.DOCKER_VERSION ?? 'unknown',
  GIT_COMMIT_SHA: process.env.GIT_COMMIT_SHA ?? 'unknown',
  REPOSITORY: process.env.REPOSITORY ?? 'gewis/aquarius',
};
