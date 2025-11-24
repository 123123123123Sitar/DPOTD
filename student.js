window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true
    },
    options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
    }
};


const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxtQTYwTvh5Qh-uJz2mURoDTXs8kRuiHu-1uPvAtMRrdcKX23C9FWOrjcqMW0okZWN3/exec';
const GEMINI_API_KEY = 'AIzaSyAG0HmsIkxuESxsq0sYNPRANTfqHdIk6Tk';

let currentUser = null;
let startTime, timerInterval, questionsData;
let q1StartTime, q2StartTime, q3StartTime;
let q1EndTime, q2EndTime, q3EndTime;
let exitCount = 0, exitLogs = [];
let testActive = false, currentDay = null, currentQuestion = 0;
const TEST_DURATION = 120 * 60 * 1000;
let latexUpdateTimer = null;
let autoSaveInterval = null;
let fullscreenChangeHandler, visibilityChangeHandler;

window.addEventListener('load', () => {
    const storedUser = localStorage.getItem('dpotdUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showMainPortal();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('reset');
    if (resetToken) {
        verifyResetToken(resetToken);
    }
});

function showStatus(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.className = 'status ' + type;
    el.style.display = 'block';
}

function showLoading(message) {
    document.getElementById('loadingText').textContent = message;
    document.getElementById('loadingModal').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingModal').classList.remove('show');
}

function cleanAnswer(answer) {
    return answer.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
}

function handleLoginEnter(event) {
    if (event.key === 'Enter') login();
}

function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('forgotPasswordForm').classList.add('hidden');
    document.getElementById('resetPasswordForm').classList.add('hidden');
}

function showForgotPassword() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('forgotPasswordForm').classList.remove('hidden');
    document.getElementById('resetPasswordForm').classList.add('hidden');
}

async function requestPasswordReset() {
    const email = document.getElementById('resetEmail').value.trim();
    if (!email) {
        showStatus('resetStatus', 'Please enter your email address', 'error');
        return;
    }

    showLoading('Sending reset link...');
    try {
        const baseUrl = window.location.origin + window.location.pathname;
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'requestPasswordReset',
                email: email,
                baseUrl: baseUrl
            })
        });

        hideLoading();
        showStatus('resetStatus', 'If an account exists with that email, a password reset link has been sent. Please check your inbox.', 'success');
        document.getElementById('resetEmail').value = '';
    } catch (error) {
        hideLoading();
        showStatus('resetStatus', 'Error: ' + error.message, 'error');
    }
}

async function verifyResetToken(token) {
    showLoading('Verifying reset link...');
    try {
        const response = await fetch(`${SCRIPT_URL}?action=verifyResetToken&token=${encodeURIComponent(token)}`);
        const result = await response.json();
        hideLoading();

        if (result.valid) {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('forgotPasswordForm').classList.add('hidden');
            document.getElementById('resetPasswordForm').classList.remove('hidden');
            document.getElementById('resetPasswordForm').dataset.token = token;
            document.getElementById('resetPasswordForm').dataset.email = result.email;
        } else {
            showLogin();
            showStatus('loginStatus', result.error || 'Invalid or expired reset link', 'error');
        }
    } catch (error) {
        hideLoading();
        showLogin();
        showStatus('loginStatus', 'Error verifying reset link', 'error');
    }
}

async function resetPassword() {
    const newPassword = document.getElementById('newResetPassword').value;
    const confirmPassword = document.getElementById('confirmResetPassword').value;
    const token = document.getElementById('resetPasswordForm').dataset.token;

    if (!newPassword || !confirmPassword) {
        showStatus('resetPasswordStatus', 'Please fill in both fields', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showStatus('resetPasswordStatus', 'Passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showStatus('resetPasswordStatus', 'Password must be at least 6 characters', 'error');
        return;
    }

    showLoading('Resetting password...');
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'resetPassword',
                token: token,
                newPassword: newPassword
            })
        });

        hideLoading();
        showLogin();
        showStatus('loginStatus', 'Password reset successfully! Please login with your new password.', 'success');

        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
        hideLoading();
        showStatus('resetPasswordStatus', 'Error: ' + error.message, 'error');
    }
}

async function loadUserRank() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getUserRank&email=${encodeURIComponent(currentUser.email)}`);
        const result = await response.json();

        const profileRank = document.getElementById('profileRank');
        const rankDisplay = document.getElementById('rankDisplay');
        const rankDetails = document.getElementById('rankDetails');

        if (result.rank) {
            rankDisplay.textContent = `#${result.rank}`;
            rankDetails.textContent = `out of ${result.totalStudents} students (${result.score} points)`;
            profileRank.classList.remove('hidden');
        } else {
            profileRank.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error loading rank:', error);
    }
}

function updateLatexPreview() {
    if (latexUpdateTimer) clearTimeout(latexUpdateTimer);

    latexUpdateTimer = setTimeout(() => {
        const input = document.getElementById('latexInput').value;
        const preview = document.getElementById('latexPreview');

        if (!input.trim()) {
            preview.innerHTML = '<p style="color: #999;">Your formatted proof will appear here...</p>';
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

        preview.innerHTML = content || '<p style="color: #999;">Write your proof...</p>';

        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetClear([preview]);
            MathJax.typesetPromise([preview]).catch((err) => {
                console.error('MathJax error:', err);
                preview.innerHTML += '<p style="color: #dc3545; font-size: 12px; margin-top: 10px;"><strong>LaTeX Error:</strong> Check your syntax</p>';
            });
        }
    }, 500);
}

function toggleAIHelper() {
    document.getElementById('aiHelper').classList.toggle('show');
}

let latexHelpTimeout;

function showLatexHelp() {
    clearTimeout(latexHelpTimeout);
    document.getElementById('latexHelpDropdown').classList.add('show');
}

function hideLatexHelp() {
    latexHelpTimeout = setTimeout(() => {
        document.getElementById('latexHelpDropdown').classList.remove('show');
    }, 300);
}

function handleAIEnter(event) {
    if (event.key === 'Enter') sendAIMessage();
}

async function sendAIMessage() {
    const input = document.getElementById('aiInput');
    const message = input.value.trim();
    if (!message) return;

    addAIMessage(message, 'user');
    input.value = '';

    const lowerMessage = message.toLowerCase();
    const problemSolvingPhrases = ['solve', 'calculate', 'compute', 'what is', 'how much is', 'find the answer', 'find the solution', 'the answer to', 'result of', 'evaluate', 'simplify'];
    const syntaxPhrases = ['how do i write', 'how to write', 'syntax for', 'latex code', 'in latex', 'using latex', 'format', 'display'];

    const isSyntaxQuestion = syntaxPhrases.some(phrase => lowerMessage.includes(phrase));
    const isProblemSolving = problemSolvingPhrases.some(phrase => lowerMessage.includes(phrase));

    if (isProblemSolving && !isSyntaxQuestion) {
        addAIMessage('I cannot help solve math problems or provide answers. I can ONLY help with LaTeX syntax questions.', 'assistant');
        return;
    }

    const systemPrompt = `You are a STRICT LaTeX syntax helper. You can ONLY answer questions about how to write LaTeX code. FORBIDDEN: Solve ANY math problems, provide numerical answers, give hints, explain mathematical concepts. Keep responses brief and focused on LaTeX code syntax only.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                contents: [{parts: [{text: `${systemPrompt}\n\nUser: ${message}`}]}],
                generationConfig: {temperature: 0.4, maxOutputTokens: 200}
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, no response';
        addAIMessage(aiResponse, 'assistant');
    } catch (error) {
        addAIMessage(`Error: ${error.message}`, 'assistant');
    }
}

function addAIMessage(message, type) {
    const container = document.getElementById('aiChatContainer');
    const div = document.createElement('div');
    div.className = `ai-message ${type}`;

    if (type === 'assistant') {
        let processed = message
            .replace(/```([^`]+)```/g, '<pre style="background:#2d2d2d;color:#f8f8f2;padding:10px;border-radius:4px;overflow-x:auto;margin:10px 0">$1</pre>')
            .replace(/`([^`]+)`/g, '<code style="background:#f4f4f4;padding:2px 6px;border-radius:3px;color:#e83e8c">$1</code>');
        div.innerHTML = `<strong>LaTeX Helper:</strong> ${processed}`;
        container.appendChild(div);
        if (window.MathJax) MathJax.typesetPromise([div]).catch(e => console.log(e));
    } else {
        div.textContent = message;
        container.appendChild(div);
    }
    container.scrollTop = container.scrollHeight;
}

function switchMainTab(tab) {
    document.querySelectorAll('#mainPortal .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#mainPortal .tab-content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
    if (tab === 'today') checkTodayTest();
    if (tab === 'history') loadHistory();
    if (tab === 'leaderboard') loadLeaderboard();
}

async function loadLeaderboard() {
    const container = document.getElementById('leaderboardContainer');
    container.innerHTML = '<p style="color: #666; text-align: center;">Loading leaderboard...</p>';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getLeaderboard`);
        const leaderboard = await response.json();

        if (leaderboard.error) {
            container.innerHTML = '<p style="color: #dc3545; text-align: center;">Error loading leaderboard: ' + leaderboard.error + '</p>';
            return;
        }

        if (!leaderboard || !Array.isArray(leaderboard) || leaderboard.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No submissions yet. Be the first to complete a test!</p>';
            return;
        }

        let tableHTML = `
            <table class="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Name</th>
                        <th>Total Score</th>
                        <th>Tests Completed</th>
                    </tr>
                </thead>
                <tbody>
        `;

        leaderboard.forEach((student, index) => {
            const rank = index + 1;
            let rankClass = 'rank-other';
            if (rank === 1) rankClass = 'rank-1';
            else if (rank === 2) rankClass = 'rank-2';
            else if (rank === 3) rankClass = 'rank-3';

            const isCurrentUser = currentUser && student.email === currentUser.email;
            const rowStyle = isCurrentUser ? 'background: #fff3cd; font-weight: 600;' : '';

            tableHTML += `
                <tr style="${rowStyle}">
                    <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                    <td>${student.name}${isCurrentUser ? ' (You)' : ''}</td>
                    <td>${student.totalScore} pts</td>
                    <td>${student.completedDays}</td>
                </tr>
            `;
        });

        tableHTML += `
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;

    } catch (error) {
        container.innerHTML = '<p style="color: #dc3545; text-align: center;">Error loading leaderboard</p>';
        console.error('Leaderboard error:', error);
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
        showStatus('loginStatus', 'Please enter email and password', 'error');
        return;
    }
    showLoading('Logging in...');
    try {
        const response = await fetch(`${SCRIPT_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
        const result = await response.json();
        hideLoading();
        if (result.success) {
            currentUser = { name: result.name, email: result.email };
            localStorage.setItem('dpotdUser', JSON.stringify(currentUser));
            showMainPortal();
        } else {
            showStatus('loginStatus', result.error || 'Invalid credentials', 'error');
        }
    } catch (error) {
        hideLoading();
        showStatus('loginStatus', 'Error: ' + error.message, 'error');
    }
}

function logout() {
    localStorage.removeItem('dpotdUser');
    currentUser = null;
    document.getElementById('mainPortal').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
    const profileRank = document.getElementById('profileRank');
    if (profileRank) profileRank.classList.add('hidden');
    location.reload();
}

function showMainPortal() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainPortal').classList.remove('hidden');
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileNameInput').value = currentUser.name;
    document.getElementById('profileEmailInput').value = currentUser.email;
    checkTodayTest();
    loadUserRank();
}

async function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;
    if (!current || !newPass || !confirm) {
        showStatus('profileStatus', 'Please fill in all fields', 'error');
        return;
    }
    if (newPass !== confirm) {
        showStatus('profileStatus', 'New passwords do not match', 'error');
        return;
    }
    if (newPass.length < 6) {
        showStatus('profileStatus', 'New password must be at least 6 characters', 'error');
        return;
    }
    showLoading('Updating password...');
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'changePassword',
                email: currentUser.email,
                currentPassword: current,
                newPassword: newPass
            })
        });
        hideLoading();
        showStatus('profileStatus', 'Password updated successfully!', 'success');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
    } catch (error) {
        hideLoading();
        showStatus('profileStatus', 'Error: ' + error.message, 'error');
    }
}

async function getCurrentDay() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getSchedule`);
        const schedule = await response.json();
        const now = new Date();
        for (let i = 1; i <= 5; i++) {
            const dayStart = schedule[`day${i}`];
            if (!dayStart) continue;
            const scheduledDate = new Date(dayStart);
            scheduledDate.setHours(0, 0, 0, 0);
            const dayEnd = new Date(scheduledDate);
            dayEnd.setHours(23, 59, 59, 999);
            if (now >= scheduledDate && now <= dayEnd) return i;
        }
        return null;
    } catch (error) {
        console.error('Error getting day:', error);
        return null;
    }
}

async function checkTodayTest() {
    const statusDiv = document.getElementById('testStatus');
    statusDiv.innerHTML = '<p style="color: #666;">Checking for today\'s test...</p>';

    try {
        currentDay = await getCurrentDay();

        if (!currentDay) {
            statusDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h3 style="color: #666; margin-bottom: 15px;">No Test Available Today</h3>
                    <p style="color: #999;">There is no scheduled test for today. Please check back on a scheduled test day.</p>
                </div>
            `;
            return;
        }

        const submissionCheck = await fetch(`${SCRIPT_URL}?action=checkSubmission&email=${encodeURIComponent(currentUser.email)}&day=${currentDay}`);
        const submissionResult = await submissionCheck.json();

        if (submissionResult.exists) {
            statusDiv.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <h3 style="color: #28a745; margin-bottom: 15px;">Test Already Submitted</h3>
                    <p style="color: #666;">You have already completed Day ${currentDay}'s test.</p>
                    <p style="color: #666; margin-top: 10px;">Check the "Score History" tab to view your results.</p>
                </div>
            `;
            return;
        }

        const activeTestCheck = await fetch(`${SCRIPT_URL}?action=getActiveTest&email=${encodeURIComponent(currentUser.email)}&day=${currentDay}`);
        const activeTest = await activeTestCheck.json();

        if (activeTest.exists) {
            statusDiv.innerHTML = `
                <div class="resume-test-banner">
                    <h3>You Have an Active Test in Progress</h3>
                    <p>You started Day ${currentDay}'s test but didn't complete it.</p>
                    <p><strong>Violations recorded: ${activeTest.exitCount}</strong></p>
                    <button class="btn" onclick="resumeTest()" style="margin-top: 15px;">Resume Test</button>
                </div>
            `;
            return;
        }

        statusDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: #EA5A2F; margin-bottom: 20px;">Day ${currentDay} Test Available</h2>
                <p style="font-size: 18px; color: #666; margin-bottom: 30px;">Ready to take today's test?</p>
                <button class="btn" onclick="showConfirmation()" style="padding: 15px 40px; font-size: 18px;">Start Test</button>
            </div>
        `;

    } catch (error) {
        statusDiv.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h3 style="color: #dc3545; margin-bottom: 15px;">Error Loading Test</h3>
                <p style="color: #666;">Please refresh the page or contact your administrator.</p>
            </div>
        `;
        console.error('Error checking test:', error);
    }
}

async function resumeTest() {
    showLoading('Resuming your test...');
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getActiveTest&email=${encodeURIComponent(currentUser.email)}&day=${currentDay}`);
        const activeTest = await response.json();
        if (!activeTest.exists) {
            hideLoading();
            alert('Active test not found. Please contact your administrator.');
            checkTodayTest();
            return;
        }
        const questionsResponse = await fetch(`${SCRIPT_URL}?action=getQuestions&day=${currentDay}`);
        questionsData = await questionsResponse.json();
        if (questionsData.error) {
            hideLoading();
            alert('Error loading questions: ' + questionsData.error);
            return;
        }
        document.getElementById('q1Text').textContent = questionsData.q1_text;
        document.getElementById('q2Text').textContent = questionsData.q2_text;
        document.getElementById('q3Text').textContent = questionsData.q3_text;
        if (window.MathJax) {
            setTimeout(() => {
                MathJax.typesetPromise([document.getElementById('q1Text'), document.getElementById('q2Text'), document.getElementById('q3Text')]).catch(e => console.log('MathJax error:', e));
            }, 100);
        }
        if (questionsData.q1_image && questionsData.q1_image.trim() !== '') {
            document.getElementById('q1Image').src = questionsData.q1_image;
            document.getElementById('q1Image').style.display = 'block';
        }
        if (questionsData.q2_image && questionsData.q2_image.trim() !== '') {
            document.getElementById('q2Image').src = questionsData.q2_image;
            document.getElementById('q2Image').style.display = 'block';
        }
        if (questionsData.q3_image && questionsData.q3_image.trim() !== '') {
            document.getElementById('q3Image').src = questionsData.q3_image;
            document.getElementById('q3Image').style.display = 'block';
        }
        document.getElementById('q1Answer').value = activeTest.q1Answer || '';
        document.getElementById('q2Answer').value = activeTest.q2Answer || '';
        document.getElementById('latexInput').value = activeTest.q3Answer || '';
        updateLatexPreview();
        startTime = new Date(activeTest.startTime).getTime();
        exitCount = activeTest.exitCount;
        exitLogs = activeTest.exitLogs || [];
        document.getElementById('testTitle').textContent = `D.PotD Day ${currentDay}`;
        hideLoading();
        await enterFullscreenAndStart(activeTest.currentQuestion || 1);
    } catch (error) {
        hideLoading();
        alert('Error resuming test: ' + error.message);
    }
}

function showConfirmation() {
    document.getElementById('confirmationModal').classList.add('show');
}

function cancelTest() {
    document.getElementById('confirmationModal').classList.remove('show');
}

function confirmStart() {
    document.getElementById('confirmationModal').classList.remove('show');
    startTest();
}

async function loadHistory() {
    const container = document.getElementById('historyContainer');
    container.innerHTML = '<p style="color: #666;">Loading your scores...</p>';
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getUserSubmissions&email=${encodeURIComponent(currentUser.email)}`);
        const submissions = await response.json();
        if (!submissions || submissions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No submissions yet. Take your first test!</p>';
            return;
        }
        container.innerHTML = '';
        submissions.reverse().forEach(sub => {
            const card = document.createElement('div');
            card.className = 'score-card';
            const timestamp = new Date(sub.timestamp).toLocaleString();
            const q1Points = sub.q1_correct ? 5 : 0;
            const q2Points = sub.q2_correct ? 5 : 0;
            const q3Points = sub.q3_score || 0;
            const totalPoints = q1Points + q2Points + parseInt(q3Points);
            let feedbackHTML = '';
            if (sub.q3_feedback) {
                let feedbackContent = sub.q3_feedback;
                feedbackContent = feedbackContent.replace(/\\documentclass\{[^}]+\}/g, '').replace(/\\usepackage\{[^}]+\}/g, '').replace(/\\title\{[^}]*\}/g, '').replace(/\\author\{[^}]*\}/g, '').replace(/\\date\{[^}]*\}/g, '').replace(/\\maketitle/g, '');
                const docMatch = feedbackContent.match(/\\begin\{document\}([\s\S]*)\\end\{document\}/);
                if (docMatch) feedbackContent = docMatch[1].trim();
                feedbackHTML = `<div class="feedback-box"><h4>Q3 Feedback</h4><div id="feedback_${sub.rowIndex || Math.random()}" style="line-height: 1.6;">${feedbackContent}</div></div>`;
            }
            card.innerHTML = `
                <div class="score-header"><h3>Day ${sub.day}</h3><span style="color: #666; font-size: 14px;">${timestamp}</span></div>
                <div style="background: #EA5A2F; color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: center;"><strong style="font-size: 24px;">Total Score: ${totalPoints}/20</strong></div>
                <div class="score-details">
                    <div class="score-item"><strong>Q1:</strong> <span class="${sub.q1_correct ? 'correct' : 'incorrect'}">${sub.q1_correct ? 'Correct (+5 pts)' : 'Incorrect (0 pts)'}</span></div>
                    <div class="score-item"><strong>Q2:</strong> <span class="${sub.q2_correct ? 'correct' : 'incorrect'}">${sub.q2_correct ? 'Correct (+5 pts)' : 'Incorrect (0 pts)'}</span></div>
                    <div class="score-item"><strong>Q3 Score:</strong> ${sub.q3_score !== undefined && sub.q3_score !== '' ? sub.q3_score + '/10 (+' + sub.q3_score + ' pts)' : 'Pending'}</div>
                    <div class="score-item"><strong>Time:</strong> ${Math.floor(sub.totalTime / 60)}m ${sub.totalTime % 60}s</div>
                </div>
                ${feedbackHTML}
            `;
            container.appendChild(card);
            if (sub.q3_feedback && window.MathJax) {
                setTimeout(() => {
                    const feedbackDiv = card.querySelector(`[id^="feedback_"]`);
                    if (feedbackDiv) MathJax.typesetPromise([feedbackDiv]).catch(e => console.log(e));
                }, 100);
            }
        });
    } catch (error) {
        container.innerHTML = '<p style="color: #dc3545;">Error loading history</p>';
    }
}

async function startTest() {
    showLoading(`Loading Day ${currentDay} questions...`);
    try {
        const response = await fetch(`${SCRIPT_URL}?action=getQuestions&day=${currentDay}`);
        const responseText = await response.text();
        questionsData = JSON.parse(responseText);
        if (questionsData.error) {
            hideLoading();
            alert('Error loading questions: ' + questionsData.error);
            return;
        }
        if (!questionsData.q1_text || !questionsData.q2_text || !questionsData.q3_text) {
            hideLoading();
            alert('Questions for Day ' + currentDay + ' are not set up yet. Please contact your administrator.');
            return;
        }
        document.getElementById('q1Text').textContent = questionsData.q1_text;
        document.getElementById('q2Text').textContent = questionsData.q2_text;
        document.getElementById('q3Text').textContent = questionsData.q3_text;
        if (window.MathJax) {
            setTimeout(() => {
                MathJax.typesetPromise([document.getElementById('q1Text'), document.getElementById('q2Text'), document.getElementById('q3Text')]).catch(e => console.log('MathJax error:', e));
            }, 100);
        }
        if (questionsData.q1_image && questionsData.q1_image.trim() !== '') {
            document.getElementById('q1Image').src = questionsData.q1_image;
            document.getElementById('q1Image').style.display = 'block';
        } else {
            document.getElementById('q1Image').style.display = 'none';
        }
        if (questionsData.q2_image && questionsData.q2_image.trim() !== '') {
            document.getElementById('q2Image').src = questionsData.q2_image;
            document.getElementById('q2Image').style.display = 'block';
        } else {
            document.getElementById('q2Image').style.display = 'none';
        }
        if (questionsData.q3_image && questionsData.q3_image.trim() !== '') {
            document.getElementById('q3Image').src = questionsData.q3_image;
            document.getElementById('q3Image').style.display = 'block';
        } else {
            document.getElementById('q3Image').style.display = 'none';
        }
        document.getElementById('testTitle').textContent = `D.PotD Day ${currentDay}`;
        startTime = Date.now();
        const endTime = startTime + TEST_DURATION;
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'createActiveTest',
                email: currentUser.email,
                day: currentDay,
                startTime: new Date(startTime).toISOString(),
                endTime: new Date(endTime).toISOString()
            })
        });
        hideLoading();
        await enterFullscreenAndStart(1);
    } catch (error) {
        hideLoading();
        alert('Error loading questions: ' + error.message);
    }
}

async function enterFullscreenAndStart(questionNum) {
    document.getElementById('mainPortal').style.display = 'none';
    document.getElementById('questionSection').style.display = 'block';
    document.getElementById('navigationBar').style.display = 'block';
    const profileRank = document.getElementById('profileRank');
    if (profileRank) profileRank.classList.add('hidden');
    document.body.classList.add('locked');
    testActive = true;
    monitorFullscreen();
    q1StartTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
    startAutoSave();
    showQuestion(questionNum);

    try {
        await document.documentElement.requestFullscreen();
    } catch (err) {
        console.error('Fullscreen error:', err);
    }
}

function startAutoSave() {
    autoSaveInterval = setInterval(async () => {
        if (!testActive) return;
        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    action: 'updateActiveTest',
                    email: currentUser.email,
                    day: currentDay,
                    currentQuestion: currentQuestion,
                    q1Answer: document.getElementById('q1Answer').value,
                    q2Answer: document.getElementById('q2Answer').value,
                    q3Answer: document.getElementById('latexInput').value,
                    exitCount: exitCount,
                    exitLogs: JSON.stringify(exitLogs)
                })
            });
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, 30000);
}

function showQuestion(num) {
    ['q1Page', 'q2Page', 'q3Page'].forEach(id => document.getElementById(id).style.display = 'none');
    document.getElementById(`q${num}Page`).style.display = 'block';
    document.getElementById('progressIndicator').textContent = `Day ${currentDay} - Question ${num} of 3`;
    document.getElementById('progressIndicator').style.display = 'block';
    ['navBtn1', 'navBtn2', 'navBtn3'].forEach(id => {
        const btn = document.getElementById(id);
        btn.style.background = 'white';
        btn.style.borderColor = '#E3E3E3';
        btn.style.color = '#000';
    });
    const activeBtn = document.getElementById(`navBtn${num}`);
    activeBtn.style.background = '#EA5A2F';
    activeBtn.style.borderColor = '#EA5A2F';
    activeBtn.style.color = 'white';
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    if (num === 3) {
        nextBtn.style.display = 'none';
        submitBtn.style.display = 'block';
    } else {
        nextBtn.style.display = 'block';
        submitBtn.style.display = 'none';
    }
    const aiBtn = document.getElementById('aiToggleBtn');
    const helpBtn = document.getElementById('latexHelpBtn');
    if (num === 3) {
        aiBtn.style.display = 'block';
        helpBtn.style.display = 'flex';
    } else {
        aiBtn.style.display = 'none';
        helpBtn.style.display = 'none';
    }
    currentQuestion = num;
}

function nextQuestion() {
    if (currentQuestion < 3) showQuestion(currentQuestion + 1);
}

function updateTimer() {
    if (!startTime) return;
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, TEST_DURATION - elapsed);
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const timer = document.getElementById('timer');
    timer.textContent = `Time Remaining: ${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    timer.style.display = 'block';
    timer.style.color = remaining < 600000 ? '#ff6b6b' : '#000';
    if (remaining <= 0) {
        clearInterval(timerInterval);
        submitTest(true);
    }
}

async function submitTest(isForced = false) {
    if (!testActive && !isForced) return;
    const q1Answer = cleanAnswer(document.getElementById('q1Answer').value.trim());
    const q2Answer = cleanAnswer(document.getElementById('q2Answer').value.trim());
    const q3Answer = document.getElementById('latexInput').value.trim();
    if (!isForced && (!q1Answer || !q2Answer || !q3Answer)) {
        alert('Please answer all questions before submitting.');
        return;
    }

    testActive = false;
    clearInterval(timerInterval);
    if (autoSaveInterval) clearInterval(autoSaveInterval);

    document.removeEventListener('fullscreenchange', fullscreenChangeHandler);
    document.removeEventListener('visibilitychange', visibilityChangeHandler);

    const endTime = Date.now();
    q3EndTime = endTime;
    const q1Time = q1EndTime ? Math.floor((q1EndTime - q1StartTime) / 1000) : 0;
    const q2Time = q2EndTime && q2StartTime ? Math.floor((q2EndTime - q2StartTime) / 1000) : 0;
    const q3Time = q3StartTime ? Math.floor((q3EndTime - q3StartTime) / 1000) : 0;
    const totalTime = Math.floor((endTime - startTime) / 1000);
    const q1Correct = q1Answer === cleanAnswer(questionsData.q1_answer);
    const q2Correct = q2Answer === cleanAnswer(questionsData.q2_answer);
    const submission = {
        action: 'submitTest',
        studentName: currentUser.name,
        studentEmail: currentUser.email,
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
        exitLogs: JSON.stringify(exitLogs)
    };
    showLoading(isForced ? 'Auto-submitting...' : 'Submitting...');
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(submission)
        });

        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
                action: 'deleteActiveTest',
                email: currentUser.email,
                day: currentDay
            })
        });

        hideLoading();
        testActive = false;
        document.body.classList.remove('locked');
        if (document.exitFullscreen) document.exitFullscreen();

        document.getElementById('aiHelper').classList.remove('show');
        document.getElementById('aiToggleBtn').style.display = 'none';
        document.getElementById('latexHelpBtn').style.display = 'none';
        document.getElementById('timer').style.display = 'none';
        document.getElementById('progressIndicator').style.display = 'none';

        document.getElementById('questionSection').style.display = 'none';
        document.getElementById('mainPortal').style.display = 'block';
        const profileRank = document.getElementById('profileRank');
        if (profileRank) profileRank.classList.remove('hidden');

        loadUserRank();

        const q1Points = q1Correct ? 5 : 0;
        const q2Points = q2Correct ? 5 : 0;
        const currentTotal = q1Points + q2Points;
        document.getElementById('testStatus').innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: #28a745; margin-bottom: 20px;">Test Submitted Successfully!</h2>
                <p style="font-size: 18px; color: #666; margin-bottom: 30px;">Your responses have been recorded and will be graded shortly.</p>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto;">
                    <div style="background: #EA5A2F; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <strong style="font-size: 20px;">Current Score: ${currentTotal}/20</strong>
                        <p style="margin-top: 5px; font-size: 14px;">Q3 will be graded manually</p>
                    </div>
                    <div style="margin-bottom: 15px; text-align: left;">
                        <strong>Q1 (5 points):</strong> <span class="${q1Correct ? 'correct' : 'incorrect'}">${q1Correct ? 'Correct (+5 pts)' : 'Incorrect (0 pts)'}</span>
                    </div>
                    <div style="margin-bottom: 15px; text-align: left;">
                        <strong>Q2 (5 points):</strong> <span class="${q2Correct ? 'correct' : 'incorrect'}">${q2Correct ? 'Correct (+5 pts)' : 'Incorrect (0 pts)'}</span>
                    </div>
                    <div style="text-align: left;">
                        <strong>Q3 (10 points):</strong> Will be graded manually
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        hideLoading();
        alert('Error submitting test: ' + error.message + '\n\nPlease contact your administrator.');
        testActive = true;
    }
}

function recordViolation(type) {
    if (!testActive) return;
    exitCount++;
    exitLogs.push({time: new Date().toISOString(), type});
    document.getElementById('violationCount').textContent = exitCount;
    document.getElementById('warningOverlay').classList.add('show');
}

function hideWarning() {
    document.getElementById('warningOverlay').classList.remove('show');
}

function returnToFullscreen() {
    document.documentElement.requestFullscreen().then(() => hideWarning()).catch(() => alert('Please allow fullscreen'));
}

function monitorFullscreen() {
    fullscreenChangeHandler = () => {
        if (!document.fullscreenElement && testActive) recordViolation('exited_fullscreen');
    };

    visibilityChangeHandler = () => {
        if (document.hidden && testActive) recordViolation('tab_hidden');
    };

    document.addEventListener('fullscreenchange', fullscreenChangeHandler);
    document.addEventListener('visibilitychange', visibilityChangeHandler);
}

document.addEventListener('DOMContentLoaded', function() {
    ['q1Answer', 'q2Answer'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => {
                const cleaned = cleanAnswer(e.target.value);
                if (e.target.value !== cleaned) e.target.value = cleaned;
            });
        }
    });
    const latexInput = document.getElementById('latexInput');
    if (latexInput) {
        latexInput.addEventListener('input', updateLatexPreview);
        latexInput.value = `\\documentclass{article}
\\usepackage{amsmath}

\\begin{document}

Write your proof here. 

For inline math, use: $x^2 + y^2 = z^2$

For display math, use double dollar signs:
$
\\frac{a}{b} = \\frac{c}{d}
$

Common symbols:
- Fractions: $\\frac{numerator}{denominator}$
- Exponents: $x^2$ or $x^{10}$
- Subscripts: $x_1$ or $x_{10}$
- Square root: $\\sqrt{x}$ or $\\sqrt[3]{x}$
- Summation: $\\sum_{i=1}^{n} i$
- Integral: $\\int_0^1 f(x) dx$

\\end{document}`;
        updateLatexPreview();
    }
});

document.addEventListener('keydown', (e) => {
    if (testActive) {
        const blocked = [
            e.keyCode === 123,
            (e.ctrlKey || e.metaKey) && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74),
            (e.ctrlKey || e.metaKey) && e.keyCode === 85,
            e.keyCode === 27
        ];
        if (blocked.some(x => x)) {
            e.preventDefault();
            return false;
        }
    }
});

document.addEventListener('contextmenu', (e) => {
    if (testActive) {
        e.preventDefault();
    }
});

window.addEventListener('beforeunload', (e) => {
    if (testActive) {
        e.preventDefault();
        e.returnValue = '';
        recordViolation('attempted_close');
        return '';
    }
});

