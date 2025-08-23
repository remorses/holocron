FROM --platform=linux/amd64 node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl

COPY docker.package.json ./package.json

RUN npm install

COPY ./build /app/build
COPY ./public /app/public

ENV PORT=7664

ENV NODE_ENV=production

EXPOSE $PORT

CMD ["node", "./build/server/server.js"]
