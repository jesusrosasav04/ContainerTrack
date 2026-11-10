# 1) Compilar el frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
# El lockfile se genero en Windows: si faltan binarios de Linux, se reinstala
RUN (npm ci --no-audit --no-fund && npm run build) \
 || (echo "Reinstalando dependencias para Linux..." && rm -rf node_modules package-lock.json \
     && npm install --no-audit --no-fund && npm run build)

# 2) Servir los archivos estaticos con nginx; /api se reenvia a la API
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
