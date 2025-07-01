FROM node:22-bookworm

WORKDIR /app

# Copy package files for caching
COPY package.json yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production

# Copy compiled JS and package metadata
COPY dist ./dist
COPY package.json ./

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
