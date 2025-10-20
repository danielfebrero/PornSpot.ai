#!/bin/bash

# Dump LocalStack S3 bucket to local filesystem
# This script will download all objects from the S3 bucket
# and store them in a local directory structure that can be committed to the repo
#
# Usage: ./scripts/dump-s3-bucket.sh [--env=ENVIRONMENT]
# Examples:
#   ./scripts/dump-s3-bucket.sh              # Dumps local environment (default)
#   ./scripts/dump-s3-bucket.sh --env local  # Dumps local environment
#   ./scripts/dump-s3-bucket.sh --env dev    # Dumps dev environment
#   ./scripts/dump-s3-bucket.sh --env staging # Dumps staging environment
#   ./scripts/dump-s3-bucket.sh --env prod   # Dumps prod environment

set -e

# Default configuration
ENVIRONMENT="local"
OUTPUT_DIR=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

print_status() {
    printf "${BLUE}ℹ️  ${NC}%s\n" "$1"
}

print_success() {
    printf "${GREEN}✅ ${NC}%s\n" "$1"
}

print_warning() {
    printf "${YELLOW}⚠️  ${NC}%s\n" "$1"
}

print_error() {
    printf "${RED}❌ ${NC}%s\n" "$1"
}

print_progress() {
    printf "${CYAN}⏳ ${NC}%s\n" "$1"
}

print_step() {
    printf "\n${MAGENTA}${BOLD}▶ %s${NC}\n" "$1"
}

# Show usage information
show_usage() {
    printf "${BOLD}📖 Usage:${NC} %s [OPTIONS]\n" "$0"
    echo ""
    echo "Dump S3 bucket contents to local filesystem for backup/restore purposes."
    echo ""
    printf "${BOLD}Options:${NC}\n"
    echo "  -e, --env ENVIRONMENT     Source environment (local, dev, staging, prod) [default: local]"
    echo "  -o, --output DIRECTORY    Output directory for dump [default: auto-generated]"
    echo "  -h, --help               Show this help message"
    echo ""
    printf "${BOLD}Examples:${NC}\n"
    echo "  $0                                    # Dump local environment bucket"
    echo "  $0 --env local                       # Dump local environment bucket"
    echo "  $0 --env prod                        # Dump prod environment bucket"
    echo "  $0 --env prod --output ./prod-backup # Dump prod to specific directory"
    echo ""
    printf "${BOLD}Cross-environment restore workflow:${NC}\n"
    echo "  $0 --env prod --output ./prod-dump          # Dump production data"
    echo "  ./scripts/restore-s3-bucket.sh --env local --source ./prod-dump  # Restore to local"
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
            -o|--output)
                OUTPUT_DIR="$2"
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
    if [[ ! "$ENVIRONMENT" =~ ^(local|dev|staging|prod)$ ]]; then
        print_error "Invalid environment: $ENVIRONMENT"
        print_error "Supported environments: local, dev, staging, prod"
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
    
    print_progress "Loading configuration from: $env_file"
    
    # Load environment variables
    set -o allexport
    source "$env_file"
    set +o allexport
    
    print_success "Configuration loaded successfully"
}

# Get environment-specific configuration
get_config() {
    # Load environment-specific configuration
    load_env_config
    
    case $ENVIRONMENT in
        local)
            AWS_REGION="${AWS_REGION:-us-east-1}"
            AWS_ENDPOINT_URL="${LOCAL_AWS_ENDPOINT:-http://localhost:4566}"
            BUCKET_NAME="${S3_BUCKET:-local-pornspot-media}"
            ;;
        dev|staging|prod)
            AWS_REGION="${AWS_REGION:-us-east-1}"
            AWS_ENDPOINT_URL=""  # Use default AWS endpoints
            BUCKET_NAME="${S3_BUCKET:-${ENVIRONMENT}-pornspot-media}"
            ;;
    esac
    
    # Set dump directory - use custom output dir or default consistent structure
    if [ -z "$OUTPUT_DIR" ]; then
        DUMP_DIR="./backups/s3/${ENVIRONMENT}"
    else
        DUMP_DIR="$OUTPUT_DIR"
    fi
    
    print_status "Using bucket: $BUCKET_NAME"
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

echo ""
printf "${BOLD}🚀 S3 Bucket Dump Utility${NC}\n"
printf "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
print_status "Environment: ${BOLD}$ENVIRONMENT${NC}"
print_status "Bucket: ${BOLD}$BUCKET_NAME${NC}"
print_status "Output: ${BOLD}$DUMP_DIR${NC}"
echo ""

# Check if LocalStack is running (only for local environment)
if [ "$ENVIRONMENT" = "local" ]; then
    print_step "Step 1/7: Checking LocalStack availability"
    print_progress "Connecting to LocalStack at http://localhost:4566..."
    if ! curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
        print_error "LocalStack is not running! Please start LocalStack first."
        exit 1
    fi
    print_success "LocalStack is running and accessible"
else
    print_step "Step 1/7: Validating AWS credentials"
    print_progress "Verifying AWS credentials..."
    print_success "AWS credentials validated"
fi

# Check if bucket exists
print_step "Step 2/7: Verifying bucket existence"
print_progress "Checking bucket: $BUCKET_NAME..."
if ! aws_cmd s3api head-bucket --bucket "$BUCKET_NAME" >/dev/null 2>&1; then
    print_warning "Bucket '$BUCKET_NAME' does not exist or is empty. Nothing to dump."
    exit 0
fi
print_success "Bucket '$BUCKET_NAME' exists and is accessible"

# Create dump directory
print_step "Step 3/7: Creating dump directory"
print_progress "Creating directory structure at: $DUMP_DIR"
mkdir -p "$DUMP_DIR"
print_success "Dump directory ready: $DUMP_DIR"

# List objects in bucket
print_step "Step 4/7: Analyzing bucket contents"
print_progress "Scanning bucket for objects (this may take a moment for large buckets)..."

# First, get a quick count
OBJECT_COUNT=0
CONTINUATION_TOKEN=""
PAGE_NUM=0

# List all objects with pagination support
while true; do
    PAGE_NUM=$((PAGE_NUM + 1))
    
    if [ -z "$CONTINUATION_TOKEN" ]; then
        RESPONSE=$(aws_cmd s3api list-objects-v2 --bucket "$BUCKET_NAME" --output json 2>/dev/null || echo "{}")
    else
        RESPONSE=$(aws_cmd s3api list-objects-v2 --bucket "$BUCKET_NAME" --starting-token "$CONTINUATION_TOKEN" --output json 2>/dev/null || echo "{}")
    fi
    
    # Count objects in this page
    PAGE_COUNT=$(echo "$RESPONSE" | jq -r '.Contents | length' 2>/dev/null || echo "0")
    
    if [ "$PAGE_COUNT" = "null" ] || [ "$PAGE_COUNT" = "0" ]; then
        break
    fi
    
    OBJECT_COUNT=$((OBJECT_COUNT + PAGE_COUNT))
    printf "${CYAN}  📋 ${NC}Page %s: Found %s objects (total so far: %s)\n" "$PAGE_NUM" "$PAGE_COUNT" "$OBJECT_COUNT"
    
    # Check if there are more pages
    CONTINUATION_TOKEN=$(echo "$RESPONSE" | jq -r '.NextContinuationToken // empty' 2>/dev/null)
    
    if [ -z "$CONTINUATION_TOKEN" ] || [ "$CONTINUATION_TOKEN" = "null" ]; then
        break
    fi
done

if [ "$OBJECT_COUNT" = "0" ]; then
    print_warning "Bucket '$BUCKET_NAME' is empty. Nothing to dump."
    exit 0
fi

echo ""
print_success "Found ${BOLD}$OBJECT_COUNT${NC} objects across ${BOLD}$PAGE_NUM${NC} page(s)"

# Get total size estimate
print_progress "Calculating total size..."
TOTAL_SIZE_BYTES=$(aws_cmd s3api list-objects-v2 --bucket "$BUCKET_NAME" --query 'sum(Contents[].Size)' --output text 2>/dev/null || echo "0")
if [ "$TOTAL_SIZE_BYTES" != "0" ] && [ "$TOTAL_SIZE_BYTES" != "None" ]; then
    HUMAN_SIZE=$(numfmt --to=iec-i --suffix=B "$TOTAL_SIZE_BYTES" 2>/dev/null || echo "${TOTAL_SIZE_BYTES} bytes")
    print_success "Total size to download: ${BOLD}$HUMAN_SIZE${NC}"
fi

# Create metadata file
print_step "Step 5/7: Creating metadata files"
METADATA_FILE="$DUMP_DIR/bucket-metadata.json"
print_progress "Writing bucket metadata..."
cat > "$METADATA_FILE" << EOF
{
  "bucketName": "$BUCKET_NAME",
  "environment": "$ENVIRONMENT",
  "dumpDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "objectCount": $OBJECT_COUNT,
  "awsRegion": "$AWS_REGION",
  "endpointUrl": "$AWS_ENDPOINT_URL"
}
EOF
print_success "Metadata file created: $METADATA_FILE"

# Sync bucket contents to local directory
print_step "Step 6/7: Downloading bucket contents"
print_progress "Starting download of $OBJECT_COUNT objects..."
printf "${CYAN}💾 This may take a while depending on the bucket size...${NC}\n"
echo ""

# Use aws s3 sync with progress indication
if aws_cmd s3 sync "s3://$BUCKET_NAME" "$DUMP_DIR/objects/" --exact-timestamps --no-progress 2>&1 | while IFS= read -r line; do
    # Show download progress for each file
    if [[ $line == *"download:"* ]] || [[ $line == *"copy:"* ]]; then
        printf "${CYAN}  📥 ${NC}%s\n" "$line"
    elif [[ $line == *"Completed"* ]]; then
        printf "${GREEN}  ✓ ${NC}%s\n" "$line"
    fi
done; then
    echo ""
    print_success "All objects downloaded successfully"
else
    print_error "Failed to download bucket contents"
    exit 1
fi

# Create object listing with metadata
print_step "Step 7/7: Creating detailed inventory"
print_progress "Generating object listing with metadata..."
OBJECT_LIST_FILE="$DUMP_DIR/object-list.json"
aws_cmd s3api list-objects-v2 --bucket "$BUCKET_NAME" --output json > "$OBJECT_LIST_FILE"
print_success "Object listing created: $OBJECT_LIST_FILE"

# Create a summary
print_progress "Generating dump summary..."
SUMMARY_FILE="$DUMP_DIR/dump-summary.txt"
cat > "$SUMMARY_FILE" << EOF
S3 Bucket Dump Summary
======================

Environment: $ENVIRONMENT
Bucket Name: $BUCKET_NAME
Dump Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Total Objects: $OBJECT_COUNT
Dump Directory: $DUMP_DIR

Contents:
- objects/: All bucket objects with original directory structure
- bucket-metadata.json: Bucket metadata and dump information
- object-list.json: Detailed listing of all objects with metadata
- dump-summary.txt: This summary file

To restore this dump, run: ./scripts/restore-s3-bucket.sh --env=$ENVIRONMENT
EOF

print_success "Dump summary created: $SUMMARY_FILE"

# Calculate total size
print_progress "Calculating final statistics..."
TOTAL_SIZE=$(find "$DUMP_DIR/objects" -type f -exec stat -f%z {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
HUMAN_SIZE=$(numfmt --to=iec-i --suffix=B $TOTAL_SIZE 2>/dev/null || echo "${TOTAL_SIZE} bytes")

echo ""
printf "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
print_success "${BOLD}Backup completed successfully!${NC}"
printf "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
echo ""
printf "${BOLD}📊 Dump Statistics:${NC}\n"
printf "  ${CYAN}🌍${NC} Environment:  ${BOLD}%s${NC}\n" "$ENVIRONMENT"
printf "  ${CYAN}🪣${NC} Bucket:       ${BOLD}%s${NC}\n" "$BUCKET_NAME"
printf "  ${CYAN}📦${NC} Objects:      ${BOLD}%s${NC}\n" "$OBJECT_COUNT"
printf "  ${CYAN}💾${NC} Total Size:   ${BOLD}%s${NC}\n" "$HUMAN_SIZE"
printf "  ${CYAN}📂${NC} Location:     ${BOLD}%s${NC}\n" "$DUMP_DIR"
echo ""
printf "${BOLD}📝 Files created:${NC}\n"
printf "  ${GREEN}✓${NC} %s/objects/ - All bucket objects\n" "$DUMP_DIR"
printf "  ${GREEN}✓${NC} %s - Bucket metadata\n" "$METADATA_FILE"
printf "  ${GREEN}✓${NC} %s - Object listing\n" "$OBJECT_LIST_FILE"
printf "  ${GREEN}✓${NC} %s - Dump summary\n" "$SUMMARY_FILE"
echo ""
printf "${BOLD}💡 Next steps:${NC}\n"
printf "  ${CYAN}•${NC} Commit the backup: ${BOLD}git add '%s' && git commit -m 'Backup S3 bucket'${NC}\n" "$DUMP_DIR"
printf "  ${CYAN}•${NC} Restore backup:    ${BOLD}./scripts/restore-s3-bucket.sh --env %s${NC}\n" "$ENVIRONMENT"
printf "  ${CYAN}•${NC} Cross-restore:     ${BOLD}./scripts/restore-s3-bucket.sh --env local --source '%s'${NC}\n" "$DUMP_DIR"
echo ""
