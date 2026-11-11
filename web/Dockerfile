# 前端镜像（多阶段构建）
# build context 必须是仓库根目录：需要同时拿到 web/ 与 deploy/nginx.conf
# 生产构建会加载 web/.env.production（VITE_USE_MOCK=false），
# vite.config.ts 在 mode=production 时强制校验该值，演示数据无法被构建进生产包。

FROM node:20-alpine AS builder
WORKDIR /app
COPY web/package*.json ./
RUN npm install --ignore-scripts
COPY web/ ./
RUN npm run build:prod

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
