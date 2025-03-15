window.INTERVIEW_DATA = [];

let config = null;
let polly = null;

// Function to load configuration
async function loadConfig() {
    try {
        const response = await fetch('/config.json');
        config = await response.json();

        // Configure AWS SDK with loaded config
        AWS.config.region = config.region;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: config.identityPoolId
        });
        AWS.config.logger = console;

        // Initialize Polly after setting region and credentials
        polly = new AWS.Polly();

        return true;
    } catch (error) {
        console.error('Error loading config:', error);
        return false;
    }
}

// Function to fetch and transform questions from API
async function fetchQuestions() {
    try {
        const response = await fetch(`${config.apiEndpoint}/questions`);
        const data = await response.json();

        // Transform API data to match the required format
        const transformedData = data.questions.map(item => ({
            question: item.question,
            answer: "Not answered yet",
            status: "pending",
            relevancyScore: null,
            analysis: null,
            id: item.questionId,
            hasSubQuestions: item.hasSubQuestions,
            subQuestions: item.subQuestions?.map(sq => ({
                ...sq,
                answer: "Not answered yet",
                status: "pending",
                relevancyScore: null,
                analysis: null
            })) || [],
            triggerOnResponse: item.triggerOnResponse
        }));

        return transformedData;
    } catch (error) {
        console.error('Error fetching questions:', error);
        return [];
    }
}

// Modify the initialization to use async/await
async function initializeApp() {
    try {

        // Load config first
        const configLoaded = await loadConfig();
        if (!configLoaded) {
            throw new Error('Failed to load configuration');
        }
        // Get questions from API
        const questions = await fetchQuestions();

        // Update the global INTERVIEW_DATA
        window.INTERVIEW_DATA = questions;

        // Initialize the interface
        initializeResponsesList();
        displayCurrentQuestion();
        updateNavigationButtons();
    } catch (error) {
        console.error('Error initializing app:', error);
        responsesList.innerHTML = '<div class="error">Failed to load questions. Please try again later.</div>';
    }
}

// Single DOMContentLoaded event listener that handles everything
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

let currentQuestionIndex = 0;
let isListening = false;

// Configure AWS SDK
// AWS.config.region = 'us-east-1';
// AWS.config.credentials = new AWS.CognitoIdentityCredentials({
//     IdentityPoolId: 'us-east-1:4832fca2-7c22-4cce-9b60-bfd6d10137b7'
// });
AWS.config.logger = console;

//const polly = new AWS.Polly();

// Call initializeResponsesList when the page loads
document.addEventListener('DOMContentLoaded', initializeResponsesList);

// DOM elements
const startBtn = document.getElementById('startBtn');
const output = document.getElementById('output');
const questionDisplay = document.getElementById('questionDisplay');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const responsesList = document.getElementById('responsesList');

// Speech Recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

// Initialize the interface with all questions and placeholder answers
function initializeResponsesList() {
    console.log('Initializing responses list...');

    const html = INTERVIEW_DATA.map((item, index) => {
        // Change this line to use HTML entities
        const statusSymbol = item.status === 'completed' ? '&#x2714;' : '&#x25CB;';
        console.log(`Question ${index + 1} status:`, {
            status: item.status,
            intendedSymbol: statusSymbol,
            actualHTML: `<div class="status-indicator" id="status-${index}">${statusSymbol}</div>`
        });


        return `
        <div class="response-item ${item.status} ${item.subQuestions && item.subQuestions.length > 0 ? 'has-sub-questions' : ''}" id="response-${index}">
            <div class="question-number">
                Question ${index + 1}
                ${item.subQuestions && item.subQuestions.length > 0 ? '<span class="sub-question-indicator">(Has Follow-up Questions)</span>' : ''}
            </div>
            <div class="question-text"><strong>Q: ${item.question}</strong></div>
            <div class="answer-text" id="answer-${index}">A: ${item.answer}</div>
            <div class="analysis-text" id="analysis-${index}">
                ${item.analysis ? `Analysis: ${item.analysis}` : ''}
            </div>
            <div class="relevancy-score ${item.relevancyScore >= 8 ? 'high-relevancy' : item.relevancyScore >= 5 ? 'medium-relevancy' : 'low-relevancy'}" id="relevancy-${index}">
                ${item.relevancyScore ? `Relevancy Score: ${item.relevancyScore}/10` : ''}
            </div>
            <div class="status-indicator" id="status-${index}">
                ${statusSymbol}
            </div>
            ${item.subQuestions && item.subQuestions.length > 0 ? `
                <div class="sub-questions ${item.impliedAnswer?.toLowerCase() === 'yes' ? 'show' : 'hide'}" id="sub-questions-${index}">
                    ${item.subQuestions.map((sq, sqIndex) => `
                        <div class="sub-question-item ${sq.status}" id="sub-response-${index}-${sqIndex}">
                            <div class="sub-question-text"><strong>Follow-up: ${sq.question}</strong></div>
                            <div class="answer-text" id="sub-answer-${index}-${sqIndex}">A: ${sq.answer}</div>
                            <div class="analysis-text" id="sub-analysis-${index}-${sqIndex}">
                                ${sq.analysis ? `Analysis: ${sq.analysis}` : ''}
                            </div>
                            <div class="relevancy-score ${sq.relevancyScore >= 8 ? 'high-relevancy' : sq.relevancyScore >= 5 ? 'medium-relevancy' : 'low-relevancy'}" id="sub-relevancy-${index}-${sqIndex}">
                                ${sq.relevancyScore ? `Relevancy Score: ${sq.relevancyScore}/10` : ''}
                            </div>
                            <div class="status-indicator" id="sub-status-${index}-${sqIndex}">
                                ${sq.status === 'completed' ? '&#x2714;' : '&#x25CB;'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `}).join('');

    responsesList.innerHTML = html;

    // After rendering, let's check what actually got rendered
    INTERVIEW_DATA.forEach((_, index) => {
        const statusElement = document.getElementById(`status-${index}`);
        console.log(`Rendered status for question ${index + 1}:`, {
            elementContent: statusElement?.textContent,
            elementHTML: statusElement?.innerHTML,
            elementInnerText: statusElement?.innerText
        });
    });

    // Inspect the first status indicator
    inspectStatusIndicator(0);
}

// Helper function to inspect the status indicator - defined outside of initializeResponsesList
function inspectStatusIndicator(index) {
    const statusElement = document.getElementById(`status-${index}`);
    if (statusElement) {
        console.log('Status Indicator Inspection:', {
            textContent: statusElement.textContent,
            innerHTML: statusElement.innerHTML,
            innerText: statusElement.innerText,
            textContentCharCodes: Array.from(statusElement.textContent).map(char => char.charCodeAt(0)),
            innerHTMLCharCodes: Array.from(statusElement.innerHTML).map(char => char.charCodeAt(0)),
            innerTextCharCodes: Array.from(statusElement.innerText).map(char => char.charCodeAt(0))
        });
    }
}





// And in the updateResponse function:
// Update the updateResponse function to handle sub-questions
function updateResponse(index, answer, relevancyScore, analysis, impliedAnswer) {
    const question = INTERVIEW_DATA[index];
    question.answer = answer;
    question.status = 'completed';
    question.relevancyScore = relevancyScore;
    question.analysis = analysis;
    question.impliedAnswer = impliedAnswer;  // Store the implied answer

    const answerElement = document.getElementById(`answer-${index}`);
    const responseItem = document.getElementById(`response-${index}`);
    const statusIndicator = document.getElementById(`status-${index}`);
    const relevancyElement = document.getElementById(`relevancy-${index}`);
    const analysisElement = document.getElementById(`analysis-${index}`);

    if (answerElement && responseItem && statusIndicator && relevancyElement && analysisElement) {
        answerElement.textContent = `A: ${answer}`;
        responseItem.classList.remove('pending');
        responseItem.classList.add('completed');
        statusIndicator.innerHTML = '&#x2714;';
        relevancyElement.textContent = `Relevancy Score: ${relevancyScore}/10`;
        analysisElement.textContent = `Analysis: ${analysis}`;

        // Handle sub-questions visibility based on impliedAnswer
        if (question.hasSubQuestions) {
            const subQuestionsDiv = document.getElementById(`sub-questions-${index}`);
            if (subQuestionsDiv) {
                if (impliedAnswer?.toLowerCase() === 'yes') {
                    subQuestionsDiv.classList.remove('hide');
                    subQuestionsDiv.classList.add('show');
                } else {
                    subQuestionsDiv.classList.remove('show');
                    subQuestionsDiv.classList.add('hide');
                }
            }
        }

        relevancyElement.className = 'relevancy-score ' +
            (relevancyScore >= 8 ? 'high-relevancy' :
                relevancyScore >= 5 ? 'medium-relevancy' :
                    'low-relevancy');
    }
}
// Add new function to update sub-question responses
function updateSubQuestionResponse(questionIndex, subQuestionIndex, answer, relevancyScore, analysis) {
    const question = INTERVIEW_DATA[questionIndex];
    const subQuestion = question.subQuestions[subQuestionIndex];

    subQuestion.answer = answer;
    subQuestion.status = 'completed';
    subQuestion.relevancyScore = relevancyScore;
    subQuestion.analysis = analysis;

    const answerElement = document.getElementById(`sub-answer-${questionIndex}-${subQuestionIndex}`);
    const responseItem = document.getElementById(`sub-response-${questionIndex}-${subQuestionIndex}`);
    const statusIndicator = document.getElementById(`sub-status-${questionIndex}-${subQuestionIndex}`);
    const relevancyElement = document.getElementById(`sub-relevancy-${questionIndex}-${subQuestionIndex}`);
    const analysisElement = document.getElementById(`sub-analysis-${questionIndex}-${subQuestionIndex}`);

    if (answerElement && responseItem && statusIndicator && relevancyElement && analysisElement) {
        answerElement.textContent = `A: ${answer}`;
        responseItem.classList.remove('pending');
        responseItem.classList.add('completed');
        statusIndicator.innerHTML = '&#x2714;';
        relevancyElement.textContent = `Relevancy Score: ${relevancyScore}/10`;
        analysisElement.textContent = `Analysis: ${analysis}`;

        relevancyElement.className = 'relevancy-score ' +
            (relevancyScore >= 8 ? 'high-relevancy' :
                relevancyScore >= 5 ? 'medium-relevancy' :
                    'low-relevancy');
    }
}

function updateNavigationButtons() {
    // Check if INTERVIEW_DATA exists and has items
    if (!INTERVIEW_DATA || !INTERVIEW_DATA.length || currentQuestionIndex >= INTERVIEW_DATA.length) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }

    const currentQuestion = INTERVIEW_DATA[currentQuestionIndex];

    // Determine if we can move backward
    let canMovePrev = currentQuestionIndex > 0 || currentSubQuestionIndex > -1;

    // Determine if we can move forward
    let canMoveNext = false;

    // Check if current question has sub-questions and was answered 'yes'
    if (currentQuestion.hasSubQuestions && 
        currentQuestion.impliedAnswer?.toLowerCase() === 'yes') {
        
        // If we haven't started sub-questions yet
        if (currentSubQuestionIndex === -1) {
            canMoveNext = true; // Always allow moving to first sub-question
        } 
        // If we're in the middle of sub-questions
        else if (currentSubQuestionIndex < currentQuestion.subQuestions.length - 1) {
            canMoveNext = true; // Allow moving to next sub-question
        }
        // If we're at the last sub-question
        else {
            canMoveNext = currentQuestionIndex < INTERVIEW_DATA.length - 1;
        }

        // Special case: If we're on the main question and it has sub-questions
        if (currentSubQuestionIndex === -1 && currentQuestion.status === 'completed') {
            canMoveNext = true; // Enable next button to move to sub-questions
        }
    } else {
        // For questions without sub-questions or answered 'no'
        canMoveNext = currentQuestionIndex < INTERVIEW_DATA.length - 1;
    }

    prevBtn.disabled = !canMovePrev;
    nextBtn.disabled = !canMoveNext;

    // Debug output
    console.log('Navigation state:', {
        currentQuestionIndex,
        currentSubQuestionIndex,
        hasSubQuestions: currentQuestion.hasSubQuestions,
        impliedAnswer: currentQuestion.impliedAnswer,
        canMoveNext,
        subQuestionsLength: currentQuestion.subQuestions?.length
    });
}



// Modify the toggleListening function to speak the question when starting
function toggleListening() {
    if (isListening) {
        recognition.stop();
        startBtn.textContent = 'Start Listening';
        startBtn.classList.remove('listening');
    } else {
        recognition.start();
        startBtn.textContent = 'Stop Listening';
        startBtn.classList.add('listening');
        // Speak the current question only when starting to listen
        synthesizeSpeech(INTERVIEW_DATA[currentQuestionIndex].question);
    }
    isListening = !isListening;
}

// Add variable for tracking sub-questions
let currentSubQuestionIndex = -1; // -1 means we're on the main question

// Update the nextQuestion function
function nextQuestion() {
    const currentQuestion = INTERVIEW_DATA[currentQuestionIndex];

    // Check if current question has sub-questions and was answered "Yes"
    if (currentQuestion.hasSubQuestions &&
        currentQuestion.impliedAnswer?.toLowerCase() === 'yes') {

        // If we're on the main question, move to first sub-question
        if (currentSubQuestionIndex === -1) {
            currentSubQuestionIndex = 0;
            displayCurrentQuestion();
            updateNavigationButtons();
            // Use existing synthesizeSpeech function
            synthesizeSpeech(currentQuestion.subQuestions[currentSubQuestionIndex].question);
            return;
        }

        // If we have more sub-questions, move to next sub-question
        if (currentSubQuestionIndex < currentQuestion.subQuestions.length - 1) {
            currentSubQuestionIndex++;
            displayCurrentQuestion();
            updateNavigationButtons();
            synthesizeSpeech(currentQuestion.subQuestions[currentSubQuestionIndex].question);
            return;
        }

        // If we're at the last sub-question, move to next main question
        currentSubQuestionIndex = -1;
    }

    // Move to next main question if available
    if (currentQuestionIndex < INTERVIEW_DATA.length - 1) {
        currentQuestionIndex++;
        displayCurrentQuestion();
        updateNavigationButtons();
        synthesizeSpeech(INTERVIEW_DATA[currentQuestionIndex].question);
    }
}

// Update the previousQuestion function
function previousQuestion() {
    const currentQuestion = INTERVIEW_DATA[currentQuestionIndex];

    // If we're in sub-questions, move to previous sub-question or main question
    if (currentQuestion.hasSubQuestions &&
        currentQuestion.impliedAnswer?.toLowerCase() === 'yes') {

        if (currentSubQuestionIndex > 0) {
            currentSubQuestionIndex--;
            displayCurrentQuestion();
            updateNavigationButtons();
            synthesizeSpeech(currentQuestion.subQuestions[currentSubQuestionIndex].question);
            return;
        }

        if (currentSubQuestionIndex === 0) {
            currentSubQuestionIndex = -1;
            displayCurrentQuestion();
            updateNavigationButtons();
            synthesizeSpeech(currentQuestion.question);
            return;
        }
    }

    // Move to previous main question if available
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        // Check if previous question has sub-questions and was answered yes
        const prevQuestion = INTERVIEW_DATA[currentQuestionIndex];
        if (prevQuestion.hasSubQuestions &&
            prevQuestion.impliedAnswer?.toLowerCase() === 'yes') {
            currentSubQuestionIndex = prevQuestion.subQuestions.length - 1;
            synthesizeSpeech(prevQuestion.subQuestions[currentSubQuestionIndex].question);
        } else {
            synthesizeSpeech(prevQuestion.question);
        }
        displayCurrentQuestion();
        updateNavigationButtons();
    }
}

// Also update displayCurrentQuestion with similar safety checks
function displayCurrentQuestion() {
    if (!INTERVIEW_DATA || !INTERVIEW_DATA.length || currentQuestionIndex >= INTERVIEW_DATA.length) {
        questionDisplay.textContent = 'Loading questions...';
        return;
    }

    const currentQuestion = INTERVIEW_DATA[currentQuestionIndex];

    if (currentSubQuestionIndex >= 0 &&
        currentQuestion.hasSubQuestions &&
        currentQuestion.impliedAnswer?.toLowerCase() === 'yes') {
        // Display sub-question
        const subQuestion = currentQuestion.subQuestions[currentSubQuestionIndex];
        questionDisplay.textContent = subQuestion.question;
    } else {
        // Display main question
        questionDisplay.textContent = currentQuestion.question;
    }

    // Highlight current question in the list
    document.querySelectorAll('.response-item').forEach((item, index) => {
        if (index === currentQuestionIndex) {
            item.classList.add('current');
        } else {
            item.classList.remove('current');
        }
    });

    // Highlight current sub-question if applicable
    if (currentSubQuestionIndex >= 0) {
        document.querySelectorAll(`#sub-questions-${currentQuestionIndex} .sub-question-item`).forEach((item, index) => {
            if (index === currentSubQuestionIndex) {
                item.classList.add('current-sub');
            } else {
                item.classList.remove('current-sub');
            }
        });
    }
}

// Speech recognition handlers
function toggleListening() {
    if (isListening) {
        recognition.stop();
        startBtn.textContent = 'Start Listening';
        startBtn.classList.remove('listening');
    } else {
        recognition.start();
        startBtn.textContent = 'Stop Listening';
        startBtn.classList.add('listening');
        // Synthesize speech for the current question when starting to listen
        synthesizeSpeech(INTERVIEW_DATA[currentQuestionIndex].question);
    }
    isListening = !isListening;
}


recognition.onresult = (event) => {
    const last = event.results.length - 1;
    const text = event.results[last][0].transcript;
    output.textContent = text;

    if (event.results[last].isFinal) {
        const currentQuestion = INTERVIEW_DATA[currentQuestionIndex];

        // Determine if we're handling a sub-question or main question
        if (currentSubQuestionIndex >= 0 &&
            currentQuestion.hasSubQuestions &&
            currentQuestion.impliedAnswer?.toLowerCase() === 'yes') {
            // Handle sub-question
            checkAnswerRelevancy(currentQuestion.subQuestions[currentSubQuestionIndex].question, text)
                .then(analysis => {
                    if (analysis) {
                        updateSubQuestionResponse(
                            currentQuestionIndex,
                            currentSubQuestionIndex,
                            text,
                            analysis.Relevancy,
                            analysis.Analysis
                        );
                    } else {
                        updateSubQuestionResponse(
                            currentQuestionIndex,
                            currentSubQuestionIndex,
                            text,
                            null,
                            null
                        );
                    }
                })
                .catch(error => {
                    console.error('Relevancy Analysis Error:', error);
                    updateSubQuestionResponse(
                        currentQuestionIndex,
                        currentSubQuestionIndex,
                        text,
                        null,
                        null
                    );
                });
        } else {
            // Handle main question
            checkAnswerRelevancy(currentQuestion.question, text)
                .then(analysis => {
                    if (analysis) {
                        updateResponse(
                            currentQuestionIndex,
                            text,
                            analysis.Relevancy,
                            analysis.Analysis,
                            analysis.ImpliedAnswer
                        );
                    } else {
                        updateResponse(currentQuestionIndex, text, null, null, null);
                    }
                })
                .catch(error => {
                    console.error('Relevancy Analysis Error:', error);
                    updateResponse(currentQuestionIndex, text, null, null, null);
                });
        }
    }
};

recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    isListening = false;
    startBtn.textContent = 'Start Listening';
    startBtn.classList.remove('listening');
};

recognition.onend = () => {
    if (isListening) {
        recognition.start();
    }
};

// Text to speech function
function synthesizeSpeech(text) {
    if (!polly) {
        console.error('Polly not initialized');
        return;
    }

    const params = {
        OutputFormat: "mp3",
        SampleRate: "24000",
        Text: `<speak>${text}</speak>`,
        TextType: "ssml",
        VoiceId: "Ruth",
        Engine: "neural"
    };

    polly.synthesizeSpeech(params, (err, data) => {
        if (err) {
            console.error('Error synthesizing speech:', err);
        } else {
            if (data.AudioStream instanceof Uint8Array) {
                const blob = new Blob([data.AudioStream], { type: 'audio/mpeg' });
                const url = URL.createObjectURL(blob);
                const audio = document.getElementById('audioPlayback');
                audio.src = url;
                audio.play();
            }
        }
    });
}


// Function to check answer relevancy using API Gateway
async function checkAnswerRelevancy(question, answer) {
    //const API_URL = 'https://t6wwkcj02h.execute-api.us-east-1.amazonaws.com/prod/generate';

    const prompt = `Question: "${question}"
Answer: "${answer}"

Task: Evaluate if this answer is relevant to the question asked. Match the informal words such as "nope", "yeap", "yup", "nah", "uh-huh" to their standard equivalent "yes" or "no". An ideal answer should map to a "Yes" or "No". Consider:
1. Does the answer directly address the question?
2. Is the response on topic?

Provide your response in JSON format with exactly these three fields:
{
    "Analysis": "Your detailed analysis of the answer here",
    "Relevancy": <number between 1-10>
    "ImpliedAnswer": "Yes" or "No"
}

The Analysis should be a brief evaluation of the answer's relevance and quality. The Relevancy should be a single number between 1-10, where 10 means perfectly relevant and comprehensive, and 1 means completely irrelevant or off-topic.
Do not include any other details other than the JSON string. Do not include "Here is my analysis" or "Here is my analysis in JSON format" any other text in the response.

<good_example>
{
    "Analysis": "The answer is relevant and comprehensive. It directly addresses the question and provides a clear yes/no answer. However, it does not provide any specific details or examples.",
    "Relevancy": 9,
    "ImpliedAnswer": "Yes"
}
</good_example>

<good_example_2>
{
    "Analysis": "The answer is relevant and comprehensive. It directly addresses the question and provides a clear yes/no answer.",
    "Relevancy": 10,
    "ImpliedAnswer": "No"
}
</good_example_2>


<bad_example>
Here is my analysis in JSON format: 
{
    "Analysis": "The answer is relevant and comprehensive. It directly addresses the question and provides a clear yes/no answer. However, it does not provide any specific details or examples.",
    "Relevancy": 9
    "ImpliedAnswer": "Yes"
}
</bad_example>

<bad_example>
Here is my analysis: 
{
    "Analysis": "The answer is relevant and comprehensive. It directly addresses the question and provides a clear yes/no answer. However, it does not provide any specific details or examples.",
    "Relevancy": 9
    "ImpliedAnswer": "Yes"
}
</bad_example>
`;

    try {
        const response = await fetch(`${config.apiEndpoint}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ prompt: prompt })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API response data:', data);

        if (data.response) {
            try {
                // Extract JSON from the response string
                const jsonMatch = data.response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonStr = jsonMatch[0];
                    const analysisData = JSON.parse(jsonStr);
                    console.log('Parsed Analysis Data:', analysisData);
                    return analysisData;
                }
            } catch (parseError) {
                console.error('Error parsing JSON response:', parseError);
                return null;
            }
        }
    } catch (error) {
        console.error('Error checking answer relevancy:', error);
        return null;
    }

}

// Event listeners
startBtn.addEventListener('click', toggleListening);
nextBtn.addEventListener('click', nextQuestion);
prevBtn.addEventListener('click', previousQuestion);

// Initialize the interface
initializeResponsesList();
displayCurrentQuestion();
updateNavigationButtons();
