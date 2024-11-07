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
            analysis: null,  // Add analysis field
            id: item.id,
            category: item.category
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
// In your JavaScript, modify the initializeResponsesList function:
function initializeResponsesList() {
    responsesList.innerHTML = INTERVIEW_DATA.map((item, index) => `
        <div class="response-item ${item.status}" id="response-${index}">
            <div class="question-number">Question ${index + 1}</div>
            <div class="question-text"><strong>Q: ${item.question}</strong></div>
            <div class="answer-text" id="answer-${index}">A: ${item.answer}</div>
            <div class="analysis-text" id="analysis-${index}">
                ${item.analysis ? `Analysis: ${item.analysis}` : ''}
            </div>
            <div class="relevancy-score" id="relevancy-${index}">
                ${item.relevancyScore ? `Relevancy Score: ${item.relevancyScore}/10` : ''}
            </div>
            <div class="status-indicator" id="status-${index}">
                ${item.status === 'completed' ? '&#x2714;' : '&#x25CB;'}
            </div>
        </div>
    `).join('');
}



// And in the updateResponse function:
function updateResponse(index, answer, relevancyScore, analysis) {
    INTERVIEW_DATA[index].answer = answer;
    INTERVIEW_DATA[index].status = 'completed';
    INTERVIEW_DATA[index].relevancyScore = relevancyScore;
    INTERVIEW_DATA[index].analysis = analysis;

    const answerElement = document.getElementById(`answer-${index}`);
    const responseItem = document.getElementById(`response-${index}`);
    const statusIndicator = document.getElementById(`status-${index}`);
    const relevancyElement = document.getElementById(`relevancy-${index}`);
    const analysisElement = document.getElementById(`analysis-${index}`);

    if (answerElement && responseItem && statusIndicator && relevancyElement && analysisElement) {
        answerElement.textContent = `A: ${answer}`;
        responseItem.classList.remove('pending');
        responseItem.classList.add('completed');
        statusIndicator.innerHTML = '&#x2714;'; // Checkmark
        relevancyElement.textContent = `Relevancy Score: ${relevancyScore}/10`;
        analysisElement.textContent = `Analysis: ${analysis}`;

        // Add color coding based on relevancy score
        relevancyElement.className = 'relevancy-score ' +
            (relevancyScore >= 8 ? 'high-relevancy' :
                relevancyScore >= 5 ? 'medium-relevancy' :
                    'low-relevancy');
    }
}


// Display current question
function displayCurrentQuestion() {
    if (INTERVIEW_DATA.length > 0) {
        const currentQuestion = INTERVIEW_DATA[currentQuestionIndex].question;
        questionDisplay.textContent = currentQuestion;

        // Highlight current question in the list
        document.querySelectorAll('.response-item').forEach((item, index) => {
            if (index === currentQuestionIndex) {
                item.classList.add('current');
            } else {
                item.classList.remove('current');
            }
        });
    }
}

// Update navigation buttons
function updateNavigationButtons() {
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === INTERVIEW_DATA.length - 1;
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

// Navigation handlers
// Modify the nextQuestion and previousQuestion functions to not automatically speak
function nextQuestion() {
    if (currentQuestionIndex < INTERVIEW_DATA.length - 1) {
        currentQuestionIndex++;
        displayCurrentQuestion();
        updateNavigationButtons();
        // Only speak if we're currently listening
        if (isListening) {
            synthesizeSpeech(INTERVIEW_DATA[currentQuestionIndex].question);
        }
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayCurrentQuestion();
        updateNavigationButtons();
        // Only speak if we're currently listening
        if (isListening) {
            synthesizeSpeech(INTERVIEW_DATA[currentQuestionIndex].question);
        }
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


// Modify the recognition.onresult handler to include relevancy check
// Update the recognition.onresult handler
recognition.onresult = (event) => {
    const last = event.results.length - 1;
    const text = event.results[last][0].transcript;
    output.textContent = text;

    if (event.results[last].isFinal) {
        const currentQuestion = INTERVIEW_DATA[currentQuestionIndex].question;

        checkAnswerRelevancy(currentQuestion, text)
            .then(analysis => {
                if (analysis) {
                    updateResponse(
                        currentQuestionIndex,
                        text,
                        analysis.Relevancy,
                        analysis.Analysis  // Assuming the API returns an Analysis field
                    );
                } else {
                    updateResponse(currentQuestionIndex, text, null, null);
                }
            })
            .catch(error => {
                console.error('Relevancy Analysis Error:', error);
                updateResponse(currentQuestionIndex, text, null, null);
            });
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

Provide your response in JSON format with exactly these two fields:
{
    "Analysis": "Your detailed analysis of the answer here",
    "Relevancy": <number between 1-10>
}

The Analysis should be a brief evaluation of the answer's relevance and quality. The Relevancy should be a single number between 1-10, where 10 means perfectly relevant and comprehensive, and 1 means completely irrelevant or off-topic.
Do not include any other details other than the JSON string. Do not include "Here is my analysis" or "Here is my analysis in JSON format" any other text in the response.

<good_example>
{
    "Analysis": "The answer is relevant and comprehensive. It directly addresses the question and provides a clear yes/no answer. However, it does not provide any specific details or examples.",
    "Relevancy": 9
}
</good_example>

<bad_example>
Here is my analysis in JSON format: 
{
    "Analysis": "The answer is relevant and comprehensive. It directly addresses the question and provides a clear yes/no answer. However, it does not provide any specific details or examples.",
    "Relevancy": 9
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

        console.log('API response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API response data:', data);

        if (data.response) {
            try {
                // If data.response is a string containing JSON, parse it
                // If it's already an object, just return it
                const analysisData = typeof data.response === 'string'
                    ? JSON.parse(data.response)
                    : data.response;

                console.log('Answer Analysis:', {
                    question,
                    answer,
                    analysis: analysisData.Analysis,
                    relevancy: analysisData.Relevancy,
                    timestamp: new Date().toISOString()
                });
                return analysisData;
            } catch (parseError) {
                console.error('Error parsing JSON response:', parseError);
                return {
                    Analysis: data.response,
                    Relevancy: 0
                };
            }
        } else {
            console.error('No response in data:', data);
            return null;
        }
    } catch (error) {
        console.error('Error checking answer relevancy:', error);
        console.error('Error stack:', error.stack);
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
