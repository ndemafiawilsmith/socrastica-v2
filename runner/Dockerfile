FROM node:22-bookworm-slim
WORKDIR /runner
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY grade.cjs main.cjs ./
USER node
CMD ["node", "--max-old-space-size=256", "main.cjs"]
