FROM node:14.15.5-slim AS base

WORKDIR /usr/src/app

COPY ./package.json ./package.json
# COPY ./package-lock.json ./package-lock.json
RUN npm install

FROM base as build
COPY ./public ./public
COPY ./src ./src
RUN npm run build
RUN npm install -g serve
CMD serve -s build -l tcp://0.0.0.0:3000