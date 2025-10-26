const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyGaOdYIwixdsGcYCqrqPG_G8O75M8eg2KURcXUstmKM_MA-R76bxTZTGHcj-cFVqKBmg/exec';
const ADMIN_USERNAME = 'meipetersgoat';
const ADMIN_PASSWORD = 'SitarsTheGOAT!';

let cachedSubmissions = [];
let filteredSubmissions = [];
let currentSubmissionIndex = 0;
let isAuthenticated = false;
let latexUpdateTimers = {};

// Password Protection Functions
function checkPassword() {
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;
    const loginError = document.getElementById('loginError');
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        isAuthenticated = true;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        loadQuestions();
        loadSettings();
    } else {
        loginError.textContent = 'Incorrect username or password';
        loginError.style.display = 'block';
        document.getElementById('usernameInput').value = '';
        document.getElementById('passwordInput').value = '';
    }
}

function handlePasswordKeyPress(event) {
    if (event.key === 'Enter') {
        checkPassword();
    }
}

// Status Display
function showStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.className = 'status ' + type;
    el.style.display = 'block';
}

// Tab Switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'questions') loadQuestions();
    if (tabName === 'schedule') loadSchedule();
    if (tabName === 'settings') loadSettings();
    if (tabName === 'submissions') loadSubmissions();
    if (tabName === 'users') loadUsers();
}

// Image Upload Handler
function handleImageUpload(questionNum) {
    const input = document.getElementById(`q${questionNum}Image`);
    const preview = document.getElementById(`q${questionNum}ImagePreview`);
    const dataField = document.getElementById(`q${questionNum}ImageData`);
    
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        input.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        dataField.value = base64;
        preview.innerHTML = `
            <img src="${base64}" alt="Question ${questionNum} Image">
            <button onclick="removeImage(${questionNum})" style="margin-top: 10px; padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Remove Image</button>
        `;
    };
    reader.readAsDataURL(file);
}

function removeImage(questionNum) {
    document.getElementById(`q${questionNum}Image`).value = '';
    document.getElementById(`q${questionNum}ImageData`).value = '';
    document.getElementById(`q${questionNum}ImagePreview`).innerHTML = '';
}

// Questions Management
async function loadQuestions() {
    if (!isAuthenticated) return;
    
    const day = document.getElementById('questionDay').value;
    
    if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_DEPLOYMENT_ID')) {
        showStatus('questionStatus', 'Error: Script URL not configured', 'error');
        return;
    }

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getQuestions&day=${day}`);
        const data = await response.json();
        
        if (data.error) {
            document.getElementById('q1Text').value = '';
            document.getElementById('q1Answer').value = '';
            document.getElementById('q1ImageData').value = '';
            document.getElementById('q1ImagePreview').innerHTML = '';
            document.getElementById('q2Text').value = '';
            document.getElementById('q2Answer').value = '';
            document.getElementById('q2ImageData').value = '';
            document.getElementById('q2ImagePreview').innerHTML = '';
            document.getElementById('q3Text').value = '';
            document.getElementById('q3Answer').value = '';
            document.getElementById('q3ImageData').value = '';
            document.getElementById('q3ImagePreview').innerHTML = '';
        } else {
            document.getElementById('q1Text').value = data.q1_text || '';
            document.getElementById('q1Answer').value = data.q1_answer || '';
            if (data.q1_image) {
                document.getElementById('q1ImageData').value = data.q1_image;
                document.getElementById('q1ImagePreview').innerHTML = `
                    <img src="${data.q1_image}" alt="Question 1 Image">
                    <button onclick="removeImage(1)" style="margin-top: 10px; padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Remove Image</button>
                `;
            }
            
            document.getElementById('q2Text').value = data.q2_text || '';
            document.getElementById('q2Answer').value = data.q2_answer || '';
            if (data.q2_image) {
                document.getElementById('q2ImageData').value = data.q2_image;
                document.getElementById('q2ImagePreview').innerHTML = `
                    <img src="${data.q2_image}" alt="Question 2 Image">
                    <button onclick="removeImage(2)" style="margin-top: 10px; padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Remove Image</button>
                `;
            }
            
            document.getElementById('q3Text').value = data.q3_text || '';
            document.getElementById('q3Answer').value = data.q3_answer || '';
            if (data.q3_image) {
                document.getElementById('q3ImageData').value = data.q3_image;
                document.getElementById('q3ImagePreview').innerHTML = `
                    <img src="${data.q3_image}" alt="Question 3 Image">
                    <button onclick="removeImage(3)" style="margin-top: 10px; padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Remove Image</button>
                `;
            }
        }
    } catch (error) {
        showStatus('questionStatus', 'Error loading questions: ' + error.message, 'error');
    }
}

async function saveQuestions() {
    if (!isAuthenticated) return;
    
    const day = document.getElementById('questionDay').value;
    const data = {
        action: 'saveQuestions',
        day: day,
        q1_text: document.getElementById('q1Text').value,
        q1_answer: document.getElementById('q1Answer').value,
        q1_image: document.getElementById('q1ImageData').value || '',
        q2_text: document.getElementById('q2Text').value,
        q2_answer: document.getElementById('q2Answer').value,
        q2_image: document.getElementById('q2ImageData').value || '',
        q3_text: document.getElementById('q3Text').value,
        q3_answer: document.getElementById('q3Answer').value,
        q3_image: document.getElementById('q3ImageData').value || ''
    };

    showStatus('questionStatus', 'Saving...', 'info');

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('questionStatus', '✅ Questions saved successfully!', 'success');
        } else {
            showStatus('questionStatus', 'Error: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showStatus('questionStatus', 'Error saving: ' + error.message, 'error');
    }
}

// Schedule Management
async function loadSchedule() {
    if (!isAuthenticated) return;
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSchedule`);
        const data = await response.json();
        
        for (let i = 1; i <= 5; i++) {
            const value = data[`day${i}`];
            if (value) {
                const date = new Date(value);
                const formatted = date.toISOString().slice(0, 10);
                document.getElementById(`day${i}`).value = formatted;
            }
        }
    } catch (error) {
        showStatus('scheduleStatus', 'Error loading schedule: ' + error.message, 'error');
    }
}

async function saveSchedule() {
    if (!isAuthenticated) return;
    
    const data = {
        action: 'saveSchedule'
    };
    
    let prevDate = null;
    
    for (let i = 1; i <= 5; i++) {
        const value = document.getElementById(`day${i}`).value;
        if (value) {
            const date = new Date(value);
            
            if (prevDate) {
                const diffTime = date - prevDate;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                
                if (diffDays < 1) {
                    showStatus('scheduleStatus', `Day ${i} must be at least 24 hours after Day ${i-1}`, 'error');
                    return;
                }
            }
            
            date.setHours(0, 0, 0, 0);
            data[`day${i}`] = date.toISOString().replace('T', ' ').slice(0, 19);
            prevDate = date;
        }
    }

    showStatus('scheduleStatus', 'Saving...', 'info');

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('scheduleStatus', '✅ Schedule saved successfully!', 'success');
        } else {
            showStatus('scheduleStatus', 'Error: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showStatus('scheduleStatus', 'Error saving: ' + error.message, 'error');
    }
}

// Settings Management
async function loadSettings() {
    if (!isAuthenticated) return;
    
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSettings`);
        const data = await response.json();
        
        document.getElementById('adminName').value = data['Admin Name'] || '';
        document.getElementById('adminEmail').value = data['Admin Email'] || '';
        document.getElementById('adminUsername').value = data['Admin Username'] || ADMIN_USERNAME;
        document.getElementById('adminPasswordField').value = data['Admin Password'] || ADMIN_PASSWORD;
        document.getElementById('testDuration').value = data['Test Duration'] || 120;
    } catch (error) {
        showStatus('settingsStatus', 'Error loading settings: ' + error.message, 'error');
    }
}

async function saveSettings() {
    if (!isAuthenticated) return;
    
    const data = {
        action: 'saveSettings',
        'Admin Name': document.getElementById('adminName').value,
        'Admin Email': document.getElementById('adminEmail').value,
        'Admin Username': document.getElementById('adminUsername').value,
        'Admin Password': document.getElementById('adminPasswordField').value,
        'Test Duration': document.getElementById('testDuration').value
    };

    showStatus('settingsStatus', 'Saving...', 'info');

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('settingsStatus', '✅ Settings saved successfully! Please refresh to use new credentials.', 'success');
        } else {
            showStatus('settingsStatus', 'Error: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showStatus('settingsStatus', 'Error saving: ' + error.message, 'error');
    }
}

// LaTeX Preview Update
function updateLatexPreview(rowIndex) {
    if (latexUpdateTimers[rowIndex]) clearTimeout(latexUpdateTimers[rowIndex]);
    
    latexUpdateTimers[rowIndex] = setTimeout(() => {
        const input = document.getElementById(`feedback_latex_${rowIndex}`).value;
        const preview = document.getElementById(`feedback_preview_${rowIndex}`);
        
        if (!input.trim()) {
            preview.innerHTML = '<p style="color: #999;">Your formatted feedback will appear here...</p>';
            return;
        }
        
        let content = input;
        
        content = content.replace(/\\documentclass\{[^}]+\}/g, '');
        content = content.replace(/\\usepackage\{[^}]+\}/g, '');
        content = content.replace(/\\title\{[^}]*\}/g, '');
        content = content.replace(/\\author\{[^}]*\}/g, '');
        content = content.replace(/\\date\{[^}]*\}/g, '');
        content = content.replace(/\\maketitle/g, '');
        
        const docMatch = content.match(/\\begin\{document\}([\s\S]*)\\end\{document\}/);
        if (docMatch) content = docMatch[1].trim();
        
        preview.innerHTML = content || '<p style="color: #999;">Write your feedback...</p>';
        
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetClear([preview]);
            MathJax.typesetPromise([preview]).catch((err) => {
                console.error('MathJax error:', err);
                preview.innerHTML += '<p style="color: #dc3545; font-size: 12px; margin-top: 10px;"><strong>⚠️ LaTeX Error:</strong> Check your syntax</p>';
            });
        }
    }, 500);
}

// Submissions Management
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

async function loadSubmissions() {
    if (!isAuthenticated) return;
    
    const container = document.getElementById('submissionsContainer');
    container.innerHTML = '<p style="color: #666;">Loading submissions...</p>';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSubmissions`);
        const submissions = await response.json();
        
        cachedSubmissions = submissions;
        
        if (submissions.error) {
            showStatus('submissionsStatus', 'Error: ' + submissions.error, 'error');
            return;
        }

        if (submissions.length === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No submissions yet.</p>';
            return;
        }

        // Populate filter dropdowns
        const studentFilter = document.getElementById('filterStudent');
        const uniqueStudents = [...new Set(submissions.map(s => s.studentEmail))];
        studentFilter.innerHTML = '<option value="all">All Students</option>';
        uniqueStudents.forEach(email => {
            const sub = submissions.find(s => s.studentEmail === email);
            studentFilter.innerHTML += `<option value="${email}">${sub.studentName} (${email})</option>`;
        });
        
        filterSubmissions();
        
    } catch (error) {
        showStatus('submissionsStatus', 'Error loading submissions: ' + error.message, 'error');
        container.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 40px;">Error loading submissions</p>';
    }
}

function filterSubmissions() {
    const dayFilter = document.getElementById('filterDay').value;
    const studentFilter = document.getElementById('filterStudent').value;
    
    filteredSubmissions = cachedSubmissions.filter(sub => {
        const dayMatch = dayFilter === 'all' || sub.day == dayFilter;
        const studentMatch = studentFilter === 'all' || sub.studentEmail === studentFilter;
        return dayMatch && studentMatch;
    });
    
    filteredSubmissions.reverse();
    
    if (filteredSubmissions.length === 0) {
        document.getElementById('submissionsContainer').innerHTML = '<p style="color: #666; text-align: center; padding: 40px;">No submissions match the filters.</p>';
        document.getElementById('navControls').style.display = 'none';
        return;
    }
    
    // Setup navigation
    currentSubmissionIndex = 0;
    populateSubmissionSelector();
    document.getElementById('navControls').style.display = 'flex';
    displayCurrentSubmission();
}

function populateSubmissionSelector() {
    const selector = document.getElementById('submissionSelector');
    selector.innerHTML = '';
    
    filteredSubmissions.forEach((sub, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${sub.studentName} - Day ${sub.day} - ${new Date(sub.timestamp).toLocaleDateString()}`;
        selector.appendChild(option);
    });
    
    selector.value = currentSubmissionIndex;
}

function selectSubmission() {
    currentSubmissionIndex = parseInt(document.getElementById('submissionSelector').value);
    displayCurrentSubmission();
}

function navigateSubmission(direction) {
    currentSubmissionIndex += direction;
    if (currentSubmissionIndex < 0) currentSubmissionIndex = 0;
    if (currentSubmissionIndex >= filteredSubmissions.length) currentSubmissionIndex = filteredSubmissions.length - 1;
    
    document.getElementById('submissionSelector').value = currentSubmissionIndex;
    displayCurrentSubmission();
}

function displayCurrentSubmission() {
    const container = document.getElementById('submissionsContainer');
    const sub = filteredSubmissions[currentSubmissionIndex];
    
    if (!sub) return;
    
    document.getElementById('prevBtn').disabled = currentSubmissionIndex === 0;
    document.getElementById('nextBtn').disabled = currentSubmissionIndex === filteredSubmissions.length - 1;
    
    const timestamp = new Date(sub.timestamp).toLocaleString();
    
    let exitLogs = [];
    try {
        exitLogs = typeof sub.exitLogs === 'string' ? JSON.parse(sub.exitLogs) : sub.exitLogs || [];
    } catch (e) {
        exitLogs = [];
    }
    
    let violationDetails = '';
    if (exitLogs.length > 0) {
        violationDetails = '<div class="violation-details"><strong>Violations:</strong><ul>';
        exitLogs.forEach(log => {
            const logTime = new Date(log.time).toLocaleTimeString();
            violationDetails += `<li>${logTime}: ${log.type}</li>`;
        });
        violationDetails += '</ul></div>';
    }
    
    const q1Points = sub.q1_correct ? 5 : 0;
    const q2Points = sub.q2_correct ? 5 : 0;
    const q3Points = sub.q3_score || 0;
    const totalPoints = q1Points + q2Points + parseInt(q3Points);
    
    const isGraded = sub.q3_score !== '' && sub.q3_score !== null && sub.q3_score !== undefined;
    const gradedBadge = isGraded ? 
        '<span class="graded-badge graded">Graded</span>' : 
        '<span class="graded-badge pending">Pending</span>';
    
    // Render student's Q3 answer with LaTeX
    let q3AnswerRendered = sub.q3_answer;
    
    const feedbackSection = `
        <div style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #EA5A2F;">
            <h4 style="margin-bottom: 15px; color: #EA5A2F;">Question 3 Grading</h4>
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-weight: 600; margin-bottom: 5px;">Score (out of 10):</label>
                <input type="number" id="score_${sub.rowIndex}" min="0" max="10" step="1" value="${sub.q3_score || ''}" 
                       style="width: 100px; padding: 8px; border: 2px solid #E3E3E3; border-radius: 4px;">
            </div>
            <div class="override-controls">
                <h4>Override Auto-Graded Questions:</h4>
                <div style="margin-top: 10px;">
                    <strong>Q1 (Currently: ${sub.q1_correct ? '✓ Correct' : '✗ Incorrect'}):</strong>
                    <div class="override-buttons" style="margin-top: 5px;">
                        <button class="override-btn correct" onclick="overrideScore(${sub.rowIndex}, 1, true)">Mark Correct</button>
                        <button class="override-btn incorrect" onclick="overrideScore(${sub.rowIndex}, 1, false)">Mark Incorrect</button>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <strong>Q2 (Currently: ${sub.q2_correct ? '✓ Correct' : '✗ Incorrect'}):</strong>
                    <div class="override-buttons" style="margin-top: 5px;">
                        <button class="override-btn correct" onclick="overrideScore(${sub.rowIndex}, 2, true)">Mark Correct</button>
                        <button class="override-btn incorrect" onclick="overrideScore(${sub.rowIndex}, 2, false)">Mark Incorrect</button>
                    </div>
                </div>
            </div>
            <div style="margin-bottom: 15px; margin-top: 20px;">
                <label style="display: block; font-weight: 600; margin-bottom: 10px;">Feedback (LaTeX Supported):</label>
                <div class="latex-editor-container">
                    <div class="latex-input-section">
                        <h4>LaTeX Code</h4>
                        <textarea id="feedback_latex_${sub.rowIndex}" oninput="updateLatexPreview(${sub.rowIndex})"
                                  placeholder="Write your feedback using LaTeX here...">${sub.q3_feedback || ''}</textarea>
                    </div>
                    <div class="latex-preview-section">
                        <h4>Live Preview</h4>
                        <div id="feedback_preview_${sub.rowIndex}" class="preview-content">Your formatted feedback will appear here...</div>
                    </div>
                </div>
            </div>
            <button onclick="saveFeedback(${sub.rowIndex})" class="btn" style="width: auto; padding: 10px 20px;">
                Save Feedback & Notify Student
            </button>
        </div>
    `;
    
    container.innerHTML = `
        <div class="submission-card">
            <div class="submission-header">
                <h3>${sub.studentName} ${gradedBadge}</h3>
                <span style="color: #666;">Day ${sub.day}</span>
            </div>
            <div class="submission-details">
                <div class="detail-item">
                    <span class="detail-label">Email:</span> ${sub.studentEmail}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Submitted:</span> ${timestamp}
                </div>
                <div class="detail-item" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 10px;">
                    <strong style="font-size: 18px; color: #EA5A2F;">Total Score: ${totalPoints}/20</strong>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Q1 (5 points):</span> 
                    <span class="${sub.q1_correct ? 'correct' : 'incorrect'}">
                        ${sub.q1_correct ? '✓ Correct (+5 pts)' : '✗ Incorrect (0 pts)'}
                    </span> (Answer: ${sub.q1_answer}) - Time: ${formatTime(sub.q1_time)}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Q2 (5 points):</span> 
                    <span class="${sub.q2_correct ? 'correct' : 'incorrect'}">
                        ${sub.q2_correct ? '✓ Correct (+5 pts)' : '✗ Incorrect (0 pts)'}
                    </span> (Answer: ${sub.q2_answer}) - Time: ${formatTime(sub.q2_time)}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Q3 Score (10 points):</span> ${sub.q3_score !== '' && sub.q3_score !== null && sub.q3_score !== undefined ? `${sub.q3_score}/10 (+${sub.q3_score} pts)` : 'Not graded yet'}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Q3 Time:</span> ${formatTime(sub.q3_time)}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Q3 Answer (Student's LaTeX):</span> 
                    <div id="student_answer_${sub.rowIndex}" style="margin-top: 10px; padding: 15px; background: white; border-radius: 4px; white-space: pre-wrap; max-height: 400px; overflow-y: auto; border: 2px solid #E3E3E3;">${q3AnswerRendered}</div>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Total Time:</span> ${formatTime(sub.totalTime)}
                </div>
                <div class="detail-item">
                    <span class="detail-label">Exit Count:</span> 
                    <span style="color: ${sub.exitCount > 0 ? '#dc3545' : '#28a745'}; font-weight: bold;">
                        ${sub.exitCount}
                    </span>
                </div>
                ${violationDetails}
            </div>
            ${feedbackSection}
        </div>
    `;
    
    // Render student's LaTeX answer
    if (window.MathJax) {
        setTimeout(() => {
            const answerDiv = document.getElementById(`student_answer_${sub.rowIndex}`);
            if (answerDiv) {
                MathJax.typesetPromise([answerDiv]).catch(e => console.log(e));
            }
        }, 100);
    }
    
    if (sub.q3_feedback) {
        setTimeout(() => updateLatexPreview(sub.rowIndex), 100);
    }
    
    showStatus('submissionsStatus', `Viewing submission ${currentSubmissionIndex + 1} of ${filteredSubmissions.length}`, 'info');
}

async function overrideScore(rowIndex, questionNum, isCorrect) {
    if (!confirm(`Are you sure you want to mark Q${questionNum} as ${isCorrect ? 'CORRECT' : 'INCORRECT'}?`)) {
        return;
    }
    
    const data = {
        action: 'overrideScore',
        rowIndex: rowIndex,
        questionNum: questionNum,
        isCorrect: isCorrect
    };
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Q${questionNum} marked as ${isCorrect ? 'correct' : 'incorrect'}!`);
            loadSubmissions();
        } else {
            alert('Error: ' + (result.error || 'Failed to override score'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function saveFeedback(rowIndex) {
    const scoreInput = document.getElementById(`score_${rowIndex}`);
    const score = scoreInput.value;
    const feedback = document.getElementById(`feedback_latex_${rowIndex}`).value;
    
    if (!score || !feedback) {
        alert('Please enter both score and feedback');
        return;
    }
    
    const scoreNum = parseInt(score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 10) {
        alert('Score must be a whole number between 0 and 10');
        return;
    }
    
    scoreInput.value = scoreNum;
    
    const data = {
        action: 'updateFeedback',
        rowIndex: rowIndex,
        q3_score: scoreNum,
        q3_feedback: feedback
    };
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Feedback saved and student notified!');
            loadSubmissions();
        } else {
            alert('Error: ' + (result.error || 'Failed to save feedback'));
        }
    } catch (error) {
        alert('Error saving feedback: ' + error.message);
    }
}

// CSV Export
function exportToCSV() {
    if (!isAuthenticated) return;
    
    if (cachedSubmissions.length === 0) {
        alert('No submissions to export. Please load submissions first.');
        return;
    }

    const headers = [
        'Student Name',
        'Email',
        'Day',
        'Timestamp',
        'Q1 Answer',
        'Q1 Correct',
        'Q1 Points',
        'Q1 Time (s)',
        'Q2 Answer',
        'Q2 Correct',
        'Q2 Points',
        'Q2 Time (s)',
        'Q3 Answer',
        'Q3 Time (s)',
        'Q3 Score',
        'Q3 Feedback',
        'Total Points',
        'Total Time (s)',
        'Exit Count',
        'Violations'
    ];

    const rows = cachedSubmissions.map(sub => {
        let exitLogs = [];
        try {
            exitLogs = typeof sub.exitLogs === 'string' ? JSON.parse(sub.exitLogs) : sub.exitLogs || [];
        } catch (e) {
            exitLogs = [];
        }
        
        const violations = exitLogs.map(log => `${log.time}: ${log.type}`).join('; ');
        
        const q1Points = sub.q1_correct ? 5 : 0;
        const q2Points = sub.q2_correct ? 5 : 0;
        const q3Points = sub.q3_score || 0;
        const totalPoints = q1Points + q2Points + parseInt(q3Points);
        
        return [
            sub.studentName,
            sub.studentEmail,
            sub.day,
            sub.timestamp,
            sub.q1_answer,
            sub.q1_correct,
            q1Points,
            sub.q1_time,
            sub.q2_answer,
            sub.q2_correct,
            q2Points,
            sub.q2_time,
            `"${sub.q3_answer.replace(/"/g, '""')}"`,
            sub.q3_time,
            sub.q3_score || '',
            `"${(sub.q3_feedback || '').replace(/"/g, '""')}"`,
            totalPoints,
            sub.totalTime,
            sub.exitCount,
            `"${violations}"`
        ];
    });

    const csv = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dpotd_submissions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// User Management
async function loadUsers() {
    if (!isAuthenticated) return;
    
    const container = document.getElementById('usersContainer');
    container.innerHTML = '<p style="color: #666;">Loading users...</p>';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getUsers`);
        const users = await response.json();
        
        if (users.error) {
            showStatus('usersStatus', 'Error: ' + users.error, 'error');
            return;
        }

        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No users registered yet.</p>';
            return;
        }

        container.innerHTML = '';
        
        users.forEach(user => {
            const card = document.createElement('div');
            card.className = 'submission-card';
            
            const createdDate = new Date(user.created).toLocaleString();
            
            card.innerHTML = `
                <div class="submission-header">
                    <h3>${user.name}</h3>
                    <button onclick="deleteUser('${user.email}')" class="btn" 
                            style="width: auto; padding: 8px 16px; background: #dc3545; font-size: 14px;">
                        Delete User
                    </button>
                </div>
                <div class="submission-details">
                    <div class="detail-item">
                        <span class="detail-label">Email:</span> ${user.email}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Password:</span> ${user.password}
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Registered:</span> ${createdDate}
                    </div>
                </div>
            `;
            
            container.appendChild(card);
        });
        
        showStatus('usersStatus', `Loaded ${users.length} user(s)`, 'success');
    } catch (error) {
        showStatus('usersStatus', 'Error loading users: ' + error.message, 'error');
        container.innerHTML = '<p style="color: #dc3545; text-align: center; padding: 40px;">Error loading users</p>';
    }
}

async function addUser() {
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    
    if (!name || !email || !password) {
        showStatus('usersStatus', 'Please fill in all fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showStatus('usersStatus', 'Password must be at least 6 characters', 'error');
        return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showStatus('usersStatus', 'Invalid email format', 'error');
        return;
    }
    
    showStatus('usersStatus', 'Adding user...', 'info');
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action: 'adminAddUser',
                name: name,
                email: email,
                password: password
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('usersStatus', '✅ User added successfully!', 'success');
            document.getElementById('newUserName').value = '';
            document.getElementById('newUserEmail').value = '';
            document.getElementById('newUserPassword').value = '';
            loadUsers();
        } else {
            showStatus('usersStatus', 'Error: ' + (result.error || 'Failed to add user'), 'error');
        }
    } catch (error) {
        showStatus('usersStatus', 'Error: ' + error.message, 'error');
    }
}

async function deleteUser(email) {
    if (!confirm(`Are you sure you want to delete the user with email: ${email}?\n\nThis will also delete all their test submissions!`)) {
        return;
    }
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'deleteUser',
                email: email
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('usersStatus', '✅ User deleted successfully!', 'success');
            loadUsers();
        } else {
            showStatus('usersStatus', 'Error: ' + (result.error || 'Failed to delete user'), 'error');
        }
    } catch (error) {
        showStatus('usersStatus', 'Error: ' + error.message, 'error');
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    if (!SCRIPT_URL || SCRIPT_URL.includes('YOUR_DEPLOYMENT_ID')) {
        alert('⚠️ Please update the SCRIPT_URL in admin.js with your Google Apps Script deployment URL');
    }
    document.getElementById('usernameInput').focus();
});
