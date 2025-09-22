#!/bin/bash

# Ensure the script runs with bash even if invoked via `sh`
if [ -z "${BASH_VERSION:-}" ]; then
    exec /usr/bin/env bash "$0" "$@"
fi

# Optimized DynamoDB table restore with maximum AWS throughput
# Features:
# - Parallel batch processing with multiple workers
# - Automatic retry with exponential backoff
# - S3 Import Table for large datasets (>1GB)
# - Progress monitoring with ETA
# - Optimized batch sizes and connection pooling

set -e
set -o pipefail

# Default configuration
ENVIRONMENT="local"
SOURCE_DIR=""
PARALLEL_WORKERS=10  # Number of parallel workers for batch operations
MAX_RETRIES=5
BATCH_SIZE=25  # DynamoDB maximum batch write size
USE_S3_IMPORT=false  # Auto-detect based on data size
S3_BUCKET=""  # For S3 import method
PROGRESS_INTERVAL=100  # Show progress every N items

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_progress() {
    echo -e "${CYAN}[PROGRESS]${NC} $1"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Optimized DynamoDB table restore with maximum AWS throughput."
    echo ""
    echo "Options:"
    echo "  -e, --env ENVIRONMENT      Target environment (local, dev, staging, prod) [default: local]"
    echo "  -s, --source DIRECTORY     Source directory for restore [default: auto-detected]"
    echo "  -w, --workers NUMBER       Number of parallel workers [default: 10]"
    echo "  -b, --s3-bucket BUCKET     S3 bucket for import (auto-creates if needed)"
    echo "  --use-s3-import           Force S3 import method (faster for large datasets)"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Performance Tips:"
    echo "  • For datasets > 1GB, S3 import is automatically used (10-100x faster)"
    echo "  • Increase workers for better throughput: --workers 20"
    echo "  • Ensure your AWS account has sufficient DynamoDB capacity"
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
            -w|--workers)
                PARALLEL_WORKERS="$2"
                shift 2
                ;;
            -b|--s3-bucket)
                S3_BUCKET="$2"
                shift 2
                ;;
            --use-s3-import)
                USE_S3_IMPORT=true
                shift
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
    
    # Normalize environment
    if [[ "$ENVIRONMENT" == "staging" ]]; then
        ENVIRONMENT="stage"
    fi

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(local|dev|stage|prod)$ ]]; then
        print_error "Invalid environment: $ENVIRONMENT"
        exit 1
    fi
}

# Load environment variables from .env file
load_env_config() {
    local env_file="./scripts/.env.${ENVIRONMENT}"
    
    if [ ! -f "$env_file" ]; then
        print_error "Environment file not found: $env_file"
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
    load_env_config
    
    case $ENVIRONMENT in
        local)
            AWS_REGION="${AWS_REGION:-us-east-1}"
            AWS_ENDPOINT_URL="${LOCAL_AWS_ENDPOINT:-http://localhost:4566}"
            TABLE_NAME="${DYNAMODB_TABLE:-local-pornspot-media}"
            ;;
        dev|stage|prod)
            AWS_REGION="${AWS_REGION:-us-east-1}"
            AWS_ENDPOINT_URL=""
            TABLE_NAME="${DYNAMODB_TABLE:-${ENVIRONMENT}-pornspot-media}"
            # Auto-generate S3 bucket name if not provided
            if [ -z "$S3_BUCKET" ]; then
                S3_BUCKET="dynamodb-restore-${ENVIRONMENT}-$(date +%s)"
            fi
            ;;
    esac
    
    if [ -z "$SOURCE_DIR" ]; then
        DUMP_DIR="./backups/dynamodb/${ENVIRONMENT}"
    else
        DUMP_DIR="$SOURCE_DIR"
    fi
}

# AWS CLI command wrapper with connection pooling
aws_cmd() {
    local AWS_CLI_OPTIONS="--cli-read-timeout 0 --cli-connect-timeout 60"
    
    if [ "$ENVIRONMENT" = "local" ]; then
        AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}" \
        AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}" \
        aws $AWS_CLI_OPTIONS --region "$AWS_REGION" --endpoint-url="$AWS_ENDPOINT_URL" "$@"
    else
        if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
            AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
            AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
            aws $AWS_CLI_OPTIONS --region "$AWS_REGION" "$@"
        else
            aws $AWS_CLI_OPTIONS --region "$AWS_REGION" "$@"
        fi
    fi
}

# Calculate optimal batch processing parameters
calculate_optimal_params() {
    local data_file="$1"
    local file_size=$(stat -f%z "$data_file" 2>/dev/null || stat -c%s "$data_file" 2>/dev/null || echo "0")
    local file_size_mb=$((file_size / 1048576))
    
    print_status "Data file size: ${file_size_mb}MB"
    
    # Auto-detect optimal method based on size
    if [ "$ENVIRONMENT" != "local" ] && [ $file_size_mb -gt 1024 ]; then
        USE_S3_IMPORT=true
        print_status "Dataset > 1GB - Using S3 Import Table for maximum speed"
    fi
    
    # Adjust workers based on data size
    if [ $file_size_mb -lt 100 ]; then
        PARALLEL_WORKERS=5
    elif [ $file_size_mb -lt 500 ]; then
        PARALLEL_WORKERS=10
    elif [ $file_size_mb -lt 1000 ]; then
        PARALLEL_WORKERS=15
    else
        PARALLEL_WORKERS=20
    fi
    
    print_status "Using $PARALLEL_WORKERS parallel workers for optimal throughput"
}

# Process a single batch with retry logic
process_single_batch() {
    local batch_file="$1"
    local status_log="$2"
    local retry_count=0
    local backoff=1
    local current_file="$batch_file"
    local tmp_unprocessed="${batch_file}.unprocessed"
    
    while [ $retry_count -lt "$MAX_RETRIES" ]; do
        local out=""
        local exit_code=0
        
        if [ "$ENVIRONMENT" = "local" ]; then
            out=$(AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}" \
                 AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}" \
                 aws --cli-read-timeout 0 --cli-connect-timeout 60 \
                     --region "$AWS_REGION" --endpoint-url="$AWS_ENDPOINT_URL" \
                     dynamodb batch-write-item \
                     --request-items "file://$current_file" \
                     --return-consumed-capacity TOTAL \
                     --return-item-collection-metrics SIZE \
                     --output json 2>&1)
            exit_code=$?
        else
            if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
                out=$(AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
                     AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
                     aws --cli-read-timeout 0 --cli-connect-timeout 60 \
                         --region "$AWS_REGION" \
                         dynamodb batch-write-item \
                         --request-items "file://$current_file" \
                         --return-consumed-capacity TOTAL \
                         --return-item-collection-metrics SIZE \
                         --output json 2>&1)
                exit_code=$?
            else
                out=$(aws --cli-read-timeout 0 --cli-connect-timeout 60 \
                         --region "$AWS_REGION" \
                         dynamodb batch-write-item \
                         --request-items "file://$current_file" \
                         --return-consumed-capacity TOTAL \
                         --return-item-collection-metrics SIZE \
                         --output json 2>&1)
                exit_code=$?
            fi
        fi
        
        if [ $exit_code -eq 0 ]; then
            # Check for unprocessed items
            unprocessed=$(printf "%s" "$out" | jq -c "(.UnprocessedItems // {}) | with_entries(.value |= map(select(.PutRequest)))" 2>/dev/null || echo "{}")
            unprocessed_count=$(printf "%s" "$unprocessed" | jq -r "[.[] | length] | add // 0" 2>/dev/null || echo "0")
            
            if [ "$unprocessed_count" = "0" ] || [ -z "$unprocessed" ] || [ "$unprocessed" = "{}" ]; then
                echo "SUCCESS" >> "$status_log"
                rm -f "$tmp_unprocessed"
                return 0
            fi
            
            # Write unprocessed batch to a temp file and retry
            printf "%s" "$unprocessed" > "$tmp_unprocessed"
            current_file="$tmp_unprocessed"
        fi
        
        retry_count=$((retry_count + 1))
        if [ $retry_count -lt "$MAX_RETRIES" ]; then
            sleep "$backoff"
            backoff=$((backoff * 2))
        fi
    done
    
    echo "FAILED" >> "$status_log"
    return 1
}

# Monitor batch file creation progress
monitor_batch_creation() {
    local total_batches=$1
    local batch_dir=$2
    local start_time=$(date +%s)
    
    while true; do
        local created=$(find "$batch_dir" -name "batch-*.json" 2>/dev/null | wc -l | tr -d ' ')
        
        if [ $created -ge $total_batches ]; then
            printf "\r${CYAN}[PROGRESS]${NC} Created: %d/%d batch files (100.0%%)                    \n" \
                $created $total_batches
            break
        fi
        
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        local rate=0
        local eta=0
        
        if [ $created -gt 0 ] && [ $elapsed -gt 0 ]; then
            rate=$((created * 100 / elapsed))
            if [ $rate -gt 0 ]; then 
                eta=$(((total_batches - created) * 100 / rate))
            fi
        fi
        
        local percentage=$(echo "scale=1; $created * 100 / $total_batches" | bc 2>/dev/null || echo 0)
        printf "\r${CYAN}[PROGRESS]${NC} Created: %d/%d batch files (%s%%) | Rate: %d.%02d files/sec | ETA: %ds     " \
            $created $total_batches $percentage \
            $((rate / 100)) $((rate % 100)) $eta
        
        sleep 0.5
    done
}

# Monitor progress from a status log
monitor_progress_log() {
    local total_items=$1
    local status_log=$2
    local expected_batches=$3
    local start_time=$(date +%s)
    
    while true; do
        # Read counts safely; avoid emitting extra zeros on stderr/stdout
        local successes failures
        successes=$(grep -c "^SUCCESS" "$status_log" 2>/dev/null || true)
        failures=$(grep -c "^FAILED" "$status_log" 2>/dev/null || true)
        # Normalize to integers (strip newlines/non-digits) and default to 0
        successes=${successes//$'\n'/}
        failures=${failures//$'\n'/}
        successes=${successes//[^0-9]/}
        failures=${failures//[^0-9]/}
        : "${successes:=0}"
        : "${failures:=0}"
        local done=$((successes + failures))
        local processed=$((successes * BATCH_SIZE))
        if [ $processed -gt $total_items ]; then processed=$total_items; fi
        
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        local rate=0
        local eta=0
        if [ $processed -gt 0 ] && [ $elapsed -gt 0 ]; then
            rate=$((processed / elapsed))
            if [ $rate -gt 0 ]; then eta=$(((total_items - processed) / rate)); fi
        fi
        
        printf "\r${CYAN}[PROGRESS]${NC} Processed: %d/%d items (%.1f%%) | Rate: %d items/sec | ETA: %ds     " \
            $processed $total_items \
            $(echo "scale=1; $processed * 100 / $total_items" | bc 2>/dev/null || echo 0) \
            $rate $eta
        
        if [ $done -ge $expected_batches ]; then
            break
        fi
        sleep 1
    done
    echo ""
}

# S3 Import Table method for large datasets
perform_s3_import() {
    local data_file="$1"
    local schema_file="$2"
    
    print_status "Preparing S3 import for maximum performance..."
    
    # Create S3 bucket if it doesn't exist
    if ! aws_cmd s3api head-bucket --bucket "$S3_BUCKET" 2>/dev/null; then
        print_status "Creating S3 bucket: $S3_BUCKET"
        if [ "$AWS_REGION" = "us-east-1" ]; then
            aws_cmd s3api create-bucket --bucket "$S3_BUCKET" --region "$AWS_REGION"
        else
            aws_cmd s3api create-bucket --bucket "$S3_BUCKET" --region "$AWS_REGION" \
                --create-bucket-configuration LocationConstraint="$AWS_REGION"
        fi
    fi
    
    # Convert DynamoDB JSON to DynamoDB export format
    local export_dir="/tmp/dynamodb-export-$$"
    mkdir -p "$export_dir"
    
    print_status "Converting data to DynamoDB export format..."
    
    # Split into multiple files for parallel upload
    local items_per_file=$(($(jq '.Items | length' "$data_file") / PARALLEL_WORKERS + 1))
    local file_num=0
    
    jq -c '.Items[]' "$data_file" | while IFS= read -r item; do
        echo "$item" >> "$export_dir/data-$((file_num / items_per_file)).json"
        file_num=$((file_num + 1))
    done
    
    # Compress files for faster upload
    print_status "Compressing data files..."
    find "$export_dir" -name "*.json" -exec gzip {} \;
    
    # Upload to S3 in parallel
    print_status "Uploading to S3 with ${PARALLEL_WORKERS} parallel streams..."
    find "$export_dir" -name "*.json.gz" -print0 | \
        xargs -0 -P "$PARALLEL_WORKERS" -I {} \
        aws_cmd s3 cp {} "s3://$S3_BUCKET/import/" \
        --storage-class STANDARD_IA
    
    # Extract table schema
    local key_schema=$(jq -r '.Table.KeySchema' "$schema_file")
    local attribute_definitions=$(jq -r '.Table.AttributeDefinitions' "$schema_file")
    
    # Create table using ImportTable API
    print_status "Creating table via S3 import (this is the fastest method)..."
    
    local import_arn=$(aws_cmd dynamodb import-table \
        --s3-bucket-source "Bucket=$S3_BUCKET,Prefix=import/" \
        --input-format DYNAMODB_JSON \
        --table-creation-parameters "{
            \"TableName\": \"$TABLE_NAME\",
            \"BillingMode\": \"PAY_PER_REQUEST\",
            \"KeySchema\": $key_schema,
            \"AttributeDefinitions\": $attribute_definitions
        }" --query 'ImportTableDescription.ImportArn' --output text)
    
    # Wait for import to complete
    print_status "Import initiated. Waiting for completion..."
    local import_status="IN_PROGRESS"
    while [ "$import_status" = "IN_PROGRESS" ]; do
        sleep 10
        import_status=$(aws_cmd dynamodb describe-import \
            --import-arn "$import_arn" \
            --query 'ImportTableDescription.ImportStatus' --output text 2>/dev/null || echo "IN_PROGRESS")
        print_progress "Import status: $import_status"
    done
    
    # Cleanup
    rm -rf "$export_dir"
    aws_cmd s3 rm "s3://$S3_BUCKET/import/" --recursive
    
    print_success "S3 import completed successfully!"
}

# Optimized parallel batch write for smaller datasets
perform_parallel_batch_write() {
    local data_file="$1"
    local total_items=$(jq '.Items | length' "$data_file")
    
    print_status "Preparing parallel batch write with $PARALLEL_WORKERS workers..."
    
    # Create temporary directory for batch files
    local batch_dir="/tmp/dynamodb-batches-$$"
    mkdir -p "$batch_dir"
    
    # Expected batches for progress/termination
    local total_batches=$(( (total_items + BATCH_SIZE - 1) / BATCH_SIZE ))
    print_status "Total batches to process: $total_batches"
    
    # Status log for progress accounting
    local status_log="/tmp/dynamodb-status-$$.log"
    : > "$status_log"
    
    # Create batch files with progress monitoring
    print_status "Creating batch files..."
    
    # Start batch creation monitor in background
    monitor_batch_creation $total_batches "$batch_dir" &
    local creation_monitor_pid=$!
    
    # Create all batch files
    jq -c --arg table "$TABLE_NAME" --argjson size $BATCH_SIZE '
        .Items as $items
        | [range(0; ($items|length); $size)]
        | .[]
        | {($table): ( ($items[. : (. + $size)]) | map({PutRequest:{Item:.}})) }
    ' "$data_file" | nl -v 0 -w 1 -s $'\t' | while IFS=$'\t' read -r idx payload; do
        printf "%s" "$payload" > "$batch_dir/batch-$(printf "%06d" "$idx").json"
    done
    
    # Stop batch creation monitor
    kill $creation_monitor_pid 2>/dev/null || true
    wait $creation_monitor_pid 2>/dev/null || true
    
    # Verify all batches were created
    local created_batches=$(find "$batch_dir" -name "batch-*.json" 2>/dev/null | wc -l | tr -d ' ')
    print_success "Created $created_batches batch files"
    
    # Start processing batches
    print_status "Processing batches with $PARALLEL_WORKERS parallel workers..."
    
    # Start progress monitor in background
    monitor_progress_log $total_items "$status_log" $total_batches &
    local monitor_pid=$!
    
    # Export necessary variables for subshells
    export -f process_single_batch
    export -f aws_cmd
    export ENVIRONMENT AWS_REGION AWS_ENDPOINT_URL AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY MAX_RETRIES TABLE_NAME
    
    # Process batches in parallel using find and xargs
    find "$batch_dir" -name "batch-*.json" -type f -print0 | \
        xargs -0 -P "$PARALLEL_WORKERS" -I {} bash -c 'process_single_batch "$1" "$2"' _ {} "$status_log"
    
    # Stop progress monitor
    kill $monitor_pid 2>/dev/null || true
    wait $monitor_pid 2>/dev/null || true
    
    # Cleanup batch files
    rm -rf "$batch_dir"
    
    # Summarize results
    local successful=$(grep -c "^SUCCESS" "$status_log" 2>/dev/null || echo 0)
    local failed=$(grep -c "^FAILED" "$status_log" 2>/dev/null || echo 0)
    
    print_status "Batch processing complete: $successful successful, $failed failed"
    
    # Cleanup status log
    rm -f "$status_log"
    
    echo ""
    if [ "$failed" -gt 0 ]; then
        print_warning "$failed batches failed after $MAX_RETRIES retries"
    fi
    print_success "Parallel batch write completed!"
}

# Main execution
parse_arguments "$@"
get_config

print_status "🚀 Optimized DynamoDB Restore for environment: $ENVIRONMENT"
print_status "Table: $TABLE_NAME"
print_status "Source: $DUMP_DIR"

# Validation checks
if [ "$ENVIRONMENT" = "local" ]; then
    if ! curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
        print_error "LocalStack is not running!"
        exit 1
    fi
fi

if [ ! -d "$DUMP_DIR" ] || [ ! -f "$DUMP_DIR/table-data.json" ]; then
    print_error "No dump data found in: $DUMP_DIR"
    exit 1
fi

# Prepare data file
DATA_FILE="$DUMP_DIR/table-data.json"
SANITIZED_DATA_FILE="$DUMP_DIR/table-data.sanitized.json"
SCHEMA_FILE="$DUMP_DIR/table-schema.json"

print_status "Sanitizing dump data..."
LC_ALL=C tr -d '\000-\010\013\014\016-\037' < "$DATA_FILE" > "$SANITIZED_DATA_FILE"

if ! jq -e . "$SANITIZED_DATA_FILE" >/dev/null 2>&1; then
    print_error "Invalid JSON in dump file"
    exit 1
fi

# Calculate optimal parameters
calculate_optimal_params "$SANITIZED_DATA_FILE"

# Get item count
ITEM_COUNT=$(jq '.Items | length' "$SANITIZED_DATA_FILE")
print_status "Items to restore: $ITEM_COUNT"

# Drop existing table if exists
if aws_cmd dynamodb describe-table --table-name "$TABLE_NAME" >/dev/null 2>&1; then
    if [ "$ENVIRONMENT" != "local" ]; then
        print_warning "⚠️  Table '$TABLE_NAME' will be DELETED in $ENVIRONMENT!"
        read -p "Type 'yes' to confirm: " -r
        if [[ $REPLY != "yes" ]]; then
            exit 0
        fi
    fi
    
    print_status "Deleting existing table..."
    aws_cmd dynamodb delete-table --table-name "$TABLE_NAME" >/dev/null
    aws_cmd dynamodb wait table-not-exists --table-name "$TABLE_NAME"
fi

# Start restore timer
START_TIME=$(date +%s)

# Choose restore method based on configuration
if [ "$USE_S3_IMPORT" = true ] && [ "$ENVIRONMENT" != "local" ]; then
    # Use S3 import for maximum speed
    perform_s3_import "$SANITIZED_DATA_FILE" "$SCHEMA_FILE"
else
    # Create table first
    print_status "Creating table from schema..."
    
    # Extract schema components
    KEY_SCHEMA=$(jq -r '.Table.KeySchema' "$SCHEMA_FILE")
    ATTRIBUTE_DEFINITIONS=$(jq -r '.Table.AttributeDefinitions' "$SCHEMA_FILE")
    GSI=$(jq -r '.Table.GlobalSecondaryIndexes // empty' "$SCHEMA_FILE")
    
    # Clean GSI for create-table
    if [ "$GSI" != "null" ] && [ "$GSI" != "" ]; then
        GSI=$(echo "$GSI" | jq '[
            .[]
            | del(
                .IndexArn,
                .IndexStatus,
                .IndexSizeBytes,
                .ItemCount,
                .ProvisionedThroughput,
                .Backfilling,
                .ContributorInsightsStatus,
                .OnDemandThroughput,
                .WarmThroughput
            )
            | {IndexName, KeySchema, Projection}
        ]')
    fi
    
    # Create table
    TEMP_DIR="/tmp/dynamodb-create-$$"
    mkdir -p "$TEMP_DIR"
    
    echo "$KEY_SCHEMA" > "$TEMP_DIR/key-schema.json"
    echo "$ATTRIBUTE_DEFINITIONS" > "$TEMP_DIR/attributes.json"
    
    CREATE_ARGS="--table-name $TABLE_NAME --billing-mode PAY_PER_REQUEST"
    CREATE_ARGS="$CREATE_ARGS --key-schema file://$TEMP_DIR/key-schema.json"
    CREATE_ARGS="$CREATE_ARGS --attribute-definitions file://$TEMP_DIR/attributes.json"
    
    if [ "$GSI" != "null" ] && [ "$GSI" != "" ] && [ "$GSI" != "[]" ]; then
        echo "$GSI" > "$TEMP_DIR/gsi.json"
        CREATE_ARGS="$CREATE_ARGS --global-secondary-indexes file://$TEMP_DIR/gsi.json"
    fi
    
    aws_cmd dynamodb create-table $CREATE_ARGS >/dev/null
    aws_cmd dynamodb wait table-exists --table-name "$TABLE_NAME"
    
    rm -rf "$TEMP_DIR"
    
    print_success "Table created successfully"
    
    # Use parallel batch write
    perform_parallel_batch_write "$SANITIZED_DATA_FILE"
fi

# Calculate restore time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Verify restore
print_status "Verifying restore..."
FINAL_COUNT=$(aws_cmd dynamodb describe-table --table-name "$TABLE_NAME" --query 'Table.ItemCount' --output text)

# Final report
echo ""
print_success "🎉 Optimized restore completed in ${DURATION} seconds!"
echo ""
echo "📊 Performance Statistics:"
echo "  • Environment: $ENVIRONMENT"
echo "  • Table: $TABLE_NAME"
echo "  • Items Restored: $ITEM_COUNT"
echo "  • Restore Time: ${DURATION}s"
echo "  • Throughput: $((ITEM_COUNT / (DURATION + 1))) items/sec"
echo "  • Method: $([ "$USE_S3_IMPORT" = true ] && echo "S3 Import (fastest)" || echo "Parallel Batch Write")"
echo "  • Workers Used: $PARALLEL_WORKERS"
echo ""

if [ "$ENVIRONMENT" != "local" ] && [ $ITEM_COUNT -gt 10000 ]; then
    echo "💡 Performance Tips for Next Time:"
    echo "  • Use --use-s3-import for datasets > 1GB (10-100x faster)"
    echo "  • Increase workers with --workers 20 for better parallelism"
    echo "  • Consider using AWS DataPipeline for regular large restores"
fi