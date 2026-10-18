// Gravity Drift - 2D canvas runner
// written by Navilesh

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// player physics & settings
const size = 36;
let gravity = 1.35; // fast, snappy gravity flip

let x = 110;
let y = canvas.height - size;
let vy = 0;
let onSurface = true;

// tactile squash & stretch for landing/jumping feel
let scaleX = 1;
let scaleY = 1;

// input buffering - if player presses flip 140ms before landing, flip immediately on touchdown
let flipBufferTimer = 0;
const BUFFER_MS = 140;

// obstacle list & game state
let obstacles = [];
let shards = [];      // collectible bonus shards
let floaters = [];    // floating score popups ("+50", "Close Call!")
let timer = 0;
let nextSpawnDistance = 60;
let speed = 5.4;
let frames = 0;
let shake = 0;
let state = "start"; // start | play | pause | over

// scoring
let score = 0;
let best = Number(localStorage.getItem("gdBest")) || 0;
let newBestTriggered = false;

// visual effects
let trail = [];
let particles = [];
let stars = [];
let railOffset = 0;

// distant stars for depth
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    s: 0.8 + Math.random() * 1.6,
    speedFactor: 0.15 + Math.random() * 0.25
  });
}

// ---------------- sound effects (procedural web audio) ----------------
let audio = null;
let muted = localStorage.getItem("gdMuted") === "1";

function getAudio() {
  if (!audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audio = new AudioContext();
  }
  if (audio && audio.state === "suspended") {
    audio.resume();
  }
  return audio;
}

function playSound(type) {
  if (muted) return;
  const actx = getAudio();
  if (!actx) return;

  const now = actx.currentTime;

  if (type === "flip") {
    // snappy woosh/click
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = "sine";
    const startF = gravity > 0 ? 300 : 540;
    const endF = gravity > 0 ? 540 : 300;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === "land") {
    // subtle low thud
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.06);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } else if (type === "collect") {
    // bright 2-note chime
    [660, 990].forEach((freq, i) => {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.07, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.09);
      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.1);
    });
  } else if (type === "crash") {
    // low noise crunch
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.29);
  } else if (type === "start") {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.1);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

// ---------------- reset / start ----------------
function resetGame() {
  x = 110;
  y = canvas.height - size;
  vy = 0;
  gravity = Math.abs(gravity); // always start on floor
  onSurface = true;
  scaleX = 1;
  scaleY = 1;
  flipBufferTimer = 0;

  obstacles = [];
  shards = [];
  floaters = [];
  timer = 0;
  nextSpawnDistance = 60;
  speed = 5.4;
  score = 0;
  newBestTriggered = false;
  trail = [];
  particles = [];
  state = "play";

  playSound("start");
}

function doFlip() {
  gravity = -gravity;
  onSurface = false;

  // snappy launch impulse
  vy = gravity * 3.8;

  // tactile launch stretch
  scaleX = 0.82;
  scaleY = 1.25;

  playSound("flip");

  // small burst of thruster dust at launch point
  const dustY = gravity > 0 ? 4 : canvas.height - 4;
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: x + size / 2 + (Math.random() - 0.5) * 14,
      y: dustY,
      vx: -(Math.random() * 2 + 2),
      vy: gravity > 0 ? Math.random() * 2 : -Math.random() * 2,
      life: 14 + Math.random() * 8,
      color: "#38bdf8",
      size: 2.5
    });
  }
}

function requestFlip() {
  if (state === "start" || state === "over") {
    resetGame();
    return;
  }
  if (state === "play") {
    if (onSurface) {
      doFlip();
    } else {
      // buffer the flip if pressed slightly before landing
      flipBufferTimer = Date.now();
    }
  }
}

// ---------------- controls ----------------
document.addEventListener("keydown", function (e) {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    requestFlip();
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

// canvas touch / click support
canvas.addEventListener("pointerdown", function (e) {
  e.preventDefault();
  requestFlip();
});

// pause when window loses focus
window.addEventListener("blur", function () {
  if (state === "play") state = "pause";
});

// ---------------- collision & near-miss helper ----------------
function hit(a, b) {
  const pad = 2; // forgiving hitbox
  return (
    a.x + pad < b.x + b.w &&
    a.x + a.w - pad > b.x &&
    a.y + pad < b.y + b.h &&
    a.y + a.h - pad > b.y
  );
}

function addFloater(text, fx, fy, color = "#f1f5f9") {
  floaters.push({
    text,
    x: fx,
    y: fy,
    vy: -1.3,
    life: 32,
    color
  });
}

// ---------------- procedural obstacle & rhythm spawner ----------------
function spawnPattern() {
  const roll = Math.random();
  const spawnX = canvas.width + 20;

  // Pattern A: Mid-air static gate (safe on floor or ceiling)
  if (score > 300 && roll < 0.28) {
    const midY = (canvas.height - 60) / 2;
    obstacles.push({
      x: spawnX,
      y: midY,
      w: 26,
      h: 60,
      type: "gate",
      nearMissed: false
    });
    // spawn bonus shard above or below
    const shardOnTop = Math.random() < 0.5;
    shards.push({
      x: spawnX + 13,
      y: shardOnTop ? midY - 32 : midY + 60 + 32,
      size: 11
    });
    nextSpawnDistance = 65 + Math.random() * 20;
    return;
  }

  // Pattern B: Alternating rhythm pair (Floor spike -> Ceiling spike)
  if (score > 500 && roll < 0.52) {
    const h1 = 55;
    const h2 = 55;
    obstacles.push({
      x: spawnX,
      y: canvas.height - h1,
      w: 26,
      h: h1,
      type: "block",
      nearMissed: false
    });
    const gap = 120 + speed * 6;
    obstacles.push({
      x: spawnX + gap,
      y: 0,
      w: 26,
      h: h2,
      type: "block",
      nearMissed: false
    });
    shards.push({
      x: spawnX + gap / 2,
      y: canvas.height / 2,
      size: 11
    });
    nextSpawnDistance = (gap + 75) / (speed * 0.8);
    return;
  }

  // Pattern C: Standard solid pillar on floor or ceiling
  const onFloor = Math.random() < 0.5;
  const h = 58 + Math.random() * 85;
  obstacles.push({
    x: spawnX,
    y: onFloor ? canvas.height - h : 0,
    w: 26,
    h: h,
    type: "block",
    nearMissed: false
  });

  // 35% chance to place a rewarding collectible shard near the opposite surface
  if (Math.random() < 0.35) {
    shards.push({
      x: spawnX + 13,
      y: onFloor ? 65 : canvas.height - 65,
      size: 11
    });
  }

  nextSpawnDistance = 55 + Math.random() * 25;
}

// ---------------- landing dust & crash particles ----------------
function spawnLandingDust(isCeiling) {
  const dustY = isCeiling ? 2 : canvas.height - 2;
  for (let i = 0; i < 7; i++) {
    particles.push({
      x: x + size / 2 + (Math.random() - 0.5) * 18,
      y: dustY,
      vx: (Math.random() - 0.5) * 3.5 - 1.5,
      vy: isCeiling ? Math.random() * 2.5 : -Math.random() * 2.5,
      life: 14 + Math.random() * 8,
      color: "#94a3b8",
      size: 2
    });
  }
}

function burst(px, py) {
  // shatter burst on death
  for (let i = 0; i < 34; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = 1.5 + Math.random() * 5.5;
    particles.push({
      x: px,
      y: py,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      life: 35 + Math.random() * 25,
      color: Math.random() > 0.4 ? "#38bdf8" : "#f43f5e",
      size: 3.5
    });
  }
}

function die() {
  state = "over";
  shake = 14;
  burst(x + size / 2, y + size / 2);
  playSound("crash");

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

  // 1. Background stars parallax
  ctx.fillStyle = "#ffffff";
  for (const st of stars) {
    st.x = st.x - st.speedFactor * (state === "play" ? speed : 0.6);
    if (st.x < 0) st.x = canvas.width;
    ctx.globalAlpha = 0.2 + st.speedFactor * 0.35;
    ctx.fillRect(st.x, st.y, st.s, st.s);
  }
  ctx.globalAlpha = 1;

  // 2. Parallax rails with moving speed hashes
  railOffset = (railOffset + (state === "play" ? speed : 0.6)) % 40;

  // Floor and ceiling main lines
  ctx.strokeStyle = "#252836";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(canvas.width, 1);
  ctx.moveTo(0, canvas.height - 1);
  ctx.lineTo(canvas.width, canvas.height - 1);
  ctx.stroke();

  // Moving tick hashes on rails to give a real sense of speed
  ctx.fillStyle = "#1e2230";
  for (let rx = -railOffset; rx < canvas.width + 40; rx += 40) {
    ctx.fillRect(rx, 0, 14, 3);
    ctx.fillRect(rx, canvas.height - 3, 14, 3);
  }

  // 3. Gameplay logic updates
  if (state === "play") {
    frames = frames + 1;

    // vertical physics
    vy = vy + gravity;
    y = y + vy;
    onSurface = false;

    // hit the floor
    if (y > canvas.height - size) {
      if (!onSurface && vy > 1) {
        playSound("land");
        spawnLandingDust(false);
        scaleX = 1.25;
        scaleY = 0.78; // landing squash
      }
      y = canvas.height - size;
      vy = 0;
      onSurface = true;

      // check if a buffered flip was waiting for floor contact
      if (Date.now() - flipBufferTimer < BUFFER_MS) {
        flipBufferTimer = 0;
        doFlip();
      }
    }

    // hit the ceiling
    if (y < 0) {
      if (!onSurface && vy < -1) {
        playSound("land");
        spawnLandingDust(true);
        scaleX = 1.25;
        scaleY = 0.78; // landing squash
      }
      y = 0;
      vy = 0;
      onSurface = true;

      // check if a buffered flip was waiting for ceiling contact
      if (Date.now() - flipBufferTimer < BUFFER_MS) {
        flipBufferTimer = 0;
        doFlip();
      }
    }

    // spring physics recovery for squash & stretch
    scaleX += (1 - scaleX) * 0.22;
    scaleY += (1 - scaleY) * 0.22;

    // score & speed scaling
    score = score + 1;
    speed = 5.4 + Math.min(score / 1200, 7.0);

    // new best celebration sound
    if (score > best && best > 0 && !newBestTriggered) {
      newBestTriggered = true;
      addFloater("NEW BEST!", canvas.width / 2, 70, "#f59e0b");
      playSound("collect");
    }

    // spawn obstacles with rhythm timing
    timer = timer + 1;
    if (timer > nextSpawnDistance) {
      spawnPattern();
      timer = 0;
    }

    // update obstacles & check collisions / near misses
    const pBox = { x: x, y: y, w: size, h: size };
    for (const o of obstacles) {
      o.x = o.x - speed;

      // near miss detection (grazing an obstacle within 18px without hitting it)
      if (!o.nearMissed && o.x + o.w < x) {
        o.nearMissed = true;
        const distY = Math.abs((y + size / 2) - (o.y + o.h / 2));
        if (distY < o.h / 2 + size / 2 + 20) {
          score += 25;
          addFloater("+25 Close Call", x + 40, y - 10, "#fbbf24");
        }
      }

      if (hit(pBox, o)) {
        die();
      }
    }
    obstacles = obstacles.filter(o => o.x + o.w > -50);

    // update collectible shards
    for (let i = shards.length - 1; i >= 0; i--) {
      const sh = shards[i];
      sh.x -= speed;

      // check pickup collision
      const cx = x + size / 2;
      const cy = y + size / 2;
      const dist = Math.hypot(cx - sh.x, cy - sh.y);
      if (dist < size / 2 + sh.size) {
        score += 50;
        playSound("collect");
        addFloater("+50", sh.x, sh.y - 12, "#38bdf8");

        // sparkle pickup particles
        for (let k = 0; k < 10; k++) {
          particles.push({
            x: sh.x,
            y: sh.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 18 + Math.random() * 8,
            color: "#38bdf8",
            size: 2.5
          });
        }
        shards.splice(i, 1);
        continue;
      }

      if (sh.x < -30) shards.splice(i, 1);
    }

    // player ghost trail history
    trail.push({ x: x, y: y, scaleX: scaleX, scaleY: scaleY });
    if (trail.length > 7) trail.shift();
  }

  // 4. Draw Obstacles (Clean flat color with subtle border)
  for (const o of obstacles) {
    ctx.fillStyle = o.type === "gate" ? "#f59e0b" : "#f43f5e";
    ctx.fillRect(o.x, o.y, o.w, o.h);

    // subtle top highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(o.x, o.y, o.w, 3);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x, o.y, o.w, o.h);
  }

  // 5. Draw Collectible Shards (Rotated Diamond with soft inner core)
  for (const sh of shards) {
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(frames * 0.04);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(-sh.size / 2, -sh.size / 2, sh.size, sh.size);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-sh.size / 4, -sh.size / 4, sh.size / 2, sh.size / 2);
    ctx.restore();
  }

  // 6. Draw Player Trail
  for (let i = 0; i < trail.length; i++) {
    const tr = trail[i];
    ctx.save();
    ctx.translate(tr.x + size / 2, tr.y + size / 2);
    ctx.scale(tr.scaleX, tr.scaleY);
    ctx.globalAlpha = ((i + 1) / trail.length) * 0.22;
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 7. Draw Player (Clean solid box with tactile squash & stretch)
  if (state !== "over") {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(scaleX, scaleY);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(-size / 2, -size / 2, size, size);

    // subtle inner border for a crafted indie game look
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-size / 2 + 1, -size / 2 + 1, size - 2, size - 2);
    ctx.restore();
  }

  // 8. Update & Draw Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    ctx.globalAlpha = Math.max(p.life / 30, 0);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size || 2.5, p.size || 2.5);
    if (p.life <= 0) particles.splice(i, 1);
  }
  ctx.globalAlpha = 1;

  // 9. Update & Draw Floating Text Popups
  for (let i = floaters.length - 1; i >= 0; i--) {
    const fl = floaters[i];
    fl.y += fl.vy;
    fl.life -= 1;
    ctx.globalAlpha = Math.max(fl.life / 30, 0);
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = fl.color;
    ctx.textAlign = "left";
    ctx.fillText(fl.text, fl.x, fl.y);
    if (fl.life <= 0) floaters.splice(i, 1);
  }
  ctx.globalAlpha = 1;

  // 10. HUD: Score, Best & Speed
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "600 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Score: " + Math.floor(score / 10), 20, 32);

  ctx.fillStyle = newBestTriggered ? "#f59e0b" : "#94a3b8";
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Best: " + Math.floor(best / 10), 20, 54);

  // Speed multiplier indicator
  const speedX = (speed / 5.4).toFixed(1);
  ctx.textAlign = "right";
  ctx.fillStyle = "#64748b";
  ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Speed " + speedX + "x", canvas.width - 20, 54);

  ctx.fillStyle = "#94a3b8";
  ctx.fillText(muted ? "Sound: off (M)" : "Sound: on (M)", canvas.width - 20, 32);

  // 11. Overlays: Start, Pause & Game Over
  ctx.textAlign = "center";
  if (state === "start") {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("GRAVITY DRIFT", canvas.width / 2, 160);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("Flip between floor & ceiling to dodge blocks and collect shards", canvas.width / 2, 200);

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
    ctx.fillStyle = "rgba(10, 12, 18, 0.72)";
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
      ctx.fillText("★ New Best Score! ★", canvas.width / 2, 225);
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

// launch loop
loop();