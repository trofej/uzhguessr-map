// UZH Map Guessr – Interactive Leaflet Edition with Points & Distance
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

// Firebase helpers
const fbAddDoc = window.fbAddDoc;
const fbGetDocs = window.fbGetDocs;
const fbCollection = window.fbCollection;
const fbQuery = window.fbQuery;
const fbOrderBy = window.fbOrderBy;

// Leaflet map + overlays
let map, guessMarker, correctMarker, lineLayer;

// Custom Marker Icons ------------------------
const uzhIcon = L.icon({
  iconUrl: "images/icons/uzh-marker.svg",
  iconSize: [34, 34],
  iconAnchor: [17, 34]
});

const pulseIcon = L.divIcon({
  className: "pulse-marker",
  html: '<div class="pulse-ring"></div><div class="pulse-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Initialize map
document.addEventListener("DOMContentLoaded", () => {
  const center = [47.3769, 8.5417];
  const zurichBounds = L.latLngBounds(
    [47.4200, 8.4800],
    [47.3300, 8.6200]
  );

  map = L.map("map", {
    zoomControl: true,
    minZoom: 13,
    maxZoom: 19,
    maxBounds: zurichBounds,
    maxBoundsViscosity: 1.0,
    zoomAnimation: true,
    markerZoomAnimation: true,
    fadeAnimation: true
  }).setView(center, 14);

  L.tileLayer(
    "https://api.maptiler.com/maps/bright/{z}/{x}/{y}.png?key=0m0ly2WMir4T3fpwYwHi",
    {
      tileSize: 512,
      zoomOffset: -1,
      noWrap: true,
      bounds: zurichBounds,
      maxZoom: 19,
      attribution: '&copy; OSM | © MapTiler'
    }
  ).addTo(map);

  map.on("resize", () => map.fitBounds(zurichBounds));
  map.on("drag", () => map.panInsideBounds(zurichBounds));

  map.on("click", e => {
    if (!guessLocked) placeGuess(e.latlng.lat, e.latlng.lng);
  });

  renderLeaderboard();
  resetView();
});

function resetView() {
  map.flyTo([47.3769, 8.5417], 14, { animate: true, duration: 0.8 });
}

// Load Questions
async function loadQuestions() {
  try {
    const res = await fetch("data/questions.json");
    QUESTIONS = await res.json();
  } catch (err) {
    console.error("Error loading questions");
  }
}

function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function setScreen(target) {
  [screenStart, screenGame, screenResult].forEach(s => s.classList.remove("active"));
  target.classList.add("active");
}

async function startGame() {
  if (QUESTIONS.length === 0) await loadQuestions();

  gameQuestions = shuffleArray(QUESTIONS).slice(0, TOTAL_QUESTIONS);

  currentIndex = 0;
  points = 0;
  totalDistanceKm = 0;
  scoreIndicator.textContent = "Points: 0";
  playerNameInput.value = "";
  nameEntry.style.display = "none";

  clearGuessArtifacts();
  setScreen(screenGame);
  renderRound();
}

function renderRound() {
  const q = gameQuestions[currentIndex];
  guessLocked = false;
  userGuess = null;

  clearGuessArtifacts();

  questionText.textContent = `Where is: ${q.answer}?`;
  roundIndicator.textContent = `Round ${currentIndex + 1}/${gameQuestions.length}`;
  btnNext.disabled = true;
  btnConfirmGuess.disabled = true;
  btnClearGuess.disabled = true;
  questionImage.src = q.image;

  resetView();
}

function placeGuess(lat, lng) {
  userGuess = { lat, lng };
  if (guessMarker) map.removeLayer(guessMarker);

  guessMarker = L.marker([lat, lng]).addTo(map);
  btnConfirmGuess.disabled = false;
  btnClearGuess.disabled = false;
}

function clearGuessArtifacts() {
  if (guessMarker) map.removeLayer(guessMarker);
  if (correctMarker) map.removeLayer(correctMarker);
  if (lineLayer) map.removeLayer(lineLayer);
}

function confirmGuess() {
  if (!userGuess) return;
  guessLocked = true;

  const q = gameQuestions[currentIndex];
  const correctPos = [q.lat, q.lng];

  correctMarker = L.marker(correctPos, { icon: uzhIcon }).addTo(map);
  L.marker(correctPos, { icon: pulseIcon }).addTo(map); // pulsing ring

  const m = map.distance([userGuess.lat, userGuess.lng], correctPos);
  const km = m / 1000;
  totalDistanceKm += km;

  const gained = awardPoints(m);
  points += gained;

  scoreIndicator.textContent = `Points: ${points}`;

  lineLayer = L.polyline([[userGuess.lat, userGuess.lng], correctPos], {
    color: "#8aa1ff",
    weight: 3,
    opacity: 0.85
  }).addTo(map);

  map.fitBounds([correctPos, [userGuess.lat, userGuess.lng]].map(e => e), {
    padding: [80, 80],
    animate: true,
    duration: 0.8
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

btnNext.addEventListener("click", () => {
  if (currentIndex < gameQuestions.length - 1) {
    currentIndex++;
    renderRound();
  } else finish();
});

function finish() {
  resultSummary.textContent =
    `You scored ${points} points! Distance: ${totalDistanceKm.toFixed(2)} km`;
  renderLeaderboard();
  setScreen(screenResult);

  if (points >= MIN_SCORE_TO_SUBMIT) nameEntry.style.display = "block";
}

async function loadLeaderboard() {
  try {
    const q = fbQuery(
      fbCollection(window.db, "leaderboard"),
      fbOrderBy("points", "desc"),
      fbOrderBy("distance", "asc")
    );
    const res = await fbGetDocs(q);
    return res.docs.map(d => d.data());
  } catch {
    return [];
  }
}

async function renderLeaderboard() {
  const data = await loadLeaderboard();
  leaderboardBody.innerHTML = "";
  data.forEach((e, i) => {
    leaderboardBody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(e.name)}</td>
        <td>${e.points}</td>
        <td>${e.distance.toFixed(2)}</td>
      </tr>`;
  });
}

btnSaveScore.addEventListener("click", async () => {
  const name = sanitizeName(playerNameInput.value);
  if (!name) return alert("Enter valid name");

  await fbAddDoc(fbCollection(window.db, "leaderboard"), {
    name, points,
    distance: parseFloat(totalDistanceKm.toFixed(2)),
    ts: Date.now()
  });

  nameEntry.style.display = "none";
  renderLeaderboard();
});

function sanitizeName(s) {
  s = s.trim();
  if (!s) return null;
  const bad = ["fuck","shit","bitch","ass","dick","cock","cunt","nigger","fag","whore","slut","sex","arse"];
  const lower = s.toLowerCase();
  if (bad.some(w => lower.includes(w))) return null;
  return s.slice(0, 20);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m])
  );
}

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
