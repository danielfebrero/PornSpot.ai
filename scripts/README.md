# Deployment Scripts

This directory contains scripts for deploying the pornspot Art application to different environments.

## Scripts Overview

### [`deploy.sh`](deploy.sh)

Main backend deployment script that supports multiple environments (dev, staging, prod).

**Usage:**

```bash
./scripts/deploy.sh [OPTIONS]

Options:
  -e, --env ENVIRONMENT    Target environment (dev, staging, prod) [default: dev]
  -g, --guided            Run guided deployment (interactive)
  -h, --help              Show help message

Examples:
  ./scripts/deploy.sh                      # Deploy to dev environment
  ./scripts/deploy.sh --env staging        # Deploy to staging environment
  ./scripts/deploy.sh --env prod --guided  # Deploy to production with guided setup
```

**Features:**

- Environment validation and safety checks
- Production deployment confirmation
- Automatic dependency installation
- SAM build and deployment
- Environment-specific stack naming
- API Gateway URL extraction

### [`deploy-frontend.sh`](deploy-frontend.sh)

Frontend preparation and deployment script for Vercel.

**Usage:**

```bash
./scripts/deploy-frontend.sh [OPTIONS]

Options:
  -e, --env ENVIRONMENT    Target environment (dev, staging, prod) [default: prod]
  -t, --type TYPE         Deployment type (preview, production) [default: preview]
  -h, --help              Show help message

Examples:
  ./scripts/deploy-frontend.sh                           # Deploy to preview (staging)
  ./scripts/deploy-frontend.sh --env prod --type production  # Deploy to production
  ./scripts/deploy-frontend.sh --env staging             # Deploy staging to preview
```

**Features:**

- Pre-deployment validation (type checking, linting, tests)
- Environment-specific configuration guidance
- Production deployment safety checks
- Vercel CLI integration
- Environment variable documentation

### [`fix-rollback-stack.sh`](fix-rollback-stack.sh)

Fixes CloudFormation stacks stuck in ROLLBACK_COMPLETE state by deleting and recreating them.

**Usage:**

```bash
./scripts/fix-rollback-stack.sh [OPTIONS]

Options:
  -e, --env ENVIRONMENT    Target environment (dev, staging, prod) [default: prod]
  -f, --force             Force delete without confirmation
  -h, --help              Show help message

Examples:
  ./scripts/fix-rollback-stack.sh                    # Fix prod stack (with confirmation)
  ./scripts/fix-rollback-stack.sh --env staging      # Fix staging stack
  ./scripts/fix-rollback-stack.sh --force            # Force delete prod stack without confirmation
```

**Features:**

- Checks if the stack is in ROLLBACK_COMPLETE state
- Deletes the stack after confirmation (⚠️ **DATA LOSS**)
- Redeploys the stack using the deploy script
- **WARNING**: This will delete all data in DynamoDB tables and S3 buckets

### [`continue-rollback.sh`](continue-rollback.sh)

Attempts to continue update rollback for CloudFormation stacks in ROLLBACK_COMPLETE state without data loss.

**Usage:**

```bash
./scripts/continue-rollback.sh [OPTIONS]

Options:
  -e, --env ENVIRONMENT    Target environment (dev, staging, prod) [default: prod]
  -h, --help              Show help message

Examples:
  ./scripts/continue-rollback.sh                     # Continue rollback for prod stack
  ./scripts/continue-rollback.sh --env staging       # Continue rollback for staging stack
```

**Features:**

- Checks if the stack is in ROLLBACK_COMPLETE state
- Continues the update rollback to get stack back to stable state
- Redeploys the stack using the deploy script
- **Recommended first approach** as it preserves data

### [`dump-s3-bucket.sh`](dump-s3-bucket.sh)

Dumps S3 bucket contents to local filesystem for backup/restore purposes.

**Usage:**

```bash
./scripts/dump-s3-bucket.sh [OPTIONS]

Options:
  -e, --env ENVIRONMENT   Target environment (local, dev, staging, prod) [default: local]
  -h, --help             Show help message

Examples:
  ./scripts/dump-s3-bucket.sh                     # Dump local environment bucket
  ./scripts/dump-s3-bucket.sh --env prod          # Dump production bucket
```

**Features:**

- Environment-aware (local, dev, staging, prod)
- Creates complete backup with metadata
- Stores objects with original directory structure
- Generates human-readable summary

### [`restore-s3-bucket.sh`](restore-s3-bucket.sh)

Restores S3 bucket contents from local filesystem dump.

**Usage:**

```bash
./scripts/restore-s3-bucket.sh [OPTIONS]

Options:
  -e, --env ENVIRONMENT   Target environment (local, dev, staging, prod) [default: local]
  -h, --help             Show help message

Examples:
  ./scripts/restore-s3-bucket.sh                  # Restore to local environment
  ./scripts/restore-s3-bucket.sh --env staging    # Restore to staging environment
```

**Features:**

- Auto-creates bucket if it doesn't exist
- Verifies upload integrity
- Applies CORS policy for local environment
- **Auto-restore**: `start-local-backend.sh` automatically restores if local bucket is empty

See [`docs/S3_BACKUP_RESTORE.md`](../docs/S3_BACKUP_RESTORE.md) for detailed documentation.

### [`dump-dynamodb-table.sh`](dump-dynamodb-table.sh)

Dumps DynamoDB table contents to local filesystem for backup/restore purposes.

**Usage:**

```bash
./scripts/dump-dynamodb-table.sh [OPTIONS]

Options:
  -e, --env ENVIRONMENT     Source environment (local, dev, staging, prod) [default: local]
  -o, --output DIRECTORY    Output directory for dump [default: auto-generated]
  -h, --help               Show help message

Examples:
  ./scripts/dump-dynamodb-table.sh                     # Dump local environment table
  ./scripts/dump-dynamodb-table.sh --env prod          # Dump production table
```

**Features:**

- Environment-aware (reads from `/scripts/.env.{environment}`)
- Creates complete backup with schema and metadata
- Handles large tables with batch processing
- Generates human-readable summary

### [`restore-dynamodb-table.sh`](restore-dynamodb-table.sh)

Restores DynamoDB table contents from local filesystem dump.

**Usage:**

```bash
./scripts/restore-dynamodb-table.sh [OPTIONS]

Options:
  -e, --env ENVIRONMENT     Target environment (local, dev, staging, prod) [default: local]
  -s, --source DIRECTORY    Source directory for restore [default: auto-detected]
  -h, --help               Show help message

Examples:
  ./scripts/restore-dynamodb-table.sh                  # Restore to local environment
  ./scripts/restore-dynamodb-table.sh --env staging    # Restore to staging environment
  ./scripts/restore-dynamodb-table.sh --env local --source ./prod-backup # Cross-environment restore
```

**Features:**

- Auto-creates table if it doesn't exist (using schema from dump)
- Preserves Global and Local Secondary Indexes
- Batch processing for large datasets
- Cross-environment restore support with warnings
- Verifies restore integrity

See [`docs/DYNAMODB_BACKUP_RESTORE.md`](../docs/DYNAMODB_BACKUP_RESTORE.md) for detailed documentation.

## Environment Support

Both scripts support three environments:

### Development (`dev`)

- **Purpose**: Feature development and initial testing
- **Backend Stack**: `pornspot-ai-dev`
- **Frontend Domain**: `dev.pornspot.ai`
- **Safety Level**: Low (quick iterations)

### Staging (`staging`)

- **Purpose**: Pre-production testing and validation
- **Backend Stack**: `pornspot-ai-staging`
- **Frontend Domain**: `staging.pornspot.ai`
- **Safety Level**: Medium (comprehensive testing)

### Production (`prod`)

- **Purpose**: Live application for end users
- **Backend Stack**: `pornspot-ai-prod`
- **Frontend Domain**: `pornspot.ai`
- **Safety Level**: High (confirmation prompts, guided deployment)

## Prerequisites

### Backend Deployment

- AWS CLI configured with appropriate permissions
- AWS SAM CLI installed
- Node.js and npm installed
- Valid [`samconfig.toml`](../samconfig.toml) configuration

### Frontend Deployment

- Vercel CLI installed (or will be installed automatically)
- Backend API deployed and accessible
- Environment variables configured in Vercel dashboard

## Safety Features

### Production Safeguards

- Confirmation prompts for production deployments
- Guided deployment option for production
- Environment validation before deployment
- Clear warnings for destructive operations

### Validation Checks

- Dependency verification
- Configuration file validation
- Environment variable checks
- Pre-deployment testing (frontend)

## Integration with CI/CD

These scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Deploy Backend to Staging
  run: ./scripts/deploy.sh --env staging

- name: Prepare Frontend for Production
  run: ./scripts/deploy-frontend.sh --env prod --type production
```

## Troubleshooting

### Common Issues

1. **CloudFormation Stack in ROLLBACK_COMPLETE State**

   When you see the error: `Stack is in ROLLBACK_COMPLETE state and can not be updated`:

   **Option 1: Continue Rollback (Recommended first try)**

   ```bash
   ./scripts/continue-rollback.sh --env prod
   ```

   **Option 2: Delete and Recreate Stack**

   ```bash
   ./scripts/fix-rollback-stack.sh --env prod
   ```

   ⚠️ **WARNING**: This will delete all data in the stack

2. **Permission Denied**

   ```bash
   chmod +x scripts/deploy.sh
   chmod +x scripts/deploy-frontend.sh
   chmod +x scripts/fix-rollback-stack.sh
   chmod +x scripts/continue-rollback.sh
   ```

3. **AWS Configuration Issues**

   ```bash
   aws configure list
   aws sts get-caller-identity
   ```

4. **SAM CLI Issues**

   ```bash
   sam --version
   sam build --help
   ```

5. **Node.js/npm Issues**
   ```bash
   node --version
   npm --version
   ```

### Getting Help

Run any script with the `--help` flag to see detailed usage information:

```bash
./scripts/deploy.sh --help
./scripts/deploy-frontend.sh --help
```

## Related Documentation

- [Main Deployment Guide](../docs/DEPLOYMENT.md) - Comprehensive deployment documentation
- [SAM Configuration](../samconfig.toml) - Environment-specific SAM settings
- [Vercel Configuration](../vercel.json) - Frontend deployment settings
- [AWS SAM Template](../template.yaml) - Infrastructure as Code definition

---

## Thumbnail System Scripts

### [`repair-thumbnails.js`](repair-thumbnails.js)

**🎯 NEW: 5-Size Thumbnail Generation System**

Batch script to generate missing thumbnails for existing media files using the new intelligent 5-size thumbnail system.

**Usage:**

```bash
npm run repair:thumbnails [OPTIONS]

Options:
  --dry-run           Show what would be processed without making changes
  --limit NUMBER      Limit the number of items to process [default: 100]
  --batch-size NUMBER Number of items to process concurrently [default: 5]

Examples:
  npm run repair:thumbnails                    # Process up to 100 items with default settings
  npm run repair:thumbnails --dry-run          # Preview what would be processed
  npm run repair:thumbnails --limit 50         # Process only 50 items
  npm run repair:thumbnails --batch-size 3     # Process 3 items concurrently
```

**✨ New 5-Size System Features:**

- **Cover** (128×128px, 75% quality) - Album covers, small previews
- **Small** (240×240px, 80% quality) - Dense grids, admin interfaces
- **Medium** (300×300px, 85% quality) - General purpose, discover
- **Large** (365×365px, 85% quality) - High quality grids
- **X-Large** (600×600px, 90% quality) - Mobile/small screens

**How It Works:**

1. Scans DynamoDB for media items without complete thumbnail sets
2. Downloads original images from S3
3. **Generates all 5 thumbnail sizes** using Sharp image processing
4. Uploads thumbnails to organized S3 folder structure
5. Updates DynamoDB with complete `thumbnailUrls` object
6. Maintains backward compatibility with legacy `thumbnailUrl` field

**Output Example:**

```bash
🚀 Thumbnail Repair Script - 5-Size System
📅 2024-01-15T10:30:00.000Z
📊 Found 45 media items needing thumbnail repair

Processing batch 1/2 (25 items)...
✅ album123/media456.jpg → Generated 5 sizes (cover, small, medium, large, xlarge)
✅ album123/media789.jpg → Generated 5 sizes (cover, small, medium, large, xlarge)
⚠️  album123/video012.mp4 → Skipped (video file)

📊 Repair Results:
   Items processed: 45
   Thumbnails generated: 43 (5 sizes each = 215 total files)
   Skipped: 2 (video files)
   Errors: 0

💾 Storage Impact:
   Original images: ~450MB
   Generated thumbnails: ~85MB
   Space efficiency: 81% savings vs original
```

**Prerequisites:**

- AWS CLI configured with appropriate permissions
- Access to S3 bucket containing original images
- DynamoDB read/write permissions for media table
- Node.js environment with Sharp dependencies

**Production Considerations:**

- Start with small limits (`--limit 10`) to test in production
- Monitor AWS costs during large batch operations
- Use appropriate `--batch-size` based on Lambda memory and network
- Consider running during off-peak hours for large datasets
- Each item generates 5 thumbnail files, so plan storage accordingly

**Migration from 3-Size System:**

If migrating from the previous 3-size system, run cleanup scripts first:

```bash
# 1. Clean up old thumbnails
npm run cleanup:thumbnails:all

# 2. Generate new 5-size thumbnails
npm run repair:thumbnails
```

---

## Cleanup Scripts

**🧹 Thumbnail Migration & Cleanup Tools**

Scripts for migrating from old 3-size to new 5-size thumbnail system by cleaning up existing thumbnail data.

### Overview

The cleanup scripts remove legacy thumbnail data to prepare for the new 5-size system:

**Legacy Patterns Removed:**

- Files in `/thumbnails/` directories with old suffixes
- Database fields: old `thumbnailUrl` references
- Files with `_thumb_small`, `_thumb_medium`, `_thumb_large` suffixes

**New System Preparation:**

- Clean slate for 5 new sizes: cover (128px), small (240px), medium (300px), large (365px), xlarge (600px)
- Intelligent responsive selection system
- Backward compatibility maintained

### Scripts

#### 1. S3 Cleanup ([`cleanup-thumbnails-s3.js`](cleanup-thumbnails-s3.js))

Removes all legacy thumbnail files from S3 bucket.

**Usage:**

```bash
# Dry run (preview what would be deleted)
npm run cleanup:thumbnails:s3 -- --dry-run

# Actual cleanup
S3_BUCKET=your-bucket npm run cleanup:thumbnails:s3

# Help
node scripts/cleanup-thumbnails-s3.js --help
```

**What it does:**

- Lists all objects with `/thumbnails/` prefix
- Identifies and deletes legacy thumbnail patterns
- Provides detailed progress logging and batch deletion
- Supports safe dry-run mode for testing

#### 2. DynamoDB Cleanup ([`cleanup-thumbnails-db.js`](cleanup-thumbnails-db.js))

Removes legacy thumbnail references from database.

**Usage:**

```bash
# Dry run (preview what would be updated)
npm run cleanup:thumbnails:db -- --dry-run

# Actual cleanup
DYNAMODB_TABLE=your-table npm run cleanup:thumbnails:db

# Help
node scripts/cleanup-thumbnails-db.js --help
```

**What it does:**

- Scans all Media entities in DynamoDB
- Removes legacy `thumbnailUrl` and `thumbnailUrls` fields
- Resets status to "uploaded" for reprocessing
- Updates `updatedAt` timestamp

#### 3. Complete Cleanup ([`cleanup-thumbnails-all.js`](cleanup-thumbnails-all.js))

Orchestrates both S3 and DynamoDB cleanup in sequence.

**Usage:**

```bash
# Complete dry run
npm run cleanup:thumbnails:all -- --dry-run

# Complete cleanup
S3_BUCKET=your-bucket DYNAMODB_TABLE=your-table npm run cleanup:thumbnails:all

# Selective cleanup
npm run cleanup:thumbnails:all -- --skip-db    # Only S3
npm run cleanup:thumbnails:all -- --skip-s3    # Only DynamoDB
```

### Environment Variables

| Variable         | Required             | Description                           |
| ---------------- | -------------------- | ------------------------------------- |
| `S3_BUCKET`      | Yes (for S3 cleanup) | S3 bucket name containing media files |
| `DYNAMODB_TABLE` | Yes (for DB cleanup) | DynamoDB table name                   |
| `AWS_REGION`     | No                   | AWS region (default: us-east-1)       |

### Safety Features

#### Dry Run Mode

All scripts support `--dry-run` to preview changes without execution:

```bash
npm run cleanup:thumbnails:all -- --dry-run
```

#### Confirmation Prompts

Scripts require explicit confirmation for destructive operations:

```
⚠️  WARNING: This will permanently delete thumbnail data!
   - Legacy S3 thumbnail files will be deleted
   - Legacy DynamoDB thumbnail references will be removed
   This action cannot be undone.

Are you sure you want to proceed? (y/N):
```

#### Progress Logging

Detailed progress information:

- Object/entity counts and processing status
- Batch operation progress
- Success/error summaries with detailed reporting
- Performance metrics and timing

### Migration Workflow

**Complete Migration Process:**

```bash
# 1. Assessment (dry-run)
npm run cleanup:thumbnails:all -- --dry-run

# 2. Backup verification (ensure you have backups)
echo "Verify backups are in place before proceeding"

# 3. Execute cleanup
npm run cleanup:thumbnails:all

# 4. Generate new 5-size thumbnails
npm run repair:thumbnails

# 5. Verify new system
npm run repair:thumbnails -- --dry-run --limit 10
```

### Example Output

**S3 Cleanup:**

```bash
🚀 S3 Thumbnail Cleanup Script
📅 2024-01-15T10:30:00.000Z
🪣 S3 Bucket: my-production-bucket
🌍 AWS Region: us-east-1

🔍 Scanning for legacy thumbnails...
📊 Found 347 legacy thumbnail objects:
   - /thumbnails/ directories: 215 objects
   - _thumb_small suffix: 44 objects
   - _thumb_medium suffix: 44 objects
   - _thumb_large suffix: 44 objects
   Total size: 67.3 MB

🗑️  Deleting in batches...
   ✅ Batch 1/4: 100 objects deleted
   ✅ Batch 2/4: 100 objects deleted
   ✅ Batch 3/4: 100 objects deleted
   ✅ Batch 4/4: 47 objects deleted

✅ S3 cleanup completed! Ready for 5-size system.
```

**Database Cleanup:**

```bash
🚀 DynamoDB Thumbnail Cleanup Script
📅 2024-01-15T10:35:00.000Z
📋 DynamoDB Table: production-media-table

🔍 Scanning for legacy thumbnail references...
📊 Found 123 media entities with legacy data:
   - With thumbnailUrl field: 89
   - With old thumbnailUrls: 54
   - Status needs reset: 123

🔄 Cleaning database records...
   ✅ Batch 1/5: 25 entities updated
   ✅ Batch 2/5: 25 entities updated
   ✅ Batch 3/5: 25 entities updated
   ✅ Batch 4/5: 25 entities updated
   ✅ Batch 5/5: 23 entities updated

✅ Database cleanup completed! Ready for repair script.
```

### Error Recovery

**If S3 cleanup fails:**

```bash
# Skip S3 and clean database only
npm run cleanup:thumbnails:all -- --skip-s3
```

**If database cleanup fails:**

```bash
# Skip database and retry S3 only
npm run cleanup:thumbnails:all -- --skip-db
```

**Complete failure recovery:**

1. Check AWS credentials and permissions
2. Verify environment variables are set correctly
3. Check network connectivity and service availability
4. Run individual scripts with `--dry-run` to diagnose issues
5. Check CloudWatch logs for detailed error information

### Next Steps After Cleanup

1. ✅ All legacy thumbnail files removed from S3
2. ✅ All legacy thumbnail references removed from database
3. ✅ Media entities reset to "uploaded" status
4. 🚀 **Ready to run repair script for 5-size system**

```bash
# Generate new 5-size thumbnails
npm run repair:thumbnails

# Verify intelligent selection working
# Frontend will automatically use new system
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] **Backup Verification**: Ensure database and S3 backups are current
- [ ] **Cleanup Testing**: Run all cleanup scripts with `--dry-run` in staging
- [ ] **Migration Planning**: Schedule maintenance window for migration
- [ ] **Monitoring Setup**: Prepare CloudWatch alarms for thumbnail generation

### Deployment

- [ ] **Deploy Backend**: Update Lambda functions with 5-size generation
- [ ] **Run Cleanup**: Execute cleanup scripts to remove legacy thumbnails
- [ ] **Run Repair**: Generate new 5-size thumbnails for existing media
- [ ] **Deploy Frontend**: Update with intelligent selection logic
- [ ] **Verify Operation**: Test thumbnail generation and selection

### Post-Deployment

- [ ] **Performance Monitoring**: Verify improved loading speeds
- [ ] **Cost Analysis**: Monitor S3 storage and bandwidth costs
- [ ] **User Experience**: Validate responsive thumbnail selection
- [ ] **Error Monitoring**: Check for any thumbnail generation failures

For comprehensive migration procedures, see [`docs/THUMBNAIL_MIGRATION.md`](../docs/THUMBNAIL_MIGRATION.md).

---

## DynamoDB Backfill Scripts

### [`backfill-gsi2-albums.js`](backfill-gsi2-albums.js)

Backfills album entities to ensure the cover image relationship is indexed consistently.

- Sets `GSI2PK` to `ALBUM_COVER_IMAGE` and `GSI2SK` to `<coverImageMediaId>#<albumId>` when a cover exists
- Removes stale GSI2 attributes when an album no longer has a `coverImageMediaId`
- Supports `--dry-run`, `--env`, `--concurrency`, and `--page-size` arguments

**Usage:**

```bash
cd scripts
node backfill-gsi2-albums.js --env=stage --dry-run
# Re-run without --dry-run to apply updates
```

> 💡 Shares the same safety patterns as other DynamoDB migrations (for example `backfill-gsi3-albums.js` and `backfill-gsi5-visibility.js`).
