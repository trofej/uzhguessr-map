// UZH Map Guessr
const TOTAL_QUESTIONS = 5; // Number of questions per game

// State
let currentIndex = 0;
let score = 0;
let userGuess = null;
let guessLocked = false;
let QUESTIONS = []; // loaded from JSON
let gameQuestions = []; // the 5 random questions for current game

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
  boxShadow: "0 0 12px rgba(255,0,0,0.5)"
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
  boxShadow: "0 0 12px rgba(0,255,0,0.4)"
});

// Load questions from JSON
async function loadQuestions() {
  const res = await fetch("data/questions.json");
  QUESTIONS = await res.json();
}

// Helper: shuffle an array
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

  // Pick 5 random questions for this game
  gameQuestions = shuffleArray([...QUESTIONS]).slice(0, TOTAL_QUESTIONS);

  currentIndex = 0;
  score = 0;
  scoreIndicator.textContent = `Score: ${score}`;
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
  roundIndicator.textContent = `Round ${currentIndex + 1}/${TOTAL_QUESTIONS}`;
  btnNext.disabled = true;

  questionImage.src = q.image;
  campusMap.src = "images/uzh_map.jpeg";
}

// Map click handler
campusMap.addEventListener("click", e => {
  if (guessLocked) return;

  const rect = campusMap.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;

  userGuess = { x, y };
  marker.style.left = `${x}%`;
  marker.style.top = `${y}%`;
  marker.style.display = "block";

  checkAnswer();
  guessLocked = true;
});

// Helper: convert percentage distance to kilometers
function calculateDistanceKm(x1, y1, x2, y2) {
  // Assuming the map represents a 1 km x 1 km area
  const mapWidthKm = 13;  // width of the map in km
  const mapHeightKm = 9; // height of the map in km

  const dxKm = ((x2 - x1) / 100) * mapWidthKm;
  const dyKm = ((y2 - y1) / 100) * mapHeightKm;

  return Math.sqrt(dxKm * dxKm + dyKm * dyKm);
}

// Check answer
function checkAnswer() {
  const q = gameQuestions[currentIndex];
  const dx = q.x - userGuess.x;
  const dy = q.y - userGuess.y;
  const distancePercent = Math.sqrt(dx * dx + dy * dy);

  // Show correct marker
  correctMarker.style.left = `${q.x}%`;
  correctMarker.style.top = `${q.y}%`;
  correctMarker.style.display = "block";

  // Calculate distance in km
  const distanceKm = calculateDistanceKm(userGuess.x, userGuess.y, q.x, q.y).toFixed(2);

  if (distancePercent < 5) {
    score++;
    scoreIndicator.textContent = `Score: ${score}`;
    showMessage(`✅ Correct! Distance: ${distanceKm} km`, "var(--success)");
  } else {
    showMessage(`❌ Wrong! Distance: ${distanceKm} km`, "var(--danger)");
  }

  btnNext.disabled = false;
}

// Show message
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
  msg.style.zIndex = "20";
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
  resultSummary.textContent = `You scored ${score} out of ${TOTAL_QUESTIONS}.`;
  setScreen(screenResult);
}

// Event listeners
btnRestart.addEventListener("click", () => setScreen(screenStart));
btnStart.addEventListener("click", startGame);