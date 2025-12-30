# Use Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the port React runs on (default 3000)
EXPOSE 3000

# Start the development server
CMD ["npm", "start"]