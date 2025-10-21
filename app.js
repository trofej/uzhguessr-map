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
// Robust click handler that accounts for object-fit (contain / cover) and letterboxing
campusMap.addEventListener("click", (e) => {
  if (guessLocked) return;

  const rect = campusMap.getBoundingClientRect();

  // intrinsic image size
  const natW = campusMap.naturalWidth;
  const natH = campusMap.naturalHeight;
  if (!natW || !natH) return; // image not loaded yet

  // displayed element size
  const dispW = rect.width;
  const dispH = rect.height;

  // computed object-fit used by browser (default may be "fill", "contain", "cover")
  const style = window.getComputedStyle(campusMap);
  const objectFit = style.getPropertyValue('object-fit') || 'fill';

  // compute the drawn image size (drawW/drawH) inside the element
  let scale, drawW, drawH, offsetX, offsetY;

  if (objectFit === 'cover') {
    // image is scaled to cover element, may be cropped
    scale = Math.max(dispW / natW, dispH / natH);
    drawW = natW * scale;
    drawH = natH * scale;
    // offsets (can be negative if image larger than container)
    offsetX = (dispW - drawW) / 2;
    offsetY = (dispH - drawH) / 2;
  } else if (objectFit === 'contain' || objectFit === 'scale-down' || objectFit === 'none') {
    // contain or default behavior (no cropping)
    // for 'none' the image may be smaller than container; still works
    scale = Math.min(dispW / natW, dispH / natH);
    drawW = natW * scale;
    drawH = natH * scale;
    offsetX = (dispW - drawW) / 2;
    offsetY = (dispH - drawH) / 2;
  } else {
    // fallback for unexpected object-fit values (treat as contain)
    scale = Math.min(dispW / natW, dispH / natH);
    drawW = natW * scale;
    drawH = natH * scale;
    offsetX = (dispW - drawW) / 2;
    offsetY = (dispH - drawH) / 2;
  }

  // coordinates relative to the element top-left (client coords -> element local coords)
  const localX = e.clientX - rect.left;
  const localY = e.clientY - rect.top;

  // coordinates relative to the drawn image area
  const clickX_onDrawn = localX - offsetX;
  const clickY_onDrawn = localY - offsetY;

  // ignore clicks outside the visible image area (letterbox)
  if (clickX_onDrawn < 0 || clickX_onDrawn > drawW || clickY_onDrawn < 0 || clickY_onDrawn > drawH) {
    // optionally show a small hint or ignore
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

  // Show correct marker similarly (we'll compute position below in checkAnswer)
  // Lock and evaluate
  checkAnswer(); // checkAnswer will use QUESTIONS[currentIndex].x/ .y (they are percentages relative to intrinsic image)
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