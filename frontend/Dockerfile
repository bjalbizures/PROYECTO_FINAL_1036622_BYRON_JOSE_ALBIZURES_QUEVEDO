FROM node:20-alpine AS build

WORKDIR /app

COPY package.json .
RUN npm install

COPY index.html .
COPY vite.config.js .
COPY src ./src
RUN npx vite build

FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
