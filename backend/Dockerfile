# Dockerfile for PornSpot.ai Lambda Functions
# Multi-stage build for optimized container images with all dependencies

# Stage 1: Build stage with all dependencies
FROM public.ecr.aws/lambda/nodejs:20 as builder

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files first for better Docker caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY shared/ ./shared/
COPY functions/ ./functions/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build:typescript

# Stage 2: Production stage with only runtime dependencies
FROM public.ecr.aws/lambda/nodejs:20

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund

# Remove unnecessary files to reduce container size
RUN find node_modules -name "*.md" -delete && \
    find node_modules -name "*.txt" -delete && \
    find node_modules -name "*.map" -delete && \
    find node_modules -name "CHANGELOG*" -delete && \
    find node_modules -name "README*" -delete && \
    find node_modules -name "LICENSE*" -delete && \
    find node_modules -name "NOTICE*" -delete && \
    find node_modules -name "*.d.ts" -delete && \
    find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "docs" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name ".nyc_output" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "coverage" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "benchmark" -type d -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -name "samples" -type d -exec rm -rf {} + 2>/dev/null || true

# Copy built JavaScript files from builder stage
COPY --from=builder ${LAMBDA_TASK_ROOT}/dist/ ./

# Default handler (will be overridden by each function)
CMD ["index.handler"]
