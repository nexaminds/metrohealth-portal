FROM node:20-alpine
WORKDIR /app
COPY metrics-server/package.json ./
RUN npm install --omit=dev
COPY metrics-server/server.js ./
# Static portal files are mounted at /portal at compose-up time (read-only).
ENV STATIC_DIR=/portal
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
