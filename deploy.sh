#!/bin/bash

# Prompt for sensitive information
read -p "Enter your AWS profile (default if empty): " AWS_PROFILE
AWS_PROFILE=${AWS_PROFILE:-default}

# Set AWS Profile
export AWS_PROFILE=$AWS_PROFILE

# Step 1: Deploy CloudFormation stack
echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file APIGW.yaml \
    --stack-name bedrock-api-stack \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset

# Check if stack deployment was successful
if [ $? -ne 0 ]; then
    echo "Error: Failed to deploy CloudFormation stack"
    exit 1
fi

# Function to check stack status
check_stack_status() {
    local stack_name=$1
    local status=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].StackStatus' \
        --output text)
    echo "$status"
}

# Wait for stack to complete with status updates
echo "Waiting for stack deployment to complete..."
while true; do
    STATUS=$(check_stack_status "bedrock-api-stack")
    echo "Current status: $STATUS"
    
    case $STATUS in
        CREATE_COMPLETE|UPDATE_COMPLETE)
            echo "Stack deployment successful!"
            break
            ;;
        CREATE_IN_PROGRESS|UPDATE_IN_PROGRESS|UPDATE_COMPLETE_CLEANUP_IN_PROGRESS)
            sleep 5  # Check every 5 seconds
            ;;
        CREATE_FAILED|ROLLBACK_IN_PROGRESS|ROLLBACK_COMPLETE|UPDATE_ROLLBACK_IN_PROGRESS|UPDATE_ROLLBACK_COMPLETE|UPDATE_FAILED)
            echo "Stack deployment failed with status: $STATUS"
            exit 1
            ;;
        *)
            echo "Unknown status: $STATUS"
            exit 1
            ;;
    esac
done


# Step 2: Extract values from CloudFormation stack
echo "Extracting values from CloudFormation stack..."

echo -n "Getting Identity Pool ID... "
IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name bedrock-api-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`IdentityPoolId`].OutputValue' \
    --output text)
echo "$IDENTITY_POOL_ID"

echo -n "Getting API Endpoint... "
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name bedrock-api-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text)
echo "$API_ENDPOINT"

echo -n "Getting Region... "
REGION=$(aws cloudformation describe-stacks \
    --stack-name bedrock-api-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`Region`].OutputValue' \
    --output text)
echo "$REGION"

echo -n "Getting Website Bucket... "
WEBSITE_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name bedrock-api-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteBucket`].OutputValue' \
    --output text)
echo "$WEBSITE_BUCKET"

echo -n "Getting DynamoDB Table... "
DYNAMODB_TABLE=$(aws cloudformation describe-stacks \
    --stack-name bedrock-api-stack \
    --query 'Stacks[0].Outputs[?OutputKey==`DynamoDBTableName`].OutputValue' \
    --output text)
echo "$DYNAMODB_TABLE"

# Optional: Print a summary of all values
echo -e "\nStack Output Summary:"
echo "===================="
echo "Identity Pool ID: $IDENTITY_POOL_ID"
echo "API Endpoint: $API_ENDPOINT"
echo "Region: $REGION"
echo "Website Bucket: $WEBSITE_BUCKET"
echo "DynamoDB Table: $DYNAMODB_TABLE"
echo "===================="

# Check if all values were retrieved successfully
if [ -z "$IDENTITY_POOL_ID" ] || [ -z "$API_ENDPOINT" ] || [ -z "$REGION" ] || [ -z "$WEBSITE_BUCKET" ] || [ -z "$DYNAMODB_TABLE" ]; then
    echo "Error: Failed to retrieve one or more values from CloudFormation stack"
    exit 1
fi

# Step 3: Create config.json
echo "Creating config.json..."
cat > config.json << EOF
{
    "apiEndpoint": "${API_ENDPOINT}",
    "identityPoolId": "${IDENTITY_POOL_ID}",
    "region": "${REGION}"
}
EOF

# Step 4: Upload files to S3
echo "Uploading files to S3..."

# Remove any existing files in the bucket
aws s3 rm "s3://${WEBSITE_BUCKET}" --recursive

# Upload config.json with content-type
aws s3 cp config.json "s3://${WEBSITE_BUCKET}/config.json" \
    --content-type "application/json"

# Upload index.html with content-type
aws s3 cp index.html "s3://${WEBSITE_BUCKET}/index.html" \
    --content-type "text/html"

# Upload qa-script.js with content-type
aws s3 cp qa-script.js "s3://${WEBSITE_BUCKET}/qa-script.js" \
    --content-type "application/javascript"

# Check if uploads were successful
if [ $? -eq 0 ]; then
    echo "Successfully uploaded all files to S3 bucket: ${WEBSITE_BUCKET}"
    echo "Config values used:"
    echo "Identity Pool ID: ${IDENTITY_POOL_ID}"
    echo "API Endpoint: ${API_ENDPOINT}"
    echo "Region: ${REGION}"
    echo "Website Bucket: ${WEBSITE_BUCKET}"
    echo "DynamoDB Table: ${DYNAMODB_TABLE}"
else
    echo "Error: Failed to upload files to S3"
    exit 1
fi

# Step 5: Install Python dependencies
echo "Installing Python dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install Python dependencies"
        exit 1
    fi
    echo "Successfully installed Python dependencies"
else
    echo "Warning: requirements.txt not found, skipping dependency installation"
fi

# Step 6: Insert questions into DynamoDB
echo "Inserting questions into DynamoDB..."
python dynamo_question_insert.py --region "${REGION}" --table "${DYNAMODB_TABLE}"
if [ $? -ne 0 ]; then
    echo "Error: Failed to insert questions into DynamoDB"
    exit 1
fi
echo "Successfully inserted questions into DynamoDB"

fi

echo "Deployment completed successfully!"
