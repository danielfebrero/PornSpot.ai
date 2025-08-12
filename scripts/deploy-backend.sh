#!/bin/bash

# Read ImageUri from file
if [ -f "./backend/.docker-image-uri" ]; then
    IMAGE_URI=$(cat ./backend/.docker-image-uri | tr -d '\n')
    echo "Using ImageUri: $IMAGE_URI"
    
    # Replace placeholder in template or use parameter override
    cd backend && npm run build:docker && cd .. && sam build && sam deploy --config-env prod --parameter-overrides ImageUri="$IMAGE_URI"
else
    echo "Error: .docker-image-uri file not found"
    exit 1
fi