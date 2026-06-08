FROM node:20-slim

WORKDIR /app

# Install necessary system utilities
RUN apt-get update && apt-get install -y psmisc && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY . .

# Expose backend port
EXPOSE 8081

CMD ["npm", "start"]
