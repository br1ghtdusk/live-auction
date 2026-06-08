# 第一阶段：构建 (Build)
FROM node:20 AS build

WORKDIR /app

# 注入环境变量，让 Vite 构建时包含正确的后端地址
ARG VITE_WS_URL
ARG VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 第二阶段：运行 (Serve)
FROM nginx:alpine

# 拷贝构建产物
COPY --from=build /app/dist /usr/share/nginx/html

# 拷贝自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
