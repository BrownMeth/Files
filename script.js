// Simple Pong game
// Controls:
// - Move left paddle with mouse (over the canvas) or ArrowUp / ArrowDown keys
// - Click Start to begin, Pause to pause

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  // Game objects
  const paddleWidth = 14;
  const paddleHeight = 100;
  const paddleInset = 20;

  const player = {
    x: paddleInset,
    y: (HEIGHT - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight,
    speed: 6,
    dy: 0, // for keyboard movement
    score: 0
  };

  const ai = {
    x: WIDTH - paddleInset - paddleWidth,
    y: (HEIGHT - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight,
    speed: 4,
    score: 0
  };

  const ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    r: 12,    // increased ball size (was 8)
    speed: 5,
    vx: 5,
    vy: 0
  };

  let running = false;
  let paused = false;
  let lastTime = 0;
  let resetTimeout = null;

  // Keyboard state
  const keys = {
    ArrowUp: false,
    ArrowDown: false
  };

  // Initialize
  function resetBall(servingTo = (Math.random() < 0.5 ? 'player' : 'ai')) {
    ball.x = WIDTH / 2;
    ball.y = HEIGHT / 2;
    ball.speed = 5;
    const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8); // -22.5deg .. +22.5deg
    const dir = (servingTo === 'player') ? -1 : 1;
    ball.vx = dir * ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  resetBall('player');

  // Event listeners
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    // center paddle on mouse
    player.y = clamp(mouseY - player.height / 2, 0, HEIGHT - player.height);
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = true;
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = false;
      e.preventDefault();
    }
  });

  startBtn.addEventListener('click', () => {
    if (!running) {
      running = true;
      paused = false;
      lastTime = performance.now();
      requestAnimationFrame(loop);
    } else {
      paused = false;
    }
    startBtn.disabled = true;
    pauseBtn.disabled = false;
  });

  pauseBtn.addEventListener('click', () => {
    paused = true;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  });

  pauseBtn.disabled = true;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function rectCircleColliding(circle, rect) {
    // find closest point on rect to circle center
    const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < (circle.r * circle.r);
  }

  function update(dt) {
    if (!running || paused) return;

    // Keyboard paddle movement
    if (keys.ArrowUp) {
      player.y -= player.speed;
    } else if (keys.ArrowDown) {
      player.y += player.speed;
    }
    // clamp
    player.y = clamp(player.y, 0, HEIGHT - player.height);

    // Simple AI: follow the ball with max speed
    const aiCenter = ai.y + ai.height / 2;
    const followSpeed = ai.speed;
    if (ball.y < aiCenter - 6) {
      ai.y -= followSpeed;
    } else if (ball.y > aiCenter + 6) {
      ai.y += followSpeed;
    }
    ai.y = clamp(ai.y, 0, HEIGHT - ai.height);

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Top/bottom collision
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.vy *= -1;
    } else if (ball.y + ball.r >= HEIGHT) {
      ball.y = HEIGHT - ball.r;
      ball.vy *= -1;
    }

    // Paddle collisions
    const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
    const aiRect = { x: ai.x, y: ai.y, width: ai.width, height: ai.height };

    if (ball.vx < 0 && rectCircleColliding(ball, playerRect)) {
      // hit left paddle
      ball.x = player.x + player.width + ball.r; // prevent sticking
      reflectBallFromPaddle(player);
    } else if (ball.vx > 0 && rectCircleColliding(ball, aiRect)) {
      // hit right paddle
      ball.x = ai.x - ball.r;
      reflectBallFromPaddle(ai);
    }

    // Score check
    if (ball.x + ball.r < 0) {
      // AI scores
      ai.score += 1;
      pauseAndReset('ai');
    } else if (ball.x - ball.r > WIDTH) {
      // Player scores
      player.score += 1;
      pauseAndReset('player');
    }
  }

  function reflectBallFromPaddle(paddle) {
    // Determine hit position relative to paddle center to change angle
    const paddleCenter = paddle.y + paddle.height / 2;
    const relativeIntersectY = (ball.y - paddleCenter) / (paddle.height / 2); // -1 .. 1
    const maxBounceAngle = (5 * Math.PI) / 12; // ~75 degrees
    const bounceAngle = relativeIntersectY * maxBounceAngle;

    const direction = (paddle === player) ? 1 : -1; // ball should go right if hit player, left if hit ai
    const newSpeed = Math.min(12, ball.speed + 0.5); // increase speed a bit
    ball.speed = newSpeed;

    ball.vx = direction * ball.speed * Math.cos(bounceAngle);
    ball.vy = ball.speed * Math.sin(bounceAngle);
  }

  function pauseAndReset(servingTo) {
    paused = true;
    startBtn.disabled = false;
    pauseBtn.disabled = true;

    // small visual pause then reset ball towards the player who conceded
    if (resetTimeout) clearTimeout(resetTimeout);
    resetTimeout = setTimeout(() => {
      resetBall(servingTo === 'player' ? 'ai' : 'player');
      paused = false;
      startBtn.disabled = true;
      pauseBtn.disabled = false;
    }, 900);
  }

  function drawNet() {
    ctx.fillStyle = 'rgba(159,215,255,0.12)';
    const step = 16;
    for (let y = 0; y < HEIGHT; y += step) {
      ctx.fillRect(WIDTH / 2 - 1, y + 4, 2, step / 2);
    }
  }

  function draw() {
    // clear
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // background subtle
    ctx.fillStyle = 'rgba(0,0,0,0.0)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // net
    drawNet();

    // paddles
    ctx.fillStyle = '#9fd7ff';
    roundRect(ctx, player.x, player.y, player.width, player.height, 6, true, false);
    roundRect(ctx, ai.x, ai.y, ai.width, ai.height, 6, true, false);

    // ball
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // scores
    ctx.fillStyle = '#bfefff';
    ctx.font = '48px system-ui, Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.score, WIDTH * 0.25, 58);
    ctx.fillText(ai.score, WIDTH * 0.75, 58);
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') { stroke = true; }
    if (typeof radius === 'undefined') { radius = 5; }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function loop(timestamp) {
    if (!running) return;
    const dt = (timestamp - lastTime) / 16.6667; // ~60fps units
    lastTime = timestamp;

    // If paused, just draw current state
    if (!paused) {
      // update multiple times if dt > 1 to keep things stable
      const steps = Math.max(1, Math.floor(dt));
      for (let i = 0; i < steps; i++) {
        update(1);
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  // Start with a static draw
  draw();

  // Expose for debugging if desired
  window.pong = {
    player, ai, ball, resetBall
  };
})();