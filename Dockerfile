FROM node:20-bookworm AS builder

WORKDIR /app
COPY yarn.lock .
COPY package.json .

RUN yarn install --frozen-lockfile

FROM node:20-bookworm

WORKDIR /app
COPY . .
COPY --from=builder /app/node_modules ./node_modules

RUN yarn build

ARG DOCKER_VERSION
ARG GIT_COMMIT_SHA
ARG GIT_COMMIT_BRANCH

# Get git tag and hash and store in ENV variables
RUN GIT_TAG=$(git describe --tags --always) && \
    GIT_HASH=$(git rev-parse --short HEAD) && \
    echo "DOCKER_VERSION=${DOCKER_VERSION}" >> /app/.env && \
    echo "GIT_COMMIT_SHA=${GIT_COMMIT_SHA}" >> /app/.env && \
    echo "GIT_COMMIT_BRANCH=${GIT_COMMIT_BRANCH}" >> /app/.env

ENV NODE_ENV=production

# Also expose the git vars to runtime env
ENV DOCKER_VERSION=$DOCKER_VERSION
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA
ENV GIT_COMMIT_BRANCH=$GIT_COMMIT_BRANCH

CMD ["node", "--import", "tsx", "dist/src/index.js"]
