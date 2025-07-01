FROM node:20-bookworm

WORKDIR /app
COPY . .

RUN yarn install --frozen-lockfile
RUN yarn build

# Get git tag and hash and store in ENV variables
RUN GIT_TAG=$(git describe --tags --always) && \
    GIT_HASH=$(git rev-parse --short HEAD) && \
    echo "GIT_TAG=${GIT_TAG}" >> /app/.env && \
    echo "GIT_HASH=${GIT_HASH}" >> /app/.env

ENV NODE_ENV=production

# Also expose the git vars to runtime env
ENV GIT_TAG=$GIT_TAG
ENV GIT_HASH=$GIT_HASH

CMD ["node", "--import", "tsx", "dist/src/index.js"]
