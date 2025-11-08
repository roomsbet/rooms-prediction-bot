# Multi-stage build for ROOMS prediction market bot
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Install Prisma CLI
RUN npm install -g prisma

# Generate Prisma client
RUN prisma generate

# Expose port (if needed)
EXPOSE 3000

# Run migrations and start
CMD ["sh", "-c", "prisma migrate deploy && npm start"]

