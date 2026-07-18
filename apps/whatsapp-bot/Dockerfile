FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/whatsapp-bot/package.json apps/whatsapp-bot/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=apps/whatsapp-bot --include-workspace-root
COPY . .
RUN npm run db:generate
WORKDIR /app/apps/whatsapp-bot
CMD ["npm", "run", "start"]
