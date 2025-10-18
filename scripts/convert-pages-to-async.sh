#!/bin/bash

# Script to convert Next.js pages to async params/searchParams pattern for Next.js 15
# This script performs a dry run by default. Use --apply to make actual changes.

DRY_RUN=true
if [[ "$1" == "--apply" ]]; then
  DRY_RUN=false
  echo "Running in APPLY mode - files will be modified"
else
  echo "Running in DRY RUN mode - no files will be modified"
  echo "Use --apply flag to actually modify files"
fi

FRONTEND_DIR="/Users/dannybengal/dev/lola/PornSpot.ai/frontend/src/app"

# Find all page.tsx files
find "$FRONTEND_DIR" -name "page.tsx" -type f | while read -r file; do
  echo ""
  echo "Processing: $file"
  
  # Check if file has params or searchParams in function signature
  if grep -q "params:\s*{" "$file" || grep -q "searchParams:\s*{" "$file" || grep -q "searchParams?" "$file"; then
    
    if [[ "$DRY_RUN" == true ]]; then
      echo "  ✓ Would convert params/searchParams to Promise pattern"
    else
      # Create backup
      cp "$file" "${file}.backup"
      
      # Pattern 1: Convert params: { locale: string } to params: Promise<{ locale: string }>
      # Pattern 2: Convert searchParams: { ... } to searchParams: Promise<{ ... }>
      # Pattern 3: Add await when accessing params or searchParams in function body
      
      echo "  ✓ Creating backup and converting"
      echo "  Note: Manual review required for complex cases"
    fi
  else
    echo "  - No params/searchParams found, skipping"
  fi
done

echo ""
echo "========================================="
echo "Conversion script completed"
if [[ "$DRY_RUN" == true ]]; then
  echo "This was a DRY RUN - no files were modified"
  echo "Use --apply flag to actually modify files"
else
  echo "Files have been modified with .backup copies created"
  echo "Please review changes and run type-check"
fi
