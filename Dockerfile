# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package manifests and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 5000

# Set environment
ENV NODE_ENV=production
ENV PORT=5000

# Startup command
CMD ["npm", "start"]
