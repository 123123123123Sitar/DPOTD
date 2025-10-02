<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Secure Test Page</title>
  <style>
    /* Basic layout */
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin:0; padding:0; background:#f4f6f8; color:#222; }
    .container { max-width: 900px; margin: 32px auto; padding: 24px; background: #fff; border-radius: 10px; box-shadow: 0 8px 30px rgba(50,50,93,0.05); }
    h1 { margin-top:0 }
    .status { display:none; padding:10px; border-radius:6px; margin-top:12px }
    .status.success { background:#e6ffef; color:#096; }
    .status.error { background:#ffe6e6; color:#c00; }
    .btn { display:inline-block; background:#ea5a2f; color:#fff; border:none; padding:12px 20px; border-radius:8px; cursor:pointer; font-weight:600 }
    .btn[disabled] { opacity:.6; cursor:not-allowed }
    input[type="text"], input[type="email"], textarea { width:100%; padding:10px; border-radius:6px; border:1px solid #ddd; margin-top:8px }
    label { font-weight:600; display:block; margin-top:14px }

    /* Loading modal */
    #loadingModal { position:fixed; inset:0; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.45); z-index:1000 }
    #loadingModal.show { display:flex }
    .loadingBox { background:#fff; padding:20px 26px; border-radius:8px; min-width:260px; text-align:center }

    /* Question section */
    #questionSection { display:none }
    .question { margin: 18px 0; padding:16px; border-radius:8px; background:#fafafa }

    /* Warning overlay (the element you provided) */
    .warning-overlay { position:fixed; inset:0; display:none; align-items:center; justify-content:center; text-align:center; background: rgba(220,53,69,0.95); color:#fff; z-index:2000; padding: 30px; }
    .warning-overlay.show { display:flex }
    .warning-overlay p { margin:8px 0 }
    .warning-overlay .warning-count { font-weight:700; margin-top:6px }

    /* Small helpers */
    .hidden { display:none }
    .locked { user-select:none; overflow:hidden }
  </style>
</head>
<body>
  <div class="container">
    <h1>Secure Test</h1>

    <div id="studentForm">
      <label for="studentName">Name</label>
      <input id="studentName" type="text" placeholder="Student Name" />

      <label for="studentEmail">Email</label>
      <input id="studentEmail" type="email" placeholder="student@example.com" />
      <div id="emailError" style="color:#c00; font-size:13px; margin-top:6px"></div>

      <div id="startStatus" class="status"></div>
      <button id="startBtn" class="btn" style="margin-top:14px">Check & Load Test</button>
    </div>

    <div id="questionSection">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong id="dayIndicator">Day -</strong>
          <div id="timer" style="margin-top:8px; font-weight:600"></div>
        </div>
        <div>
          <button id="submitBtn" class="btn">Submit Test</button>
        </div>
      </div>

      <div class="question">
        <h3>Question 1</h3>
        <div id="q1Text">(loading...)</div>
        <input id="q1Answer" placeholder="Answer (numbers only)" />
      </div>

      <div class="question">
        <h3>Question 2</h3>
        <div id="q2Text">(loading...)</div>
        <input id="q2Answer" placeholder="Answer (numbers only)" />
      </div>

      <div class="question">
        <h3>Question 3</h3>
        <div id="q3Text">(loading...)</div>
        <textarea id="q3Answer" rows="4" placeholder="Free response"></textarea>
      </div>

      <div id="submitStatus" class="status"></div>
    </div>

  </div>

  <!-- Loading Modal -->
  <div id="loadingModal">
    <div class="loadingBox">
      <div id="loadingText">Loading...</div>
    </div>
  </div>

  <!-- WARNING OVERLAY (inserted at the end of body so it sits above everything) -->
  <div class="warning-overlay" id="warningOverlay" aria-live="assertive" role="dialog" aria-modal="true">
    <div style="max-width:720px">
      <p><strong>⚠️ WARNING: YOU HAVE LEFT THE TEST PAGE!</strong></p>
      <p style="font-size: 18px; margin: 20px 0;">Return to the test immediately!</p>
      <p class="warning-count">Violations recorded: <span id="violationCount">0</span></p>
      <button class="btn" onclick="returnToFullscreen()" style="max-width: 400px; padding: 20px 40px; font-size: 18px; margin-top: 20px; background: #fff; color: #dc3545; border: 3px solid #fff;">
          🔒 Return to Test & Enter Fullscreen
      </button>
      <p style="font-size: 14px; margin-top: 20px; opacity: 0.95;">Click the button above to continue your test</p>
    </div>
  </div>

  <script>
    // Rewritten & organized script (integrates the overlay)
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzRPyEM0A2oP_zU9GTq_tPintK4rU1e16IvGLgCV-P1G4-dsghsw7B_kkgAuPII56X0/exec';

    // Timing & state
    let startTime = null;
    let timerInterval = null;
    let questionsData = null;
    let q1StartTime = null, q2StartTime = null, q3StartTime = null;
    let exitCount = 0;
    let exitLogs = [];
    let testActive = false;
    let currentDay = null;
    const TEST_DURATION = 120 * 60 * 1000; // 2 hours

    // ---------- UI helpers ----------
    function showStatus(id, message, type) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = message;
      el.className = 'status ' + (type || '');
      el.style.display = 'block';
    }

    function showLoading(message) {
      const modal = document.getElementById('loadingModal');
      const text = document.getElementById('loadingText');
      if (text) text.textContent = message || 'Loading...';
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

    // ---------- Warning / Violation tracking ----------
    function updateViolationUI() {
      const vc = document.getElementById('violationCount');
      if (vc) vc.textContent = exitCount;
    }

    function recordViolation(type) {
      if (!testActive) return;
      exitCount++;
      exitLogs.push({ time: new Date().toISOString(), type });
      updateViolationUI();

      const overlay = document.getElementById('warningOverlay');
      if (!overlay) return;

      const warningText = overlay.querySelector('p:first-child');
      if (type === 'exited_fullscreen') {
        warningText.innerHTML = '<strong>⚠️ WARNING: YOU EXITED FULLSCREEN MODE!</strong>';
      } else if (type === 'tab_hidden') {
        warningText.innerHTML = '<strong>⚠️ WARNING: YOU SWITCHED TABS!</strong>';
      } else if (type === 'window_blur') {
        warningText.innerHTML = '<strong>⚠️ WARNING: YOU LEFT THE TEST PAGE!</strong>';
      } else if (type === 'keyboard_shortcut_blocked') {
        warningText.innerHTML = '<strong>⚠️ WARNING: UNAUTHORIZED KEYBOARD ACTION DETECTED!</strong>';
      } else {
        warningText.innerHTML = '<strong>⚠️ WARNING: YOU LEFT THE TEST PAGE!</strong>';
      }

      overlay.classList.add('show');
    }

    function hideWarning() {
      const overlay = document.getElementById('warningOverlay');
      if (overlay) overlay.classList.remove('show');
    }

    function returnToFullscreen() {
      // Request fullscreen and hide overlay on success
      document.documentElement.requestFullscreen().then(() => {
        console.log('Returned to fullscreen');
        hideWarning();
      }).catch((err) => {
        alert('Please allow fullscreen mode to continue the test.');
        console.error('Fullscreen error:', err);
      });
    }

    // ---------- Event monitors ----------
    function handleFullscreenChange() {
      if (!document.fullscreenElement && testActive) {
        // left fullscreen
        recordViolation('exited_fullscreen');

        // Show overlay (recordViolation does this), and try to nudge back into fullscreen.
        setTimeout(() => {
          document.documentElement.requestFullscreen().then(() => {
            console.log('Re-entered fullscreen');
            hideWarning();
          }).catch(() => {
            // If user denies automatic re-entry, we leave the overlay and mark test compromised
            alert('You exited fullscreen mode. The test has been compromised.');
            testActive = false;
            // Optionally auto-submit here (commented out)
            // submitTest(true);
          });
        }, 200);
      } else if (document.fullscreenElement && testActive) {
        hideWarning();
      }
    }

    function handleVisibilityChange() {
      if (document.hidden && testActive) {
        recordViolation('tab_hidden');
      } else if (!document.hidden && testActive) {
        hideWarning();
      }
    }

    function handleWindowBlur() {
      if (testActive) recordViolation('window_blur');
    }

    function handleWindowFocus() {
      if (testActive) hideWarning();
    }

    function monitorFullscreen() {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
    }

    // ---------- Input & shortcut protection ----------
    document.addEventListener('keydown', function(e) {
      if (!testActive) return;

      // a careful list of blocked shortcuts
      const blocked = (
        (e.ctrlKey && e.keyCode === 9) || // Ctrl+Tab
        (e.ctrlKey && e.shiftKey && e.keyCode === 9) || // Ctrl+Shift+Tab
        (e.altKey && e.keyCode === 9) || // Alt+Tab (note: not always capturable)
        (e.metaKey && e.keyCode === 9) || // Cmd+Tab
        e.keyCode === 123 || // F12
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || // DevTools
        (e.ctrlKey && e.keyCode === 85) || // Ctrl+U
        (e.ctrlKey && e.keyCode === 83) || // Ctrl+S
        (e.ctrlKey && e.keyCode === 80) || // Ctrl+P
        (e.ctrlKey && e.keyCode === 87) || // Ctrl+W
        (e.metaKey && e.keyCode === 87) || // Cmd+W
        e.keyCode === 27 // Escape
      );

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        recordViolation('keyboard_shortcut_blocked');
        return false;
      }
    });

    document.addEventListener('keyup', function(e) {
      if (testActive && (e.key === 'PrintScreen' || e.key === 'Print' || e.code === 'PrintScreen')) {
        // best-effort: try to clear clipboard (may be blocked by browser)
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText('');
        recordViolation('screenshot_attempt');
      }
    });

    document.addEventListener('contextmenu', function(e) {
      if (testActive) {
        e.preventDefault();
        recordViolation('right_click');
      }
    });

    // ---------- Server schedule & fetchers ----------
    async function getCurrentDay() {
      try {
        const response = await fetch(`${SCRIPT_URL}?action=getSchedule`);
        const schedule = await response.json();
        const now = new Date();
        let activeDay = null;
        for (let i = 1; i <= 5; i++) {
          const dayStart = schedule[`day${i}`] ? new Date(schedule[`day${i}`]) : null;
          const nextDay = schedule[`day${i + 1}`] ? new Date(schedule[`day${i + 1}`]) : null;
          if (dayStart && now >= dayStart) {
            if (!nextDay || now < nextDay) { activeDay = i; break; }
          }
        }
        return activeDay;
      } catch (err) {
        console.error('Error getting schedule', err);
        return null;
      }
    }

    // ---------- Test flow: start, timer, submit ----------
    async function startTestFlow() {
      const name = document.getElementById('studentName').value.trim();
      const email = document.getElementById('studentEmail').value.trim();
      const emailError = document.getElementById('emailError');
      emailError.textContent = '';

      if (!name || !email) { showStatus('startStatus', 'Please fill in all fields', 'error'); return; }
      if (!validateEmail(email)) { emailError.textContent = 'Please enter a valid email address (e.g., student@example.com)'; showStatus('startStatus', 'Invalid email format', 'error'); return; }

      showLoading('Determining current day...');
      currentDay = await getCurrentDay();
      if (!currentDay) { hideLoading(); showStatus('startStatus', 'No test is currently available. Please check the schedule.', 'error'); return; }

      showLoading(`Loading Day ${currentDay} questions...`);

      try {
        // check submission
        const checkResponse = await fetch(`${SCRIPT_URL}?action=checkSubmission&email=${encodeURIComponent(email)}&day=${currentDay}`);
        const checkData = await checkResponse.json();
        if (checkData.exists) { hideLoading(); showStatus('startStatus', 'You have already submitted this test!', 'error'); return; }

        // get questions
        const qResponse = await fetch(`${SCRIPT_URL}?action=getQuestions&day=${currentDay}`);
        questionsData = await qResponse.json();
        if (questionsData.error) { hideLoading(); showStatus('startStatus', 'Error: ' + questionsData.error, 'error'); return; }

        // populate
        document.getElementById('q1Text').textContent = questionsData.q1_text || '(no data)';
        document.getElementById('q2Text').textContent = questionsData.q2_text || '(no data)';
        document.getElementById('q3Text').textContent = questionsData.q3_text || '(no data)';
        document.getElementById('dayIndicator').textContent = `Day ${currentDay}`;
        hideLoading();

        // show the fullscreen confirm button
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn';
        confirmBtn.style.marginTop = '20px';
        confirmBtn.textContent = 'Enter Fullscreen & Begin Test';
        confirmBtn.onclick = async function() {
          try {
            await document.documentElement.requestFullscreen();
            // hide form show questions
            document.getElementById('studentForm').style.display = 'none';
            document.getElementById('questionSection').style.display = 'block';

            // lock UI & start monitoring
            document.body.classList.add('locked');
            testActive = true;
            monitorFullscreen();

            // start timers
            startTime = Date.now();
            q1StartTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer();

          } catch (err) {
            console.error('Fullscreen error', err);
            alert('Fullscreen mode is required to take the test. Please allow fullscreen and try again.');
          }
        };

        const statusEl = document.getElementById('startStatus');
        statusEl.textContent = 'Questions loaded! Click below to enter fullscreen mode and begin.';
        statusEl.className = 'status success';
        statusEl.style.display = 'block';
        document.getElementById('studentForm').appendChild(confirmBtn);

        // track focus transitions
        document.getElementById('q1Answer').addEventListener('focus', () => { if (!q1StartTime) q1StartTime = Date.now(); });
        document.getElementById('q2Answer').addEventListener('focus', () => { if (!q2StartTime) q2StartTime = Date.now(); });
        document.getElementById('q3Answer').addEventListener('focus', () => { if (!q3StartTime) q3StartTime = Date.now(); });

        // auto submit
        setTimeout(() => {
          if (testActive) {
            alert('Time is up! Your test will be submitted automatically.');
            submitTest(true);
          }
        }, TEST_DURATION);

      } catch (err) {
        hideLoading();
        showStatus('startStatus', 'Error connecting to server: ' + err.message, 'error');
        console.error(err);
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
      timerEl.textContent = `Time Remaining: ${hours}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
      timerEl.style.display = 'block';
      if (remaining < 10 * 60 * 1000) timerEl.style.color = '#ff6b6b';
      if (remaining <= 0) { clearInterval(timerInterval); submitTest(true); }
    }

    function cleanAnswer(answer) {
      return (answer || '').replace(/[^0-9-]/g, '').replace(/(?!^)-/g, '');
    }

    async function submitTest(isForced = false) {
      if (!testActive && !isForced) return;
      const name = document.getElementById('studentName').value.trim();
      const email = document.getElementById('studentEmail').value.trim();
      const q1Answer = cleanAnswer(document.getElementById('q1Answer').value.trim());
      const q2Answer = cleanAnswer(document.getElementById('q2Answer').value.trim());
      const q3Answer = document.getElementById('q3Answer').value.trim();

      if (!isForced && (!q1Answer || !q2Answer || !q3Answer)) { showStatus('submitStatus','Please answer all questions','error'); return; }

      testActive = false;
      clearInterval(timerInterval);
      const endTime = Date.now();
      const totalTime = Math.floor((endTime - startTime) / 1000);
      const q1Time = q2StartTime ? Math.floor((q2StartTime - q1StartTime) / 1000) : totalTime;
      const q2Time = q3StartTime ? Math.floor((q3StartTime - q2StartTime) / 1000) : 0;
      const q3Time = Math.floor((endTime - (q3StartTime || q2StartTime || q1StartTime)) / 1000);

      const q1Correct = q1Answer === cleanAnswer((questionsData && questionsData.q1_answer) || '');
      const q2Correct = q2Answer === cleanAnswer((questionsData && questionsData.q2_answer) || '');

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
        const response = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(submission) });
        const responseText = await response.text();
        const result = JSON.parse(responseText);
        hideLoading();

        if (result.success) {
          testActive = false;
          document.body.classList.remove('locked');
          hideWarning();
          if (document.exitFullscreen) document.exitFullscreen();

          document.getElementById('questionSection').style.display = 'none';
          const resultsHTML = `\n            <div style="text-align:center; padding:40px 20px;">\n              <h1 style="color:#28a745; margin-bottom:20px;">✅ Test Submitted Successfully!</h1>\n              <p style="font-size:18px; color:#666; margin-bottom:30px;">Thanks for submitting! Your score will be emailed to you soon.</p>\n              <div style="background:#f8f9fa; padding:30px; border-radius:8px; border-left:4px solid #EA5A2F; max-width:500px; margin:0 auto;">\n                <h2 style="margin-bottom:20px; color:#000">Your Results</h2>\n                <div style="text-align:left; margin-bottom:15px;">\n                  <strong style="color:#495057;">Question 1:</strong> \n                  <span class="${q1Correct ? 'correct' : 'incorrect'}" style="font-size:18px; margin-left:10px;">${q1Correct ? '✓ Correct' : '✗ Incorrect'}</span>\n                  <div style="color:#666; font-size:14px; margin-top:5px;">Your answer: ${q1Answer}</div>\n                </div>\n                <div style="text-align:left; margin-bottom:15px;">\n                  <strong style="color:#495057;">Question 2:</strong> \n                  <span class="${q2Correct ? 'correct' : 'incorrect'}" style="font-size:18px; margin-left:10px;">${q2Correct ? '✓ Correct' : '✗ Incorrect'}</span>\n                  <div style="color:#666; font-size:14px; margin-top:5px;">Your answer: ${q2Answer}</div>\n                </div>\n                <div style="text-align:left;">\n                  <strong style="color:#495057;">Question 3:</strong> \n                  <span style="color:#666; font-size:14px; margin-left:10px;">Will be graded manually</span>\n                </div>\n                <div style="margin-top:25px; padding-top:20px; border-top:2px solid #E3E3E3;">\n                  <strong style="color:#495057;">Total Time:</strong> \n                  <span style="color:#000; font-size:18px; margin-left:10px;">${Math.floor(totalTime/60)} minutes ${totalTime % 60} seconds</span>\n                </div>\n                ${exitCount > 0 ? `\n                <div style="margin-top:15px; padding:15px; background:#fff3cd; border-radius:6px;">\n                  <strong style="color:#856404;">⚠️ Violations: ${exitCount}</strong>\n                  <div style="color:#856404; font-size:14px; margin-top:5px;">These have been recorded and may affect your score.</div>\n                </div>` : ''}\n              </div>\n              <button class="btn" onclick="window.location.reload()" style="max-width:300px; margin:30px auto 0;">Back to Home</button>\n            </div>\n          `;

          document.querySelector('.container').innerHTML = resultsHTML;
        } else {
          showStatus('submitStatus', 'Error: ' + (result.error || 'Unknown error'), 'error');
          testActive = true; document.getElementById('submitBtn').disabled = false;
        }

      } catch (err) {
        hideLoading();
        showStatus('submitStatus', 'Error submitting: ' + err.message, 'error');
        console.error('Submit error', err);
        testActive = true; document.getElementById('submitBtn').disabled = false;
      }
    }

    // Warn before closing tab/window
    window.addEventListener('beforeunload', function(e) {
      if (testActive) {
        e.preventDefault();
        e.returnValue = '';
        recordViolation('attempted_close');
        return '';
      }
    });

    // Restrict inputs to digits for numeric fields
    document.addEventListener('DOMContentLoaded', function() {
      const numberInputs = ['q1Answer', 'q2Answer'];
      numberInputs.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', function(e) {
          const cleaned = cleanAnswer(e.target.value);
          if (e.target.value !== cleaned) e.target.value = cleaned;
        });
      });

      // wire up buttons
      document.getElementById('startBtn').addEventListener('click', startTestFlow);
      document.getElementById('submitBtn').addEventListener('click', () => submitTest(false));
    });

  </script>
</body>
</html>
