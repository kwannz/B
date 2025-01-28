FROM node:20-alpine as builder

WORKDIR /app

# Install only necessary build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc

COPY src/frontend/package.json .
COPY src/frontend/yarn.lock .
RUN yarn install --network-timeout 100000

COPY src/frontend/ .
RUN yarn build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
