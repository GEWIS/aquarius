FROM node:20-bookworm

WORKDIR /app
COPY . .

RUN yarn install --frozen-lockfile
RUN yarn build
ENV NODE_ENV=production

CMD ["node", "--import", "tsx", "dist/src/index.js"]