# -------- deps --------
FROM node:22-alpine AS deps
WORKDIR /app

# Install dependencies (incl. devDeps needed for TS build)
COPY package*.json ./
RUN npm ci

# -------- build --------
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Compile TypeScript -> dist (clean first)
RUN rm -rf dist && npm run build


# -------- runtime --------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Optional: if you use native modules, this keeps compatibility
RUN apk add --no-cache libc6-compat

# Copy only what we need to run
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Install only production dependencies
RUN npm ci --production && npm cache clean --force

# If your app reads PORT from env, set it in runtime (.env / compose)
EXPOSE 3000

# Start the API
CMD ["node", "dist/index.js"]
