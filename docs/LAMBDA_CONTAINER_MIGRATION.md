# Lambda Container Images Migration Guide

## Overview

This document outlines the migration from ZIP-based Lambda functions with layers to Docker container images. This approach solves the 250MB layer size limit by moving to container images with a 10GB limit.

## Benefits of Container Images

### Size Limits

- **ZIP packages**: 250MB unzipped (current problem)
- **Container images**: 10GB (40x larger capacity)

### Other Advantages

- **No layer management complexity**: Everything bundled in one container
- **Better dependency management**: Full control over runtime environment
- **Easier local testing**: Same container runs locally and in AWS
- **Multi-stage builds**: Optimized for both development and production
- **Consistent environments**: No more environment-specific issues

## Migration Strategy

### Phase 1: Hybrid Approach (Recommended)

Start by migrating the most problematic functions (those that push the layer size limit) to container images while keeping others as ZIP packages.

**Convert first:**

1. Functions with heavy dependencies (image processing, ML libraries)
2. Functions that are frequently updated
3. Authorizer functions (critical path)

**Keep as ZIP for now:**

1. Simple functions with minimal dependencies
2. Functions that rarely change
3. Functions where cold start time is critical

### Phase 2: Full Migration

Once Phase 1 is stable, migrate remaining functions to containers.

## Implementation Steps

### 1. Setup ECR Repository

The template now includes an ECR repository for storing container images:

```yaml
LambdaContainerImage:
  Type: AWS::ECR::Repository
  Properties:
    RepositoryName: !Sub "${Environment}-pornspot-lambda"
    ImageScanningConfiguration:
      ScanOnPush: true
```

### 2. Build Container Images

Use the provided Docker build script:

```bash
cd backend
npm run build:containers
```

This will:

- Build optimized container images
- Push to ECR
- Generate image URIs for SAM template

### 3. Update SAM Template

Convert functions from ZIP to container format:

**Before (ZIP):**

```yaml
UserAuthorizerFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: backend/dist/functions/user/auth/
    Handler: authorizer.handler
    Layers:
      - !Ref SharedLayer
```

**After (Container):**

```yaml
UserAuthorizerFunction:
  Type: AWS::Serverless::Function
  Properties:
    PackageType: Image
    ImageUri: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/${LambdaContainerImage}:latest"
    ImageConfig:
      Command: ["functions/user/auth/authorizer.handler"]
```

### 4. Update Build Scripts

New package.json scripts available:

```bash
# Build container images
npm run build:containers

# Build and deploy with containers
npm run deploy:prod:containers

# SAM build with containers
npm run build:sam:containers
```

## File Structure

```
backend/
├── Dockerfile                     # Multi-stage build for all functions
├── build-docker-lambdas.sh       # Build and push script
├── functions/                     # Function code (unchanged)
├── shared/                        # Shared utilities (unchanged)
└── layers/                        # Keep for legacy ZIP functions
```

## Docker Multi-Stage Build

The Dockerfile uses multi-stage builds for optimization:

1. **Builder stage**: Installs all dependencies, builds TypeScript
2. **Production stage**: Only runtime dependencies, optimized file cleanup

## Local Development

Container images can be tested locally:

```bash
# Build image
docker build -t pornspot-lambda .

# Test specific function
docker run -p 9000:8080 pornspot-lambda
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"test": "data"}'
```

## Performance Considerations

### Cold Start Times

- **Container images**: Slightly slower cold starts (50-100ms increase)
- **ZIP packages**: Faster cold starts but size-limited

### Build Times

- **Initial build**: Longer due to Docker image creation
- **Subsequent builds**: Faster due to Docker layer caching

## Migration Checklist

### Pre-Migration

- [ ] Setup ECR repository
- [ ] Test Docker build locally
- [ ] Verify IAM permissions for ECR

### During Migration

- [ ] Convert functions one by one
- [ ] Test each function after conversion
- [ ] Monitor performance metrics
- [ ] Keep rollback plan ready

### Post-Migration

- [ ] Remove unused layers (if all functions migrated)
- [ ] Update CI/CD pipelines
- [ ] Update documentation
- [ ] Monitor container image costs

## Cost Impact

### ECR Storage Costs

- **Container images**: ~$0.10/GB/month
- **Estimate**: 1-2GB per image = $0.10-0.20/month per environment

### Lambda Execution

- **No cost difference**: Same execution pricing model

## Rollback Strategy

To rollback a function from container to ZIP:

1. Revert the function definition in template.yaml
2. Ensure the layer still exists
3. Redeploy with `npm run deploy:prod`

## Next Steps

1. **Test the current setup**: Try building one function as a container
2. **Migrate gradually**: Start with authorizer functions
3. **Monitor performance**: Compare cold start times
4. **Full migration**: Convert all functions once comfortable

This approach gives you 40x more space (10GB vs 250MB) and eliminates layer management complexity while maintaining the ability to rollback if needed.
