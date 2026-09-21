FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci 2>/dev/null || npm install
COPY . .
ENV PORT=3333
EXPOSE 3333
CMD ["npx", "ts-node", "--transpile-only", "src/server.ts"]
