// ==============================
// UZH Map Guessr with Wix Leaderboard
// ==============================

const TOTAL_QUESTIONS = 10; // Number of questions per game
const API_URL = "https://www.uzhguessr.com/_functions/leaderboard"; // ✅ Wix backend endpoint

// State
let currentIndex = 0;
let score = 0;
let userGuess = null;
let guessLocked = false;
let QUESTIONS = [];
let gameQuestions = [];
let totalDistanceKm = 0;

// Elements
const screenStart = document.getElementById("screen-start");
const screenGame = document.getElementById("screen-game");
const screenResult = document.getElementById("screen-result");
const btnStart = document.getElementById("btn-start");
const btnNext = document.getElementById("btn-next");
const btnRestart = document.getElementById("btn-restart");
const questionText = document.getElementById("question-text");
const roundIndicator = document.getElementById("round-indicator");
const scoreIndicator = document.getElementById("score-indicator");
const resultSummary = document.getElementById("result-summary");
const campusMap = document.getElementById("campus-map");
const marker = document.getElementById("marker");
const correctMarker = document.getElementById("correct-marker");
const questionImage = document.getElementById("question-image");
const nameEntry = document.getElementById("name-entry");
const playerNameInput = document.getElementById("player-name");
const btnSaveScore = document.getElementById("btn-save-score");
const leaderboardBody = document.getElementById("leaderboard-body");
const btnClearLeaderboard = document.getElementById("btn-clear-leaderboard");

// Style markers
Object.assign(marker.style, {
  position: "absolute",
  width: "20px",
  height: "20px",
  background: "var(--danger)",
  borderRadius: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  display: "none",
  boxShadow: "0 0 12px rgba(255,0,0,0.5)",
  zIndex: 15
});
Object.assign(correctMarker.style, {
  position: "absolute",
  width: "20px",
  height: "20px",
  background: "var(--success)",
  borderRadius: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  display: "none",
  boxShadow: "0 0 12px rgba(0,255,0,0.4)",
  zIndex: 14
});

// Load questions from JSON
async function loadQuestions() {
  try {
    const res = await fetch("data/questions.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    QUESTIONS = await res.json();
  } catch (err) {
    console.error("Failed to load questions:", err);
    QUESTIONS = [];
  }
}

// Shuffle helper
function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

// Screen navigation
function setScreen(target) {
  [screenStart, screenGame, screenResult].forEach(s => s.classList.remove("active"));
  target.classList.add("active");
}

// Start game
async function startGame() {
  if (QUESTIONS.length === 0) await loadQuestions();

  const pool = [...QUESTIONS];
  shuffleArray(pool);
  gameQuestions = pool.slice(0, Math.min(TOTAL_QUESTIONS, pool.length));

  currentIndex = 0;
  score = 0;
  totalDistanceKm = 0;
  scoreIndicator.textContent = `Score: ${score}`;
  playerNameInput.value = "";
  nameEntry.style.display = "none";

  setScreen(screenGame);
  renderRound();
}

// Render a round
function renderRound() {
  const q = gameQuestions[currentIndex];
  userGuess = null;
  guessLocked = false;
  marker.style.display = "none";
  correctMarker.style.display = "none";

  questionText.textContent = `Where is: ${q.answer}?`;
  roundIndicator.textContent = `Round ${currentIndex + 1}/${gameQuestions.length}`;
  btnNext.disabled = true;

  questionImage.src = q.image;
}

// Compute draw parameters for campus map
function computeDrawParams() {
  const rect = campusMap.getBoundingClientRect();
  const dispW = rect.width;
  const dispH = rect.height;
  const natW = campusMap.naturalWidth || 1;
  const natH = campusMap.naturalHeight || 1;
  const style = window.getComputedStyle(campusMap);
  const objectFit = style.getPropertyValue('object-fit') || 'fill';

  const scale = objectFit === 'cover'
    ? Math.max(dispW / natW, dispH / natH)
    : Math.min(dispW / natW, dispH / natH);

  const drawW = natW * scale;
  const drawH = natH * scale;
  const offsetX = (dispW - drawW) / 2;
  const offsetY = (dispH - drawH) / 2;

  return { rect, dispW, dispH, drawW, drawH, offsetX, offsetY };
}

// Map click
campusMap.addEventListener("click", (e) => {
  if (guessLocked) return;

  const { rect, dispW, dispH, drawW, drawH, offsetX, offsetY } = computeDrawParams();
  const localX = e.clientX - rect.left;
  const localY = e.clientY - rect.top;
  const clickX = localX - offsetX;
  const clickY = localY - offsetY;

  if (clickX < 0 || clickX > drawW || clickY < 0 || clickY > drawH) {
    showMessage("Click inside the map area", "rgba(255,255,255,0.9)");
    return;
  }

  const xPct = (clickX / drawW) * 100;
  const yPct = (clickY / drawH) * 100;

  userGuess = { x: xPct, y: yPct };

  const leftPercent = ((offsetX + (xPct / 100) * drawW) / dispW) * 100;
  const topPercent = ((offsetY + (yPct / 100) * drawH) / dispH) * 100;
  marker.style.left = `${leftPercent}%`;
  marker.style.top = `${topPercent}%`;
  marker.style.display = "block";

  checkAnswer();
  guessLocked = true;
});

// Calculate distance
function calculateDistanceKm(x1, y1, x2, y2) {
  const mapWidthKm = 13;
  const mapHeightKm = 9;
  const dxKm = ((x2 - x1) / 100) * mapWidthKm;
  const dyKm = ((y2 - y1) / 100) * mapHeightKm;
  return Math.sqrt(dxKm * dxKm + dyKm * dyKm);
}

// Check answer
function checkAnswer() {
  const q = gameQuestions[currentIndex];
  if (!userGuess) return;

  const distanceKm = calculateDistanceKm(userGuess.x, userGuess.y, q.x, q.y);
  totalDistanceKm += distanceKm;

  const { dispW, dispH, drawW, drawH, offsetX, offsetY } = computeDrawParams();
  const correctLeft = ((offsetX + (q.x / 100) * drawW) / dispW) * 100;
  const correctTop = ((offsetY + (q.y / 100) * drawH) / dispH) * 100;
  correctMarker.style.left = `${correctLeft}%`;
  correctMarker.style.top = `${correctTop}%`;
  correctMarker.style.display = "block";

  const dx = q.x - userGuess.x;
  const dy = q.y - userGuess.y;
  const distancePercent = Math.sqrt(dx * dx + dy * dy);

  if (distancePercent < 5) {
    score++;
    scoreIndicator.textContent = `Score: ${score}`;
    showMessage(`✅ Correct! Distance: ${distanceKm.toFixed(2)} km`, "var(--success)");
  } else {
    showMessage(`❌ Wrong! Distance: ${distanceKm.toFixed(2)} km`, "var(--danger)");
  }

  btnNext.disabled = false;
}

// Show floating message
function showMessage(text, color) {
  const msg = document.createElement("div");
  msg.textContent = text;
  msg.style.position = "absolute";
  msg.style.top = "10px";
  msg.style.left = "50%";
  msg.style.transform = "translateX(-50%)";
  msg.style.background = color;
  msg.style.color = "#000";
  msg.style.padding = "0.4rem 0.8rem";
  msg.style.borderRadius = "10px";
  msg.style.fontWeight = "600";
  msg.style.boxShadow = "0 0 12px rgba(0,0,0,0.4)";
  msg.style.zIndex = "30";
  campusMap.parentElement.appendChild(msg);
  setTimeout(() => msg.remove(), 1200);
}

// Next question
btnNext.addEventListener("click", () => {
  if (currentIndex < TOTAL_QUESTIONS - 1) {
    currentIndex++;
    renderRound();
  } else {
    finish();
  }
});

// Finish game
function finish() {
  resultSummary.textContent = `You scored ${score} out of ${gameQuestions.length}. Total distance: ${totalDistanceKm.toFixed(2)} km.`;
  setScreen(screenResult);
  renderLeaderboard();
  nameEntry.style.display = score >= 5 ? "block" : "none";
}

// ==============================
// --- Leaderboard (Wix backend)
// ==============================

// Load leaderboard
async function loadLeaderboard() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err) {
    console.error("❌ Failed to load leaderboard:", err);
    return [];
  }
}

// Save leaderboard entry
async function saveLeaderboardEntry(name, correct, distance) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, correct, distance }),
    });
    if (!res.ok) throw new Error("Server error");
    showMessage("Saved to leaderboard ✅", "var(--accent)");
  } catch (err) {
    console.error("❌ Failed to save leaderboard:", err);
    alert("Could not save your score, please try again later.");
  }
}

// Render leaderboard
async function renderLeaderboard() {
  const data = await loadLeaderboard();
  leaderboardBody.innerHTML = "";
  data.forEach((entry, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="padding:0.4rem 0.3rem;">${i + 1}</td>
      <td style="padding:0.4rem 0.3rem;">${escapeHtml(entry.name)}</td>
      <td style="padding:0.4rem 0.3rem;">${entry.correct}</td>
      <td style="padding:0.4rem 0.3rem;">${Number(entry.distance).toFixed(2)}</td>
    `;
    leaderboardBody.appendChild(row);
  });
}

// Escape HTML
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

// Sanitize name
function sanitizeName(name) {
  return name ? name.trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 20) : "";
}

// Save score
btnSaveScore.addEventListener("click", async () => {
  const clean = sanitizeName(playerNameInput.value);
  if (!clean) return alert("Please enter a valid name.");
  if (score < 5) return alert("You need at least 5 correct answers to join the leaderboard.");
  await saveLeaderboardEntry(clean, score, parseFloat(totalDistanceKm.toFixed(3)));
  playerNameInput.value = "";
  nameEntry.style.display = "none";
  await renderLeaderboard();
});

// Clear leaderboard (local cache disabled)
btnClearLeaderboard.addEventListener("click", () => {
  alert("Leaderboard is stored on the server. It cannot be cleared locally.");
});

// ==============================
// --- Event bindings
// ==============================
btnRestart.addEventListener("click", () => setScreen(screenStart));
btnStart.addEventListener("click", startGame);
document.addEventListener("DOMContentLoaded", renderLeaderboard);
