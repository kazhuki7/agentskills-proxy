#!/bin/bash
# Example Shell skill script
# This runs as a subprocess with command validation

echo "Starting Shell skill execution..."
echo "Artifact directory: $SKILL_ARTIFACT_DIR"

# Get parameters from environment
MESSAGE="${PARAM_MESSAGE:-Hello from Shell!}"
COUNT="${PARAM_COUNT:-3}"

echo "Message: $MESSAGE"
echo "Count: $COUNT"

# Generate output
echo ""
echo "Output:"
for i in $(seq 1 $COUNT); do
    echo "[$i/$COUNT] $MESSAGE"
done

# Create artifact
ARTIFACT_FILE="$SKILL_ARTIFACT_DIR/output.txt"
{
    echo "Shell Skill Report"
    echo "=================="
    echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "Message: $MESSAGE"
    echo "Count: $COUNT"
    echo ""
    echo "Output lines:"
    for i in $(seq 1 $COUNT); do
        echo "  [$i/$COUNT] $MESSAGE"
    done
} > "$ARTIFACT_FILE"

echo ""
echo "Artifact created: output.txt"
echo "Shell skill execution completed!"
