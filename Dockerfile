FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@10.28.2 --activate

COPY package.json pnpm-lock.yaml ./
COPY .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_URL=http://localhost:8080
ARG VITE_API_BASE_URL=http://localhost:8080
ARG VITE_WS_URL=http://localhost:8080/ws
ARG VITE_USE_WMS_MOCK=false
ARG VITE_CLERK_PUBLISHABLE_KEY=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_USE_WMS_MOCK=$VITE_USE_WMS_MOCK
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
