#!/bin/bash

MAX_ATTEMPTS=30  # Maximum number of attempts (30 * 20 seconds = 10 minutes)
SLEEP_INTERVAL=20  # Sleep interval in seconds

delete_stack() {
    local stack_name="bedrock-api-stack"
    
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
