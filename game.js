/* =========================================
   SNAKE GAME — Premium Game Engine
   ========================================= */

(() => {
    'use strict';

    // ── CONFIG ──
    const GRID_SIZE = 20;
    const CELL_SIZE = 28;
    const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
    const INITIAL_SPEED = 140; // ms per tick
    const MIN_SPEED = 60;
    const SPEED_STEP = 3; // ms faster per fruit

    // ── FRUIT TYPES ──
    const FRUITS = [
        { emoji: '🍎', points: 10, color: '#ef476f' },
        { emoji: '🍊', points: 15, color: '#ff8c42' },
        { emoji: '🍇', points: 20, color: '#7c3aed' },
        { emoji: '🍓', points: 15, color: '#e63946' },
        { emoji: '🍑', points: 25, color: '#ff6b6b' },
        { emoji: '🍋', points: 10, color: '#ffd166' },
        { emoji: '🥝', points: 30, color: '#06d6a0' },
    ];

    // ── DOM ELEMENTS ──
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const bgCanvas = document.getElementById('bgCanvas');
    const bgCtx = bgCanvas.getContext('2d');

    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('highScore');
    const snakeLengthEl = document.getElementById('snakeLength');
    const startOverlay = document.getElementById('startOverlay');
    const gameOverOverlay = document.getElementById('gameOverOverlay');
    const finalScoreEl = document.getElementById('finalScore');
    const finalHighScoreEl = document.getElementById('finalHighScore');
    const finalLengthEl = document.getElementById('finalLength');
    const newRecordEl = document.getElementById('newRecord');
    const btnStart = document.getElementById('btnStart');
    const btnRestart = document.getElementById('btnRestart');

    // ── GAME STATE ──
    let snake = [];
    let direction = { x: 1, y: 0 };
    let nextDirection = { x: 1, y: 0 };
    let fruit = null;
    let score = 0;
    let highScore = parseInt(localStorage.getItem('snakeHighScore')) || 0;
    let speed = INITIAL_SPEED;
    let gameLoop = null;
    let isRunning = false;
    let particles = [];
    let trailParticles = [];
    let screenShake = { x: 0, y: 0, intensity: 0 };

    // ── INIT CANVAS ──
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    highScoreEl.textContent = highScore;

    // ══════════════════════════════════════════
    //  BACKGROUND PARTICLES
    // ══════════════════════════════════════════
    const bgParticles = [];

    function initBgParticles() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
        bgParticles.length = 0;
        for (let i = 0; i < 60; i++) {
            bgParticles.push({
                x: Math.random() * bgCanvas.width,
                y: Math.random() * bgCanvas.height,
                size: Math.random() * 2 + 0.5,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: (Math.random() - 0.5) * 0.3,
                opacity: Math.random() * 0.4 + 0.1,
            });
        }
    }

    function animateBg() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

        // Subtle radial gradient background
        const grad = bgCtx.createRadialGradient(
            bgCanvas.width / 2, bgCanvas.height / 2, 0,
            bgCanvas.width / 2, bgCanvas.height / 2, bgCanvas.width * 0.7
        );
        grad.addColorStop(0, 'rgba(17, 24, 39, 0.3)');
        grad.addColorStop(1, 'rgba(10, 14, 26, 0)');
        bgCtx.fillStyle = grad;
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

        bgParticles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;

            if (p.x < 0) p.x = bgCanvas.width;
            if (p.x > bgCanvas.width) p.x = 0;
            if (p.y < 0) p.y = bgCanvas.height;
            if (p.y > bgCanvas.height) p.y = 0;

            bgCtx.beginPath();
            bgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            bgCtx.fillStyle = `rgba(6, 214, 160, ${p.opacity})`;
            bgCtx.fill();
        });

        requestAnimationFrame(animateBg);
    }

    initBgParticles();
    animateBg();
    window.addEventListener('resize', initBgParticles);

    // ══════════════════════════════════════════
    //  GAME LOGIC
    // ══════════════════════════════════════════

    function startGame() {
        // Reset state
        snake = [];
        const startX = Math.floor(GRID_SIZE / 2);
        const startY = Math.floor(GRID_SIZE / 2);
        for (let i = 2; i >= 0; i--) {
            snake.push({ x: startX - i, y: startY });
        }

        direction = { x: 1, y: 0 };
        nextDirection = { x: 1, y: 0 };
        score = 0;
        speed = INITIAL_SPEED;
        particles = [];
        trailParticles = [];
        screenShake = { x: 0, y: 0, intensity: 0 };

        updateUI();
        spawnFruit();

        startOverlay.classList.add('hidden');
        gameOverOverlay.classList.add('hidden');

        isRunning = true;
        if (gameLoop) clearInterval(gameLoop);
        gameLoop = setInterval(tick, speed);
        requestAnimationFrame(render);
    }

    function tick() {
        direction = { ...nextDirection };

        const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

        // ── DEATH CONDITIONS ──
        // Wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
            gameOver();
            return;
        }
        // Self collision
        if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
            gameOver();
            return;
        }

        snake.unshift(head);

        // ── Trail particles ──
        const tail = snake[snake.length - 1];
        trailParticles.push({
            x: tail.x * CELL_SIZE + CELL_SIZE / 2,
            y: tail.y * CELL_SIZE + CELL_SIZE / 2,
            size: 4,
            opacity: 0.5,
            life: 15,
        });

        // ── Fruit collision ──
        if (head.x === fruit.x && head.y === fruit.y) {
            score += fruit.type.points;
            speed = Math.max(MIN_SPEED, speed - SPEED_STEP);

            // Explosion particles
            spawnExplosion(fruit.x * CELL_SIZE + CELL_SIZE / 2, fruit.y * CELL_SIZE + CELL_SIZE / 2, fruit.type.color);

            // Screen shake
            screenShake.intensity = 4;

            // Restart loop with new speed
            clearInterval(gameLoop);
            gameLoop = setInterval(tick, speed);

            spawnFruit();
            updateUI();

            // Pulse animation on score
            document.getElementById('scoreDisplay').classList.remove('pulse');
            void document.getElementById('scoreDisplay').offsetWidth;
            document.getElementById('scoreDisplay').classList.add('pulse');
        } else {
            snake.pop();
        }
    }

    function spawnFruit() {
        const type = FRUITS[Math.floor(Math.random() * FRUITS.length)];
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE),
            };
        } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));

        fruit = { x: pos.x, y: pos.y, type, spawnTime: Date.now() };
    }

    function spawnExplosion(cx, cy, color) {
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.3;
            const speed = 2 + Math.random() * 4;
            particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 3,
                color: color,
                opacity: 1,
                life: 25 + Math.random() * 15,
            });
        }
    }

    function gameOver() {
        isRunning = false;
        clearInterval(gameLoop);

        // Screen shake on death
        screenShake.intensity = 10;

        // Death explosion
        const head = snake[0];
        spawnExplosion(head.x * CELL_SIZE + CELL_SIZE / 2, head.y * CELL_SIZE + CELL_SIZE / 2, '#ef476f');

        // Update high score
        let isNewRecord = false;
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('snakeHighScore', highScore);
            isNewRecord = true;
        }

        // Show game over after a brief delay for the death animation
        setTimeout(() => {
            finalScoreEl.textContent = score;
            finalHighScoreEl.textContent = highScore;
            finalLengthEl.textContent = snake.length;
            highScoreEl.textContent = highScore;

            if (isNewRecord && score > 0) {
                newRecordEl.classList.remove('hidden');
            } else {
                newRecordEl.classList.add('hidden');
            }

            gameOverOverlay.classList.remove('hidden');
        }, 600);
    }

    function updateUI() {
        scoreEl.textContent = score;
        highScoreEl.textContent = highScore;
        snakeLengthEl.textContent = snake.length;
    }

    // ══════════════════════════════════════════
    //  RENDERING
    // ══════════════════════════════════════════

    function render() {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Apply screen shake
        ctx.save();
        if (screenShake.intensity > 0) {
            screenShake.x = (Math.random() - 0.5) * screenShake.intensity;
            screenShake.y = (Math.random() - 0.5) * screenShake.intensity;
            ctx.translate(screenShake.x, screenShake.y);
            screenShake.intensity *= 0.85;
            if (screenShake.intensity < 0.3) screenShake.intensity = 0;
        }

        drawGrid();
        drawDangerZone();
        drawTrailParticles();
        drawSnake();
        drawFruit();
        drawParticles();

        ctx.restore();

        requestAnimationFrame(render);
    }

    function drawGrid() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= GRID_SIZE; i++) {
            ctx.beginPath();
            ctx.moveTo(i * CELL_SIZE, 0);
            ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, i * CELL_SIZE);
            ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
            ctx.stroke();
        }
    }

    function drawDangerZone() {
        // Red glow on borders to indicate danger
        const gradient1 = ctx.createLinearGradient(0, 0, 20, 0);
        gradient1.addColorStop(0, 'rgba(239, 71, 111, 0.08)');
        gradient1.addColorStop(1, 'rgba(239, 71, 111, 0)');
        ctx.fillStyle = gradient1;
        ctx.fillRect(0, 0, 20, CANVAS_SIZE);

        const gradient2 = ctx.createLinearGradient(CANVAS_SIZE, 0, CANVAS_SIZE - 20, 0);
        gradient2.addColorStop(0, 'rgba(239, 71, 111, 0.08)');
        gradient2.addColorStop(1, 'rgba(239, 71, 111, 0)');
        ctx.fillStyle = gradient2;
        ctx.fillRect(CANVAS_SIZE - 20, 0, 20, CANVAS_SIZE);

        const gradient3 = ctx.createLinearGradient(0, 0, 0, 20);
        gradient3.addColorStop(0, 'rgba(239, 71, 111, 0.08)');
        gradient3.addColorStop(1, 'rgba(239, 71, 111, 0)');
        ctx.fillStyle = gradient3;
        ctx.fillRect(0, 0, CANVAS_SIZE, 20);

        const gradient4 = ctx.createLinearGradient(0, CANVAS_SIZE, 0, CANVAS_SIZE - 20);
        gradient4.addColorStop(0, 'rgba(239, 71, 111, 0.08)');
        gradient4.addColorStop(1, 'rgba(239, 71, 111, 0)');
        ctx.fillStyle = gradient4;
        ctx.fillRect(0, CANVAS_SIZE - 20, CANVAS_SIZE, 20);
    }

    function drawSnake() {
        snake.forEach((seg, i) => {
            const x = seg.x * CELL_SIZE;
            const y = seg.y * CELL_SIZE;
            const isHead = i === 0;
            const progress = i / snake.length;

            // Gradient from head to tail
            const headColor = { r: 6, g: 214, b: 160 };   // accent-primary
            const tailColor = { r: 17, g: 138, b: 178 };  // accent-secondary
            const r = Math.round(headColor.r + (tailColor.r - headColor.r) * progress);
            const g = Math.round(headColor.g + (tailColor.g - headColor.g) * progress);
            const b = Math.round(headColor.b + (tailColor.b - headColor.b) * progress);

            const padding = isHead ? 1 : 2;
            const radius = isHead ? 8 : 6;

            // Glow effect
            if (isHead) {
                ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
                ctx.shadowBlur = 15;
            } else {
                ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.2)`;
                ctx.shadowBlur = 6;
            }

            // Draw segment
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            roundRect(ctx, x + padding, y + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2, radius);
            ctx.fill();

            // Inner highlight
            ctx.shadowBlur = 0;
            ctx.fillStyle = `rgba(255, 255, 255, ${isHead ? 0.25 : 0.1})`;
            roundRect(ctx, x + padding + 2, y + padding + 2, CELL_SIZE - padding * 2 - 4, (CELL_SIZE - padding * 2) / 2 - 2, radius - 2);
            ctx.fill();

            // Draw eyes on head
            if (isHead) {
                drawEyes(x, y);
            }
        });

        ctx.shadowBlur = 0;
    }

    function drawEyes(x, y) {
        const eyeSize = 5;
        const pupilSize = 2.5;

        // Eye positions based on direction
        let leftEye, rightEye;
        if (direction.x === 1) {
            leftEye = { x: x + CELL_SIZE - 9, y: y + 7 };
            rightEye = { x: x + CELL_SIZE - 9, y: y + CELL_SIZE - 7 };
        } else if (direction.x === -1) {
            leftEye = { x: x + 9, y: y + 7 };
            rightEye = { x: x + 9, y: y + CELL_SIZE - 7 };
        } else if (direction.y === -1) {
            leftEye = { x: x + 7, y: y + 9 };
            rightEye = { x: x + CELL_SIZE - 7, y: y + 9 };
        } else {
            leftEye = { x: x + 7, y: y + CELL_SIZE - 9 };
            rightEye = { x: x + CELL_SIZE - 7, y: y + CELL_SIZE - 9 };
        }

        [leftEye, rightEye].forEach(eye => {
            // White of eye
            ctx.fillStyle = '#f0f4f8';
            ctx.beginPath();
            ctx.arc(eye.x, eye.y, eyeSize, 0, Math.PI * 2);
            ctx.fill();

            // Pupil (shifted toward direction)
            ctx.fillStyle = '#0a0e1a';
            ctx.beginPath();
            ctx.arc(
                eye.x + direction.x * 1.5,
                eye.y + direction.y * 1.5,
                pupilSize, 0, Math.PI * 2
            );
            ctx.fill();
        });
    }

    function drawFruit() {
        if (!fruit) return;

        const x = fruit.x * CELL_SIZE;
        const y = fruit.y * CELL_SIZE;
        const t = Date.now() - fruit.spawnTime;

        // Pulsing glow
        const pulseScale = 1 + Math.sin(t / 300) * 0.08;
        const glowRadius = 20 + Math.sin(t / 500) * 5;

        // Glow circle
        const glow = ctx.createRadialGradient(
            x + CELL_SIZE / 2, y + CELL_SIZE / 2, 0,
            x + CELL_SIZE / 2, y + CELL_SIZE / 2, glowRadius
        );
        glow.addColorStop(0, fruit.type.color + '40');
        glow.addColorStop(1, fruit.type.color + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Fruit emoji
        ctx.save();
        ctx.translate(x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        ctx.scale(pulseScale, pulseScale);
        ctx.font = `${CELL_SIZE - 6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fruit.type.emoji, 0, 1);
        ctx.restore();
    }

    function drawParticles() {
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.life--;
            p.opacity = p.life / 30;
            p.size *= 0.97;

            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function drawTrailParticles() {
        trailParticles = trailParticles.filter(p => p.life > 0);
        trailParticles.forEach(p => {
            p.life--;
            p.opacity = (p.life / 15) * 0.3;
            p.size *= 0.92;

            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = 'rgba(6, 214, 160, 0.6)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // ── HELPERS ──
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ══════════════════════════════════════════
    //  INPUT HANDLING
    // ══════════════════════════════════════════

    document.addEventListener('keydown', (e) => {
        // Start / Restart
        if (e.code === 'Space') {
            e.preventDefault();
            if (!isRunning) {
                startGame();
                return;
            }
        }

        if (!isRunning) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
                break;
        }
    });

    // Buttons
    btnStart.addEventListener('click', startGame);
    btnRestart.addEventListener('click', startGame);

    // ── Draw initial idle screen ──
    requestAnimationFrame(render);

})();
