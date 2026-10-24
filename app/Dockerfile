
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit && npm cache clean --force

FROM node:18-alpine

LABEL maintainer="Hoàng Duy Mạnh <dtc245200060@ictu.edu.vn>"
LABEL description="Blog CMS Application - DTC245200060 - Đề 7"
# Tạo user/group riêng (không dùng root) - Hardening
RUN addgroup -g 1001 -S appgroup && \
  adduser -u 1001 -S appuser -G appgroup -h /app -s /sbin/nologin

WORKDIR /app
# Copy node_modules từ builder stage
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
# Copy source code
COPY --chown=appuser:appgroup . .
# Đổi sang user không phải root
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.js"]
