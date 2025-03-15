#!/bin/bash

# Exit on any error
set -e

STACK_NAME="bedrock-api-stack"

# Get the Distribution ID from CloudFormation outputs
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
    --output text)

if [ -z "$DISTRIBUTION_ID" ]; then
    echo "Error: Could not retrieve CloudFront Distribution ID from CloudFormation outputs"
    exit 1
fi

echo "Creating CloudFront invalidation for distribution: $DISTRIBUTION_ID"

# Create invalidation for all files (/*) in the distribution
aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*"

echo "Invalidation created successfully"
