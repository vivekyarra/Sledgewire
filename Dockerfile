FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY . .
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
USER node
CMD ["node","src/server/http.mjs"]
