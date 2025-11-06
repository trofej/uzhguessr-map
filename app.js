// ✅ UZH Map Guessr  –  Fast + Fixed Carto Map
const TOTAL_QUESTIONS = 10;

// State
let currentIndex = 0;
let points = 0;
let userGuess = null;
let guessLocked = false;
let QUESTIONS = [];
let gameQuestions = [];
let totalDistanceKm = 0;

// ✅ Games Played Counter
const gamesPlayedText = document.getElementById("games-played");
let gamesPlayed = 0;

// UI Elements
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

// Firebase helpers
const fbAddDoc = window.fbAddDoc;
const fbGetDocs = window.fbGetDocs;
const fbCollection = window.fbCollection;
const fbQuery = window.fbQuery;
const fbOrderBy = window.fbOrderBy;
const fbUpdateDoc = window.fbUpdateDoc;

// Leaflet Objects
let map, guessMarker, correctMarker, lineLayer;

const pulseIcon = L.divIcon({
  className: "pulse-marker",
  html: '<div class="pulse-ring"></div><div class="pulse-dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const pulseWrongIcon = L.divIcon({
  className: "pulse-marker",
  html: '<div class="pulse-wrong-ring"></div><div class="pulse-wrong-dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// ✅ Zürich Map Init
document.addEventListener("DOMContentLoaded", () => {
  const zurichCenter = [47.3788, 8.5481];
  const zurichBounds = L.latLngBounds([47.430, 8.450], [47.310, 8.650]);

  map = L.map("map", {
    center: zurichCenter,
    zoom: 13,
    minZoom: 12,
    maxZoom: 19,
    zoomControl: true,
    maxBounds: zurichBounds,
    maxBoundsViscosity: 1.0
  });

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    { subdomains: "abcd", noWrap: true }
  ).addTo(map);

  map.on("click", e => {
    if (!guessLocked) placeGuess(e.latlng.lat, e.latlng.lng);
  });

  renderLeaderboard();
  loadGamesPlayed(); // ✅ Load counter on startup
});

// ✅ Games Played from Firestore
async function loadGamesPlayed() {
  try {
    const snap = await fbGetDocs(fbCollection(db, "stats"));
    if (!snap.empty) {
      gamesPlayed = snap.docs[0].data().gamesPlayed || 0;
    }
  } catch (e) {}
  updateGamesPlayedUI();
}

function updateGamesPlayedUI() {
  gamesPlayedText.textContent = `Games Played: ${gamesPlayed}`;
}

async function saveGamesPlayed() {
  try {
    const snap = await fbGetDocs(fbCollection(db, "stats"));
    if (!snap.empty) {
      await fbUpdateDoc(snap.docs[0].ref, { gamesPlayed });
    }
  } catch (e) {}
}

// ✅ Load questions
async function loadQuestions() {
  const res = await fetch("data/questions.json");
  QUESTIONS = await res.json();
}

function shuffleArray(a) {
  return [...a].sort(() => Math.random() - 0.5);
}

function setScreen(s) {
  [screenStart, screenGame, screenResult].forEach(el => el.classList.remove("active"));
  s.classList.add("active");
}

// ✅ Start Game
async function startGame() {
  if (!QUESTIONS.length) await loadQuestions();

  // ✅ Increase & save play count
  gamesPlayed++;
  updateGamesPlayedUI();
  saveGamesPlayed();

  clearGuessArtifacts();
  map.closePopup();

  map.eachLayer(l => {
    if (l instanceof L.Marker || l instanceof L.Polyline) map.removeLayer(l);
  });

  gameQuestions = shuffleArray(QUESTIONS).slice(0, TOTAL_QUESTIONS);
  currentIndex = 0;
  points = 0;
  totalDistanceKm = 0;

  setScreen(screenGame);
  renderRound();
}

// ✅ Show next location
function renderRound() {
  guessLocked = false;
  clearGuessArtifacts();

  const q = gameQuestions[currentIndex];
  questionText.textContent = `Where is: ${q.answer}?`;
  roundIndicator.textContent = `Round ${currentIndex + 1}/${gameQuestions.length}`;
  questionImage.src = q.image;

  btnNext.disabled = true;
  btnConfirmGuess.disabled = true;
  btnClearGuess.disabled = true;
}

// ✅ Click on map
function placeGuess(lat, lng) {
  userGuess = { lat, lng };
  if (guessMarker) map.removeLayer(guessMarker);
  guessMarker = L.marker([lat, lng]).addTo(map);
  btnConfirmGuess.disabled = false;
  btnClearGuess.disabled = false;
}

function clearGuessArtifacts() {
  [guessMarker, correctMarker, lineLayer].forEach(l => l && map.removeLayer(l));
  guessMarker = correctMarker = lineLayer = null;
}

// ✅ Confirm guess
function confirmGuess() {
  if (!userGuess) return;
  guessLocked = true;

  const q = gameQuestions[currentIndex];
  const correctPos = [q.lat, q.lng];

  const meters = map.distance([userGuess.lat, userGuess.lng], correctPos);
  const km = meters / 1000;
  totalDistanceKm += km;

  const gained = awardPoints(meters);
  points += gained;
  scoreIndicator.textContent = `Points: ${points}`;

  correctMarker = L.marker(correctPos).addTo(map);

  lineLayer = L.polyline([correctPos, [userGuess.lat, userGuess.lng]], {
    color: gained > 0 ? "#8aa1ff" : "#ff6b6b"
  }).addTo(map);

  btnNext.disabled = false;
  btnConfirmGuess.disabled = true;
}

function awardPoints(m) {
  if (m <= 100) return 100;
  if (m <= 250) return 70;
  if (m <= 500) return 40;
  if (m <= 1000) return 10;
  return 0;
}

// ✅ Finish game
btnNext.addEventListener("click", () => {
  currentIndex < gameQuestions.length - 1 ? (currentIndex++, renderRound()) : finish();
});

function finish() {
  resultSummary.textContent = `You scored ${points} points 🎯 Total distance: ${totalDistanceKm.toFixed(2)} km`;
  setScreen(screenResult);
  renderLeaderboard();
}

// ✅ Leaderboard
async function loadLeaderboard() {
  try {
    const q = fbQuery(fbCollection(db, "leaderboard"), fbOrderBy("points", "desc"));
    const snap = await fbGetDocs(q);
    return snap.docs.map(d => d.data());
  } catch {
    return [];
  }
}

async function renderLeaderboard() {
  const data = await loadLeaderboard();
  leaderboardBody.innerHTML = data.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(e.name)}</td>
      <td>${e.points}</td>
      <td>${(e.distance ?? 0).toFixed(2)}</td>
    </tr>`).join("");
}

// ✅ Save Score
btnSaveScore.addEventListener("click", async () => {
  const name = sanitizeName(playerNameInput.value);
  if (!name) return alert("Enter valid name");

  await fbAddDoc(fbCollection(db, "leaderboard"), {
    name,
    points,
    distance: Number(totalDistanceKm.toFixed(2)),
    ts: Date.now()
  });

  renderLeaderboard();
  alert("Saved ✅");
});

// Helpers
function sanitizeName(s) {
  return (s || "").trim().slice(0, 20) || null;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Buttons
btnClearGuess.addEventListener("click", () => {
  if (!guessLocked && guessMarker) {
    map.removeLayer(guessMarker);
    guessMarker = null;
  }
});

btnConfirmGuess.addEventListener("click", confirmGuess);
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", () => {
  clearGuessArtifacts();
  map.eachLayer(l => {
    if (l instanceof L.Marker || l instanceof L.Polyline) map.removeLayer(l);
  });
  setScreen(screenStart);
});

window.addEventListener("resize", () => map && map.invalidateSize(true));