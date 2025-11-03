# Use Node.js 18 as base image
FROM node:20-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Declare build arguments
ARG VITE_SAFE_API_KEY
ARG VITE_WAGMI_PROJECT_ID
ARG VITE_TRUST_SCORE_URL
ARG VITE_FAUCET_ORG_ADDRESS
ARG VITE_CRC_AMOUNT
ARG VITE_TRUST_SCORE_THRESHOLD
ARG VITE_SEPOLIA_RPC_URL

# Set environment variables
ENV VITE_SAFE_API_KEY=$VITE_SAFE_API_KEY
ENV VITE_WAGMI_PROJECT_ID=$VITE_WAGMI_PROJECT_ID
ENV VITE_TRUST_SCORE_URL=$VITE_TRUST_SCORE_URL
ENV VITE_FAUCET_ORG_ADDRESS=$VITE_FAUCET_ORG_ADDRESS
ENV VITE_CRC_AMOUNT=$VITE_CRC_AMOUNT
ENV VITE_TRUST_SCORE_THRESHOLD=$VITE_TRUST_SCORE_THRESHOLD
ENV VITE_SEPOLIA_RPC_URL=$VITE_SEPOLIA_RPC_URL

# Build the application
RUN npm run build

# Expose port 5173 (Vite's default dev port)
EXPOSE 5173

# Start the application
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]