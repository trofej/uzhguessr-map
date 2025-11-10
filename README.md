# 🗺️ UZH Map Guessr Game

A browser-based geography challenge for the **University of Zurich (UZH)**.  
See a photo → click on the map to guess the location of the building.  
Each game has **10 timed rounds (30 seconds each)** — after each guess, the correct location is revealed along with your distance and points.

Works as a static site (no backend required).

---

## 🚀 Features

- ⏱️ **Timed rounds:** 10 rounds per game, 30 seconds per round  
- 🗺️ **Map-based guessing:** click anywhere on the UZH map to indicate your guess  
- 📍 **Distance feedback:** shows how far your guess was from the correct location (in kilometers)  
- 🧮 **Dynamic scoring:** closer guesses earn more points, with streak bonuses for accuracy  
- 🧠 **Random order of questions:** every game is unique  
- 🏆 **Global leaderboard:** powered by Firebase Firestore  
- 🌍 **Result heatmap:** see your guesses, correct answers, and all players’ guesses  
- 💡 **Clean, modern UI:** smooth animations and mobile-friendly layout  
- 🎯 **Offline capable:** once assets are loaded, gameplay works without a backend

---

## 🧩 Customization

- Edit `data/questions.json` to add or modify locations, images, and coordinates  
- Place new images inside the `/images` folder  
- Adjust the number of rounds or timer in `app.js`:
  ```js
  const TOTAL_QUESTIONS = 10;
  const ROUND_TIME = 30; // seconds
