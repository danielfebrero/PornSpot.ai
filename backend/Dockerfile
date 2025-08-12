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

# Copy built JavaScript files from builder stage
COPY --from=builder ${LAMBDA_TASK_ROOT}/dist/ ./

# Default handler (will be overridden by each function)
CMD ["index.handler"]
