#!/bin/bash

# Target directories
DIRS=("systems" "managers" "engine" "game" "ui")

# Find all TS/TSX files
FILES=$(find "${DIRS[@]}" -name "*.ts" -o -name "*.tsx")

# Find exports and check usage
for file in $FILES; do
    # Get exports (simple approach for now: const, class, function, type, interface, enum)
    # This might miss some complex cases, but it's a good start.
    EXPORTS=$(grep -E "^export (const|class|function|type|interface|enum|default class|default function) " "$file" | sed -E "s/^export (const|class|function|type|interface|enum|default class|default function) ([^<=( {]*).*/\2/" | sed "s/default//" | xargs)
    
    for symbol in $EXPORTS; do
        if [ -n "$symbol" ]; then
            # Search for the symbol in the whole project excluding the file where it's defined
            USAGE_COUNT=$(grep -r "$symbol" . --include="*.ts" --include="*.tsx" | grep -v "$file" | wc -l)
            if [ "$USAGE_COUNT" -eq 0 ]; then
                echo "Unused export: $symbol in $file"
            fi
        fi
    done
done

# Check for unused files
for file in $FILES; do
    FILENAME=$(basename "$file")
    FILENAME_NO_EXT="${FILENAME%.*}"
    # Search for imports of this file
    USAGE_COUNT=$(grep -r "from .*/$FILENAME_NO_EXT['\"]" . --include="*.ts" --include="*.tsx" | grep -v "$file" | wc -l)
    if [ "$USAGE_COUNT" -eq 0 ]; then
        # Check if it's imported via index.ts or other alias-like ways
        # This is a bit tricky, but let's see.
        echo "Potential unused file: $file"
    fi
done
