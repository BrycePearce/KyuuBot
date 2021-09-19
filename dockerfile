# Build/Run Instructions
# docker build . -t [image_name]
# docker run -it [image_name] (this is for testing)
# docker run --name [image_name] -d bryce

# List Docker processes
# docker ps -a

# Cleaning up
# docker rm 7d27 (manually delete image, 7d27 is id or container name)

# Pull base image.
FROM node:16

RUN apt-get update -y
RUN apt-get install ffmpeg -y

WORKDIR /app

COPY package.json .
# copy source to container

# install dependencies
RUN npm install

COPY . ./

CMD ["npm", "start"]