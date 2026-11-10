FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Dependencias primero: se reutilizan en cache si solo cambia el codigo
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY scripts ./scripts

# Sin privilegios de administrador dentro del contenedor
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
