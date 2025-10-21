// UZH Map Guessr with Leaderboard
const TOTAL_QUESTIONS = 10; // Number of questions per game

// State
let currentIndex = 0;
let score = 0;
let userGuess = null;
let guessLocked = false;
let QUESTIONS = []; // loaded from JSON
let gameQuestions = []; // the 5 random questions for current game
let totalDistanceKm = 0; // accumulated distance for current game

// Leaderboard storage key
const LEADERBOARD_KEY = "uzh_map_leaderboard_v1";

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
    QUESTIONS = []; // keep empty
  }
}

// Helper: shuffle an array
function shuffleArray(array) {
  // Fisher-Yates would be better, but this is simple and fine here
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

  // Pick random questions for this game (if not enough questions, use all)
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
  // campusMap image already set in HTML; ensure it is up-to-date if you want a different map
  // campusMap.src = "images/uzh_map.jpeg";
}

// compute draw params for campusMap (drawW/drawH and offsets)
function computeDrawParams() {
  const rect = campusMap.getBoundingClientRect();
  const dispW = rect.width;
  const dispH = rect.height;
  const natW = campusMap.naturalWidth || 1;
  const natH = campusMap.naturalHeight || 1;

  const style = window.getComputedStyle(campusMap);
  const objectFit = style.getPropertyValue('object-fit') || 'fill';

  let scale, drawW, drawH, offsetX, offsetY;
  if (objectFit === 'cover') {
    scale = Math.max(dispW / natW, dispH / natH);
  } else {
    scale = Math.min(dispW / natW, dispH / natH);
  }
  drawW = natW * scale;
  drawH = natH * scale;
  offsetX = (dispW - drawW) / 2;
  offsetY = (dispH - drawH) / 2;

  return { rect, dispW, dispH, natW, natH, drawW, drawH, offsetX, offsetY };
}

// Map click handler (robust)
campusMap.addEventListener("click", (e) => {
  if (guessLocked) return;

  const { rect, dispW, dispH, drawW, drawH, offsetX, offsetY } = computeDrawParams();

  // coordinates relative to the element top-left
  const localX = e.clientX - rect.left;
  const localY = e.clientY - rect.top;

  // coordinates relative to the drawn image area
  const clickX_onDrawn = localX - offsetX;
  const clickY_onDrawn = localY - offsetY;

  // ignore clicks outside the visible image area (letterbox)
  if (clickX_onDrawn < 0 || clickX_onDrawn > drawW || clickY_onDrawn < 0 || clickY_onDrawn > drawH) {
    // optional small feedback: flash a little message
    showMessage("Click inside the map area", "rgba(255,255,255,0.9)");
    return;
  }

  // convert to percentages relative to the drawn image
  const xPct = (clickX_onDrawn / drawW) * 100;
  const yPct = (clickY_onDrawn / drawH) * 100;

  // Save guess
  userGuess = { x: xPct, y: yPct };

  // Compute marker positions relative to the container (so left/top % work)
  // left% = (offsetX + xPct/100 * drawW) / dispW * 100
  const leftPercent = ((offsetX + (xPct / 100) * drawW) / dispW) * 100;
  const topPercent  = ((offsetY + (yPct / 100) * drawH) / dispH) * 100;

  marker.style.left = `${leftPercent}%`;
  marker.style.top  = `${topPercent}%`;
  marker.style.display = "block";

  // Lock and evaluate
  checkAnswer(); // checkAnswer will use gameQuestions[currentIndex].x/.y (they are percentages relative to the intrinsic image)
  guessLocked = true;
});

// Helper: convert percentage distance to kilometers
function calculateDistanceKm(x1, y1, x2, y2) {
  // Adjust these to reflect real campus extents if you want more accuracy.
  const mapWidthKm = 13;  // width of the map in km (approx)
  const mapHeightKm = 9;  // height of the map in km (approx)

  const dxKm = ((x2 - x1) / 100) * mapWidthKm;
  const dyKm = ((y2 - y1) / 100) * mapHeightKm;

  return Math.sqrt(dxKm * dxKm + dyKm * dyKm);
}

// Check answer (updates score and totalDistanceKm)
function checkAnswer() {
  const q = gameQuestions[currentIndex];
  if (!userGuess) return;

  const dx = q.x - userGuess.x;
  const dy = q.y - userGuess.y;
  const distancePercent = Math.sqrt(dx * dx + dy * dy);

  // Calculate distance in km and accumulate
  const distanceKm = calculateDistanceKm(userGuess.x, userGuess.y, q.x, q.y);
  totalDistanceKm += distanceKm;

  // Place correct marker using same drawn-image computations
  const { dispW, dispH, drawW, drawH, offsetX, offsetY } = computeDrawParams();
  const correctLeftPercent = ((offsetX + (q.x / 100) * drawW) / dispW) * 100;
  const correctTopPercent  = ((offsetY + (q.y / 100) * drawH) / dispH) * 100;

  correctMarker.style.left = `${correctLeftPercent}%`;
  correctMarker.style.top  = `${correctTopPercent}%`;
  correctMarker.style.display = "block";

  if (distancePercent < 5) {
    score++;
    scoreIndicator.textContent = `Score: ${score}`;
    showMessage(`✅ Correct! Distance: ${distanceKm.toFixed(2)} km`, "var(--success)");
  } else {
    showMessage(`❌ Wrong! Distance: ${distanceKm.toFixed(2)} km`, "var(--danger)");
  }

  btnNext.disabled = false;
}

// Show message (temporary)
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

// Finish game (show results and leaderboard)
function finish() {
  resultSummary.textContent = `You scored ${score} out of ${gameQuestions.length}. Total distance: ${totalDistanceKm.toFixed(2)} km.`;
  setScreen(screenResult);

  // Render leaderboard for display to everyone
  renderLeaderboard();

  // Show name entry only if player scored at least 5 correct
  if (score >= 5) {
    nameEntry.style.display = "block";
  } else {
    nameEntry.style.display = "none";
  }
}
// Leaderboard helpers

// sanitize input and block obviously offensive words (simple filter)
function sanitizeName(name) {
  if (!name) return null;
  let clean = name.trim();
  // Remove weird characters but keep letters, numbers, spaces and basic punctuation
  clean = clean.replace(/[^\p{L}\p{N} \-_'"]/gu, "");
  // Minimum length after trimming
  if (clean.length < 1) return null;

  // simple offensive words list (case-insensitive)
  const badWords = [
    "fuck","shit","bitch","ass","dick","cock","cunt","nigger","fag","whore","slut","sex","arse"
  ];
  const lowered = clean.toLowerCase();
  for (const bad of badWords) {
    if (lowered.includes(bad)) return null;
  }
  // Trim to reasonable length
  return clean.slice(0, 20);
}

import { addScore, getLeaderboard } from 'backend/leaderboard.jsw';

// Load leaderboard from Wix backend
async function loadLeaderboard() {
  try {
    const data = await getLeaderboard();
    return data || [];
  } catch (err) {
    console.error("Failed to load leaderboard:", err);
    return [];
  }
}

// Save new entry to Wix backend
async function saveToLeaderboard(entry) {
  try {
    await addScore(entry.name, entry.correct, entry.distance);
    showMessage("✅ Saved to global leaderboard", "var(--accent)");
  } catch (err) {
    console.error("Failed to save leaderboard entry:", err);
    showMessage("⚠️ Could not save score", "var(--danger)");
  }
}

// Render leaderboard (load from Wix each time)
async function renderLeaderboard() {
  const data = await loadLeaderboard();
  data.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    return a.distance - b.distance;
  });

  leaderboardBody.innerHTML = "";
  data.forEach((entry, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="padding:0.4rem 0.3rem;">${i + 1}</td>
      <td style="padding:0.4rem 0.3rem;">${escapeHtml(entry.name)}</td>
      <td style="padding:0.4rem 0.3rem;">${entry.correct}</td>
      <td style="padding:0.4rem 0.3rem;">${entry.distance.toFixed(2)}</td>
    `;
    leaderboardBody.appendChild(row);
  });
}

// small utility to avoid injecting raw HTML
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}


btnSaveScore.addEventListener("click", async () => {
  const raw = playerNameInput.value;
  const clean = sanitizeName(raw);
  if (!clean) {
    alert("Please enter a valid, non-offensive name (1–20 characters).");
    return;
  }
  if (score < 5) {
    alert("You need at least 5 correct answers to join the leaderboard.");
    return;
  }

  await saveToLeaderboard({
    name: clean,
    correct: score,
    distance: parseFloat(totalDistanceKm.toFixed(3))
  });

  playerNameInput.value = "";
  nameEntry.style.display = "none";
  renderLeaderboard();
});

// Clear leaderboard (local only)
btnClearLeaderboard.addEventListener("click", () => {
  if (!confirm("Clear the leaderboard locally? This will remove all saved entries in your browser.")) return;
  saveLeaderboard([]);
  renderLeaderboard();
  showMessage("Leaderboard cleared", "rgba(255,255,255,0.9)");
});

// Event listeners
btnRestart.addEventListener("click", () => setScreen(screenStart));
btnStart.addEventListener("click", startGame);

// On load render leaderboard (so it's visible on the result screen initially)
document.addEventListener("DOMContentLoaded", () => {
  renderLeaderboard();
});