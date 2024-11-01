import boto3
import argparse
from typing import List

def parse_arguments() -> argparse.Namespace:
    """
    Parse command line arguments.
    
    Returns:
        argparse.Namespace: Parsed command line arguments
    """
    parser = argparse.ArgumentParser(description='Insert questions into DynamoDB table')
    parser.add_argument(
        '--region', 
        default='us-east-1', 
        help='AWS region name'
    )
    parser.add_argument(
        '--table', 
        default='InterviewQAResponses', 
        help='DynamoDB table name'
    )
    return parser.parse_args()

def create_dynamodb_client(region_name: str) -> boto3.client:
    """
    Create a DynamoDB client for the specified region.
    
    Args:
        region_name (str): AWS region name
    
    Returns:
        boto3.client: DynamoDB client
    """
    return boto3.client('dynamodb', region_name=region_name)

def get_questions() -> List[str]:
    """
    Return the list of interview questions.
    
    Returns:
        List[str]: List of questions
    """
    return [
        "Are you a citizen of the United States?",
        "Do you desire Automatic Premium Loan Provision (if available)?"
    ]

def insert_question(dynamodb: boto3.client, 
                   table_name: str, 
                   question_id: str, 
                   session_id: str, 
                   question: str) -> None:
    """
    Insert a single question into DynamoDB table.
    
    Args:
        dynamodb (boto3.client): DynamoDB client
        table_name (str): Name of the DynamoDB table
        question_id (str): Unique identifier for the question
        session_id (str): Session identifier
        question (str): The question text
    """
    item = {
        'questionId': {'S': question_id},
        'sessionId': {'S': session_id},
        'question': {'S': question}
    }
    try:
        dynamodb.put_item(TableName=table_name, Item=item)
        print(f"Inserted question {question_id}: {question}")
    except Exception as e:
        print(f"Error inserting question {question_id}: {str(e)}")
        raise

def insert_questions(region_name: str, table_name: str) -> None:
    """
    Insert all questions into the DynamoDB table.
    
    Args:
        region_name (str): AWS region name
        table_name (str): Name of the DynamoDB table
    """
    try:
        dynamodb = create_dynamodb_client(region_name)
        questions = get_questions()
        
        for i, question in enumerate(questions, start=1):
            insert_question(
                dynamodb=dynamodb,
                table_name=table_name,
                question_id=str(i),
                session_id=str(i),
                question=question
            )
        
        print("Insertion completed successfully.")
    except Exception as e:
        print(f"Error during insertion process: {str(e)}")
        raise

def main(region_name: str, table_name: str) -> None:
    """
    Main function to execute the script.
    
    Args:
        region_name (str): AWS region name
        table_name (str): DynamoDB table name
    """
    try:
        insert_questions(region_name, table_name)
    except Exception as e:
        print(f"Script execution failed: {str(e)}")
        raise

if __name__ == "__main__":
    args = parse_arguments()
    main(args.region, args.table)