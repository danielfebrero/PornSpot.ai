# I2V Thumbnail Backfill Script

## Overview

This script backfills `thumbnailUrl` and `thumbnailUrls` for generated videos by copying them from their source images via I2V (image-to-video) job records.

## Background

When videos are generated via the I2V feature:

- An `I2VJobEntity` is created with a unique `jobId`
- The `jobId` matches the generated video's `mediaId`
- The job's `mediaId` field points to the source image
- Previously, we weren't copying thumbnail information from source to generated video

## Logic

1. **Query all videos**: Uses GSI8 (`MEDIA_BY_TYPE_AND_CREATOR`) to find all video media
2. **Find I2V jobs**: For each video, look up the corresponding I2V job using video's `mediaId` as `jobId`
3. **Get source media**: Retrieve the source image media using `job.mediaId`
4. **Copy thumbnails**: Update the video with `thumbnailUrl` and `thumbnailUrls` from source

## Usage

```bash
# Test run (recommended first)
node backfill-i2v-thumbnails.js --env=prod --dry-run

# Live execution
node backfill-i2v-thumbnails.js --env=prod

# Local development
node backfill-i2v-thumbnails.js --env=local --dry-run
```

## Environment Variables

Required in your `.env.prod` file:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `DYNAMODB_TABLE`

Optional:

- `I2V_BACKFILL_CONCURRENCY=10` (default: 10)
- `LOCAL_AWS_ENDPOINT` (for local development)

## Safety Features

### Dry Run Mode

- Use `--dry-run` to see what would be changed without applying updates
- Logs all proposed changes for review

### Rate Limiting

- Configurable concurrency (default: 10 concurrent operations)
- Small delays between batches to avoid overwhelming DynamoDB
- Graceful error handling for individual items

### Skip Logic

- Skips videos that already have both `thumbnailUrl` and `thumbnailUrls`
- Skips videos without corresponding I2V jobs
- Skips when source media is not found
- Skips when source media has no thumbnails to copy

## Expected Output

```
🚀 Starting I2V thumbnail backfill...
📋 Table: prod-pornspot-media
🌍 Mode: AWS
🔍 Run: DRY RUN

📹 Fetching all video media...
📹 Found 50 videos in this batch (total: 50)
📹 Found 50 video media items to process

⚡ Processing with concurrency: 10
🔄 [1/50] Processing video: abc123...
✅ [1/50] Updated abc123 from source def456
🔄 [2/50] Processing video: xyz789...
⏭️ [2/50] Skipped xyz789: already_has_thumbnails

📊 Migration Complete!
========================
📹 Total videos processed: 50
✅ Updated: 35
⏭️ Skipped: 15
❌ Errors: 0

📋 Breakdown by reason:
   already_has_thumbnails: 10
   no_i2v_job_found: 3
   source_has_no_thumbnails: 2
```

## Production Recommendations

1. **Always run dry-run first**:

   ```bash
   node backfill-i2v-thumbnails.js --env=prod --dry-run
   ```

2. **Monitor the output** for any unexpected patterns or high error rates

3. **Run during low-traffic periods** to minimize impact

4. **Consider chunking for large datasets**: The script handles pagination automatically, but you can stop and restart if needed

## Error Handling

The script handles these error scenarios gracefully:

- Network timeouts when accessing DynamoDB
- Missing I2V job records
- Missing source media records
- DynamoDB throttling
- Individual item update failures

Failed items are logged but don't stop the overall process.

## Rollback

This script only adds missing thumbnail information and doesn't delete or modify existing thumbnails. If needed, you can:

1. Identify updated records from the logs
2. Manually remove the thumbnail fields if necessary
3. The script is idempotent - running it again won't create duplicates

## Performance

- Uses batch processing with configurable concurrency
- Respects DynamoDB capacity with delays between batches
- Efficiently uses GSI8 for video queries
- Single-item Gets for I2V jobs and source media (efficient for this use case)

## Monitoring

Track these metrics during execution:

- Update success rate (should be high)
- Skip rate (expected for videos that already have thumbnails)
- Error rate (should be low)
- Processing speed (varies by database size and network)
