# Pull base image.
FROM node:lts-alpine

LABEL net.unraid.docker.icon="https://raw.githubusercontent.com/BrycePearce/KyuuBot/main/assets/icon.png"

WORKDIR /app

# Copy package files and install dependencies first (leverage cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the source code
COPY . .

# Set environment variable for production
ENV NODE_ENV=production

CMD ["npm", "start"]
