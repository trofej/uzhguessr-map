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

// ✅ Initialize fast & reliable Zürich map
document.addEventListener("DOMContentLoaded", () => {
  const zurichCenter = [47.3788, 8.5481];

  const zurichBounds = L.latLngBounds(
    [47.430, 8.450],
    [47.310, 8.650]
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

  // ✅ FAST - Carto Voyager tiles
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      noWrap: true,
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors &copy; Carto"
    }
  ).addTo(map);

  map.on("drag", () => map.panInsideBounds(zurichBounds, { animate: false }));
  map.on("click", e => {
    if (!guessLocked) placeGuess(e.latlng.lat, e.latlng.lng);
  });
  map.on("click", (e) => {
  if (!guessLocked) placeGuess(e.latlng.lat, e.latlng.lng);
  console.log("Lat:", e.latlng.lat.toFixed(6), "Lng:", e.latlng.lng.toFixed(6));
  });

  renderLeaderboard();
});

// ✅ Load questions
async function loadQuestions() {
  try {
    const res = await fetch("data/questions.json");
    QUESTIONS = await res.json();
  } catch {
    QUESTIONS = [];
  }
}

function shuffleArray(a) {
  return [...a].sort(() => Math.random() - 0.5);
}

// ✅ IMPORTANT: Fix partial map rendering by invalidating size
function setScreen(s) {
  [screenStart, screenGame, screenResult].forEach(el => el.classList.remove("active"));
  s.classList.add("active");

  if (s === screenGame && map) {
    setTimeout(() => {
      map.invalidateSize(true);
      map.setView([47.3788, 8.5481], 13);
    }, 200);
  }
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
  screenGame.classList.add("fade-screen");

  setTimeout(() => {
    screenGame.classList.remove("fade-screen");
  }, 450);

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

  map.flyTo([47.3788, 8.5481], 13);
  setTimeout(() => map.invalidateSize(true), 350);
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
  [guessMarker, correctMarker, lineLayer].forEach(l => l && map.removeLayer(l));
}

// ✅ Confirm Answer
function confirmGuess() {
  if (!userGuess) return;
  guessLocked = true;

  const q = gameQuestions[currentIndex];
  const correctPos = [q.lat, q.lng];

  const meters = map.distance([userGuess.lat, userGuess.lng], correctPos);
  const km = meters / 1000;

  const gained = awardPoints(meters);
  points += gained;
  scoreIndicator.textContent = `Points: ${points}`;
  totalDistanceKm += km;

  // ✅ Choose pulse color based on answered correctness
  const pulse = gained > 0 ? pulseIcon : pulseWrongIcon;
  const resultColor = gained > 0 ? "#8aa1ff" : "#ff6b6b";

  // ✅ Correct marker + pulse
  correctMarker = L.marker(correctPos).addTo(map);
  L.marker(correctPos, { icon: pulse }).addTo(map);

  // ✅ Popup with thumbnail + score + distance
  const popupHtml = `
    <div style="text-align:center; width:160px;">
      <strong style="font-size:1rem;">${q.answer}</strong><br>
      <img src="${q.image}" style="width:100%; height:80px; object-fit:cover; border-radius:6px; margin:6px 0;">
      <span style="font-size:0.85rem">
        Distance: ${km.toFixed(2)} km<br>
        Points: +${gained}
      </span>
    </div>
  `;
  correctMarker.bindPopup(popupHtml).openPopup();

  // ✅ Line (color depends on correctness)
  lineLayer = L.polyline([correctPos, [userGuess.lat, userGuess.lng]], {
    color: resultColor,
    weight: 3,
    opacity: 0.85
  }).addTo(map);

  // ✅ Camera animation
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

// ✅ Helpers
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

// ✅ Ensure map always fits viewport if resized
window.addEventListener("resize", () => map && map.invalidateSize(true));