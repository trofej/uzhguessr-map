// ✅ UZH Map Guessr – Timed Mode Edition (30s per round + Combo Visuals)
const TOTAL_QUESTIONS = 10;
const ROUND_TIME = 30;

let currentIndex = 0, points = 0, userGuess = null, guessLocked = false;
let QUESTIONS = [], gameQuestions = [];
let totalDistanceKm = 0, gamesPlayed = 0, streak = 0;
let currentGameGuesses = [], scoreSaved = false;
let lastSavedName = localStorage.getItem("lastSavedName") || null;

let timerInterval = null, timeLeft = 0;
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
const leaderboardBodyStart = document.getElementById("leaderboard-body-start");
const btnConfirmGuess = document.getElementById("btn-confirm-guess");
const btnClearGuess = document.getElementById("btn-clear-guess");
const gamesPlayedDisplay = document.getElementById("games-played");
const timerDisplay = document.getElementById("timer-display");
const streakBar = document.getElementById("streak-bar");
const streakIndicator = document.getElementById("streak-indicator");

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
let previousGuesses = L.layerGroup();

// --- Helpers ---
function makePulseIcon(color) {
  return L.divIcon({
    className: "animated-pulse-marker",
    html: `
      <div class="pulse-outer" style="background:${color}33; box-shadow:0 0 10px ${color}66;"></div>
      <div class="pulse-inner" style="background:${color}; box-shadow:0 0 10px ${color};"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}
function clearGuessArtifacts() {
  [guessMarker, correctMarker, lineLayer].forEach(m => m && map.removeLayer(m));
  guessMarker = correctMarker = lineLayer = null;
}

// --- Game Counter ---
async function loadGameCounter() {
  try {
    const ref = fbDoc(db, "stats", STATS_DOC_ID);
    const snap = await fbGetDoc(ref);
    if (snap.exists()) gamesPlayed = snap.data().gamesPlayed || 0;
    else await fbSetDoc(ref, { gamesPlayed: 0 });
    gamesPlayedDisplay.textContent = `Total Games Played: ${gamesPlayed}`;
  } catch { gamesPlayedDisplay.textContent = ""; }
}
async function incrementGamePlays() {
  try {
    await fbSetDoc(fbDoc(db, "stats", STATS_DOC_ID), { gamesPlayed: fbIncrement(1) }, { merge: true });
    gamesPlayed++;
    gamesPlayedDisplay.textContent = `Total Games Played: ${gamesPlayed}`;
  } catch {}
}

// --- Map Init ---
document.addEventListener("DOMContentLoaded", () => {
  map = L.map("map", {
    center: [47.3788, 8.5481],
    zoom: 13,
    minZoom: 12, maxZoom: 19,
    maxBounds: L.latLngBounds([47.43, 8.45], [47.31, 8.65]),
    maxBoundsViscosity: 1.0,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
    subdomains: "abcd", maxZoom: 19,
  }).addTo(map);

  previousGuesses.addTo(map);
  map.on("click", e => { if (!guessLocked) placeGuess(e.latlng.lat, e.latlng.lng); });

  loadGameCounter();
  renderLeaderboard();
  renderStartLeaderboard();
});

// --- Timer ---
function startTimer() {
  clearInterval(timerInterval);
  timeLeft = ROUND_TIME;
  timerDisplay.style.display = "block";
  timerDisplay.textContent = `Time left: ${timeLeft}s`;

  timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = `Time left: ${timeLeft}s`;

    if (timeLeft <= 10 && timeLeft > 5) timerDisplay.className = "warning";
    else if (timeLeft <= 5) timerDisplay.className = "critical";
    else timerDisplay.className = "";

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerDisplay.textContent = "⏰ Time's up!";
      if (!guessLocked) confirmGuess();
    }
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInterval);
  timerDisplay.style.display = "none";
  timerDisplay.className = "";
}

// --- UI Switch ---
function setScreen(s) {
  [screenStart, screenGame, screenResult].forEach(el => el.classList.remove("active"));
  s.classList.add("active");
  if (s === screenGame && map) setTimeout(() => map.invalidateSize(), 200);
}

// --- Start Game ---
async function startGame() {
  if (!QUESTIONS.length) {
    const res = await fetch("data/questions.json");
    QUESTIONS = await res.json();
  }
  incrementGamePlays();
  clearGuessArtifacts();
  previousGuesses.clearLayers();
  map.closePopup();

  gameQuestions = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);
  currentIndex = 0; points = 0; totalDistanceKm = 0; streak = 0;
  currentGameGuesses = []; scoreSaved = false;
  playerNameInput.disabled = false; btnSaveScore.disabled = false;

  updateStreakUI(0); // reset streak visuals
  map.setView([47.3788, 8.5481], 13);
  setScreen(screenGame);
  renderRound();
}

// --- Round ---
function renderRound() {
  clearGuessArtifacts();
  guessLocked = false;
  userGuess = null;
  const q = gameQuestions[currentIndex];
  questionText.textContent = `Where is: ${q.answer}?`;
  roundIndicator.textContent = `Round ${currentIndex + 1}/${gameQuestions.length}`;
  questionImage.src = q.image;
  btnConfirmGuess.disabled = btnClearGuess.disabled = btnNext.disabled = true;
  startTimer();
}

// --- Guess ---
function placeGuess(lat, lng) {
  userGuess = { lat, lng };
  if (guessMarker) map.removeLayer(guessMarker);
  guessMarker = L.circleMarker([lat, lng], {
    radius: 8, color: "#c9a600", weight: 3,
    fillColor: "#ffeb3b", fillOpacity: 1,
  }).addTo(map).bindTooltip("Your Guess", { permanent: true, direction: "top", offset: [0, -6] });
  btnConfirmGuess.disabled = false; btnClearGuess.disabled = false;
}

// --- Confirm Guess ---
function confirmGuess() {
  if (!userGuess || guessLocked) return;
  guessLocked = true;
  stopTimer();

  const q = gameQuestions[currentIndex];
  const correct = [q.lat, q.lng];
  const meters = map.distance([userGuess.lat, userGuess.lng], correct);
  const gained = scoreFromDistance(meters);
  const km = meters / 1000;

  const prevStreak = streak;
  if (gained >= 70) streak++;
  else streak = 0;

  // 🔥 Combo visuals
  updateStreakUI(streak, prevStreak);

  const streakBonus = Math.min(streak * 5, 25);
  const totalGained = gained + streakBonus;
  points += totalGained;
  totalDistanceKm += km;

  scoreIndicator.textContent = `Points: ${points}`;
  scoreIndicator.classList.add("bump");
  setTimeout(() => scoreIndicator.classList.remove("bump"), 300);

  const { label, color } = accuracyRating(meters);
  lineLayer = L.polyline([[userGuess.lat, userGuess.lng], correct], { color, weight: 3, opacity: 0.8 }).addTo(map);
  correctMarker = L.marker(correct, { icon: makePulseIcon(color) }).addTo(previousGuesses);
  if (guessMarker) map.removeLayer(guessMarker);
  correctMarker.bindPopup(
    `<strong style="background:${color};padding:4px 10px;border-radius:8px;">${label}</strong><br>${q.answer}<br>Distance: ${km.toFixed(2)} km`
  ).openPopup();

  currentGameGuesses.push({
    question: q.answer, lat: userGuess.lat, lng: userGuess.lng,
    correctLat: q.lat, correctLng: q.lng, distance: Math.round(meters)
  });
  btnNext.disabled = false;
  btnConfirmGuess.disabled = true;
}

// --- 🔥 Streak / Combo Visuals ---
function updateStreakUI(newStreak, oldStreak = 0) {
  streakIndicator.textContent = `🔥 Streak: ${newStreak}`;
  if (newStreak > 0) {
    streakBar.style.width = `${Math.min(newStreak * 10, 100)}%`;
    streakBar.style.opacity = 0.8;
  } else {
    streakBar.style.width = "0%";
    streakBar.style.opacity = 0.3;
  }

  if (newStreak > oldStreak) {
    streakIndicator.classList.add("flash");
    streakBar.classList.add("glow");
    showComboBadge(newStreak);
    setTimeout(() => {
      streakIndicator.classList.remove("flash");
      streakBar.classList.remove("glow");
    }, 800);
  }
}

function showComboBadge(value) {
  const badge = document.createElement("div");
  badge.textContent = `🔥 Combo x${value}`;
  badge.style.position = "absolute";
  badge.style.right = "0";
  badge.style.top = "-1.2rem";
  badge.style.fontWeight = "700";
  badge.style.color = "#ffb366";
  badge.style.textShadow = "0 0 8px rgba(255,180,0,0.6)";
  badge.style.animation = "flamePop 1s ease-out forwards";
  badge.style.pointerEvents = "none";
  streakBar.parentElement.appendChild(badge);
  setTimeout(() => badge.remove(), 1000);
}

// --- Finish ---
async function finish() {
  stopTimer();
  resultSummary.textContent = `You scored ${points} points 🎯 Total distance: ${totalDistanceKm.toFixed(2)} km`;
  setScreen(screenResult);
  nameEntry.style.display = "block";

  setTimeout(async () => {
    const el = document.getElementById("result-map");
    if (!el || !currentGameGuesses.length) return;
    el.style.display = "block";
    el.innerHTML = "";
    if (el._leaflet_id) el._leaflet_id = null;

    const resultMap = L.map(el, {
      center: [47.3788, 8.5481],
      zoom: 13, zoomControl: false, attributionControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", {
      subdomains: "abcd", maxZoom: 19,
    }).addTo(resultMap);

    currentGameGuesses.forEach(g => {
      L.circleMarker([g.lat, g.lng], { radius: 6, color: "#8aa1ff", fillColor: "#8aa1ff", fillOpacity: 0.8 })
        .bindTooltip(`You: ${g.question} (${g.distance}m)`).addTo(resultMap);
      L.circleMarker([g.correctLat, g.correctLng], { radius: 5, color: "#60d394", fillColor: "#60d394", fillOpacity: 0.7 }).addTo(resultMap);
    });

    try {
      const snapAll = await fbGetDocs(fbCollection(db, "guesses"));
      snapAll.docs.map(d => d.data()).forEach(({ lat, lng }) => {
        L.circleMarker([lat, lng], { radius: 16, fillColor: "#ff6b6b", fillOpacity: 0.12, stroke: false }).addTo(resultMap);
      });
    } catch (err) { console.warn("Could not load global guesses:", err); }

    const legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "map-legend");
      div.innerHTML = `
        <div class="legend-item"><span class="legend-color" style="background:#8aa1ff"></span>Your Guesses</div>
        <div class="legend-item"><span class="legend-color" style="background:#60d394"></span>Correct Locations</div>
        <div class="legend-item"><span class="legend-color" style="background:#ff6b6b"></span>All Players’ Guesses</div>`;
      return div;
    };
    legend.addTo(resultMap);

    const bounds = L.latLngBounds(currentGameGuesses.map(g => [g.lat, g.lng]));
    if (bounds.isValid()) resultMap.fitBounds(bounds.pad(0.25));
    resultMap.invalidateSize();
    el.classList.add("ready");
  }, 400);
}

// --- Utilities ---
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
  return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// --- Leaderboards ---
async function loadLeaderboard() {
  try {
    const q = fbQuery(fbCollection(db, "leaderboard"), fbOrderBy("points", "desc"));
    const snap = await fbGetDocs(q);
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

async function renderLeaderboard() {
  const data = await loadLeaderboard();
  const highlightName = lastSavedName || localStorage.getItem("lastSavedName") || playerNameInput.value.trim();
  leaderboardBody.innerHTML = data.map((e, i) => {
    const name = e.name || "";
    const isSelf = highlightName && name.toLowerCase().trim() === highlightName.toLowerCase().trim();
    return `<tr class="${isSelf ? "leaderboard-self pulse-highlight" : ""}">
      <td>${i + 1}</td><td>${escapeHtml(name)}</td><td>${e.points}</td><td>${Number(e.distance).toFixed(2)}</td></tr>`;
  }).join("");
  setTimeout(() => document.querySelectorAll(".pulse-highlight").forEach(el => el.classList.remove("pulse-highlight")), 1500);
}

async function renderStartLeaderboard() {
  const data = await loadLeaderboard();
  if (!leaderboardBodyStart) return;
  leaderboardBodyStart.innerHTML = data.slice(0, 10).map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(e.name || "")}</td>
      <td>${e.points}</td>
      <td>${Number(e.distance).toFixed(2)}</td>
    </tr>`).join("");
}

// --- Events ---
btnConfirmGuess.addEventListener("click", confirmGuess);
btnClearGuess.addEventListener("click", () => {
  if (!guessLocked && guessMarker) {
    map.removeLayer(guessMarker);
    guessMarker = null;
    userGuess = null;
    btnConfirmGuess.disabled = btnClearGuess.disabled = true;
  }
});
btnNext.addEventListener("click", () => {
  currentIndex < gameQuestions.length - 1 ? renderRound(++currentIndex) : finish();
});
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", () => setScreen(screenStart));

// --- Save Score ---
btnSaveScore.addEventListener("click", async () => {
  if (scoreSaved) return alert("Score already saved ✅");
  if (!currentGameGuesses.length) return alert("Finish a game before saving.");
  const name = (playerNameInput.value.trim() || "Anonymous").slice(0, 20);
  const gameId = `game_${Date.now()}`;
  try {
    await fbAddDoc(fbCollection(db, "leaderboard"), { name, points, distance: Number(totalDistanceKm.toFixed(2)), ts: Date.now() });
    for (const g of currentGameGuesses)
      await fbAddDoc(fbCollection(db, "guesses"), { user: name, lat: g.lat, lng: g.lng, question: g.question, distance: g.distance, ts: Date.now() });
    const userRef = fbDoc(db, "user_guesses", name);
    const snap = await fbGetDoc(userRef);
    const data = snap.exists() ? snap.data() : { games: [] };
    data.games.push({ gameId, guesses: currentGameGuesses, timestamp: Date.now() });
    await fbSetDoc(userRef, data);

    scoreSaved = true;
    lastSavedName = name;
    localStorage.setItem("lastSavedName", name);
    playerNameInput.disabled = true;
    btnSaveScore.disabled = true;
    await renderLeaderboard();
    await renderStartLeaderboard();
    alert("Score saved ✅");
  } catch (err) {
    console.error(err);
    alert("Error saving score.");
  }
});

window.addEventListener("resize", () => map && map.invalidateSize());
