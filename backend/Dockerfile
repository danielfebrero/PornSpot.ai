# Dockerfile for PornSpot.ai Lambda Functions
# Multi-stage build for optimized container images with all dependencies
# Explicitly targeting x86_64 architecture for AWS Lambda compatibility

# Build argument for target platform (defaults to amd64 for Lambda)
ARG TARGETPLATFORM=linux/amd64

# Stage 1: Build stage with all dependencies
FROM --platform=$TARGETPLATFORM public.ecr.aws/lambda/nodejs:20 as builder

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
RUN npm run build

# Stage 2: Production stage with only runtime dependencies
FROM --platform=$TARGETPLATFORM public.ecr.aws/lambda/nodejs:20

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --no-audit --no-fund

# Remove unnecessary files to reduce container size
# Use more compatible shell commands and ensure findutils is available
RUN yum update -y && yum install -y findutils && \
    /usr/bin/find node_modules -name "*.md" -delete && \
    /usr/bin/find node_modules -name "*.txt" -delete && \
    /usr/bin/find node_modules -name "*.map" -delete && \
    /usr/bin/find node_modules -name "CHANGELOG*" -delete && \
    /usr/bin/find node_modules -name "README*" -delete && \
    /usr/bin/find node_modules -name "LICENSE*" -delete && \
    /usr/bin/find node_modules -name "NOTICE*" -delete && \
    /usr/bin/find node_modules -name "*.d.ts" -delete && \
    /usr/bin/find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true && \
    /usr/bin/find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true && \
    /usr/bin/find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true && \
    /usr/bin/find node_modules -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true && \
    /usr/bin/find node_modules -name "docs" -type d -exec rm -rf {} + 2>/dev/null || true && \
    /usr/bin/find node_modules -name ".nyc_output" -type d -exec rm -rf {} + 2>/dev/null || true && \
    /usr/bin/find node_modules -name "coverage" -type d -exec rm -rf {} + 2>/dev/null || true && \
    /usr/bin/find node_modules -name "benchmark" -type d -exec rm -rf {} + 2>/dev/null || true && \
    /usr/bin/find node_modules -name "samples" -type d -exec rm -rf {} + 2>/dev/null || true && \
    yum clean all && rm -rf /var/cache/yum

# Copy built JavaScript files from builder stage
COPY --from=builder ${LAMBDA_TASK_ROOT}/dist/ ./

# Default handler (will be overridden by each function)
CMD ["index.handler"]
