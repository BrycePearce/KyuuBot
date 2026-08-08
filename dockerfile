# Pull base image.
FROM node:lts-alpine

# Unraid (6.10+) reads this label to render the container icon.
# Must be a local host path -- remote URLs fail intermittently when the
# webgui can't resolve them, and .webp/.svg don't render at all. Copy the
# icon into place once on the host:
#   cp /mnt/user/Misc/KyuuBot/assets/icon.png /mnt/user/appdata/kyuu/icon.png
LABEL net.unraid.docker.icon="/mnt/user/appdata/kyuu/icon.png"

# Install ffmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files and install dependencies first (leverage cache)
COPY package*.json ./
RUN npm install --production

# Copy the rest of the source code
COPY . .

# Set environment variable for production
ENV NODE_ENV=production

CMD ["npm", "start"]