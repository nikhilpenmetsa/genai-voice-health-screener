#!/bin/bash

echo "Deleting CloudFormation stack..."
aws cloudformation delete-stack --stack-name bedrock-api-stack

echo "Waiting for stack deletion to complete..."
aws cloudformation wait stack-delete-complete --stack-name bedrock-api-stack

if [ $? -eq 0 ]; then
    echo "Stack deletion completed successfully"
else
    echo "Error: Stack deletion failed"
    exit 1
fi
