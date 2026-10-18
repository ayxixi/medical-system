FROM node:18-alpine

WORKDIR /app

COPY apps/server/package*.json ./

RUN npm install

COPY apps/server ./

RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
