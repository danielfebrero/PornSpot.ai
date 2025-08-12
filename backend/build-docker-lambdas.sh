# Build script for Docker-based Lambda functions
# This replaces the layer-based approach with container images

#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ENVIRONMENT=${ENVIRONMENT:-dev}
IMAGE_NAME="${ENVIRONMENT}-pornspot-lambda"
IMAGE_TAG="${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

print_status "Building Lambda container images..."
print_status "Registry: $ECR_REGISTRY"
print_status "Image: $IMAGE_NAME:$IMAGE_TAG"

# Ensure ECR repository exists
print_status "Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names "$IMAGE_NAME" --region "$AWS_REGION" >/dev/null 2>&1 || {
    print_status "Creating ECR repository..."
    aws ecr create-repository --repository-name "$IMAGE_NAME" --region "$AWS_REGION" >/dev/null
}

# Build the Docker image
print_status "Building Docker image for x86_64 architecture..."
if docker buildx build --platform linux/amd64 -t "$IMAGE_NAME:$IMAGE_TAG" -t "$IMAGE_NAME:latest" --load .; then
    print_success "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# Login to ECR
print_status "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Tag and push image
print_status "Tagging and pushing image to ECR..."
docker tag "$IMAGE_NAME:$IMAGE_TAG" "$ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
docker tag "$IMAGE_NAME:latest" "$ECR_REGISTRY/$IMAGE_NAME:latest"

if docker push "$ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG" && docker push "$ECR_REGISTRY/$IMAGE_NAME:latest"; then
    print_success "Image pushed to ECR successfully"
else
    print_error "Failed to push image to ECR"
    exit 1
fi

# Output the image URI for SAM template
IMAGE_URI="$ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
print_success "Container image built and pushed!"
print_status "Image URI: $IMAGE_URI"

# Save image URI to file for SAM template
echo "$IMAGE_URI" > .docker-image-uri

print_status "Use this image URI in your SAM template:"
print_status "PackageType: Image"
print_status "ImageUri: $IMAGE_URI"
