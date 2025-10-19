# UZH Map Guessr Game

A lightweight browser game: see a photo → click on the map to guess the location of the building.  
Each session has 5 rounds (configurable). After guessing, the correct location is revealed along with the distance from your guess.

Works as a static site (no backend).

## Features

- 5 rounds per game (configurable via `TOTAL_QUESTIONS`)
- Map-based guessing: click on the UZH map to indicate your answer
- Shows the correct location after each guess
- Displays the distance between your guess and the correct location (in kilometers)
- Clean UI with animations; mobile-friendly
- Random order of questions each game

## Customization

- Edit `data/questions.json` to add or modify questions, images, and coordinates
- Place new images in the `/images` folder
- Adjust the map scaling in `index.js` if your map image dimensions change

## Notes

- Each round allows **only one guess** before moving to the next question
- The game works offline once all images and JSON data are loaded
- Designed for UZH campus, but can be adapted to other campuses/maps