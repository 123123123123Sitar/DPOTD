const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxkGRgLvAMg4UhU-vWO21b7TbW2Ms-wJhCpA5rB0U0sE-ZNQ-eEBUaRfOV8sA0ag47/exec';

let startTime;
let timerInterval;
let questionsData;
let q1StartTime, q2StartTime, q3StartTime;
let exitCount = 0;
let exitLogs = [];
let testActive = false;
let currentDay = null;
const TEST_DURATION = 120 * 60 * 1000; // 2 hours in milliseconds

function showStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.className = 'status ' + type;
    el.style.display = 'block';
}

function showLoading(message) {
    const modal = document.getElementById('loadingModal');
    const text = document.getElementById('loadingText');
    text.textContent = message;
    modal.classList.add('show');
}

function hideLoading() {
    const modal = document.getElementById('loadingModal');
    modal.classList.remove('show');
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function recordViolation(type) {
    if (!testActive) return;
    
    exitCount++;
    exitLogs.push({
        time: new Date().toISOString(),
        type: type
    });
    
    document.getElementById('violationCount').textContent = exitCount;
    
    // Show warning overlay
    const overlay = document.getElementById('warningOverlay');
    overlay.classList.add('show');
}

function hideWarning() {
    document.getElementById('warningOverlay').classList.remove('show');
}

// Request fullscreen
function enterFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(err => {
            console.log('Fullscreen error:', err);
        });
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    }
}

// Monitor fullscreen changes
document.addEventListener('fullscreenchange', function() {
    if (!document.fullscreenElement && testActive) {
        recordViolation('exited_fullscreen');
        enterFullscreen();
    }
});

document.addEventListener('webkitfullscreenchange', function() {
    if (!document.webkitFullscreenElement && testActive) {
        recordViolation('exited_fullscreen');
        enterFullscreen();
    }
});

// Monitor visibility changes (tab switching, minimizing)
document.addEventListener('visibilitychange', function() {
    if (document.hidden && testActive) {
        recordViolation('tab_hidden');
    } else if (!document.hidden && testActive) {
        hideWarning();
    }
});

// Monitor window blur (switching to another application)
window.addEventListener('blur', function() {
    if (testActive) {
        recordViolation('window_blur');
    }
});

// Return to window
window.addEventListener('focus', function() {
    if (testActive) {
        hideWarning();
    }
});

// Prevent ALL tab switching and common shortcuts during test
document.addEventListener('keydown', function(e) {
    if (testActive) {
        // Block tab switching shortcuts
        if ((e.ctrlKey && e.keyCode === 9) || // Ctrl+Tab
            (e.ctrlKey && e.shiftKey && e.keyCode === 9) || // Ctrl+Shift+Tab
            (e.altKey && e.keyCode === 9) || // Alt+Tab
            (e.metaKey && e.keyCode === 9) || // Cmd+Tab (Mac)
            (e.metaKey && e.keyCode === 192) || // Cmd+` (Mac)
            (e.ctrlKey && (e.keyCode >= 49 && e.keyCode <= 57)) || // Ctrl+1-9
            (e.metaKey && (e.keyCode >= 49 && e.keyCode <= 57)) || // Cmd+1-9 (Mac)
            e.keyCode === 123 || // F12
            (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // Ctrl+Shift+I/J/C
            (e.ctrlKey && e.keyCode === 85) || // Ctrl+U
            (e.metaKey && e.altKey && (e.keyCode === 73 || e.keyCode === 74)) || // Cmd+Option+I/J (Mac)
            (e.altKey && e.keyCode === 37) || // Alt+Left Arrow
            (e.altKey && e.keyCode === 39) || // Alt+Right Arrow
            (e.ctrlKey && e.keyCode === 87) || // Ctrl+W
            (e.metaKey && e.keyCode === 87) || // Cmd+W (Mac)
            e.keyCode === 27) { // Escape key
            
            e.preventDefault();
            e.stopPropagation();
            recordViolation('keyboard_shortcut_blocked');
            return false;
        }
    }
});

// Prevent right-click during test
document.addEventListener('contextmenu', function(e) {
    if (testActive) {
        e.preventDefault();
        recordViolation('right_click');
    }
});

// Get current day based on schedule
async function getCurrentDay() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSchedule`);
        const schedule = await response.json();
        
        const now = new Date();
        let activeDay = null;
        
        // Check which day is currently active
        for (let i = 1; i <= 5; i++) {
            const dayStart = schedule[`day${i}`] ? new Date(schedule[`day${i}`]) : null;
            const nextDay = schedule[`day${i + 1}`] ? new Date(schedule[`day${i + 1}`]) : null;
            
            if (dayStart && now >= dayStart) {
                if (!nextDay || now < nextDay) {
                    activeDay = i;
                    break;
                }
            }
        }
        
        return activeDay;
    } catch (error) {
        console.error('Error getting current day:', error);
        return null;
    }
}

async function startTest() {
    const name = document.getElementById('studentName').value.trim();
    const email = document.getElementById('studentEmail').value.trim();
    const emailError = document.getElementById('emailError');

    // Clear previous error
    emailError.textContent = '';

    if (!name || !email) {
        showStatus('startStatus', 'Please fill in all fields', 'error');
        return;
    }

    // Validate email format
    if (!validateEmail(email)) {
        emailError.textContent = 'Please enter a valid email address (e.g., student@example.com)';
        showStatus('startStatus', 'Invalid email format', 'error');
        return;
    }

    showLoading('Determining current day...');

    // Get current day
    currentDay = await getCurrentDay();
    
    if (!currentDay) {
        hideLoading();
        showStatus('startStatus', 'No test is currently available. Please check the schedule.', 'error');
        return;
    }

    showLoading(`Loading Day ${currentDay} questions...`);

    try {
        // Check if already submitted
        const checkResponse = await fetch(`${SCRIPT_URL}?action=checkSubmission&email=${encodeURIComponent(email)}&day=${currentDay}`);
        const checkData = await checkResponse.json();
        
        if (checkData.exists) {
            hideLoading();
            showStatus('startStatus', 'You have already submitted this test!', 'error');
            return;
        }

        // Get questions
        showLoading('Loading questions...');
        const response = await fetch(`${SCRIPT_URL}?action=getQuestions&day=${currentDay}`);
        questionsData = await response.json();

        if (questionsData.error) {
            hideLoading();
            showStatus('startStatus', 'Error: ' + questionsData.error, 'error');
            return;
        }

        // Display questions
        document.getElementById('q1Text').textContent = questionsData.q1_text;
        document.getElementById('q2Text').textContent = questionsData.q2_text;
        document.getElementById('q3Text').textContent = questionsData.q3_text;
        document.getElementById('dayIndicator').textContent = `Day ${currentDay}`;

        hideLoading();

        // Hide form, show questions
        document.getElementById('studentForm').style.display = 'none';
        document.getElementById('questionSection').style.display = 'block';
        
        // Enter fullscreen mode
        enterFullscreen();
        
        // Lock the page
        document.body.classList.add('locked');
        testActive = true;

        // Start timer
        startTime = Date.now();
        q1StartTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);
        
        // Update timer immediately
        updateTimer();

        // Track question transitions
        document.getElementById('q1Answer').addEventListener('focus', () => {
            if (!q2StartTime) q2StartTime = Date.now();
        });
        document.getElementById('q2Answer').addEventListener('focus', () => {
            if (!q3StartTime) q3StartTime = Date.now();
        });

        // Auto-submit after 2 hours
        setTimeout(() => {
            if (testActive) {
                alert('Time is up! Your test will be submitted automatically.');
                submitTest(true);
            }
        }, TEST_DURATION);

    } catch (error) {
        hideLoading();
        showStatus('startStatus', 'Error connecting to server: ' + error.message, 'error');
        console.error('Error:', error);
    }
}

function updateTimer() {
    if (!startTime) return;
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, TEST_DURATION - elapsed);
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    
    const timerEl = document.getElementById('timer');
    timerEl.textContent = `Time Remaining: ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timerEl.style.display = 'block';
    timerEl.style.color = '#000000'; // Black text
    
    // Change color when time is running out
    if (remaining < 10 * 60 * 1000) { // Less than 10 minutes
        timerEl.style.color = '#ff6b6b';
    }
    
    if (remaining <= 0) {
        clearInterval(timerInterval);
        submitTest(true);
    }
}

// Clean answer to only accept numbers
function cleanAnswer(answer) {
    // Remove all non-numeric characters except minus sign at the beginning
    return answer.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
}

async function submitTest(isForced = false) {
    if (!testActive && !isForced) {
        console.log('Test not active, submission blocked');
        return;
    }

    const name = document.getElementById('studentName').value.trim();
    const email = document.getElementById('studentEmail').value.trim();
    const q1Answer = cleanAnswer(document.getElementById('q1Answer').value.trim());
    const q2Answer = cleanAnswer(document.getElementById('q2Answer').value.trim());
    const q3Answer = document.getElementById('q3Answer').value.trim();

    if (!isForced && (!q1Answer || !q2Answer || !q3Answer)) {
        showStatus('submitStatus', 'Please answer all questions', 'error');
        return;
    }

    testActive = false;
    clearInterval(timerInterval);
    const endTime = Date.now();
    const totalTime = Math.floor((endTime - startTime) / 1000);
    const q1Time = q2StartTime ? Math.floor((q2StartTime - q1StartTime) / 1000) : totalTime;
    const q2Time = q3StartTime ? Math.floor((q3StartTime - q2StartTime) / 1000) : 0;
    const q3Time = Math.floor((endTime - (q3StartTime || q2StartTime || q1StartTime)) / 1000);

    // Check answers (clean both before comparing)
    const q1Correct = q1Answer === cleanAnswer(questionsData.q1_answer);
    const q2Correct = q2Answer === cleanAnswer(questionsData.q2_answer);

    const submission = {
        studentName: name,
        studentEmail: email,
        day: currentDay,
        q1_answer: q1Answer,
        q2_answer: q2Answer,
        q3_answer: q3Answer,
        q1_correct: q1Correct,
        q2_correct: q2Correct,
        q1_time: q1Time,
        q2_time: q2Time,
        q3_time: q3Time,
        totalTime: totalTime,
        exitCount: exitCount,
        exitLogs: JSON.stringify(exitLogs),
        workFileURL: ''
    };

    showLoading(isForced ? 'Auto-submitting test...' : 'Submitting your answers...');
    document.getElementById('submitBtn').disabled = true;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify(submission)
        });

        const result = await response.json();

        hideLoading();

        if (result.success) {
            showStatus('submitStatus', isForced ? 
                '⚠️ Test auto-submitted (time expired)!' : 
                '✅ Test submitted successfully!', 
                isForced ? 'error' : 'success');
            document.body.classList.remove('locked');
            hideWarning();
            
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            // Hide question section after successful submit
            document.getElementById('questionSection').style.display = 'none';
            document.getElementById('studentForm').style.display = 'block';
        } else {
            showStatus('submitStatus', 'Error: ' + (result.error || 'Unknown error'), 'error');
            testActive = true; // Re-enable test if submission failed
            document.getElementById('submitBtn').disabled = false;
        }
    } catch (error) {
        hideLoading();
        showStatus('submitStatus', 'Error submitting: ' + error.message, 'error');
        console.error('Error:', error);
        testActive = true; // Re-enable test if submission failed
        document.getElementById('submitBtn').disabled = false;
    }
}

// Warn before leaving page
window.addEventListener('beforeunload', function(e) {
    if (testActive) {
        e.preventDefault();
        e.returnValue = '';
        recordViolation('attempted_close');
        return '';
    }
});

// Add input validation for number-only fields
document.addEventListener('DOMContentLoaded', function() {
    const numberInputs = ['q1Answer', 'q2Answer'];
    numberInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function(e) {
                const cleaned = cleanAnswer(e.target.value);
                if (e.target.value !== cleaned) {
                    e.target.value = cleaned;
                }
            });
        }
    });
});
