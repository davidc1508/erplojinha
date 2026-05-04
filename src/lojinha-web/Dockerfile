FROM node:20-alpine AS build
WORKDIR /app

COPY src/lojinha-web/package.json ./package.json
COPY src/lojinha-web/package-lock.json ./package-lock.json
RUN npm ci

COPY src/lojinha-web/ ./

RUN npm run build

FROM nginx:1.27-alpine AS final
WORKDIR /usr/share/nginx/html

COPY src/lojinha-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist ./

EXPOSE 80