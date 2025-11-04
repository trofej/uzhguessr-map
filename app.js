// ✅ UZH Map Guessr  –  Fast + Fixed Carto Map
const TOTAL_QUESTIONS = 10;
const MIN_SCORE_TO_SUBMIT = 300;

// State
let currentIndex = 0;
let points = 0;
let userGuess = null;
let guessLocked = false;
let QUESTIONS = [];
let gameQuestions = [];
let totalDistanceKm = 0;

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

// Firebase
const fbAddDoc = window.fbAddDoc;
const fbGetDocs = window.fbGetDocs;
const fbCollection = window.fbCollection;
const fbQuery = window.fbQuery;
const fbOrderBy = window.fbOrderBy;

// Leaflet Objects
let map, guessMarker, correctMarker, lineLayer;

// ✅ Custom Pulsing icons
const uzhIcon = L.icon({
  iconUrl: "images/icons/uzh-marker.svg",
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});

const pulseIcon = L.divIcon({
  className: "pulse-marker",
  html: '<div class="pulse-ring"></div><div class="pulse-dot"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// ✅ Initialize fast & reliable Zürich map
document.addEventListener("DOMContentLoaded", () => {
  const zurichCenter = [47.3788, 8.5481];

  const zurichBounds = L.latLngBounds(
    [47.430, 8.450], // expanded NW
    [47.310, 8.650]  // expanded SE
  );

  map = L.map("map", {
    center: zurichCenter,
    zoom: 13,
    minZoom: 12,
    maxZoom: 19,
    zoomControl: true,
    maxBounds: zurichBounds,
    maxBoundsViscosity: 1.0,
    preferCanvas: true
  });

  // ✅ FAST - Carto Voyager tiles (full city coverage)
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      noWrap: true,
      maxZoom: 19,
      minZoom: 12,
      attribution: "&copy; OpenStreetMap contributors &copy; Carto"
    }
  )
  .on("tileerror", () => console.warn("Tile load error (auto-retrying)..."))
  .addTo(map);

  // ✅ Force tiles always fill frame
  map.on("drag", () => map.panInsideBounds(zurichBounds, { animate: false }));

  map.on("click", e => {
    if (!guessLocked) placeGuess(e.latlng.lat, e.latlng.lng);
  });

  renderLeaderboard();
});

// ✅ Load questions
async function loadQuestions() {
  try {
    const res = await fetch("data/questions.json");
    QUESTIONS = await res.json();
  } catch (err) {
    console.error("Error loading questions:", err);
    QUESTIONS = [];
  }
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

  gameQuestions = shuffleArray(QUESTIONS).slice(0, TOTAL_QUESTIONS);
  currentIndex = 0;
  points = 0;
  totalDistanceKm = 0;
  scoreIndicator.textContent = "Points: 0";

  clearGuessArtifacts();
  setScreen(screenGame);
  renderRound();
}

// ✅ Render a question
function renderRound() {
  const q = gameQuestions[currentIndex];
  guessLocked = false;
  userGuess = null;

  clearGuessArtifacts();

  questionText.textContent = `Where is: ${q.answer}?`;
  roundIndicator.textContent = `Round ${currentIndex + 1}/${gameQuestions.length}`;
  questionImage.src = q.image;

  btnNext.disabled = true;
  btnConfirmGuess.disabled = true;
  btnClearGuess.disabled = true;

  map.flyTo([47.3788, 8.5481], 13, { duration: 0.6 });
}

// ✅ Place Guess
function placeGuess(lat, lng) {
  userGuess = { lat, lng };
  if (guessMarker) map.removeLayer(guessMarker);
  guessMarker = L.marker([lat, lng]).addTo(map);
  btnConfirmGuess.disabled = false;
  btnClearGuess.disabled = false;
}

// ✅ Clear map
function clearGuessArtifacts() {
  [guessMarker, correctMarker, lineLayer].forEach(l => {
    if (l) map.removeLayer(l);
  });
}

// ✅ Confirm Answer
function confirmGuess() {
  if (!userGuess) return;
  guessLocked = true;

  const q = gameQuestions[currentIndex];
  const correctPos = [q.lat, q.lng];

  correctMarker = L.marker(correctPos, { icon: uzhIcon }).addTo(map);
  L.marker(correctPos, { icon: pulseIcon }).addTo(map);

  const meters = map.distance([userGuess.lat, userGuess.lng], correctPos);
  totalDistanceKm += meters / 1000;

  const gained = awardPoints(meters);
  points += gained;
  scoreIndicator.textContent = `Points: ${points}`;

  lineLayer = L.polyline([correctPos, [userGuess.lat, userGuess.lng]], {
    color: "#8aa1ff",
    weight: 3,
    opacity: 0.85
  }).addTo(map);

  map.fitBounds([correctPos, [userGuess.lat, userGuess.lng]], {
    padding: [80, 80],
    animate: true
  });

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

// ✅ Next / Finish
btnNext.addEventListener("click", () => {
  currentIndex < gameQuestions.length - 1 ? (currentIndex++, renderRound()) : finish();
});

function finish() {
  resultSummary.textContent =
    `You scored ${points} points 🎯 Total distance: ${totalDistanceKm.toFixed(2)} km`;
  renderLeaderboard();
  setScreen(screenResult);
  nameEntry.style.display = points >= MIN_SCORE_TO_SUBMIT ? "block" : "none";
}

// ✅ Leaderboard
async function loadLeaderboard() {
  try {
    const q = fbQuery(
      fbCollection(window.db, "leaderboard"),
      fbOrderBy("points", "desc"),
      fbOrderBy("distance", "asc")
    );
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
      <td>${e.distance.toFixed(2)}</td>
    </tr>
  `).join("");
}

btnSaveScore.addEventListener("click", async () => {
  const name = sanitizeName(playerNameInput.value);
  if (!name) return alert("Enter valid name");

  await fbAddDoc(fbCollection(window.db, "leaderboard"), {
    name,
    points,
    distance: parseFloat(totalDistanceKm.toFixed(2)),
    ts: Date.now()
  });

  nameEntry.style.display = "none";
  renderLeaderboard();
});

function sanitizeName(s) {
  const bad = ["fuck","shit","bitch","ass","dick","cock","cunt","nigger","fag","whore","slut","sex","arse"];
  s = (s || "").trim().slice(0, 20);
  if (!s || bad.some(w => s.toLowerCase().includes(w))) return null;
  return s;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// ✅ Buttons
btnClearGuess.addEventListener("click", () => {
  if (!guessLocked) {
    if (guessMarker) map.removeLayer(guessMarker);
    userGuess = null;
    btnConfirmGuess.disabled = true;
    btnClearGuess.disabled = true;
  }
});

btnConfirmGuess.addEventListener("click", confirmGuess);
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", () => setScreen(screenStart));