# AUSPEX snapshot + news worker
# Build from the REPO ROOT so the worker's "../src" relative imports resolve:
#   docker build -f worker/Dockerfile -t auspex-worker .
#   docker run -p 8801:8801 --env-file worker/.env auspex-worker
FROM node:22-slim

WORKDIR /app

# Install worker dependencies first (better layer caching).
COPY worker/package.json worker/package-lock.json ./worker/
RUN cd worker && npm ci --omit=dev

# Copy the worker and its sibling pure-core (worker/index.js imports ../src).
COPY worker/ ./worker/
COPY src/ ./src/

# The worker reads/writes ../snapshot.json relative to worker/index.js.
# Provide an empty seed so the first /snapshot.json request returns 200 before
# the first poll completes; the worker overwrites it on each pass.
RUN printf '{"generatedAt":"1970-01-01T00:00:00.000Z","version":1,"events":[]}' > snapshot.json

ENV NODE_ENV=production
EXPOSE 8801

WORKDIR /app/worker
CMD ["node", "index.js"]
