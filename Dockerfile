FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY app ./app
COPY config ./config
COPY tsconfig.backend.json ./tsconfig.backend.json

EXPOSE 4000

CMD ["npm", "run", "dev:backend"]
