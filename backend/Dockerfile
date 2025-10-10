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

# Expose port 3001
EXPOSE 3001

# Start the application
CMD ["npm", "start"]