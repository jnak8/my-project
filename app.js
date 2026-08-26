const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const startBtn = document.getElementById("start-btn");

const ROUND_SECONDS = 40;
const TARGET_COLOR = "#ef4444";
const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#fb7185"];

let width = 0;
let height = 0;
let balloons = [];
let pops = [];
let floatTexts = [];
let score = 0;
let remaining = ROUND_SECONDS;
let playing = false;
let lastTime = 0;
let spawnAcc = 0;
let audioCtx = null;
let timerId = null;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playPop(isTarget) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(isTarget ? 520 : 280, t);
  osc.frequency.exponentialRampToValueAtTime(isTarget ? 880 : 160, t + 0.12);
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.15);
}

function spawnBalloon() {
  const r = rand(36, 62);
  balloons.push({
    x: rand(r + 8, width - r - 8),
    y: height + r + rand(0, 80),
    r,
    color: Math.random() < 0.45 ? TARGET_COLOR : pick(COLORS),
    vy: rand(70, 130),
    wobble: rand(0, Math.PI * 2),
    face: Math.random() > 0.2,
  });
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#7dd3fc");
  sky.addColorStop(0.55, "#bae6fd");
  sky.addColorStop(1, "#fef9c3");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (const cloud of [
    [width * 0.18, 90, 46],
    [width * 0.7, 130, 58],
    [width * 0.42, height * 0.22, 40],
  ]) {
    ctx.beginPath();
    ctx.arc(cloud[0], cloud[1], cloud[2], 0, Math.PI * 2);
    ctx.arc(cloud[0] + cloud[2] * 0.8, cloud[1] + 8, cloud[2] * 0.7, 0, Math.PI * 2);
    ctx.arc(cloud[0] - cloud[2] * 0.7, cloud[1] + 10, cloud[2] * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBalloon(b) {
  ctx.save();
  ctx.translate(b.x, b.y);

  ctx.strokeStyle = "rgba(15,23,42,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, b.r - 2);
  ctx.quadraticCurveTo(12, b.r + 18, 0, b.r + 34);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, b.r * 0.82, b.r, 0, 0, Math.PI * 2);
  ctx.fillStyle = b.color;
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(-b.r * 0.28, -b.r * 0.28, b.r * 0.22, b.r * 0.32, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, b.r - 4);
  ctx.lineTo(-7, b.r + 8);
  ctx.lineTo(7, b.r + 8);
  ctx.closePath();
  ctx.fillStyle = b.color;
  ctx.fill();

  if (b.face) {
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(-10, -4, 4, 0, Math.PI * 2);
    ctx.arc(10, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 8, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPops() {
  for (const p of pops) {
    ctx.globalAlpha = Math.max(p.life, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTexts() {
  ctx.textAlign = "center";
  ctx.font = "700 28px sans-serif";
  for (const t of floatTexts) {
    ctx.globalAlpha = Math.max(t.life, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function hitTest(x, y) {
  for (let i = balloons.length - 1; i >= 0; i -= 1) {
    const b = balloons[i];
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy <= b.r * b.r * 1.15) {
      return i;
    }
  }
  return -1;
}

function popBalloon(index) {
  const b = balloons[index];
  const isTarget = b.color === TARGET_COLOR;
  const gained = isTarget ? 2 : 1;
  score += gained;
  scoreEl.textContent = String(score);
  balloons.splice(index, 1);

  for (let i = 0; i < 10; i += 1) {
    const angle = rand(0, Math.PI * 2);
    pops.push({
      x: b.x,
      y: b.y,
      vx: Math.cos(angle) * rand(40, 180),
      vy: Math.sin(angle) * rand(40, 180),
      r: rand(4, 10),
      color: b.color,
      life: 1,
    });
  }
  floatTexts.push({
    x: b.x,
    y: b.y - 10,
    text: isTarget ? "+2 いいね！" : "+1",
    color: isTarget ? "#be185d" : "#1d4ed8",
    life: 1,
  });
  playPop(isTarget);
  if (navigator.vibrate) navigator.vibrate(isTarget ? 20 : 10);
}

function update(dt) {
  spawnAcc += dt;
  const spawnEvery = Math.max(0.45, 1.05 - score * 0.012);
  while (spawnAcc >= spawnEvery) {
    spawnAcc -= spawnEvery;
    spawnBalloon();
    if (Math.random() < 0.25) spawnBalloon();
  }

  balloons = balloons.filter((b) => {
    b.wobble += dt * 2.2;
    b.x += Math.sin(b.wobble) * 22 * dt;
    b.y -= b.vy * dt;
    b.x = Math.max(b.r, Math.min(width - b.r, b.x));
    return b.y + b.r > -20;
  });

  pops.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 2.2;
  });
  pops = pops.filter((p) => p.life > 0);

  floatTexts.forEach((t) => {
    t.y -= 40 * dt;
    t.life -= dt * 1.4;
  });
  floatTexts = floatTexts.filter((t) => t.life > 0);
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  if (playing) update(dt);
  drawSky();
  balloons.forEach(drawBalloon);
  drawPops();
  drawTexts();
  requestAnimationFrame(frame);
}

function showEnd() {
  overlay.classList.remove("hidden");
  hud.classList.add("hidden");
  overlay.innerHTML = `
    <div class="panel">
      <p class="emoji">${score >= 20 ? "🌟" : "🎈"}</p>
      <h1>よくできた！</h1>
      <p class="lead">てんすうは <strong>${score}</strong> てん<br />あかい ふうせんは 2てん だよ</p>
      <button id="start-btn" type="button">もういちど</button>
    </div>
  `;
  document.getElementById("start-btn").addEventListener("click", startGame);
}

function startGame() {
  ensureAudio();
  playing = true;
  score = 0;
  remaining = ROUND_SECONDS;
  balloons = [];
  pops = [];
  floatTexts = [];
  spawnAcc = 0;
  scoreEl.textContent = "0";
  timeEl.textContent = String(ROUND_SECONDS);
  overlay.classList.add("hidden");
  hud.classList.remove("hidden");
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    remaining -= 1;
    timeEl.textContent = String(remaining);
    if (remaining <= 0) {
      clearInterval(timerId);
      playing = false;
      showEnd();
    }
  }, 1000);
}

function pointerPos(event) {
  const rect = canvas.getBoundingClientRect();
  const point = event.changedTouches ? event.changedTouches[0] : event;
  return {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
}

function onPointer(event) {
  if (!playing) return;
  event.preventDefault();
  const { x, y } = pointerPos(event);
  const index = hitTest(x, y);
  if (index >= 0) popBalloon(index);
}

resize();
window.addEventListener("resize", resize);
canvas.addEventListener("pointerdown", onPointer);
canvas.addEventListener("touchstart", onPointer, { passive: false });
startBtn.addEventListener("click", startGame);
document.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
  },
  { passive: false }
);

lastTime = performance.now();
requestAnimationFrame(frame);
