# Dockerfile for Next.js application

# 1. Builder Stage
# This stage builds the Next.js application.
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
# We install all dependencies including devDependencies to build the app
RUN pnpm install

# Copy the rest of the source code
COPY . .

# Build the Next.js application
RUN pnpm build

# 2. Runner Stage
# This stage creates the final, lean production image.
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output from the builder stage
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

# Switch to the non-root user
USER nextjs

# Expose the port the app runs on
EXPOSE 3000

# Set the port environment variable
ENV PORT=3000

# Start the Next.js server
CMD ["node", "server.js"] 
