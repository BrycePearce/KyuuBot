FROM node:14.15.1-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app
# copy source to container

# install dependencies
RUN npm install

COPY . .

CMD ["npm", "start"]