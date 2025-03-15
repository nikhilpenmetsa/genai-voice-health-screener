#!/bin/bash

MAX_ATTEMPTS=30  # Maximum number of attempts (30 * 20 seconds = 10 minutes)
SLEEP_INTERVAL=20  # Sleep interval in seconds

# Function to empty an S3 bucket
empty_bucket() {
    local bucket_name=$1
    echo "Emptying bucket: $bucket_name"
    
    # Check if bucket exists
    if aws s3api head-bucket --bucket "$bucket_name" 2>/dev/null; then
        echo "Removing all versions from bucket..."
        # List and delete all versions (including delete markers)
        aws s3api list-object-versions \
            --bucket "$bucket_name" \
            --output json \
            --query '[Versions[].{Key:Key,VersionId:VersionId},DeleteMarkers[].{Key:Key,VersionId:VersionId}][]' \
            2>/dev/null | \
        jq -r '.[] | select(. != null) | "Key=\(.Key),VersionId=\(.VersionId)"' | \
        while read -r line; do
            if [ ! -z "$line" ]; then
                aws s3api delete-object \
                    --bucket "$bucket_name" \
                    --delete "Objects=[{$line}],Quiet=true"
            fi
        done

        echo "Removing remaining objects..."
        # Delete any remaining objects (if versioning was not enabled)
        aws s3 rm "s3://$bucket_name" --recursive
        
        echo "Bucket emptied successfully"
        return 0
    else
        echo "Bucket $bucket_name does not exist"
        return 1
    fi
}

# Function to get bucket name from stack outputs
get_bucket_name() {
    aws cloudformation describe-stacks \
        --stack-name bedrock-api-stack \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucket`].OutputValue' \
        --output text
}

delete_stack() {
    local stack_name="bedrock-api-stack"
    
    # First, try to get and empty the S3 bucket
    local bucket_name=$(get_bucket_name)
    if [ ! -z "$bucket_name" ]; then
        echo "Found bucket: $bucket_name"
        empty_bucket "$bucket_name"
        if [ $? -ne 0 ]; then
            echo "Warning: Failed to empty bucket $bucket_name"
        fi
    else
        echo "No bucket found in stack outputs, proceeding with stack deletion"
    fi
    
    echo "Deleting CloudFormation stack: $stack_name"
    aws cloudformation delete-stack --stack-name "$stack_name"
    
    echo "Checking stack deletion status..."
    local attempts=0
    
    while [ $attempts -lt $MAX_ATTEMPTS ]; do
        # Check if stack exists
        if ! aws cloudformation describe-stacks --stack-name "$stack_name" 2>/dev/null; then
            echo "Stack deletion completed successfully"
            return 0
        fi
        
        # Get stack status
        local status=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query 'Stacks[0].StackStatus' --output text 2>/dev/null)
        
        echo "Current status: $status (Attempt $((attempts + 1))/$MAX_ATTEMPTS)"
        
        # Check for failure states
        if [[ $status == *FAILED* ]]; then
            echo "Error: Stack deletion failed with status: $status"
            return 1
        fi
        
        # Wait before next check
        echo "Waiting $SLEEP_INTERVAL seconds before next check..."
        sleep $SLEEP_INTERVAL
        
        ((attempts++))
    done
    
    echo "Error: Stack deletion timed out after $((MAX_ATTEMPTS * SLEEP_INTERVAL)) seconds"
    return 1
}

# Execute the delete function
delete_stack
exit_code=$?

if [ $exit_code -ne 0 ]; then
    echo "Stack deletion process failed"
    exit 1
fi
