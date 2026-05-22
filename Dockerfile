# ---- Development stage ----
FROM node:22-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000 3001

CMD ["npm", "run", "dev"]

# ... rest of file stays the same ...