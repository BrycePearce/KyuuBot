# Pull base image.
FROM node:lts-slim

# Install ffmpeg and clean up
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies first (leverage cache)
COPY package*.json ./
RUN npm install --production

# Copy the rest of the source code
COPY . .

# Set environment variable for production
ENV NODE_ENV=production

CMD ["npm", "start"]