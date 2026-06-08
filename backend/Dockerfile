FROM node:20-slim

WORKDIR /app

# 安装必要的系统工具（如 fuser 等）
RUN apt-get update && apt-get install -y psmisc && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

# 暴露后端端口
EXPOSE 8081

CMD ["npm", "start"]
