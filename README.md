# Cursed Rhythm

Cursed Rhythm is a fun, browser-based rhythm game built with React and custom timing logic.
It starts off easy, then gradually ramps up the difficulty as you play.

The game leans heavily into a playful, anime-inspired aesthetic (a little
“puppy-coded”), but at its core it’s just a solid rhythm game meant to be fun, fast,
and a bit unhinged in the best way.

Play it here at https://radkinz.com/cursed-rhythm/

---

## What It Is

Cursed Rhythm is a fun front-end project that blends:
- **Interactive timing**
- **React state management**
- **Keyboard input**
- **Simple animation**

The game challenges users to hit keys in time with visual cues. It was built as a creative side project to explore real-time interactions and UI responsiveness in React.

---

## Features

- **Browser-based rhythm gameplay** with real-time keyboard input and hit timing
- **Custom chart engine** that reads JSON note charts and drives gameplay logic
- **Difficulty scaling** that ramps up as the song progresses
- **Visual feedback and scoring** for hits, misses, and streaks
- **React-based UI** for managing game state, animations, and transitions

### Chart Generation Pipeline

- Python preprocessing script that analyzes MP3 audio files
- Extracts timing and structure information from songs given the song's BPM
- Automatically generates rhythm chart JSON files used by the game
- Enables rapid iteration on new songs without manually authoring charts

This separation between audio analysis (Python) and gameplay (JavaScript/React)
keeps the game logic lightweight while allowing more complex offline processing.

---

## Tech Stack

- **Frontend:** React  
- **Build Tool:** Vite  
- **Languages:** JavaScript, JSX, HTML, CSS  
- **Deployment:** Static site hosted on GitHub Pages  

---

## Local Development

To run this project locally:

1. Clone the repo  
   ```bash
   git clone https://github.com/radkinz/cursed-rhythm.git
   cd cursed-rhythm
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Start the development server
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to
   ```bash
   http://localhost:5173   
   ```
---

## Video Demo

[![Cursed Rhythm Demo]](LiveGamplay.mp4)
