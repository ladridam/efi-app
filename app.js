// ========== HELPER FUNCTIONS ==========
function getCurrentDay() {
    const start = new Date(COHORT_START);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.min(diffDays + 1, 30); // Max 30 days
}

async function apiCall(params) {
    const url = new URL(API_BASE);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    const response = await fetch(url);
    return response.json();
}

async function saveResponse(day, moduleType, answer, isCorrect = false) {
    return await apiCall({
        action: 'saveResponse',
        code: currentStudent.code,
        day: day,
        moduleType: moduleType,
        answer: answer,
        isCorrect: isCorrect
    });
}

function speak(word) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.8;
        speechSynthesis.cancel(); // Stop any ongoing speech
        speechSynthesis.speak(utterance);
    } else {
        alert('Audio not supported on this device');
    }
}

// ========== LOGIN ==========
async function login() {
    const code = document.getElementById('studentCode').value.trim();
    if (!code) {
        alert('Please enter your code');
        return;
    }
    
    const result = await apiCall({ action: 'login', code: code });
    
    if (result.success) {
        currentStudent.code = code;
        currentStudent.name = result.name;
        localStorage.setItem('efi_student', JSON.stringify(currentStudent));
        window.location.href = 'student.html';
    } else {
        alert('Invalid code. Please check with your teacher.');
    }
}

// ========== STUDENT DASHBOARD ==========
async function loadStudentDashboard() {
    // Load saved student data
    const saved = localStorage.getItem('efi_student');
    if (saved) {
        currentStudent = JSON.parse(saved);
        document.getElementById('studentName').textContent = currentStudent.name;
    }
    
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning,' : (hour < 18 ? 'Good afternoon,' : 'Good evening,');
    document.getElementById('greeting').textContent = greeting;
    
    const currentDay = getCurrentDay();
    document.getElementById('currentDay').textContent = currentDay;
    
    // Load streak (from localStorage for now)
    const streak = localStorage.getItem('efi_streak') || 0;
    document.getElementById('streakBadge').innerHTML = `🔥 ${streak} day${streak !== 1 ? 's' : ''}`;
    
    // Load modules
    await loadModules(currentDay);
}

async function loadModules(day) {
    const modules = await apiCall({ action: 'getModules' });
    const container = document.getElementById('modulesContainer');
    container.innerHTML = '';
    
    // Filter modules for this day
    const dayModules = modules.filter(m => m[0] == day);
    
    if (dayModules.length === 0) {
        container.innerHTML = '<div class="module-card">No modules for today. Check back tomorrow!</div>';
        return;
    }
    
    for (const module of dayModules) {
        const [_, moduleType, title, content, correctAnswer, hint] = module;
        const card = createModuleCard(moduleType, title, content, correctAnswer, hint, day);
        container.appendChild(card);
    }
}

function createModuleCard(type, title, content, correctAnswer, hint, day) {
    const card = document.createElement('div');
    card.className = 'module-card';
    
    const typeLabel = type.replace('_', ' ').toUpperCase();
    
    if (type === 'spell_say') {
        card.innerHTML = `
            <div class="module-type">${typeLabel}</div>
            <div class="module-title">${title}</div>
            <div class="module-content">
                <strong>${content}</strong>
                ${hint ? `<div style="font-size:12px; margin-top:4px;">${hint}</div>` : ''}
                <button class="save-btn" style="margin-top:8px; background:transparent; border:1px solid var(--border);" onclick="speak('${content}')">🔊 Listen</button>
            </div>
            <input type="text" class="module-input" placeholder="Type the word..." id="input_${type}_${day}">
            <button class="save-btn" onclick="saveSpelling('${day}', '${content}', 'input_${type}_${day}')">Save</button>
            <div id="feedback_${type}_${day}" class="feedback-success"></div>
        `;
    } 
    else if (type === 'vocab') {
        card.innerHTML = `
            <div class="module-type">${typeLabel}</div>
            <div class="module-title">${title}</div>
            <div class="module-content">${content}</div>
            <button class="save-btn" style="background:transparent; border:1px solid var(--border);" onclick="speak('${title.split(':')[0].trim()}')">🔊 Listen</button>
            <button class="save-btn" style="margin-top:8px;" onclick="markVocabSeen('${day}', '${title}')">✓ Mark as learned</button>
        `;
    }
    else if (type === 'sentence') {
        card.innerHTML = `
            <div class="module-type">${typeLabel}</div>
            <div class="module-title">${title}</div>
            <div class="module-content">${content}</div>
            <textarea class="module-input" rows="2" placeholder="Write your sentence here..." id="input_${type}_${day}"></textarea>
            <button class="save-btn" onclick="saveSentence('${day}', 'input_${type}_${day}')">Save</button>
        `;
    }
    else if (type === 'translation') {
        card.innerHTML = `
            <div class="module-type">${typeLabel}</div>
            <div class="module-title">${title}</div>
            <div class="module-content">${content}</div>
            <input type="text" class="module-input" placeholder="Type English translation..." id="input_${type}_${day}">
            <button class="save-btn" onclick="checkTranslation('${day}', '${correctAnswer}', 'input_${type}_${day}')">Check & Save</button>
            <div id="feedback_${type}_${day}" class="feedback-success"></div>
        `;
    }
    else if (type === 'quick_check') {
        const [q, optA, optB, optC] = content.split('|');
        card.innerHTML = `
            <div class="module-type">${typeLabel}</div>
            <div class="module-title">${title}</div>
            <div class="module-content">${q}</div>
            <div class="quiz-option" data-answer="${optA}">A. ${optA}</div>
            <div class="quiz-option" data-answer="${optB}">B. ${optB}</div>
            <div class="quiz-option" data-answer="${optC}">C. ${optC}</div>
            <button class="save-btn" style="margin-top:8px;" onclick="checkQuickCheck('${day}', '${correctAnswer}', this)">Submit</button>
            <div id="feedback_${type}_${day}" class="feedback-success"></div>
        `;
        
        // Add click handlers to options
        const options = card.querySelectorAll('.quiz-option');
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });
    }
    
    return card;
}

// Module save functions
async function saveSpelling(day, correctWord, inputId) {
    const input = document.getElementById(inputId);
    const answer = input.value.trim().toLowerCase();
    const isCorrect = answer === correctWord.toLowerCase();
    await saveResponse(day, 'spell_say', answer, isCorrect);
    
    const feedback = document.getElementById(`feedback_${inputId.replace('input_', '')}`);
    if (isCorrect) {
        feedback.textContent = '✓ Correct!';
        feedback.style.color = 'var(--success)';
    } else {
        feedback.textContent = `✗ Incorrect. Correct spelling: ${correctWord}`;
        feedback.style.color = 'var(--error)';
    }
    
    setTimeout(() => feedback.textContent = '', 2000);
}

async function markVocabSeen(day, word) {
    await saveResponse(day, 'vocabulary', `seen: ${word}`, true);
    alert('✓ Marked as learned!');
}

async function saveSentence(day, inputId) {
    const input = document.getElementById(inputId);
    const sentence = input.value.trim();
    if (sentence) {
        await saveResponse(day, 'sentence_builder', sentence, true);
        alert('✓ Sentence saved!');
        input.value = '';
    } else {
        alert('Please write a sentence first');
    }
}

async function checkTranslation(day, correctAnswer, inputId) {
    const input = document.getElementById(inputId);
    const answer = input.value.trim().toLowerCase();
    const isCorrect = answer === correctAnswer.toLowerCase();
    await saveResponse(day, 'translation', answer, isCorrect);
    
    const feedback = document.getElementById(`feedback_${inputId.replace('input_', '')}`);
    if (isCorrect) {
        feedback.textContent = '✓ Correct translation!';
        feedback.style.color = 'var(--success)';
    } else {
        feedback.textContent = `✗ Expected: ${correctAnswer}`;
        feedback.style.color = 'var(--error)';
    }
    
    setTimeout(() => feedback.textContent = '', 2000);
}

async function checkQuickCheck(day, correctAnswer, btn) {
    const card = btn.closest('.module-card');
    const selected = card.querySelector('.quiz-option.selected');
    
    if (!selected) {
        alert('Please select an answer');
        return;
    }
    
    const answer = selected.dataset.answer;
    const isCorrect = answer === correctAnswer;
    await saveResponse(day, 'quick_check', answer, isCorrect);
    
    const feedback = card.querySelector('.feedback-success');
    if (isCorrect) {
        feedback.textContent = '✓ Correct!';
        feedback.style.color = 'var(--success)';
        selected.classList.add('correct');
    } else {
        feedback.textContent = `✗ Incorrect. Correct answer: ${correctAnswer}`;
        feedback.style.color = 'var(--error)';
        selected.classList.add('wrong');
    }
    
    setTimeout(() => feedback.textContent = '', 2000);
}

// ========== NAVIGATION ==========
function setupNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tab = btn.dataset.tab;
            if (tab === 'today') {
                document.getElementById('modulesContainer').style.display = 'flex';
                document.getElementById('quizModal').style.display = 'none';
                loadModules(getCurrentDay());
            } else if (tab === 'quiz') {
                document.getElementById('modulesContainer').style.display = 'none';
                openQuiz();
            } else if (tab === 'progress') {
                document.getElementById('modulesContainer').style.display = 'none';
                showProgress();
            }
        });
    });
}

async function openQuiz() {
    const modal = document.getElementById('quizModal');
    modal.style.display = 'block';
    await loadQuiz();
}

function closeQuiz() {
    document.getElementById('quizModal').style.display = 'none';
}

async function loadQuiz() {
    const week = Math.ceil(getCurrentDay() / 7);
    const questions = await apiCall({ action: 'getQuiz', week: week });
    const container = document.getElementById('quizContainer');
    container.innerHTML = '';
    
    if (questions.length === 0) {
        container.innerHTML = '<p>No quiz available yet. Check back Friday!</p>';
        return;
    }
    
    let quizHTML = '<div id="quizQuestions">';
    questions.forEach((q, idx) => {
        quizHTML += `
            <div class="quiz-question" data-qid="${idx}" data-correct="${q[6]}">
                <p style="font-weight:500; margin-bottom:8px;">${idx+1}. ${q[1]}</p>
                <div class="quiz-option" data-value="A">A. ${q[2]}</div>
                <div class="quiz-option" data-value="B">B. ${q[3]}</div>
                <div class="quiz-option" data-value="C">C. ${q[4]}</div>
            </div>
            <div style="margin-bottom:20px;"></div>
        `;
    });
    quizHTML += '<button class="btn btn-primary" onclick="submitQuiz()">Submit Quiz</button></div>';
    container.innerHTML = quizHTML;
    
    // Add click handlers
    document.querySelectorAll('.quiz-question').forEach(q => {
        q.querySelectorAll('.quiz-option').forEach(opt => {
            opt.addEventListener('click', () => {
                q.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });
    });
}

async function submitQuiz() {
    let score = 0;
    let total = 0;
    
    document.querySelectorAll('.quiz-question').forEach(q => {
        total++;
        const selected = q.querySelector('.quiz-option.selected');
        const correct = q.dataset.correct;
        
        if (selected && selected.dataset.value === correct) {
            score++;
            selected.classList.add('correct');
        } else if (selected) {
            selected.classList.add('wrong');
        }
    });
    
    const percentage = Math.round((score / total) * 100);
    await apiCall({
        action: 'saveQuizScore',
        code: currentStudent.code,
        score: percentage
    });
    
    alert(`Quiz complete!\nScore: ${score}/${total} (${percentage}%)\nCheck your progress tab for details.`);
    closeQuiz();
    
    // Update streak
    const today = new Date().toDateString();
    const lastActive = localStorage.getItem('efi_last_active');
    let streak = parseInt(localStorage.getItem('efi_streak') || '0');
    
    if (lastActive === today) {
        // Already counted
    } else if (lastActive === new Date(Date.now() - 86400000).toDateString()) {
        streak++;
        localStorage.setItem('efi_streak', streak);
    } else {
        streak = 1;
        localStorage.setItem('efi_streak', streak);
    }
    localStorage.setItem('efi_last_active', today);
}

async function showProgress() {
    const container = document.getElementById('modulesContainer');
    
    // Get saved responses from localStorage (in real version, fetch from API)
    const streak = localStorage.getItem('efi_streak') || 0;
    
    container.innerHTML = `
        <div class="progress-stats">
            <div class="stat-card">
                <div class="stat-value">${streak}</div>
                <div class="stat-label">Day Streak</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${getCurrentDay() - 1}</div>
                <div class="stat-label">Days Completed</div>
            </div>
        </div>
        
        <h3 style="margin-bottom:12px;">Skills Progress</h3>
        <div class="skill-bar">
            <div class="skill-label"><span>Spelling</span><span id="spellingPct">0%</span></div>
            <div class="skill-track"><div class="skill-fill" id="spellingFill" style="width:0%"></div></div>
        </div>
        <div class="skill-bar">
            <div class="skill-label"><span>Vocabulary</span><span id="vocabPct">0%</span></div>
            <div class="skill-track"><div class="skill-fill" id="vocabFill" style="width:0%"></div></div>
        </div>
        <div class="skill-bar">
            <div class="skill-label"><span>Translation</span><span id="transPct">0%</span></div>
            <div class="skill-track"><div class="skill-fill" id="transFill" style="width:0%"></div></div>
        </div>
        
        <button class="btn btn-secondary" style="margin-top:20px;" onclick="loadModules(getCurrentDay())">← Back to Today</button>
    `;
    
    // For demo, set some sample percentages
    document.getElementById('spellingFill').style.width = '65%';
    document.getElementById('spellingPct').textContent = '65%';
    document.getElementById('vocabFill').style.width = '70%';
    document.getElementById('vocabPct').textContent = '70%';
    document.getElementById('transFill').style.width = '55%';
    document.getElementById('transPct').textContent = '55%';
}

// ========== INIT ==========
if (document.getElementById('loginBtn')) {
    document.getElementById('loginBtn').addEventListener('click', login);
    document.getElementById('studentCode').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
}

if (document.getElementById('studentName')) {
    loadStudentDashboard();
    setupNavigation();
}