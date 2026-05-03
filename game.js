const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const timeEl = document.querySelector("#time");
const bestEl = document.querySelector("#best");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");

const keys = new Set();
const bestKey = "neon-courier-best";
const playerStart = { x: 480, y: 300 };

let state;
let frameId;

function reset() {
  state = {
    running: false,
    score: 0,
    timeLeft: 45,
    lastTime: 0,
    coreTimer: 0,
    blockerTimer: 0,
    boostTimer: 5,
    shield: 0,
    player: { x: playerStart.x, y: playerStart.y, r: 17, speed: 330 },
    cores: [],
    blockers: [],
    boosts: []
  };

  scoreEl.textContent = "0";
  timeEl.textContent = "45";
  bestEl.textContent = localStorage.getItem(bestKey) || "0";
}

function startGame() {
  reset();
  state.running = true;
  overlay.classList.add("hidden");
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(loop);
}

function endGame() {
  state.running = false;
  const best = Math.max(Number(localStorage.getItem(bestKey) || 0), state.score);
  localStorage.setItem(bestKey, String(best));
  bestEl.textContent = best;
  overlay.classList.remove("hidden");
  overlay.querySelector("h2").textContent = "Run complete.";
  overlay.querySelector("p").textContent = `Final score: ${state.score}. Press Space to restart.`;
  overlay.querySelector("strong").textContent = "Press Space";
}

function loop(timestamp) {
  const delta = Math.min((timestamp - (state.lastTime || timestamp)) / 1000, 0.033);
  state.lastTime = timestamp;

  update(delta);
  draw();

  if (state.running) {
    frameId = requestAnimationFrame(loop);
  }
}

function update(delta) {
  state.timeLeft -= delta;
  state.coreTimer -= delta;
  state.blockerTimer -= delta;
  state.boostTimer -= delta;
  state.shield = Math.max(0, state.shield - delta);

  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    timeEl.textContent = "0";
    endGame();
    return;
  }

  movePlayer(delta);
  spawnObjects();
  moveBlockers(delta);
  resolveCollisions();

  scoreEl.textContent = state.score;
  timeEl.textContent = Math.ceil(state.timeLeft);
}

function movePlayer(delta) {
  const p = state.player;
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    p.x += (dx / length) * p.speed * delta;
    p.y += (dy / length) * p.speed * delta;
  }

  p.x = clamp(p.x, p.r, canvas.width - p.r);
  p.y = clamp(p.y, p.r, canvas.height - p.r);
}

function spawnObjects() {
  if (state.coreTimer <= 0) {
    state.coreTimer = 0.55;
    state.cores.push(randomItem(12));
  }

  if (state.blockerTimer <= 0) {
    state.blockerTimer = Math.max(0.45, 0.9 - state.score / 900);
    const blocker = randomItem(19);
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 120;
    blocker.vx = Math.cos(angle) * speed;
    blocker.vy = Math.sin(angle) * speed;
    state.blockers.push(blocker);
  }

  if (state.boostTimer <= 0) {
    state.boostTimer = 7 + Math.random() * 4;
    state.boosts.push(randomItem(14));
  }

  state.cores = state.cores.slice(-18);
  state.blockers = state.blockers.slice(-14);
  state.boosts = state.boosts.slice(-3);
}

function moveBlockers(delta) {
  state.blockers.forEach((blocker) => {
    blocker.x += blocker.vx * delta;
    blocker.y += blocker.vy * delta;

    if (blocker.x < blocker.r || blocker.x > canvas.width - blocker.r) blocker.vx *= -1;
    if (blocker.y < blocker.r || blocker.y > canvas.height - blocker.r) blocker.vy *= -1;

    blocker.x = clamp(blocker.x, blocker.r, canvas.width - blocker.r);
    blocker.y = clamp(blocker.y, blocker.r, canvas.height - blocker.r);
  });
}

function resolveCollisions() {
  state.cores = state.cores.filter((core) => {
    if (collides(state.player, core)) {
      state.score += 10;
      return false;
    }
    return true;
  });

  state.boosts = state.boosts.filter((boost) => {
    if (collides(state.player, boost)) {
      state.score += 25;
      state.shield = 4;
      return false;
    }
    return true;
  });

  state.blockers = state.blockers.filter((blocker) => {
    if (!collides(state.player, blocker)) return true;

    if (state.shield > 0) {
      state.score += 5;
      return false;
    }

    state.score = Math.max(0, state.score - 20);
    state.timeLeft = Math.max(0, state.timeLeft - 3);
    blocker.x = randomBetween(40, canvas.width - 40);
    blocker.y = randomBetween(40, canvas.height - 40);
    return true;
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  state.cores.forEach((core) => drawDiamond(core.x, core.y, core.r, "#34d6ff"));
  state.boosts.forEach((boost) => drawDiamond(boost.x, boost.y, boost.r, "#ffd166"));
  state.blockers.forEach(drawBlocker);
  drawPlayer();
}

function drawGrid() {
  ctx.fillStyle = "#05080c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(52, 214, 255, 0.11)";
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  const color = state.shield > 0 ? "#ffd166" : "#73e2a7";
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(0, -p.r - 9);
  ctx.lineTo(p.r + 13, p.r + 3);
  ctx.lineTo(0, p.r * 0.42);
  ctx.lineTo(-p.r - 13, p.r + 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDiamond(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

function drawBlocker(blocker) {
  ctx.save();
  ctx.translate(blocker.x, blocker.y);
  ctx.strokeStyle = "#ff4d5e";
  ctx.fillStyle = "rgba(255, 77, 94, 0.2)";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#ff4d5e";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(0, 0, blocker.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-blocker.r * 0.65, -blocker.r * 0.65);
  ctx.lineTo(blocker.r * 0.65, blocker.r * 0.65);
  ctx.moveTo(blocker.r * 0.65, -blocker.r * 0.65);
  ctx.lineTo(-blocker.r * 0.65, blocker.r * 0.65);
  ctx.stroke();
  ctx.restore();
}

function randomItem(r) {
  return {
    r,
    x: randomBetween(r + 8, canvas.width - r - 8),
    y: randomBetween(r + 8, canvas.height - r - 8)
  };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function collides(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.code === "Space") {
    event.preventDefault();
    startGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

startButton.addEventListener("click", startGame);

reset();
draw();
