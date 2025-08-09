# pornspot.ai Architecture

## Overview

pornspot.ai is built using a modern serverless architecture that provides scalability, cost-effectiveness, and high performance. The application follows a clean separation between frontend and backend, with a focus on minimalist design and user experience.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Frontend      │    │   API Gateway   │    │   Lambda        │
│   (Next.js)     │◄──►│                 │◄──►│   Functions     │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │                 │    │                 │
                       │   CloudFront    │    │   DynamoDB      │
                       │   (CDN)         │    │   (Database)    │
                       │                 │    │                 │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │                 │
                       │   S3 Bucket     │
                       │   (Storage)     │
                       │                 │
                       └─────────────────┘
```

## Components

### Frontend (Next.js 14)

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Features**:
  - Server-side rendering (SSR)
  - Static site generation (SSG)
  - Image optimization
  - Dark theme by default
  - Responsive design
  - Progressive Web App (PWA) ready

### Backend (AWS Lambda)

- **Runtime**: Node.js 18.x
- **Language**: TypeScript
- **Functions**:
  - Album management (CRUD operations)
  - Media upload and management
  - Authentication and authorization
  - Image processing and optimization

### Database (DynamoDB)

- **Design**: Single-table design for optimal performance
- **Access Patterns**:
  - Get album by ID
  - List all albums (paginated)
  - Get media by album ID
  - List media in album (paginated)

#### Table Structure

**Primary Table**: `pornspot-media`

| Entity Type | PK                | SK                | GSI1PK            | GSI1SK                  |
| ----------- | ----------------- | ----------------- | ----------------- | ----------------------- |
| Album       | `ALBUM#{albumId}` | `METADATA`        | `ALBUM`           | `{createdAt}#{albumId}` |
| Media       | `ALBUM#{albumId}` | `MEDIA#{mediaId}` | `MEDIA#{albumId}` | `{createdAt}#{mediaId}` |

### Storage (S3 + CloudFront)

- **S3 Bucket**: Stores original images and 5-size thumbnail system
- **CloudFront**: Global CDN for fast content delivery with intelligent caching
- **Organization**:
  ```
  albums/
  ├── {albumId}/
  │   ├── media/
  │   │   ├── {mediaId}.jpg
  │   │   └── {mediaId}.png
  │   └── thumbnails/
  │       ├── {filename}_thumb_cover.jpg    # 128×128px (75% quality)
  │       ├── {filename}_thumb_small.jpg    # 240×240px (80% quality)
  │       ├── {filename}_thumb_medium.jpg   # 300×300px (85% quality)
  │       ├── {filename}_thumb_large.jpg    # 365×365px (85% quality)
  │       └── {filename}_thumb_xlarge.jpg   # 600×600px (90% quality)
  ```

### API Gateway

- **Type**: REST API
- **Authentication**: AWS IAM (can be extended with Cognito)
- **CORS**: Configured for frontend domain
- **Endpoints**:
  - `/albums` - Album management
  - `/albums/{albumId}/media` - Media management

## Security

### Authentication & Authorization

- AWS IAM for service-to-service communication
- API Gateway with IAM authentication
- S3 bucket policies for secure access
- CloudFront Origin Access Control (OAC)

### Data Protection

- HTTPS everywhere (TLS 1.2+)
- S3 bucket encryption at rest
- DynamoDB encryption at rest
- Secure headers in frontend

### Access Control

- Private S3 bucket with CloudFront access only
- DynamoDB fine-grained access control
- Lambda function permissions following least privilege

## Performance

### Frontend Optimizations

- Next.js automatic code splitting
- Image optimization with next/image
- Static asset caching
- Lazy loading for images
- Progressive enhancement

### Backend Optimizations

- Lambda cold start optimization
- DynamoDB single-table design
- Efficient query patterns
- Connection pooling where applicable

### CDN & Caching

- CloudFront global edge locations
- Aggressive caching for static assets
- Smart cache invalidation
- Optimized cache headers

## Scalability

### Horizontal Scaling

- Lambda functions scale automatically
- DynamoDB on-demand billing
- CloudFront global distribution
- S3 virtually unlimited storage

### Cost Optimization

- Pay-per-use serverless model
- DynamoDB on-demand pricing
- S3 intelligent tiering
- CloudFront cost-effective distribution

## Monitoring & Observability

### Logging

- CloudWatch Logs for Lambda functions
- Structured logging with correlation IDs
- Error tracking and alerting

### Metrics

- CloudWatch metrics for all services
- Custom business metrics
- Performance monitoring
- Cost tracking

### Tracing

- AWS X-Ray for distributed tracing
- Request flow visualization
- Performance bottleneck identification

## Deployment

### Infrastructure as Code

- AWS SAM templates
- Environment-specific configurations
- Automated deployments
- Rollback capabilities

### CI/CD Pipeline

- GitHub Actions (recommended)
- Automated testing

## Conventions

### Lambda file headers

To improve navigability, each Lambda handler file begins with a concise header block describing:

- File objective: one-liner of what the Lambda does
- Auth: which handler wrapper is used (withAuth, withoutAuth, withAdminAuth) and the implication
- Special notes: bullets for validation, pagination/cursors, side effects (counters, revalidation), rate/size limits, local/dev specifics (LocalStack)

This convention reduces onboarding time and clarifies non-obvious behavior at a glance.

- Security scanning
- Multi-environment deployment
