# DynamoDB Complete Data Deletion Script

This document describes the `delete-all-dynamodb-items.js` script for completely wiping all data from the PornSpot.ai DynamoDB table.

## ⚠️ DANGER ZONE - PRODUCTION WARNING

**This script permanently deletes ALL data from the database. This includes:**

- All user accounts and profiles
- All albums and media files metadata
- All comments and interactions
- All authentication sessions
- All application data

**This operation cannot be undone!**

## Prerequisites

1. **AWS Credentials**: Ensure you have proper AWS credentials configured
2. **Node.js Dependencies**: Run `npm install` in the scripts directory
3. **Access Permissions**: Verify you have DynamoDB full access for the target environment

## Usage Examples

### Safe Preview (Recommended First Step)
```bash
# Preview what would be deleted from production
node scripts/delete-all-dynamodb-items.js --env=prod --dry-run

# Preview what would be deleted from staging
node scripts/delete-all-dynamodb-items.js --env=staging --dry-run
```

### Local Development
```bash
# Delete all local development data
node scripts/delete-all-dynamodb-items.js --env=local --confirm
```

### Staging Environment
```bash
# Delete staging data with backup
node scripts/delete-all-dynamodb-items.js --env=staging --confirm --backup

# Delete staging data without backup
node scripts/delete-all-dynamodb-items.js --env=staging --confirm
```

### Production Environment (High Risk)
```bash
# ALWAYS create backup when deleting production data
node scripts/delete-all-dynamodb-items.js --env=prod --confirm --backup
```

## Command Options

| Option | Description | Required |
|--------|-------------|----------|
| `--env=ENV` | Environment: local, dev, staging, prod | Yes |
| `--dry-run` | Preview mode - no actual deletion | Optional |
| `--confirm` | Actually perform deletion (mutually exclusive with dry-run) | Yes (unless dry-run) |
| `--backup` | Create JSON backup before deletion | Optional (recommended for prod) |
| `--help` | Show help message | Optional |

## Safety Features

### 1. Explicit Confirmation Required
- Script requires `--confirm` flag for actual deletion
- Production deletions require typing "DELETE ALL PRODUCTION DATA"
- No accidental deletions possible

### 2. Dry-Run Mode
- Use `--dry-run` to preview what would be deleted
- Shows item counts by type (USER, ALBUM, MEDIA, etc.)
- No data is modified in dry-run mode

### 3. Backup Functionality
- `--backup` flag creates complete JSON backup
- Backup saved to `backups/dynamodb/` directory
- Includes timestamp in filename
- Can be used for restoration if needed

### 4. Progress Tracking
- Real-time progress display
- Batch processing to handle large datasets
- Error handling and retry logic
- Final summary report

## Output Examples

### Dry Run Output
```
🚀 DynamoDB Items Deletion Script
   Environment: prod
   Table: prod-pornspot-media
   Mode: DRY RUN

🔍 Scanning table: prod-pornspot-media

📊 Found item types:
   USER: 1542 items
   ALBUM: 3891 items
   MEDIA: 15637 items
   COMMENT: 2847 items

🗑️  would delete: 23917/23917 items (956 batches)

📈 Final Report:
   Environment: prod
   Table: prod-pornspot-media
   Items would be deleted: 23917
   Batches processed: 956
   Duration: 45 seconds

💡 This was a dry run. No items were actually deleted.
   Use --confirm to perform actual deletion.
```

### Production Deletion with Backup
```
🚀 DynamoDB Items Deletion Script
   Environment: prod
   Table: prod-pornspot-media
   Mode: LIVE DELETION
   Backup: Enabled

🚨 PRODUCTION DELETION WARNING 🚨
You are about to delete ALL items from: prod-pornspot-media
Environment: prod
This operation is IRREVERSIBLE and will destroy ALL data!
✅ Backup will be created before deletion

Type "DELETE ALL PRODUCTION DATA" to confirm: DELETE ALL PRODUCTION DATA

📦 Creating backup: ../backups/dynamodb/prod-full-backup-2025-08-25T14-30-45-123Z.json
📦 Backing up items: 23917
✅ Backup created: 23917 items saved to ../backups/dynamodb/prod-full-backup-2025-08-25T14-30-45-123Z.json

🔍 Scanning table: prod-pornspot-media
🗑️  deleted: 23917/23917 items (956 batches)

📈 Final Report:
   Environment: prod
   Table: prod-pornspot-media
   Items deleted: 23917
   Batches processed: 956
   Duration: 52 seconds

✅ Deletion completed successfully!

💾 Backup location: ../backups/dynamodb/prod-full-backup-2025-08-25T14-30-45-123Z.json
```

## Error Handling

The script includes comprehensive error handling:

- **Network Issues**: Retries failed operations automatically
- **Permission Errors**: Clear error messages for access issues
- **Partial Failures**: Tracks successful vs failed deletions
- **Interruption Handling**: Graceful shutdown on Ctrl+C
- **Validation**: Checks environment parameters before execution

## Recovery Procedures

### If Deletion Fails Midway
1. Check the final report for completion status
2. Re-run with same parameters to delete remaining items
3. Use backup file for restoration if needed

### If Backup is Needed for Restoration
1. Locate backup file in `backups/dynamodb/` directory
2. Use the `restore-dynamodb-table.sh` script
3. Or manually restore using AWS CLI batch-write operations

## Best Practices

### For Production Use
1. **Always run dry-run first** to understand scope
2. **Always create backup** with `--backup` flag
3. **Verify backup integrity** before proceeding
4. **Plan for downtime** during deletion process
5. **Have rollback plan** ready with backup file

### For Development Use
1. Use local or staging environments for testing
2. Regular cleanup helps maintain development environments
3. Consider automated cleanup in CI/CD pipelines

## Troubleshooting

### Common Issues

**Error: "Invalid environment"**
- Solution: Use one of: local, dev, staging, prod

**Error: "Must specify either --dry-run or --confirm"**
- Solution: Choose exactly one execution mode

**Error: "Access denied"**
- Solution: Check AWS credentials and DynamoDB permissions

**Error: "Table not found"**
- Solution: Verify environment and table naming convention

### Performance Considerations

- Large datasets (>100k items) may take several minutes
- Script uses batch operations for efficiency
- Progress is displayed in real-time
- Memory usage scales with backup size (if enabled)

## Integration with Other Scripts

This script complements other maintenance scripts:

- **Backup Scripts**: `dump-dynamodb-table.sh` for regular backups
- **Restore Scripts**: `restore-dynamodb-table.sh` for data restoration
- **Cleanup Scripts**: Various cleanup scripts for specific data types

## Security Considerations

1. **Credentials**: Never commit AWS credentials to version control
2. **Backups**: Store backups securely, they contain sensitive data
3. **Logging**: Script output may contain sensitive information
4. **Access Control**: Limit access to production deletion capabilities

## Testing

Before using in production:

1. Test with local environment first
2. Test with staging environment with known data
3. Verify backup and restore procedures work
4. Practice the full procedure in non-production environment

Remember: **When in doubt, create a backup!**
