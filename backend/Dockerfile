FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /backend

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Start the application
CMD ["pnpm", "run", "start:faucetWorker"]