FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Prisma
COPY prisma ./prisma
RUN npx prisma generate

# Source
COPY . .

# Build
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/server.js"]
