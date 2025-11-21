# Use an official Node runtime as a parent image
FROM node:18-slim

# Install dependencies for Playwright/Puppeteer (browsers, libs)
# RUN npx playwright install-deps

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
# COPY package*.json ./

# Install dependencies
# RUN npm install

# Copy the rest of the application code
COPY . .

# Build TypeScript code
# RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application
# CMD ["npm", "start"]