// ======================
// UZH Map Guessr - Wix Page Code
// ======================

import { addScore, getLeaderboard } from 'backend/leaderboard.jsw';

// ----------------------
// Constants & State
// ----------------------
const TOTAL_QUESTIONS = 10;

let currentIndex = 0;
let score = 0;
let userGuess = null;
let guessLocked = false;
let QUESTIONS = [];
let gameQuestions = [];
let totalDistanceKm = 0;

// ----------------------
// DOM Elements
// ----------------------
const screenStart = $w('#screen-start');
const screenGame = $w('#screen-game');
const screenResult = $w('#screen-result');
const btnStart = $w('#btn-start');
const btnNext = $w('#btn-next');
const btnRestart = $w('#btn-restart');
const questionText = $w('#question-text');
const roundIndicator = $w('#round-indicator');
const scoreIndicator = $w('#score-indicator');
const resultSummary = $w('#result-summary');
const campusMap = $w('#campus-map');
const marker = $w('#marker');
const correctMarker = $w('#correct-marker');
const questionImage = $w('#question-image');
const nameEntry = $w('#name-entry');
const playerNameInput = $w('#player-name');
const btnSaveScore = $w('#btn-save-score');
const leaderboardBody = $w('#leaderboard-body');
const btnClearLeaderboard = $w('#btn-clear-leaderboard');

// ----------------------
// Load questions
// ----------------------
async function loadQuestions() {
    try {
        const res = await fetch("/data/questions.json");
        if (!res.ok) throw new Error("HTTP " + res.status);
        QUESTIONS = await res.json();
    } catch (err) {
        console.error("Failed to load questions:", err);
        QUESTIONS = [];
    }
}

// ----------------------
// Helpers
// ----------------------
function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

function setScreen(screen) {
    [screenStart, screenGame, screenResult].forEach(s => s.hide());
    screen.show();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

function sanitizeName(name) {
    if (!name) return null;
    let clean = name.trim();
    clean = clean.replace(/[^\p{L}\p{N} \-_'"]/gu, "");
    if (clean.length < 1) return null;

    const badWords = [
        "fuck","shit","bitch","ass","dick","cock","cunt","nigger","fag","whore","slut","sex","arse"
    ];
    const lowered = clean.toLowerCase();
    for (const bad of badWords) if (lowered.includes(bad)) return null;

    return clean.slice(0, 20);
}

// ----------------------
// Game Logic
// ----------------------
async function startGame() {
    if (QUESTIONS.length === 0) await loadQuestions();
    const pool = [...QUESTIONS];
    shuffleArray(pool);
    gameQuestions = pool.slice(0, Math.min(TOTAL_QUESTIONS, pool.length));

    currentIndex = 0;
    score = 0;
    totalDistanceKm = 0;
    scoreIndicator.text = `Score: ${score}`;
    playerNameInput.value = "";
    nameEntry.hide();

    setScreen(screenGame);
    renderRound();
}

function renderRound() {
    const q = gameQuestions[currentIndex];
    userGuess = null;
    guessLocked = false;
    marker.hide();
    correctMarker.hide();

    questionText.text = `Where is: ${q.answer}?`;
    roundIndicator.text = `Round ${currentIndex + 1}/${gameQuestions.length}`;
    btnNext.disable();
    questionImage.src = q.image;
}

function computeDrawParams() {
    const rect = campusMap.rendered ? campusMap.box : { width: 1, height: 1, left: 0, top: 0 };
    const dispW = rect.width;
    const dispH = rect.height;
    const natW = campusMap.naturalWidth || 1;
    const natH = campusMap.naturalHeight || 1;
    const objectFit = "fill";

    let scale, drawW, drawH, offsetX, offsetY;
    scale = Math.min(dispW / natW, dispH / natH);
    drawW = natW * scale;
    drawH = natH * scale;
    offsetX = (dispW - drawW) / 2;
    offsetY = (dispH - drawH) / 2;

    return { dispW, dispH, drawW, drawH, offsetX, offsetY };
}

function calculateDistanceKm(x1, y1, x2, y2) {
    const mapWidthKm = 13;
    const mapHeightKm = 9;
    const dxKm = ((x2 - x1) / 100) * mapWidthKm;
    const dyKm = ((y2 - y1) / 100) * mapHeightKm;
    return Math.sqrt(dxKm * dxKm + dyKm * dyKm);
}

function checkAnswer() {
    const q = gameQuestions[currentIndex];
    if (!userGuess) return;

    const dx = q.x - userGuess.x;
    const dy = q.y - userGuess.y;
    const distancePercent = Math.sqrt(dx * dx + dy * dy);
    const distanceKm = calculateDistanceKm(userGuess.x, userGuess.y, q.x, q.y);
    totalDistanceKm += distanceKm;

    const { dispW, dispH, drawW, drawH, offsetX, offsetY } = computeDrawParams();
    correctMarker.show();
    correctMarker.left = ((offsetX + (q.x / 100) * drawW) / dispW) * 100 + "%";
    correctMarker.top = ((offsetY + (q.y / 100) * drawH) / dispH) * 100 + "%";

    if (distancePercent < 5) {
        score++;
        scoreIndicator.text = `Score: ${score}`;
        showMessage(`✅ Correct! Distance: ${distanceKm.toFixed(2)} km`, "var(--success)");
    } else {
        showMessage(`❌ Wrong! Distance: ${distanceKm.toFixed(2)} km`, "var(--danger)");
    }

    btnNext.enable();
}

function finish() {
    resultSummary.text = `You scored ${score} out of ${gameQuestions.length}. Total distance: ${totalDistanceKm.toFixed(2)} km.`;
    setScreen(screenResult);
    renderLeaderboard();
    score >= 5 ? nameEntry.show() : nameEntry.hide();
}

// ----------------------
// Leaderboard Functions
// ----------------------
async function loadLeaderboard() {
    try {
        const data = await getLeaderboard();
        return data || [];
    } catch (err) {
        console.error(err);
        return [];
    }
}

async function saveToLeaderboard(entry) {
    try {
        await addScore(entry.name, entry.correct, entry.distance);
        showMessage("✅ Saved to global leaderboard", "var(--accent)");
    } catch (err) {
        console.error(err);
        showMessage("⚠️ Could not save score", "var(--danger)");
    }
}

async function renderLeaderboard() {
    const data = await loadLeaderboard();
    data.sort((a, b) => b.correct - a.correct || a.distance - b.distance);
    leaderboardBody.html = "";
    data.forEach((entry, i) => {
        leaderboardBody.html += `
            <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(entry.name)}</td>
                <td>${entry.correct}</td>
                <td>${entry.distance.toFixed(2)}</td>
            </tr>
        `;
    });
}

// ----------------------
// Event Listeners
// ----------------------
campusMap.onClick((e) => {
    if (guessLocked) return;

    const { dispW, dispH, drawW, drawH, offsetX, offsetY } = computeDrawParams();

    const localX = e.offsetX;
    const localY = e.offsetY;

    const xPct = (localX / drawW) * 100;
    const yPct = (localY / drawH) * 100;
    userGuess = { x: xPct, y: yPct };

    marker.show();
    marker.left = ((offsetX + (xPct / 100) * drawW) / dispW) * 100 + "%";
    marker.top = ((offsetY + (yPct / 100) * drawH) / dispH) * 100 + "%";

    guessLocked = true;
    checkAnswer();
});

btnNext.onClick(() => {
    if (currentIndex < TOTAL_QUESTIONS - 1) {
        currentIndex++;
        renderRound();
    } else {
        finish();
    }
});

btnStart.onClick(startGame);
btnRestart.onClick(() => setScreen(screenStart));

btnSaveScore.onClick(async () => {
    const raw = playerNameInput.value;
    const clean = sanitizeName(raw);
    if (!clean) {
        $w.alert("Please enter a valid, non-offensive name (1–20 characters).");
        return;
    }
    if (score < 5) {
        $w.alert("You need at least 5 correct answers to join the leaderboard.");
        return;
    }

    await saveToLeaderboard({
        name: clean,
        correct: score,
        distance: parseFloat(totalDistanceKm.toFixed(3))
    });

    playerNameInput.value = "";
    nameEntry.hide();
    renderLeaderboard();
});

btnClearLeaderboard.onClick(() => {
    leaderboardBody.html = "";
    showMessage("Leaderboard cleared", "rgba(255,255,255,0.9)");
});

// ----------------------
// Show message (temporary)
// ----------------------
function showMessage(text, color) {
    $w('#screen-game').insertAdjacentHTML('beforeend', `
        <div class="temp-msg" style="position:absolute;top:10px;left:50%;transform:translateX(-50%);
        background:${color};color:#000;padding:0.4rem 0.8rem;border-radius:10px;font-weight:600;z-index:30;">
        ${text}</div>`);
    setTimeout(() => {
        const msg = $w('#screen-game').getChildren().filter(c => c.className === "temp-msg")[0];
        if (msg) msg.remove();
    }, 1200);
}

// ----------------------
// Init
// ----------------------
$w.onReady(() => {
    renderLeaderboard();
});
