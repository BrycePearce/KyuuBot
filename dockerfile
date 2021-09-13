# Build/Run Instructions
# docker build . -t [image_name]
# docker run -it [image_name]

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