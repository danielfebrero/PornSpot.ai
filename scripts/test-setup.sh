#!/bin/bash

# Test Environment Setup Script for pornspot.ai
# This script sets up the testing environment for both backend and frontend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
COVERAGE_DIR="$PROJECT_ROOT/coverage"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"

# Default values
ENVIRONMENT="local"
COMPONENT="all"
CLEAN_FIRST=false
VERBOSE=false
DOCKER_MODE=false

# Function to print colored output
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

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [COMPONENT]

Setup test environment for pornspot.ai project

COMPONENT:
    all         Setup both backend and frontend (default)
    backend     Setup only backend testing environment
    frontend    Setup only frontend testing environment

OPTIONS:
    -e, --environment ENV    Set environment (local, ci, docker) [default: local]
    -c, --clean             Clean existing test artifacts first
    -v, --verbose           Enable verbose output
    -d, --docker            Use Docker for test environment
    -h, --help              Show this help message

EXAMPLES:
    $0                      # Setup all components for local environment
    $0 backend              # Setup only backend
    $0 --clean --verbose    # Clean setup with verbose output
    $0 --docker frontend    # Setup frontend in Docker mode
    $0 -e ci                # Setup for CI environment

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -c|--clean)
            CLEAN_FIRST=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -d|--docker)
            DOCKER_MODE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        backend|frontend|all)
            COMPONENT="$1"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if ! command_exists node; then
        missing_deps+=("node")
    fi
    
    if ! command_exists npm; then
        missing_deps+=("npm")
    fi
    
    if [[ "$DOCKER_MODE" == true ]] && ! command_exists docker; then
        missing_deps+=("docker")
    fi
    
    if [[ "$DOCKER_MODE" == true ]] && ! command_exists docker-compose; then
        missing_deps+=("docker-compose")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    
    if ! command_exists npx; then
        print_error "npx is required but not found"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to clean test artifacts
clean_test_artifacts() {
    if [[ "$CLEAN_FIRST" == true ]]; then
        print_status "Cleaning existing test artifacts..."
        
        # Clean coverage directories
        rm -rf "$COVERAGE_DIR"
        rm -rf "$BACKEND_DIR/coverage"
        rm -rf "$FRONTEND_DIR/coverage"
        rm -rf "$FRONTEND_DIR/playwright-report"
        
        # Clean test results
        rm -rf "$TEST_RESULTS_DIR"
        
        # Clean node_modules if in CI
        if [[ "$ENVIRONMENT" == "ci" ]]; then
            rm -rf "$BACKEND_DIR/node_modules"
            rm -rf "$FRONTEND_DIR/node_modules"
            rm -rf "$PROJECT_ROOT/node_modules"
        fi
        
        print_success "Test artifacts cleaned"
    fi
}

# Function to create directories
create_directories() {
    print_status "Creating test directories..."
    
    mkdir -p "$COVERAGE_DIR"
    mkdir -p "$COVERAGE_DIR/backend"
    mkdir -p "$COVERAGE_DIR/frontend"
    mkdir -p "$TEST_RESULTS_DIR"
    mkdir -p "$TEST_RESULTS_DIR/backend"
    mkdir -p "$TEST_RESULTS_DIR/frontend"
    
    print_success "Test directories created"
}

# Function to setup environment variables
setup_environment_variables() {
    print_status "Setting up environment variables..."
    
    # Create test environment file
    cat > "$PROJECT_ROOT/.env.test" << EOF
# Test Environment Configuration
NODE_ENV=test
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# DynamoDB Configuration
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_TABLE_PREFIX=test_

# S3 Configuration
S3_BUCKET=test-pornspot-ai
S3_ENDPOINT=http://localhost:4566

# API Configuration
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Test Configuration
TEST_TIMEOUT=30000
JEST_TIMEOUT=30000
PLAYWRIGHT_TIMEOUT=30000

# Coverage Configuration
COVERAGE_THRESHOLD=85
EOF

    # Docker-specific environment
    if [[ "$DOCKER_MODE" == true ]]; then
        cat >> "$PROJECT_ROOT/.env.test" << EOF

# Docker Configuration
DYNAMODB_ENDPOINT=http://dynamodb-local:8000
S3_ENDPOINT=http://localstack:4566
API_BASE_URL=http://backend-app:3001
FRONTEND_URL=http://frontend-app:3000
EOF
    fi
    
    print_success "Environment variables configured"
}

# Function to install dependencies
install_dependencies() {
    local component=$1
    
    print_status "Installing dependencies for $component..."
    
    case $component in
        "root")
            cd "$PROJECT_ROOT"
            if [[ "$VERBOSE" == true ]]; then
                npm ci
            else
                npm ci --silent
            fi
            ;;
        "backend")
            cd "$BACKEND_DIR"
            if [[ "$VERBOSE" == true ]]; then
                npm ci
            else
                npm ci --silent
            fi
            ;;
        "frontend")
            cd "$FRONTEND_DIR"
            if [[ "$VERBOSE" == true ]]; then
                npm ci
                npx playwright install
            else
                npm ci --silent
                npx playwright install --quiet
            fi
            ;;
    esac
    
    print_success "Dependencies installed for $component"
}

# Function to setup backend testing environment
setup_backend() {
    print_status "Setting up backend testing environment..."
    
    # Install dependencies
    install_dependencies "backend"
    
    # Setup AWS services for testing
    if [[ "$DOCKER_MODE" == false ]]; then
        setup_local_aws_services
    fi
    
    # Create test database tables
    setup_test_database
    
    # Seed test data
    seed_test_data "backend"
    
    print_success "Backend testing environment ready"
}

# Function to setup frontend testing environment
setup_frontend() {
    print_status "Setting up frontend testing environment..."
    
    # Install dependencies
    install_dependencies "frontend"
    
    # Setup test configuration
    setup_frontend_test_config
    
    # Seed test data
    seed_test_data "frontend"
    
    print_success "Frontend testing environment ready"
}

# Function to setup local AWS services
setup_local_aws_services() {
    print_status "Setting up local AWS services..."
    
    # Check if LocalStack is running
    if ! curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1; then
        print_warning "LocalStack not running, starting with Docker..."
        
        if command_exists docker-compose; then
            docker-compose -f "$PROJECT_ROOT/docker-compose.test.yml" up -d localstack dynamodb-local
            
            # Wait for services to be ready
            print_status "Waiting for AWS services to be ready..."
            local max_attempts=30
            local attempt=1
            
            while [[ $attempt -le $max_attempts ]]; do
                if curl -s http://localhost:4566/_localstack/health >/dev/null 2>&1 && \
                   curl -s http://localhost:8000/ >/dev/null 2>&1; then
                    break
                fi
                
                print_status "Attempt $attempt/$max_attempts - waiting for services..."
                sleep 2
                ((attempt++))
            done
            
            if [[ $attempt -gt $max_attempts ]]; then
                print_error "AWS services failed to start within timeout"
                exit 1
            fi
        else
            print_error "Docker Compose not available and LocalStack not running"
            exit 1
        fi
    fi
    
    print_success "Local AWS services ready"
}

# Function to setup test database
setup_test_database() {
    print_status "Setting up test database..."
    
    cd "$BACKEND_DIR"
    
    # Create DynamoDB tables for testing
    cat > create-test-tables.js << 'EOF'
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
    credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
    }
});

const tables = [
    {
        TableName: 'test_albums',
        KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'id', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    },
    {
        TableName: 'test_media',
        KeySchema: [
            { AttributeName: 'id', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'id', AttributeType: 'S' },
            { AttributeName: 'albumId', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'AlbumIndex',
                KeySchema: [
                    { AttributeName: 'albumId', KeyType: 'HASH' }
                ],
                Projection: { ProjectionType: 'ALL' }
            }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    }
];

async function createTables() {
    try {
        const existingTables = await client.send(new ListTablesCommand({}));
        
        for (const table of tables) {
            if (!existingTables.TableNames.includes(table.TableName)) {
                console.log(`Creating table: ${table.TableName}`);
                await client.send(new CreateTableCommand(table));
            } else {
                console.log(`Table already exists: ${table.TableName}`);
            }
        }
        
        console.log('Test database setup complete');
    } catch (error) {
        console.error('Error setting up test database:', error);
        process.exit(1);
    }
}

createTables();
EOF
    
    node create-test-tables.js
    rm create-test-tables.js
    
    print_success "Test database setup complete"
}

# Function to setup frontend test configuration
setup_frontend_test_config() {
    print_status "Setting up frontend test configuration..."
    
    cd "$FRONTEND_DIR"
    
    # Create Lighthouse CI configuration
    cat > .lighthouserc.json << EOF
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "startServerCommand": "npm run start",
      "startServerReadyPattern": "ready on",
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["warn", {"minScore": 0.8}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "categories:best-practices": ["warn", {"minScore": 0.8}],
        "categories:seo": ["warn", {"minScore": 0.8}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
EOF
    
    print_success "Frontend test configuration complete"
}

# Function to seed test data
seed_test_data() {
    local component=$1
    print_status "Seeding test data for $component..."
    
    case $component in
        "backend")
            cd "$BACKEND_DIR"
            if [[ -f "__tests__/fixtures/seed-data.js" ]]; then
                node __tests__/fixtures/seed-data.js
            fi
            ;;
        "frontend")
            # Frontend uses MSW for mocking, no seeding needed
            print_status "Frontend uses MSW mocks, no database seeding required"
            ;;
    esac
    
    print_success "Test data seeding complete for $component"
}

# Function to setup Docker environment
setup_docker_environment() {
    print_status "Setting up Docker test environment..."
    
    cd "$PROJECT_ROOT"
    
    # Build test images
    docker-compose -f docker-compose.test.yml build
    
    # Start services
    docker-compose -f docker-compose.test.yml up -d
    
    # Wait for services to be ready
    print_status "Waiting for Docker services to be ready..."
    sleep 30
    
    print_success "Docker test environment ready"
}

# Function to verify setup
verify_setup() {
    print_status "Verifying test environment setup..."
    
    local errors=0
    
    # Check if directories exist
    if [[ ! -d "$COVERAGE_DIR" ]]; then
        print_error "Coverage directory not found"
        ((errors++))
    fi
    
    # Check backend setup
    if [[ "$COMPONENT" == "all" || "$COMPONENT" == "backend" ]]; then
        if [[ ! -f "$BACKEND_DIR/package.json" ]]; then
            print_error "Backend package.json not found"
            ((errors++))
        fi
        
        if [[ "$DOCKER_MODE" == false ]]; then
            if ! curl -s http://localhost:8000/ >/dev/null 2>&1; then
                print_error "DynamoDB Local not accessible"
                ((errors++))
            fi
        fi
    fi
    
    # Check frontend setup
    if [[ "$COMPONENT" == "all" || "$COMPONENT" == "frontend" ]]; then
        if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
            print_error "Frontend package.json not found"
            ((errors++))
        fi
    fi
    
    if [[ $errors -eq 0 ]]; then
        print_success "Test environment verification passed"
    else
        print_error "Test environment verification failed with $errors errors"
        exit 1
    fi
}

# Main execution
main() {
    print_status "Starting test environment setup..."
    print_status "Environment: $ENVIRONMENT"
    print_status "Component: $COMPONENT"
    print_status "Docker mode: $DOCKER_MODE"
    
    check_prerequisites
    clean_test_artifacts
    create_directories
    setup_environment_variables
    
    # Install root dependencies
    install_dependencies "root"
    
    if [[ "$DOCKER_MODE" == true ]]; then
        setup_docker_environment
    else
        case $COMPONENT in
            "all")
                setup_backend
                setup_frontend
                ;;
            "backend")
                setup_backend
                ;;
            "frontend")
                setup_frontend
                ;;
        esac
    fi
    
    verify_setup
    
    print_success "Test environment setup complete!"
    print_status "You can now run tests using:"
    print_status "  npm run test:all          # Run all tests"
    print_status "  npm run test:backend      # Run backend tests"
    print_status "  npm run test:frontend     # Run frontend tests"
    print_status "  npm run test:coverage     # Generate coverage reports"
}

# Run main function
main "$@"