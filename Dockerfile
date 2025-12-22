# Use Node.js 22 as the base image
FROM node:22-bullseye

# Install system dependencies: build-essential for gcc/g++
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Compile the extension (optional, ensures environment works)
RUN npm run compile

# The extension itself runs inside VS Code, but this container 
# provides the full environment needed for development and testing.
CMD [ "npm", "run", "watch" ]
