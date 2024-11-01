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
        "Have you ever been rejected for life insurance, rated, or failed to receive a policy as applied for?",
        "Have you ever had or been treated for high blood pressure, chest pain, heart attack, stroke or any heart or circulatory disorder?",
        "Have you ever had or been treated for asthma, emphysema, or other respiratory disorder?",
        "Have you ever had or been treated for ulcer, colitis, or other digestive tract disorder?",
        "Have you ever had or been treated for cirrhosis, hepatitis, or other liver disorder or any blood disorder?",
        "Have you ever had or been treated for diabetes or other endocrine disorder?",
        "Have you ever had or been treated for kidney, prostate, urinary, bladder or other genitourinary disorder?",
        "Have you ever had or been treated for paralysis, epilepsy, mental disease or disorder or any other nervous system, brain disorder or psychological disorder?",
        "Have you ever had or been treated for cancer, tumor, or unexplained masses?",
        "Have you ever had or been treated for disease of the breasts, uterus, or ovaries?",
        "Have you ever had or been treated for rheumatoid arthritis or any musculoskeletal disorder?",
        "In the last five years, have you had a physical examination?",
        "In the last five years, have you had any medical treatment? (includes prescription medications)",
        "In the last five years, have you been hospitalized?",
        "Have you ever applied for or received disability or workers' compensation benefits based on permanent disability or are you currently receiving government, workers' compensation or disability policy benefits for temporary disability?",
        "Have you ever been treated or been advised to be treated for alcoholism or alcohol abuse including membership in A.A., or been advised by a physician to reduce alcohol consumption?",
        "Have you ever used alcohol to excess or used narcotics, sedatives, or hallucinogens?",
        "Have you used marijuana in the past year?",
        "Have you ever been arrested, including arrests for driving while intoxicated or under the influence?",
        "Do you smoke cigarettes or use tobacco in any other form?",
        "If you are a former user of tobacco, when did you quit?",
        "Do you desire Automatic Premium Loan Provision (if available)?",
        "Do you have existing life insurance or annuities in force, including policies under conditional receipt, other than Group or Credit Life Insurance with this or any other company?",
        "Is the insurance applied for intended to replace or change any existing insurance or annuities with this or any other company?",
        "Within the last two years, have you made or intend to make any flights other than as a passenger on a scheduled airline?",
        "Within the last two years, have you engaged in or intend to engage in automobile, motorboat, or motorcycle racing, scuba, skin or sky diving?",
        "Do you plan to travel or reside outside the United States or Canada within the next year?",
        "Have you ever tested positive for exposure to the Human"
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