# GSI3 AlbumMedia Migration

## Overview

This migration adds GSI3 to the `AlbumMediaEntity` to enable efficient querying of media within a specific album, sorted by when they were added (`addedAt`).

## Schema Changes

### AlbumMediaEntity GSI3 Keys

- **GSI3PK**: `ALBUM#<albumId>`
- **GSI3SK**: `<addedAt>#<mediaId>`

This GSI allows us to:

1. Query all media in a specific album (using GSI3PK)
2. Sort results by `addedAt` in descending order (most recent first)
3. Maintain proper pagination with sorted results

## Benefits

### Before (Main Table Query + In-Memory Sort)

- ❌ Queried using main table PK/SK
- ❌ Required in-memory sorting by `addedAt`
- ❌ Pagination broke sorting (each page was sorted independently)
- ❌ Not efficient for large albums

### After (GSI3 Query)

- ✅ Native DynamoDB sorting by `addedAt`
- ✅ Proper pagination with consistent ordering
- ✅ More efficient query pattern
- ✅ No in-memory sorting required

## Implementation

### 1. Update Shared Types

The `AlbumMediaEntity` interface in `shared-types/database.ts` now includes:

```typescript
export interface AlbumMediaEntity extends BaseEntity {
  PK: string; // ALBUM#{albumId}
  SK: string; // MEDIA#{mediaId}
  GSI1PK: string; // MEDIA#{mediaId}
  GSI1SK: string; // ALBUM#{albumId}#{addedAt}
  GSI2PK: string; // ALBUM_MEDIA_BY_DATE
  GSI2SK: string; // {addedAt}#{albumId}#{mediaId}
  GSI3PK: string; // ALBUM#{albumId}  ← NEW
  GSI3SK: string; // {addedAt}#{mediaId}  ← NEW
  EntityType: "AlbumMedia";
  albumId: string;
  mediaId: string;
  addedAt: string;
  addedBy?: string;
}
```

### 2. Update DynamoDB Service

The `addMediaToAlbum` function now sets GSI3 keys when creating new relationships:

```typescript
const albumMediaEntity: AlbumMediaEntity = {
  PK: `ALBUM#${albumId}`,
  SK: `MEDIA#${mediaId}`,
  GSI1PK: `MEDIA#${mediaId}`,
  GSI1SK: `ALBUM#${albumId}#${now}`,
  GSI2PK: "ALBUM_MEDIA_BY_DATE",
  GSI2SK: `${now}#${albumId}#${mediaId}`,
  GSI3PK: `ALBUM#${albumId}`, // NEW
  GSI3SK: `${now}#${mediaId}`, // NEW
  EntityType: "AlbumMedia",
  albumId,
  mediaId,
  addedAt: now,
  addedBy,
};
```

### 3. Update Query Pattern

The `listAlbumMedia` function now uses GSI3:

```typescript
// Before: Main table query + in-memory sort
const relationshipsResult = await docClient.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk_prefix)",
    ExpressionAttributeValues: {
      ":pk": `ALBUM#${albumId}`,
      ":sk_prefix": "MEDIA#",
    },
    Limit: limit,
  })
);
// ... then sort in memory

// After: GSI3 query with native sorting
const relationshipsResult = await docClient.send(
  new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "GSI3",
    KeyConditionExpression: "GSI3PK = :gsi3pk",
    ExpressionAttributeValues: {
      ":gsi3pk": `ALBUM#${albumId}`,
    },
    ScanIndexForward: false, // Descending order
    Limit: limit,
  })
);
```

## Migration Steps

### 1. Update CloudFormation Template

Add GSI3 to your `template.yaml`:

```yaml
GlobalSecondaryIndexes:
  # ... existing GSIs ...
  - IndexName: GSI3
    KeySchema:
      - AttributeName: GSI3PK
        KeyType: HASH
      - AttributeName: GSI3SK
        KeyType: RANGE
    Projection:
      ProjectionType: ALL
    ProvisionedThroughput:
      ReadCapacityUnits: 5
      WriteCapacityUnits: 5
```

Don't forget to add the attribute definitions:

```yaml
AttributeDefinitions:
  # ... existing attributes ...
  - AttributeName: GSI3PK
    AttributeType: S
  - AttributeName: GSI3SK
    AttributeType: S
```

### 2. Deploy CloudFormation Changes

```bash
# Stage environment
npm run deploy:backend:stage

# Production environment
npm run deploy:backend:prod
```

### 3. Run Backfill Script

After the GSI is created, backfill existing AlbumMedia relationships:

```bash
# Dry run first to preview changes
node scripts/backfill-gsi3-album-media.js --env=stage --dry-run

# Run the actual backfill
node scripts/backfill-gsi3-album-media.js --env=stage

# For production
node scripts/backfill-gsi3-album-media.js --env=prod
```

### 4. Verify Migration

Check a few albums to ensure media is properly sorted:

```bash
# Use AWS CLI to verify GSI3 keys exist
aws dynamodb query \
  --table-name YourTableName \
  --index-name GSI3 \
  --key-condition-expression "GSI3PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"ALBUM#your-album-id"}}'
```

## Performance Impact

### Query Performance

- **Before**: O(n log n) due to in-memory sorting
- **After**: O(log n) for DynamoDB query only

### Storage

- **Additional Storage**: ~100 bytes per AlbumMedia relationship for GSI3 keys
- **Read/Write Capacity**: GSI3 consumes additional RCUs/WCUs

### Cost Considerations

- Adding a GSI increases storage costs slightly
- Read/write capacity for GSI3 should be monitored and adjusted based on usage patterns
- Consider using on-demand billing if traffic is unpredictable

## Rollback Plan

If issues arise, you can temporarily revert to the old query pattern:

1. Change `listAlbumMedia` to use the main table query
2. Keep GSI3 in place for future use
3. Investigate and fix any issues
4. Re-enable GSI3 query when ready

## Testing

### Unit Tests

Update tests in `backend/__tests__/dynamodb.test.ts` to verify:

- GSI3 keys are set correctly on new relationships
- `listAlbumMedia` returns properly sorted results
- Pagination works correctly with GSI3

### Integration Tests

Test the full flow:

1. Create an album
2. Add multiple media items at different times
3. Query the album media list
4. Verify results are sorted by `addedAt` descending
5. Test pagination across multiple pages

## Related Files

- `shared-types/database.ts` - Type definitions
- `backend/shared/utils/dynamodb.ts` - DynamoDB operations
- `scripts/backfill-gsi3-album-media.js` - Migration script
- `template.yaml` - CloudFormation template (needs manual update)

## Questions or Issues

If you encounter any issues during migration:

1. Check CloudFormation stack events for GSI creation status
2. Verify GSI3 is active before running backfill
3. Monitor DynamoDB metrics for throttling
4. Check backfill script logs for errors
