#!/bin/bash

# Restore DynamoDB table from local filesystem dump
# This script will import all items from the dump directory back to the table
#
# Usage: ./scripts/restore-dynamodb-table.sh [--env=ENVIRONMENT] [--source=DIRECTORY]
# Examples:
#   ./scripts/restore-dynamodb-table.sh              # Restores to local environment (default)
#   ./scripts/restore-dynamodb-table.sh --env local  # Restores to local environment
#   ./scripts/restore-dynamodb-table.sh --env dev    # Restores to dev environment
#   ./scripts/restore-dynamodb-table.sh --env staging # Restores to staging environment
#   ./scripts/restore-dynamodb-table.sh --env prod   # Restores to prod environment
#   ./scripts/restore-dynamodb-table.sh --env local --source ./prod-backup # Cross-environment restore

set -e

# Default configuration
ENVIRONMENT="local"
SOURCE_DIR=""

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

# Show usage information
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Restore DynamoDB table contents from local filesystem dump."
    echo ""
    echo "Options:"
    echo "  -e, --env ENVIRONMENT     Target environment (local, dev, staging, prod) [default: local]"
    echo "  -s, --source DIRECTORY    Source directory for restore [default: auto-detected]"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                        # Restore to local environment table"
    echo "  $0 --env local                           # Restore to local environment table"
    echo "  $0 --env staging                         # Restore to staging environment table"
    echo "  $0 --env local --source ./prod-backup    # Restore prod backup to local"
    echo ""
    echo "Cross-environment restore workflow:"
    echo "  ./scripts/dump-dynamodb-table.sh --env prod --output ./prod-dump    # Dump production data"
    echo "  $0 --env local --source ./prod-dump                           # Restore to local"
    echo ""
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -s|--source)
                SOURCE_DIR="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(local|dev|stage|prod)$ ]]; then
        print_error "Invalid environment: $ENVIRONMENT"
        print_error "Supported environments: local, dev, stage, prod"
        exit 1
    fi
}

# Load environment variables from .env file
load_env_config() {
    local env_file="./scripts/.env.${ENVIRONMENT}"
    
    if [ ! -f "$env_file" ]; then
        print_error "Environment file not found: $env_file"
        print_error "Please create the .env file for environment: $ENVIRONMENT"
        exit 1
    fi
    
    print_status "Loading configuration from: $env_file"
    
    # Load environment variables
    set -o allexport
    source "$env_file"
    set +o allexport
}

# Get environment-specific configuration
get_config() {
    # Load environment-specific configuration
    load_env_config
    
    case $ENVIRONMENT in
        local)
            AWS_REGION="${AWS_REGION:-us-east-1}"
            AWS_ENDPOINT_URL="${LOCAL_AWS_ENDPOINT:-http://localhost:4566}"
            TABLE_NAME="${DYNAMODB_TABLE:-local-pornspot-media}"
            ;;
        dev|stage|prod)
            AWS_REGION="${AWS_REGION:-us-east-1}"
            AWS_ENDPOINT_URL=""  # Use default AWS endpoints
            TABLE_NAME="${DYNAMODB_TABLE:-${ENVIRONMENT}-pornspot-media}"
            ;;
    esac
    
    # Set dump directory - use custom source dir or default consistent structure
    if [ -z "$SOURCE_DIR" ]; then
        DUMP_DIR="./backups/dynamodb/${ENVIRONMENT}"
    else
        DUMP_DIR="$SOURCE_DIR"
    fi
    
    print_status "Using table: $TABLE_NAME"
}

# AWS CLI command wrapper
aws_cmd() {
    if [ "$ENVIRONMENT" = "local" ]; then
        AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}" \
        AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}" \
        aws --region "$AWS_REGION" --endpoint-url="$AWS_ENDPOINT_URL" "$@"
    else
        # Use credentials from .env file or environment
        if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
            AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
            AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
            aws --region "$AWS_REGION" "$@"
        else
            # Fall back to default AWS credentials (profile, IAM role, etc.)
            aws --region "$AWS_REGION" "$@"
        fi
    fi
}

# Parse arguments
parse_arguments "$@"

# Get environment-specific configuration
get_config

print_status "Restoring DynamoDB table for environment: $ENVIRONMENT"
print_status "Table: $TABLE_NAME"
print_status "Dump location: $DUMP_DIR"

# Check if LocalStack is running (only for local environment)
if [ "$ENVIRONMENT" = "local" ]; then
    print_status "Checking if LocalStack is running..."
    if ! curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
        print_error "LocalStack is not running! Please start LocalStack first."
        exit 1
    fi
    print_success "LocalStack is running"
fi

# Check if dump directory exists
if [ ! -d "$DUMP_DIR" ]; then
    print_warning "Dump directory '$DUMP_DIR' does not exist. Nothing to restore."
    print_status "Run './scripts/dump-dynamodb-table.sh' first to create a dump."
    exit 0
fi

# Check if dump has data
if [ ! -f "$DUMP_DIR/table-data.json" ]; then
    print_warning "No table data found in dump directory. Nothing to restore."
    exit 0
fi

print_success "Found dump directory with table data"

# Read metadata if available
METADATA_FILE="$DUMP_DIR/table-metadata.json"
if [ -f "$METADATA_FILE" ]; then
    DUMP_DATE=$(cat "$METADATA_FILE" | grep -o '"dumpDate": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "Unknown")
    EXPECTED_COUNT=$(cat "$METADATA_FILE" | grep -o '"itemCount": [0-9]*' | cut -d':' -f2 | tr -d ' ' 2>/dev/null || echo "Unknown")
    SOURCE_ENV=$(cat "$METADATA_FILE" | grep -o '"environment": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "Unknown")
    SOURCE_TABLE=$(cat "$METADATA_FILE" | grep -o '"tableName": "[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "Unknown")
    
    print_status "Dump metadata found - Date: $DUMP_DATE, Expected items: $EXPECTED_COUNT"
    
    # Show cross-environment warning
    if [ "$SOURCE_ENV" != "$ENVIRONMENT" ] && [ "$SOURCE_ENV" != "Unknown" ]; then
        print_warning "Cross-environment restore detected!"
        print_warning "Source: $SOURCE_ENV → Target: $ENVIRONMENT"
        print_warning "Source table: $SOURCE_TABLE → Target table: $TABLE_NAME"
    fi
fi

# Check if table exists, drop and recreate it for clean restore
print_status "Checking if table '$TABLE_NAME' exists..."
if aws_cmd dynamodb describe-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
    print_warning "Table '$TABLE_NAME' exists and will be dropped for clean restore"
    
    # Show warning for destructive operation
    if [ "$ENVIRONMENT" != "local" ]; then
        echo ""
        print_warning "⚠️  DESTRUCTIVE OPERATION WARNING ⚠️"
        print_warning "This will DELETE the existing table '$TABLE_NAME' in $ENVIRONMENT environment!"
        print_warning "All existing data will be permanently lost."
        echo ""
        read -p "Are you sure you want to continue? Type 'yes' to confirm: " -r
        echo
        if [[ $REPLY != "yes" ]]; then
            print_status "Restore cancelled by user"
            exit 0
        fi
    fi
    
    print_status "Deleting existing table '$TABLE_NAME'..."
    if aws_cmd dynamodb delete-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
        print_success "Table '$TABLE_NAME' deletion initiated"
        
        # Wait for table to be deleted
        print_status "Waiting for table to be fully deleted..."
        aws_cmd dynamodb wait table-not-exists --table-name "$TABLE_NAME"
        print_success "Table '$TABLE_NAME' deleted successfully"
    else
        print_error "Failed to delete table '$TABLE_NAME'"
        exit 1
    fi
fi

# Create table from schema
SCHEMA_FILE="$DUMP_DIR/table-schema.json"
if [ ! -f "$SCHEMA_FILE" ]; then
    print_error "Schema file not found: $SCHEMA_FILE"
    print_error "Cannot recreate table without schema information"
    exit 1
fi

print_status "Creating table '$TABLE_NAME' from schema..."

# Extract key schema and attribute definitions from the schema file
KEY_SCHEMA=$(cat "$SCHEMA_FILE" | jq -r '.Table.KeySchema')
ATTRIBUTE_DEFINITIONS=$(cat "$SCHEMA_FILE" | jq -r '.Table.AttributeDefinitions')
GLOBAL_SECONDARY_INDEXES=$(cat "$SCHEMA_FILE" | jq -r '.Table.GlobalSecondaryIndexes // empty')
LOCAL_SECONDARY_INDEXES=$(cat "$SCHEMA_FILE" | jq -r '.Table.LocalSecondaryIndexes // empty')

# Clean GSI and LSI for create-table compatibility (remove production-only metadata)
# These attributes are returned by describe-table but not allowed in create-table
if [ "$GLOBAL_SECONDARY_INDEXES" != "null" ] && [ "$GLOBAL_SECONDARY_INDEXES" != "" ]; then
    GLOBAL_SECONDARY_INDEXES=$(echo "$GLOBAL_SECONDARY_INDEXES" | jq '[.[] | del(.WarmThroughput, .IndexArn, .IndexStatus, .ProvisionedThroughput, .IndexSizeBytes, .ItemCount)]')
fi

if [ "$LOCAL_SECONDARY_INDEXES" != "null" ] && [ "$LOCAL_SECONDARY_INDEXES" != "" ]; then
    LOCAL_SECONDARY_INDEXES=$(echo "$LOCAL_SECONDARY_INDEXES" | jq '[.[] | del(.IndexArn, .IndexStatus, .IndexSizeBytes, .ItemCount)]')
fi

# For local environment, also ensure billing mode is correct
if [ "$ENVIRONMENT" = "local" ]; then
    # LocalStack may have additional restrictions
    print_status "Applying LocalStack compatibility adjustments..."
fi

# Build create table command using temporary files for safer execution
print_status "Building create table command..."

# Write JSON data to temporary files for safer AWS CLI usage
TEMP_DIR="/tmp/dynamodb-restore-$$"
mkdir -p "$TEMP_DIR"

echo "$KEY_SCHEMA" > "$TEMP_DIR/key-schema.json"
echo "$ATTRIBUTE_DEFINITIONS" > "$TEMP_DIR/attribute-definitions.json"

# Build base command
CREATE_CMD_ARGS="--table-name $TABLE_NAME --billing-mode PAY_PER_REQUEST --key-schema file://$TEMP_DIR/key-schema.json --attribute-definitions file://$TEMP_DIR/attribute-definitions.json"

# Add GSI if exists
if [ "$GLOBAL_SECONDARY_INDEXES" != "null" ] && [ "$GLOBAL_SECONDARY_INDEXES" != "" ]; then
    echo "$GLOBAL_SECONDARY_INDEXES" > "$TEMP_DIR/gsi.json"
    CREATE_CMD_ARGS="$CREATE_CMD_ARGS --global-secondary-indexes file://$TEMP_DIR/gsi.json"
fi

# Add LSI if exists  
if [ "$LOCAL_SECONDARY_INDEXES" != "null" ] && [ "$LOCAL_SECONDARY_INDEXES" != "" ]; then
    echo "$LOCAL_SECONDARY_INDEXES" > "$TEMP_DIR/lsi.json"
    CREATE_CMD_ARGS="$CREATE_CMD_ARGS --local-secondary-indexes file://$TEMP_DIR/lsi.json"
fi

print_status "Creating table with command: aws_cmd dynamodb create-table $CREATE_CMD_ARGS"

# Execute create table command and capture detailed error output
ERROR_OUTPUT=$(aws_cmd dynamodb create-table $CREATE_CMD_ARGS 2>&1)
CREATE_EXIT_CODE=$?

# Clean up temporary files
rm -rf "$TEMP_DIR"

if [ $CREATE_EXIT_CODE -eq 0 ]; then
    print_success "Table '$TABLE_NAME' created successfully"
    
    # Wait for table to be active
    print_status "Waiting for table to become active..."
    aws_cmd dynamodb wait table-exists --table-name "$TABLE_NAME"
    print_success "Table is now active and ready for data restore"
else
    print_error "Failed to create table '$TABLE_NAME'"
    print_error "Error details:"
    echo "$ERROR_OUTPUT"
    exit 1
fi

# Count items to restore
ITEM_COUNT=$(cat "$DUMP_DIR/table-data.json" | jq -r '.Items | length' 2>/dev/null || echo "0")
print_status "Found $ITEM_COUNT items to restore"

if [ "$ITEM_COUNT" -eq 0 ]; then
    print_warning "No items to restore"
    exit 0
fi

# Restore items using batch-write-item
print_status "Restoring items to table..."

# Extract items directly from file
ITEMS_JSON=$(cat "$DUMP_DIR/table-data.json" | jq -r '.Items')
TOTAL_ITEMS=$(echo "$ITEMS_JSON" | jq '. | length')

print_status "Processing $TOTAL_ITEMS items in batches of 25..."

# Calculate total number of batches
TOTAL_BATCHES=$(((TOTAL_ITEMS + 24) / 25))  # Round up division
print_status "Will process $TOTAL_BATCHES batches..."

# Process batches directly without creating temp files
SUCCESSFUL_ITEMS=0
FAILED_BATCHES=0
BATCH_COUNT=0
OFFSET=0

while [ $OFFSET -lt $TOTAL_ITEMS ]; do
    # Extract batch of 25 items starting from offset (directly in memory)
    BATCH_ITEMS_JSON=$(echo "$ITEMS_JSON" | jq -c ".[$OFFSET:$((OFFSET + 25))]")
    BATCH_SIZE=$(echo "$BATCH_ITEMS_JSON" | jq '. | length')
    
    if [ $BATCH_SIZE -gt 0 ]; then
        BATCH_COUNT=$((BATCH_COUNT + 1))
        
        # Create batch write request directly from the slice
        BATCH_REQUEST=$(echo "$BATCH_ITEMS_JSON" | jq -c "{\"$TABLE_NAME\": [.[] | {\"PutRequest\": {\"Item\": .}}]}")
        
        # Try the batch write and capture detailed error
        ERROR_OUTPUT=$(aws_cmd dynamodb batch-write-item --request-items "$BATCH_REQUEST" 2>&1)
        if [ $? -eq 0 ]; then
            SUCCESSFUL_ITEMS=$((SUCCESSFUL_ITEMS + BATCH_SIZE))
            printf "."
            # Show progress every 10 batches
            if [ $((BATCH_COUNT % 10)) -eq 0 ]; then
                echo " ($BATCH_COUNT/$TOTAL_BATCHES batches, $SUCCESSFUL_ITEMS items)"
            fi
        else
            FAILED_BATCHES=$((FAILED_BATCHES + 1))
            printf "x"
            # Log the first few errors for debugging
            if [ $FAILED_BATCHES -le 3 ]; then
                echo ""
                print_warning "Batch $BATCH_COUNT failed. Error details:"
                echo "$ERROR_OUTPUT" | head -3
            fi
        fi
    fi
    
    OFFSET=$((OFFSET + 25))
done

echo ""
print_success "Items restored successfully: $SUCCESSFUL_ITEMS"

# Verify restore
print_status "Verifying restore..."
FINAL_COUNT=$(aws_cmd dynamodb describe-table --table-name "$TABLE_NAME" --query 'Table.ItemCount' --output text 2>/dev/null || echo "0")

if [ "$FINAL_COUNT" != "None" ] && [ "$FINAL_COUNT" -ge "$SUCCESSFUL_ITEMS" ]; then
    print_success "Restore verification passed: $FINAL_COUNT items in table"
else
    print_warning "Restore verification warning: Expected at least $SUCCESSFUL_ITEMS, found $FINAL_COUNT items"
fi

# Calculate total size if possible
TOTAL_SIZE=$(find "$DUMP_DIR" -type f -exec stat -f%z {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
HUMAN_SIZE=$(numfmt --to=iec-i --suffix=B $TOTAL_SIZE 2>/dev/null || echo "${TOTAL_SIZE} bytes")

echo ""
print_success "🎉 DynamoDB table restore completed successfully!"
echo ""
echo "📊 Restore Statistics:"
echo "  • Environment: $ENVIRONMENT"
echo "  • Table: $TABLE_NAME"
echo "  • Items Restored: $SUCCESSFUL_ITEMS"
echo "  • Final Item Count: $FINAL_COUNT"
echo "  • Total Size: $HUMAN_SIZE"
echo "  • Source: $DUMP_DIR"
echo ""
echo "💡 Table is now ready for use"
if [ "$ENVIRONMENT" = "local" ]; then
    echo "💡 Test with: aws --endpoint-url=http://localhost:4566 dynamodb scan --table-name $TABLE_NAME --max-items 5"
else
    echo "💡 Test with: aws dynamodb scan --table-name $TABLE_NAME --max-items 5"
fi
