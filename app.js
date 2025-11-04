// UZH Map Guessr – Interactive Leaflet Edition with Points & Distance
const TOTAL_QUESTIONS = 10; // rounds per game
const MIN_SCORE_TO_SUBMIT = 300; // gate for leaderboard entry (tweak as you like)

// State
let currentIndex = 0;
let points = 0;
let userGuess = null; // { lat, lng }
let guessLocked = false;
let QUESTIONS = []; // loaded from JSON (now has lat/lng)
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
const questionImage = document.getElementById("question-image");
const nameEntry = document.getElementById("name-entry");
const playerNameInput = document.getElementById("player-name");
const btnSaveScore = document.getElementById("btn-save-score");
const leaderboardBody = document.getElementById("leaderboard-body");
const btnConfirmGuess = document.getElementById("btn-confirm-guess");
const btnClearGuess = document.getElementById("btn-clear-guess");

// Firebase helpers from window (already assigned in index.html)
const fbAddDoc = window.fbAddDoc;
const fbGetDocs = window.fbGetDocs;
const fbCollection = window.fbCollection;
const fbQuery = window.fbQuery;
const fbOrderBy = window.fbOrderBy;

// Leaflet Map
let map, guessMarker, correctMarker, lineLayer;

// Initialize Leaflet map once DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Center on central Zürich, zoomed to campuses
  map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([47.3769, 8.5417], 14);

  // Free OSM tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    minZoom: 12,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Blue-ish UI accents are handled via CSS (see app.css/theme tweaks)

  // Place guess on click
  map.on('click', (e) => {
    if (guessLocked) return; // do not allow changing after confirming
    placeGuess(e.latlng.lat, e.latlng.lng);
  });

  renderLeaderboard(); // show initial leaderboard on load
});

// Questions
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

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

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
  points = 0;
  totalDistanceKm = 0;
  scoreIndicator.textContent = `Points: ${points}`;
  playerNameInput.value = "";
  nameEntry.style.display = "none";

  clearGuessArtifacts();
  setScreen(screenGame);
  renderRound();
}

function renderRound() {
  const q = gameQuestions[currentIndex];
  userGuess = null;
  guessLocked = false;

  // UI
  questionText.textContent = `Where is: ${q.answer}?`;
  roundIndicator.textContent = `Round ${currentIndex + 1}/${gameQuestions.length}`;
  btnNext.disabled = true;
  btnConfirmGuess.disabled = true;
  btnClearGuess.disabled = true;

  questionImage.src = q.image;

  // Clear previous round markers/lines
  clearGuessArtifacts();

  // Zoom the map so both Zentrum/Irchel areas feel comfortable
  // (We keep a city-wide view; users can zoom freely)
  // Optionally fit to campus bounds later if you want.
}

function placeGuess(lat, lng) {
  userGuess = { lat, lng };

  if (guessMarker) map.removeLayer(guessMarker);
  guessMarker = L.marker([lat, lng], {
    title: "Your guess"
  }).addTo(map);

  btnConfirmGuess.disabled = false;
  btnClearGuess.disabled = false;
}

function clearGuessArtifacts() {
  if (guessMarker) { map.removeLayer(guessMarker); guessMarker = null; }
  if (correctMarker) { map.removeLayer(correctMarker); correctMarker = null; }
  if (lineLayer) { map.removeLayer(lineLayer); lineLayer = null; }
}

function confirmGuess() {
  if (!userGuess) return;
  guessLocked = true;

  const q = gameQuestions[currentIndex];
  const correct = { lat: q.lat, lng: q.lng };

  // Correct marker
  correctMarker = L.marker([correct.lat, correct.lng], {
    title: "Correct location"
  }).addTo(map);

  // Line between guess and correct
  lineLayer = L.polyline([[userGuess.lat, userGuess.lng], [correct.lat, correct.lng]], {
    color: '#8aa1ff',
    weight: 3,
    opacity: 0.9,
  }).addTo(map);

  // Distance (meters -> km)
  const meters = map.distance([userGuess.lat, userGuess.lng], [correct.lat, correct.lng]);
  const km = meters / 1000;
  totalDistanceKm += km;

  // Distance-based points
  const gained = awardPoints(meters);
  points += gained;
  scoreIndicator.textContent = `Points: ${points}`;

  // Small popup feedback
  const popupHtml = `
    <div style="font-weight:600;">${gained > 0 ? '✅ Nice!' : '❌'} ${gained} pts</div>
    <div>Distance: ${km.toFixed(2)} km</div>
  `;
  correctMarker.bindPopup(popupHtml).openPopup();

  // Fit so both markers are visible
  const bounds = L.latLngBounds([userGuess.lat, userGuess.lng], [correct.lat, correct.lng]);
  map.fitBounds(bounds.pad(0.25), { animate: true });

  btnNext.disabled = false;
  btnConfirmGuess.disabled = true;
}

// Points tiers (tweak freely)
function awardPoints(meters) {
  if (meters <= 100) return 100;
  if (meters <= 250) return 70;
  if (meters <= 500) return 40;
  if (meters <= 1000) return 10;
  return 0;
}

// Next / Finish
btnNext.addEventListener("click", () => {
  if (currentIndex < gameQuestions.length - 1) {
    currentIndex++;
    renderRound();
  } else {
    finish();
  }
});

function finish() {
  resultSummary.textContent = `You scored ${points} points over ${gameQuestions.length} rounds. Total distance: ${totalDistanceKm.toFixed(2)} km.`;
  setScreen(screenResult);

  // Show / render leaderboard
  renderLeaderboard();

  // Show name entry if points reach threshold
  if (points >= MIN_SCORE_TO_SUBMIT) {
    nameEntry.style.display = "block";
  } else {
    nameEntry.style.display = "none";
  }
}

// Leaderboard (Firestore)
async function loadLeaderboard() {
  try {
    const q = fbQuery(
      fbCollection(window.db, "leaderboard"),
      fbOrderBy("points", "desc"),
      fbOrderBy("distance", "asc")
    );
    const snap = await fbGetDocs(q);
    const entries = [];
    snap.forEach(doc => entries.push(doc.data()));
    return entries;
  } catch (err) {
    console.error("Failed to load leaderboard:", err);
    return [];
  }
}

async function saveToLeaderboard(entry) {
  try {
    await fbAddDoc(fbCollection(window.db, "leaderboard"), entry);
    showMessage("✅ Saved to global leaderboard", "var(--accent)");
  } catch (err) {
    console.error("Error saving to leaderboard:", err);
    showMessage("⚠️ Failed to save score", "var(--danger)");
  }
}

async function renderLeaderboard() {
  const data = await loadLeaderboard();
  leaderboardBody.innerHTML = "";
  data.forEach((entry, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="padding:0.4rem 0.3rem;">${i + 1}</td>
      <td style="padding:0.4rem 0.3rem;">${escapeHtml(entry.name ?? '')}</td>
      <td style="padding:0.4rem 0.3rem;">${entry.points ?? 0}</td>
      <td style="padding:0.4rem 0.3rem;">${(entry.distance ?? 0).toFixed(2)}</td>
    `;
    leaderboardBody.appendChild(row);
  });
}

// Name sanitization (same idea as before)
function sanitizeName(name) {
  if (!name) return null;
  let clean = name.trim();
  clean = clean.replace(/[^\p{L}\p{N} \-_'"]/gu, "");
  if (clean.length < 1) return null;
  const badWords = ["fuck","shit","bitch","ass","dick","cock","cunt","nigger","fag","whore","slut","sex","arse"];
  const lowered = clean.toLowerCase();
  for (const bad of badWords) {
    if (lowered.includes(bad)) return null;
  }
  return clean.slice(0, 20);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Save score
btnSaveScore.addEventListener("click", async () => {
  const raw = playerNameInput.value;
  const clean = sanitizeName(raw);
  if (!clean) {
    alert("Please enter a valid, non-offensive name (1–20 characters).");
    return;
  }
  if (points < MIN_SCORE_TO_SUBMIT) {
    alert(`You need at least ${MIN_SCORE_TO_SUBMIT} points to join the leaderboard.`);
    return;
  }

  const entry = {
    name: clean,
    points,
    distance: parseFloat(totalDistanceKm.toFixed(3)),
    ts: Date.now()
  };

  await saveToLeaderboard(entry);
  playerNameInput.value = "";
  nameEntry.style.display = "none";
  renderLeaderboard();
});

// UI helpers
function showMessage(text, bg) {
  const msg = document.createElement("div");
  msg.textContent = text;
  msg.style.position = "fixed";
  msg.style.left = "50%";
  msg.style.bottom = "24px";
  msg.style.transform = "translateX(-50%)";
  msg.style.background = bg || "rgba(255,255,255,0.95)";
  msg.style.color = "#000";
  msg.style.padding = "0.5rem 0.9rem";
  msg.style.borderRadius = "10px";
  msg.style.fontWeight = "600";
  msg.style.boxShadow = "0 10px 30px rgba(0,0,0,0.25)";
  msg.style.zIndex = "9999";
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 1400);
}

// Buttons
btnClearGuess.addEventListener("click", () => {
  if (guessLocked) return;
  userGuess = null;
  if (guessMarker) { map.removeLayer(guessMarker); guessMarker = null; }
  btnConfirmGuess.disabled = true;
  btnClearGuess.disabled = true;
});

btnConfirmGuess.addEventListener("click", confirmGuess);

btnRestart.addEventListener("click", () => setScreen(screenStart));
btnStart.addEventListener("click", startGame);

// ----------------------------------------------------------------------------
// NOTE: The old pixel/% static-map code is removed. We now rely on Leaflet.
// ----------------------------------------------------------------------------
