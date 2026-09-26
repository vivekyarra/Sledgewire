FROM node:22.18-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
RUN mkdir -p /persistent && chown node:node /persistent
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
USER node
CMD ["node","src/server/http.mjs"]
