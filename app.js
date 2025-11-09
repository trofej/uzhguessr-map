// ✅ UZH Map Guessr – Enhanced Edition
const TOTAL_QUESTIONS = 10;
const ROUND_TIME = 30; // seconds per round

// Game state
let currentIndex = 0;
let points = 0;
let userGuess = null;
let guessLocked = false;
let QUESTIONS = [];
let gameQuestions = [];
let totalDistanceKm = 0;
let gamesPlayed = 0;
let streak = 0; // ✅ combo streak

// Timed mode
let isTimedMode = false;
let timerInterval = null;
let timeLeft = 0;

// Firestore constants
const STATS_DOC_ID = "gamesPlayed";

// UI
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
const gamesPlayedDisplay = document.getElementById("games-played");
const modeSelect = document.getElementById("mode-select");
const timerDisplay = document.getElementById("timer-display");

// ✅ New streak bar element
const streakBar = document.getElementById("streak-bar") || (() => {
  const el = document.createElement("div");
  el.id = "streak-bar";
  document.querySelector(".status")?.appendChild(el);
  return el;
})();

// Firebase helpers
const db = window.db;
const fbCollection = window.fbCollection;
const fbAddDoc = window.fbAddDoc;
const fbGetDocs = window.fbGetDocs;
const fbQuery = window.fbQuery;
const fbOrderBy = window.fbOrderBy;
const fbDoc = window.fbDoc;
const fbIncrement = window.fbIncrement;
const fbGetDoc = window.fbGetDoc;
const fbSetDoc = window.fbSetDoc;

// Leaflet
let map, guessMarker, correctMarker, lineLayer;
let heatLayer = L.layerGroup();
let previousGuesses = L.layerGroup();
let heatData = [];

// ✅ Create dynamic pulse icon
function makePulseIcon(color) {
  return L.divIcon({
    className: "animated-pulse-marker",
    html: `
      <div class="pulse-outer" style="background:${color}33; box-shadow:0 0 10px ${color}66;"></div>
      <div class="pulse-inner" style="background:${color}; box-shadow:0 0 10px ${color};"></div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

// Clean up
function clearGuessArtifacts() {
  [guessMarker, correctMarker, lineLayer].forEach(m => m && map.removeLayer(m));
  guessMarker = correctMarker = lineLayer = null;
}

// Remove non-basemap layers
function clearAllMapLayers() {
  map.eachLayer(layer => {
    if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
  });
}

// ✅ Game counter
async function loadGameCounter() {
  const ref = fbDoc(db, "stats", STATS_DOC_ID);
  const snap = await fbGetDoc(ref);
  if (snap.exists()) gamesPlayed = snap.data().gamesPlayed || 0;
  else await fbSetDoc(ref, { gamesPlayed: 0 });
  gamesPlayedDisplay.textContent = `Total Games Played: ${gamesPlayed}`;
}

async function incrementGamePlays() {
  await fbSetDoc(fbDoc(db, "stats", STATS_DOC_ID),
    { gamesPlayed: fbIncrement(1) },
    { merge: true }
  );
  gamesPlayed++;
  gamesPlayedDisplay.textContent = `Total Games Played: ${gamesPlayed}`;
}

// ✅ Map init
document.addEventListener("DOMContentLoaded", () => {
  map = L.map("map", {
    center: [47.3788, 8.5481],
    zoom: 13,
    minZoom: 12,
    maxZoom: 19,
    preferCanvas: true,
    maxBounds: L.latLngBounds([47.430, 8.450], [47.310, 8.650]),
    maxBoundsViscosity: 1.0
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(map);

  previousGuesses.addTo(map);
  map.doubleClickZoom.disable();
  map.on("drag", () => map.panInsideBounds(map.options.maxBounds));
  map.on("click", e => !guessLocked && placeGuess(e.latlng.lat, e.latlng.lng));

  loadGameCounter();
  renderLeaderboard();
  renderHeatmap();
});

// ✅ Timer
function startTimer() {
  if (!isTimedMode) return;
  clearInterval(timerInterval);
  timeLeft = ROUND_TIME;

  timerDisplay.style.display = "block";
  timerDisplay.style.color = "var(--accent-2)";
  timerDisplay.textContent = `Time left: ${timeLeft}s`;

  timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = `Time left: ${timeLeft}s`;

    if (timeLeft <= 10 && timeLeft > 5) timerDisplay.style.color = "#ffb366";
    else if (timeLeft <= 5 && timeLeft > 0) timerDisplay.style.color = "#ff6b6b";

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerDisplay.textContent = "⏰ Time's up!";
      if (!guessLocked) {
        if (userGuess) confirmGuess();
        else {
          guessLocked = true;
          btnNext.disabled = false;
          btnConfirmGuess.disabled = true;
          alert("⏰ Time's up! No guess placed — 0 points this round.");
        }
      }
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerDisplay.style.display = "none";
}

// ✅ UI switching
function setScreen(s) {
  [screenStart, screenGame, screenResult].forEach(el =>
    el.classList.remove("active")
  );
  s.classList.add("active");
  if (s === screenGame) setTimeout(() => map.invalidateSize(), 200);
}

// ✅ Start game
async function startGame() {
  if (!QUESTIONS.length) {
    const res = await fetch("data/questions.json");
    QUESTIONS = await res.json();
  }
  incrementGamePlays();

  clearGuessArtifacts();
  clearAllMapLayers();
  map.closePopup();
  heatLayer = L.layerGroup();
  previousGuesses = L.layerGroup().addTo(map);

  gameQuestions = [...QUESTIONS]
    .sort(() => Math.random() - 0.5)
    .slice(0, TOTAL_QUESTIONS);

  currentIndex = 0;
  points = 0;
  totalDistanceKm = 0;
  userGuess = null;
  guessLocked = false;
  streak = 0;
  scoreIndicator.textContent = "Points: 0";
  streakBar.style.width = "0%";
  streakBar.style.opacity = 0.3;

  isTimedMode = modeSelect && modeSelect.value === "timed";

  map.setView([47.3788, 8.5481], 13);
  setScreen(screenGame);
  renderRound();
}

// ✅ Render round
function renderRound() {
  clearGuessArtifacts();
  guessLocked = false;
  userGuess = null;

  const q = gameQuestions[currentIndex];
  questionText.textContent = `Where is: ${q.answer}?`;
  roundIndicator.textContent = `Round ${currentIndex + 1}/${gameQuestions.length}`;
  questionImage.src = q.image;

  btnConfirmGuess.disabled = true;
  btnClearGuess.disabled = true;
  btnNext.disabled = true;

  if (isTimedMode) startTimer();
  else stopTimer();
}

// ✅ Place guess
function placeGuess(lat, lng) {
  userGuess = { lat, lng };
  if (guessMarker) map.removeLayer(guessMarker);

  guessMarker = L.circleMarker([lat, lng], {
    radius: 8,
    color: "#c9a600",
    weight: 3,
    fillColor: "#ffeb3b",
    fillOpacity: 1
  })
    .addTo(map)
    .bindTooltip("Your Guess", { permanent: true, direction: "top", offset: [0, -6] });

  btnConfirmGuess.disabled = false;
  btnClearGuess.disabled = false;
}

// ✅ Confirm guess
function confirmGuess() {
  if (!userGuess || guessLocked) return;
  guessLocked = true;
  stopTimer();

  const q = gameQuestions[currentIndex];
  const correct = [q.lat, q.lng];
  const meters = map.distance([userGuess.lat, userGuess.lng], correct);

  const gained = scoreFromDistance(meters);
  const km = meters / 1000;

  // ✅ Combo streak logic
  if (gained >= 70) streak++;
  else streak = 0;

  const streakBonus = Math.min(streak * 5, 25);
  const totalGained = gained + streakBonus;
  points += totalGained;
  totalDistanceKm += km;

  // ✅ Pop animation for score
  scoreIndicator.textContent = `Points: ${points}`;
  scoreIndicator.classList.add("bump");
  setTimeout(() => scoreIndicator.classList.remove("bump"), 300);

  // ✅ Update streak bar
  streakBar.style.width = `${Math.min(streak * 10, 100)}%`;
  streakBar.style.opacity = streak > 0 ? 1 : 0.3;

  const { label, color } = accuracyRating(meters);

  // ✅ Connection line & centering
  lineLayer = L.polyline([[userGuess.lat, userGuess.lng], correct], {
    color,
    weight: 3,
    opacity: 0.8,
    className: "guess-line"
  }).addTo(map);
  map.fitBounds(L.latLngBounds([userGuess, correct]).pad(0.3), { animate: true });

  // ✅ Pulse marker
  correctMarker = L.marker(correct, { icon: makePulseIcon(color) }).addTo(previousGuesses);

  // ✅ Glow feedback
  const mapEl = map.getContainer();
  mapEl.classList.add("flash");
  setTimeout(() => mapEl.classList.remove("flash"), 500);

  // ✅ Cleanup & popup
  if (guessMarker) map.removeLayer(guessMarker);

  correctMarker.bindPopup(`
    <strong style="background:${color};padding:4px 10px;border-radius:8px;display:inline-block;">
      ${label}
    </strong><br><br>
    ${q.answer}<br>
    Distance: ${km.toFixed(2)} km<br>
    Points: +${totalGained} (Base ${gained} + Streak ${streakBonus})
  `).openPopup();

  saveGuess(userGuess.lat, userGuess.lng, meters);
  btnNext.disabled = false;
  btnConfirmGuess.disabled = true;
}

// ✅ Finish
function finish() {
  stopTimer();
  resultSummary.textContent = `You scored ${points} points 🎯 Total distance: ${totalDistanceKm.toFixed(2)} km`;

  heatLayer.addTo(map);
  drawHeatLayer();
  renderLeaderboard();
  setScreen(screenResult);
  nameEntry.style.display = "block";

  // ✅ Mini result map
  setTimeout(() => {
    const resultMapEl = document.getElementById("result-map");
    if (!resultMapEl) return;
    const resultMap = L.map("result-map", {
      center: [47.3788, 8.5481],
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
      subdomains: "abcd", maxZoom: 19
    }).addTo(resultMap);
    gameQuestions.forEach(q => {
      L.circleMarker([q.lat, q.lng], {
        radius: 7, color: "#76e4f7", fillColor: "#76e4f7", fillOpacity: 0.9
      }).addTo(resultMap);
    });
    resultMap.fitBounds(L.latLngBounds(gameQuestions.map(q => [q.lat, q.lng])).pad(0.2));
  }, 400);
}

// ✅ Heatmap
async function renderHeatmap() {
  const snap = await fbGetDocs(fbCollection(db, "guesses"));
  heatData = snap.docs.map(d => d.data());
}

function drawHeatLayer() {
  heatLayer.clearLayers();
  heatData.forEach(({ lat, lng }) => {
    L.circleMarker([lat, lng], {
      radius: 22,
      fillColor: "#ff6b6b",
      fillOpacity: 0.12,
      stroke: false
    }).addTo(heatLayer);
  });
}

// ✅ Save guess
async function saveGuess(lat, lng, meters) {
  await fbAddDoc(fbCollection(db, "guesses"), {
    lat,
    lng,
    meters: Math.round(meters),
    ts: Date.now()
  });
}

// ✅ Leaderboard
async function loadLeaderboard() {
  const q = fbQuery(fbCollection(db, "leaderboard"), fbOrderBy("points", "desc"));
  const snap = await fbGetDocs(q);
  return snap.docs.map(d => d.data());
}

async function renderLeaderboard() {
  const data = await loadLeaderboard();
  leaderboardBody.innerHTML = data
    .map(
      (e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(e.name || "")}</td>
        <td>${e.points}</td>
        <td>${e.distance.toFixed(2)}</td>
      </tr>`
    )
    .join("");
}

// ✅ Utilities
function scoreFromDistance(m) {
  if (m <= 100) return 100;
  if (m <= 250) return 70;
  if (m <= 500) return 40;
  if (m <= 1000) return 10;
  return 0;
}

function accuracyRating(m) {
  if (m <= 100) return { label: "🎯 PERFECT!", color: "#60d394" };
  if (m <= 250) return { label: "✅ Very Close", color: "#76e4f7" };
  if (m <= 500) return { label: "👍 Good Guess", color: "#8aa1ff" };
  if (m <= 1000) return { label: "😅 Off a Bit", color: "#ffb366" };
  return { label: "❌ Way Off", color: "#ff6b6b" };
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// ✅ Buttons
btnConfirmGuess.addEventListener("click", confirmGuess);
btnClearGuess.addEventListener("click", () => {
  if (!guessLocked && guessMarker) {
    map.removeLayer(guessMarker);
    guessMarker = null;
    userGuess = null;
    btnConfirmGuess.disabled = true;
    btnClearGuess.disabled = true;
  }
});
btnNext.addEventListener("click", () => {
  if (currentIndex < gameQuestions.length - 1) {
    currentIndex++;
    renderRound();
  } else {
    finish();
  }
});
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", () => setScreen(screenStart));
btnSaveScore.addEventListener("click", async () => {
  const name = playerNameInput.value.trim().slice(0, 20);
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
window.addEventListener("resize", () => map.invalidateSize());
