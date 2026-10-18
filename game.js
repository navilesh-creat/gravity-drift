// Gravity Drift - 2D canvas runner
// written by Navilesh

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// player settings
const size = 36; // 36px feels a bit tighter than 40
let gravity = 0.52; // tweak this if it feels too floaty or heavy

let x = 100;
let y = canvas.height - size;
let vy = 0;
let onSurface = true;

// obstacle list & game state
let obstacles = [];
let timer = 0;
let speed = 5;
let frames = 0;
let shake = 0;
let state = "start"; // start | play | pause | over

// scoring
let score = 0;
let best = Number(localStorage.getItem("gdBest")) || 0;
// let debugMode = false; // set to true if you wanna test without dying lol

// visual stuff
let trail = [];
let particles = [];
let stars = [];

// simple starfield so the void isn't completely empty
for (let i = 0; i < 55; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    s: 0.8 + Math.random() * 1.8,
  });
}

// ---------------- sound effects ----------------
// web audio context needs a click first or chrome complains in the console
let audio = null;
let muted = localStorage.getItem("gdMuted") === "1";

function beep(freq, dur, type, vol) {
  if (muted) return;
  try {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audio = new AudioContext();
    }
    if (audio.state === "suspended") {
      audio.resume();
    }
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.value = vol || 0.04;
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.stop(audio.currentTime + dur);
  } catch (err) {
    // audio failed, ignore it so game doesn't crash
  }
}

// handy helper, basically just Math.max/min
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// ---------------- reset / start ----------------
function resetGame() {
  x = 100;
  y = canvas.height - size;
  vy = 0;
  gravity = Math.abs(gravity); // always start falling down
  onSurface = true;
  obstacles = [];
  timer = 0;
  speed = 5;
  score = 0;
  trail = [];
  particles = [];
  state = "play";
  beep(600, 0.09, "sine", 0.05);
}

function flipGravity() {
  if (state === "start" || state === "over") {
    resetGame();
    return;
  }
  if (state === "play" && onSurface) {
    gravity = -gravity;
    onSurface = false;
    beep(480, 0.07, "triangle", 0.04);
  }
}

// ---------------- controls ----------------
document.addEventListener("keydown", function (e) {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    flipGravity();
  }
  if (e.code === "KeyR" && state === "over") {
    resetGame();
  }
  if (e.code === "KeyP") {
    if (state === "play") state = "pause";
    else if (state === "pause") state = "play";
  }
  if (e.code === "KeyM") {
    muted = !muted;
    localStorage.setItem("gdMuted", muted ? "1" : "0");
  }
});

// also let player click canvas to flip because spacebar gets tiring
canvas.addEventListener("pointerdown", function (e) {
  e.preventDefault();
  flipGravity();
});

// pause automatically if player tabs away
window.addEventListener("blur", function () {
  if (state === "play") state = "pause";
});

// ---------------- collision ----------------
// standard aabb box collision with tiny 2px padding for fairness
function hit(a, b) {
  const pad = 2; // forgiving hitbox feels way more fun
  return (
    a.x + pad < b.x + b.w &&
    a.x + a.w - pad > b.x &&
    a.y + pad < b.y + b.h &&
    a.y + a.h - pad > b.y
  );
}

// ---------------- obstacle spawner ----------------
function spawn() {
  const roll = Math.random();

  // moving block after reaching higher score
  if (score > 750 && roll < 0.22) {
    obstacles.push({
      x: canvas.width,
      y: 150,
      w: 26,
      h: 65,
      type: "mover",
      base: 150,
      phase: Math.random() * Math.PI * 2,
    });
  } else if (score > 250 && roll < 0.42) {
    // floating block in mid-air
    obstacles.push({
      x: canvas.width,
      y: 110 + Math.random() * 110,
      w: 26,
      h: 52,
      type: "floater",
    });
  } else {
    // regular pillar on floor or ceiling
    const h = 55 + Math.random() * 80;
    const onFloor = Math.random() < 0.5;
    obstacles.push({
      x: canvas.width,
      y: onFloor ? canvas.height - h : 0,
      w: 28,
      h: h,
      type: "block",
    });
  }
}

function colorFor(o) {
  if (o.type === "floater") return "#f59e0b"; // warm amber
  if (o.type === "mover") return "#a855f7";   // muted purple
  return "#f43f5e"; // clean coral red
}

// ---------------- particles & game over ----------------
function burst(px, py) {
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = 1.5 + Math.random() * 4.5;
    particles.push({
      x: px,
      y: py,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      life: 35 + Math.random() * 20,
    });
  }
}

function die() {
  state = "over";
  shake = 12;
  burst(x + size / 2, y + size / 2);
  beep(110, 0.35, "sawtooth", 0.08);

  // console.log("died with score:", Math.floor(score / 10));
  if (score > best) {
    best = score;
    localStorage.setItem("gdBest", best);
  }
}

// ---------------- game loop ----------------
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  // screen shake on crash
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    shake = shake - 1;
  }

  // parallax stars
  ctx.fillStyle = "#ffffff";
  for (const st of stars) {
    st.x = st.x - st.s * (state === "play" ? speed / 6 : 0.25);
    if (st.x < 0) st.x = canvas.width;
    ctx.globalAlpha = 0.2 + st.s * 0.25;
    ctx.fillRect(st.x, st.y, st.s, st.s);
  }
  ctx.globalAlpha = 1;

  // floor and ceiling boundaries
  ctx.strokeStyle = "#252836";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(canvas.width, 1);
  ctx.moveTo(0, canvas.height - 1);
  ctx.lineTo(canvas.width, canvas.height - 1);
  ctx.stroke();

  if (state === "play") {
    frames = frames + 1;

    // physics update
    vy = vy + gravity;
    y = y + vy;
    onSurface = false;

    // hit the floor
    if (y > canvas.height - size) {
      y = canvas.height - size;
      vy = 0;
      onSurface = true;
    }
    // hit the ceiling
    if (y < 0) {
      y = 0;
      vy = 0;
      onSurface = true;
    }

    score = score + 1;
    speed = 5 + score / 1400; // gentle ramp up
    if (score % 500 === 0) beep(750, 0.1, "sine", 0.03);

    // spawn obstacles
    timer = timer + 1;
    if (timer > Math.max(34, 75 - score / 60)) {
      spawn();
      timer = 0;
    }

    // update obstacles
    for (const o of obstacles) {
      o.x = o.x - speed;
      if (o.type === "mover") {
        o.y = o.base + Math.sin(frames / 24 + o.phase) * 90;
      }
      if (hit({ x: x, y: y, w: size, h: size }, o)) {
        die();
      }
    }
    obstacles = obstacles.filter(function (o) {
      return o.x + o.w > 0;
    });

    // trail history
    trail.push({ x: x, y: y });
    if (trail.length > 10) trail.shift();
  }

  // draw obstacles (clean flat colors + subtle border)
  for (const o of obstacles) {
    ctx.fillStyle = colorFor(o);
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  // player trail
  for (let i = 0; i < trail.length; i++) {
    ctx.globalAlpha = ((i + 1) / trail.length) * 0.25;
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(trail[i].x, trail[i].y, size, size);
  }
  ctx.globalAlpha = 1;

  // draw player
  if (state !== "over") {
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(x, y, size, size);

    // little eye/cockpit so the player isn't just a lifeless square
    ctx.fillStyle = "#ffffff";
    const eyeY = gravity > 0 ? y + 8 : y + size - 14;
    ctx.fillRect(x + size - 11, eyeY, 5, 6);
  }

  // death particles
  for (const p of particles) {
    p.x = p.x + p.vx;
    p.y = p.y + p.vy;
    p.life = p.life - 1;
    ctx.globalAlpha = Math.max(p.life / 50, 0);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
  particles = particles.filter(function (p) {
    return p.life > 0;
  });

  // HUD: score & best
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Score: " + Math.floor(score / 10), 20, 32);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Best: " + Math.floor(best / 10), 20, 54);

  ctx.textAlign = "right";
  ctx.fillText(muted ? "Sound: off (M)" : "Sound: on (M)", canvas.width - 20, 32);

  // Overlay screens
  ctx.textAlign = "center";
  if (state === "start") {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("GRAVITY DRIFT", canvas.width / 2, 160);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Flip between floor & ceiling to dodge blocks", canvas.width / 2, 200);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "600 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Press Space or Click to start", canvas.width / 2, 240);
  } else if (state === "pause") {
    ctx.fillStyle = "rgba(10, 12, 18, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Paused", canvas.width / 2, 185);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Press P to continue", canvas.width / 2, 220);
  } else if (state === "over") {
    ctx.fillStyle = "rgba(10, 12, 18, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#f43f5e";
    ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Game Over!", canvas.width / 2, 155);

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Score: " + Math.floor(score / 10), canvas.width / 2, 195);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    if (score > 0 && Math.floor(score / 10) >= Math.floor(best / 10)) {
      ctx.fillStyle = "#f59e0b";
      ctx.fillText("New Best Score!", canvas.width / 2, 225);
    } else {
      ctx.fillText("Best: " + Math.floor(best / 10), canvas.width / 2, 225);
    }

    ctx.fillStyle = "#38bdf8";
    ctx.font = "600 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Press Space or R to try again", canvas.width / 2, 260);
  }

  ctx.restore();
  requestAnimationFrame(loop);
}

// kick off loop
loop();