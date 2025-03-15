import boto3
import argparse
from typing import List, Dict, Optional
from collections import defaultdict

def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
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
    parser.add_argument(
        '--file',
        default='questions.txt',
        help='Input file containing questions'
    )
    return parser.parse_args()

def read_questions_file(filename: str) -> Dict[str, dict]:
    """
    Read and parse the questions file.
    
    Args:
        filename (str): Path to the questions file
    
    Returns:
        Dict[str, dict]: Dictionary of questions with their sub-questions
    """
    questions = {}
    current_question = None

    with open(filename, 'r', encoding='utf-8') as file:
        for line in file:
            line = line.strip()
            if not line:
                continue

            parts = line.split('|', 2)
            if len(parts) != 3:
                continue

            qtype, qid, text = parts

            if qtype == 'Q':
                questions[qid] = {
                    'questionId': qid,
                    'question': text,
                    'hasSubQuestions': False,
                    'subQuestions': []
                }
                current_question = qid
            elif qtype == 'SQ' and current_question:
                parent_id = qid.split('.')[0]
                if parent_id in questions:
                    questions[parent_id]['hasSubQuestions'] = True
                    questions[parent_id]['subQuestions'].append({
                        'subQuestionId': qid,
                        'question': text
                    })

    return questions

def create_dynamodb_client(region_name: str) -> boto3.client:
    """Create a DynamoDB client."""
    return boto3.client('dynamodb', region_name=region_name)

def insert_question(dynamodb: boto3.client, 
                   table_name: str, 
                   question_data: dict) -> None:
    """
    Insert a question with its optional sub-questions into DynamoDB.
    
    Args:
        dynamodb (boto3.client): DynamoDB client
        table_name (str): Name of the DynamoDB table
        question_data (dict): Question data to insert
    """
    item = {
        'sessionId': {'S': 'TEMPLATE'},  # Fixed sessionId for template questions
        'questionId': {'S': question_data['questionId']},
        'question': {'S': question_data['question']},
        'hasSubQuestions': {'BOOL': question_data['hasSubQuestions']}
    }

    if question_data['hasSubQuestions']:
        item['triggerOnResponse'] = {'S': 'YES'}
        item['subQuestions'] = {'L': [
            {
                'M': {
                    'subQuestionId': {'S': sub_q['subQuestionId']},
                    'question': {'S': sub_q['question']}
                }
            } for sub_q in question_data['subQuestions']
        ]}

    try:
        dynamodb.put_item(TableName=table_name, Item=item)
        print(f"Inserted question {question_data['questionId']}: {question_data['question']}")
    except Exception as e:
        print(f"Error inserting question {question_data['questionId']}: {str(e)}")
        raise

def insert_questions(region_name: str, table_name: str, questions: Dict[str, dict]) -> None:
    """
    Insert all questions into the DynamoDB table.
    
    Args:
        region_name (str): AWS region name
        table_name (str): Name of the DynamoDB table
        questions (Dict[str, dict]): Questions to insert
    """
    try:
        dynamodb = create_dynamodb_client(region_name)
        for question_data in questions.values():
            insert_question(
                dynamodb=dynamodb,
                table_name=table_name,
                question_data=question_data
            )
        print("Insertion completed successfully.")
    except Exception as e:
        print(f"Error during insertion process: {str(e)}")
        raise

def main() -> None:
    """Main function to execute the script."""
    args = parse_arguments()
    
    try:
        questions = read_questions_file(args.file)
        insert_questions(args.region, args.table, questions)
    except FileNotFoundError:
        print(f"Error: Could not find questions file: {args.file}")
    except Exception as e:
        print(f"Script execution failed: {str(e)}")
        raise

if __name__ == "__main__":
    main()
