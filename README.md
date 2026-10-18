# Gravity Drift

A fast-paced, one-button 2D gravity-flip runner built entirely with vanilla JavaScript, HTML5 Canvas, and the Web Audio API. No external libraries, build steps, or dependencies required.

---

## Gameplay

Your runner moves forward automatically. With a single key or click, you flip gravity between the floor and the ceiling to weave through obstacles, collect energy shards, and survive as the speed steadily accelerates.

### Controls

| Action | Input |
| :--- | :--- |
| **Flip Gravity / Start** | <kbd>Space</kbd>, <kbd>▲</kbd>, <kbd>W</kbd>, or **Left Click / Tap** |
| **Pause / Resume** | <kbd>P</kbd> |
| **Mute / Unmute Audio** | <kbd>M</kbd> |
| **Quick Restart** | <kbd>R</kbd> (on Game Over) |

---

## Features

- **Snappy, Responsive Gravity Inversion**: Fast vertical transitions with an initial launch impulse, giving you tight control when dodging close obstacles.
- **Input Buffering (140ms)**: Pressing flip right before touching the floor or ceiling buffers the action and triggers it immediately on touchdown—no dropped inputs.
- **Tactile Game Feel**: Elastic squash & stretch on landings and launches, subtle landing dust puffs, and screen shake on collisions.
- **Procedural Obstacle Generation**: Streams varied patterns (floor pillars, ceiling stalactites, alternating rhythm pairs, and mid-air gates) with dynamic reaction spacing that scales with speed.
- **Risk & Reward Mechanics**:
  - **Bonus Shards**: Floating diamond shards placed in challenging routes grant +50 points.
  - **Close Call Grazing**: Grazing dangerously close to an obstacle without hitting it awards a +25 bonus.
- **Procedural Web Audio Engine**: Synthesizes custom retro-style sound effects in real time using the browser's native Web Audio API (flips, rail landings, shard chimes, and crash sounds).
- **Persistent High Scores**: High scores are saved to browser `localStorage` and persist between sessions.
- **Clean Indie Aesthetic**: Dark charcoal/slate styling with flat arcade colors and no distracting neon bloom or heavy gradients.

---

## Project Structure

```text
gravity-drift/
├── index.html     # Semantic page structure & canvas viewport
├── style.css      # Dark-slate theme & responsive layout
├── game.js        # Core game loop, physics, procedural spawner & audio
└── README.md      # Project overview and documentation
```

---

## Getting Started

Because the project is built with vanilla web technologies, you don't need `npm`, `node`, or any bundlers:

1. Clone or download this repository:
   ```bash
   git clone https://github.com/Navilesh/gravity-drift.git
   ```
2. Open `index.html` directly in any modern browser (Chrome, Firefox, Safari, Edge):
   - Double-click `index.html`, or
   - Use VS Code **Live Server**, or
   - Run a local static server:
     ```bash
     python -m http.server 8000
     ```
3. Press <kbd>Space</kbd> or click the screen to launch!

---

## Author

Created by **Navilesh**. Built with HTML5 Canvas, CSS, and JavaScript.

