FROM node:22-bookworm

# Install handy tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      vim \
      less \
      git \
      curl \
      iputils-ping \
      net-tools \
      procps \
      htop \
      ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set workdir
WORKDIR /app

# Copy only package manifests first (for better caching)
COPY package.json yarn.lock ./

# Install dependencies with Yarn
RUN yarn install --frozen-lockfile

# Copy rest of the app
COPY . .

ENV NODE_ENV=production

# (Optional) EXPOSE 3000

CMD ["yarn", "start"]
