// --- Game Setup (Unchanged) ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton'); 
const overlay = document.getElementById('overlay');
const modalContent = document.getElementById('modal-content');
const snakeHeadLogo = document.getElementById('snakeHeadLogo'); 
const foodLogo = document.getElementById('foodLogo'); 
const systemLog = document.getElementById('system-log'); 

// --- Game Settings ---
const GRID_SIZE = 20; 
const GAME_SPEED_MS = 100; 
const SPECIAL_ITEM_SPAWN_FREQ = 5; 
const POWERUP_SPAWN_CHANCE = 0.2; 
const LOGO_FOOD_SPAWN_CHANCE = 0.1;
const POWERUP_DURATION = 3000; 
const WARP_WALLS = true; 
const LOGO_HEAD_SCALE = 1.5; // NEW: Kepala ular 1.5x lebih besar dari grid
const LOGO_FOOD_PADDING = 2; 

// --- Item Types (Unchanged) ---
const ITEM_TYPE = {
    NORMAL: 'normal',
    SPECIAL: 'special', 
    SPEED_BOOST: 'speed_boost', 
    INVERSE_CONTROLS: 'inverse_controls',
    LOGO_FOOD: 'logo_food' 
};

// --- Color Palette (Unchanged) ---
const COLOR_NORMAL_FOOD_FALLBACK = '#ff006e'; 
const COLOR_SPECIAL_FOOD = '#ffc300';
const COLOR_SPEED_BOOST = '#00bcd4'; 
const COLOR_INVERSE_CONTROLS = '#ff5722'; 
const COLOR_SNAKE_HEAD_FALLBACK = '#ff006e'; 
const COLOR_SNAKE_BODY_START = '#9d02d7'; 
const COLOR_SNAKE_BODY_END = '#6a0572'; 
const COLOR_CANVAS_BG = '#0d0014'; 

// --- Game State Variables (Unchanged) ---
let snake = []; 
let food = {}; 
let dx = 0; 
let dy = 0;   
let score = 0;
let foodEatenCount = 0;
let animationFrameId; 
let gameStarted = false;
let isPaused = false; 
let targetGameSpeed = GAME_SPEED_MS;
let isInverseControlsActive = false;
let powerupTimer = null; 

let lastHeadPosition = {}; 
let nextHeadPosition = {}; 
let lastTickTime = 0; 
let animationProgress = 0; 

// [Functions: logSystemMessage, createOscillator, playSFX, startBackgroundMusic, stopBackgroundMusic] (Keep the original content here)

function logSystemMessage(message, type = 'normal') {
    const logEntry = document.createElement('p');
    logEntry.classList.add('log-entry');
    logEntry.textContent = `> ${message}`;
    
    while (systemLog.children.length > 10) {
        systemLog.removeChild(systemLog.firstChild);
    }
    
    systemLog.appendChild(logEntry);
    systemLog.scrollTop = systemLog.scrollHeight; 
}

function createOscillator(freq, type, duration, volume) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function playSFX(type) {
    switch (type) {
        case 'eat':
            createOscillator(440, 'square', 0.08, 0.2); 
            createOscillator(660, 'square', 0.08, 0.2); 
            break;
        case 'special':
            createOscillator(880, 'sine', 0.15, 0.3); 
            createOscillator(1000, 'sine', 0.15, 0.3); 
            break;
        case 'powerup_activate':
            createOscillator(1200, 'sawtooth', 0.2, 0.4);
            createOscillator(1500, 'sawtooth', 0.2, 0.4);
            break;
        case 'powerup_end':
            createOscillator(300, 'triangle', 0.1, 0.2);
            createOscillator(200, 'triangle', 0.1, 0.2);
            break;
        case 'gameover':
            createOscillator(110, 'triangle', 0.5, 0.4); 
            createOscillator(55, 'triangle', 0.5, 0.4); 
            break;
        case 'pause':
            createOscillator(220, 'sine', 0.2, 0.3);
            break;
    }
}

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let musicOscillator = null; 

function startBackgroundMusic() { 
    if (musicOscillator) return; 
    if (audioCtx.state === 'suspended') audioCtx.resume();

    musicOscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    musicOscillator.type = 'triangle';
    musicOscillator.frequency.setValueAtTime(120, audioCtx.currentTime); 
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); 

    musicOscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    musicOscillator.start();
}

function stopBackgroundMusic() {
    if (musicOscillator) {
        musicOscillator.stop(audioCtx.currentTime + 0.1); 
        musicOscillator = null;
    }
}


// --- Game State Control (Unchanged) ---

function initializeGame() {
    const startX = 10 * GRID_SIZE;
    const startY = 10 * GRID_SIZE;

    snake = [{ x: startX, y: startY }];
    dx = GRID_SIZE; 
    dy = 0;
    score = 0;
    foodEatenCount = 0;
    targetGameSpeed = GAME_SPEED_MS;
    isInverseControlsActive = false;
    isPaused = false;
    if (powerupTimer) clearTimeout(powerupTimer); 
    
    scoreDisplay.textContent = '0000';
    placeFood();
    
    lastHeadPosition = { x: startX, y: startY };
    nextHeadPosition = { x: startX + dx, y: startY + dy };
    animationProgress = 0; 
    
    startButton.textContent = 'RESTART';
    startButton.disabled = true; 
    pauseButton.disabled = false;
    pauseButton.textContent = 'PAUSE';
    gameStarted = true;
    lastTickTime = performance.now(); 
}

function startGame() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId); 
    initializeGame();
    startBackgroundMusic(); 
    logSystemMessage('SIMULATION ACTIVE. INITIALIZING RE-CORE MOVEMENT.', 'start'); 
    
    animationFrameId = requestAnimationFrame(drawGame);
}

function togglePause() {
    if (!gameStarted) return;

    if (isPaused) {
        isPaused = false;
        pauseButton.textContent = 'PAUSE';
        lastTickTime = performance.now(); 
        animationFrameId = requestAnimationFrame(drawGame); 
        overlay.classList.add('hidden');
        startBackgroundMusic();
        logSystemMessage('SIMULATION RESUMED.', 'resume'); 
    } else {
        isPaused = true;
        pauseButton.textContent = 'RESUME';
        cancelAnimationFrame(animationFrameId); 
        stopBackgroundMusic();
        playSFX('pause');
        logSystemMessage('SIMULATION PAUSED.', 'pause'); 
        
        showModal('SYSTEM PAUSED', '<p>SYSTEM ON HOLD. PRESS RESUME OR **SPACE** TO CONTINUE.</p>', 'RESUME', togglePause);
    }
}

function endGame(message) {
    cancelAnimationFrame(animationFrameId); 
    stopBackgroundMusic(); 
    gameStarted = false;
    isPaused = false;
    
    startButton.textContent = 'RESTART';
    startButton.disabled = false; 
    pauseButton.disabled = true;
    
    playSFX('gameover');
    logSystemMessage(`CRITICAL ERROR: ${message} - FINAL SCORE: ${score}`, 'error'); 
    
    if (isInverseControlsActive) {
        isInverseControlsActive = false;
        if (powerupTimer) clearTimeout(powerupTimer);
    }
    
    showModal('SYSTEM FAILURE', `<p>RE-CORE DESTROYED. FINAL SCORE: ${score}</p>`, 'RESTART SIMULATION', startGame);
}

// --- Game Logic ---

function gameTickLogic() {
    if (!gameStarted || isPaused) return; 

    lastHeadPosition = { ...snake[0] }; 
    let head = { x: snake[0].x + dx, y: snake[0].y + dy };
    
    // Warp Walls Logic (Unchanged)
    if (WARP_WALLS) {
        if (head.x < 0) head.x = canvas.width - GRID_SIZE;
        else if (head.x >= canvas.width) head.x = 0;
        else if (head.y < 0) head.y = canvas.height - GRID_SIZE;
        else if (head.y >= canvas.height) head.y = 0;
    } else {
        if (
            head.x < 0 || head.x >= canvas.width ||
            head.y < 0 || head.y >= canvas.height
        ) {
            endGame('Out of Bounds');
            return;
        }
    }
    
    nextHeadPosition = head; 
    
    if (checkCollision(head, snake)) {
        endGame('Self-Collision');
        return;
    }

    snake.unshift(head); 

    // --- FIX BUG MAKAN ULAR ---
    // Pastikan pengecekan x dan y benar
    if (head.x === food.x && head.y === food.y) {
        handleItemPickup(food.type); 
        scoreDisplay.textContent = String(score).padStart(4, '0'); 
        placeFood(); 
    } else {
        snake.pop(); 
    }
    // -------------------------
    
    animationProgress = 0; 
}

function handleItemPickup(itemType) {
    switch (itemType) {
        case ITEM_TYPE.NORMAL:
            score += 10;
            foodEatenCount++;
            playSFX('eat');
            break;
        case ITEM_TYPE.SPECIAL:
            score += 50;
            playSFX('special');
            applyTemporarySpeedChange(targetGameSpeed + 100, 3 * targetGameSpeed);
            logSystemMessage('DATA SPIKE DETECTED. SLOWDOWN INITIATED.'); 
            break;
        case ITEM_TYPE.SPEED_BOOST:
            playSFX('powerup_activate');
            applyTemporarySpeedChange(targetGameSpeed / 2, POWERUP_DURATION);
            logSystemMessage('SPEED BOOST ACTIVE: CORE CLOCK x2.', 'powerup'); 
            break;
        case ITEM_TYPE.INVERSE_CONTROLS:
            playSFX('powerup_activate');
            isInverseControlsActive = true;
            if (powerupTimer) clearTimeout(powerupTimer);
            powerupTimer = setTimeout(() => {
                isInverseControlsActive = false;
                playSFX('powerup_end');
                logSystemMessage('CONTROL INVERSION ENDED.', 'powerup'); 
            }, POWERUP_DURATION);
            logSystemMessage('WARNING: CONTROL INPUT INVERTED!', 'warning'); 
            break;
        case ITEM_TYPE.LOGO_FOOD: 
            score += 100; 
            foodEatenCount++;
            playSFX('special'); 
            applyTemporarySpeedChange(targetGameSpeed * 0.7, POWERUP_DURATION * 0.5); 
            logSystemMessage('RE-CORE DATA ACQUIRED. BONUS SCORE +100.', 'bonus'); 
            break;
    }
}

function applyTemporarySpeedChange(newSpeed, duration) {
    const originalSpeed = targetGameSpeed;
    targetGameSpeed = newSpeed; 
    
    if (powerupTimer) clearTimeout(powerupTimer);
    powerupTimer = setTimeout(() => {
        targetGameSpeed = originalSpeed;
        playSFX('powerup_end');
        logSystemMessage('SPEED ADJUSTMENT RESET.', 'info'); 
    }, duration);
}

function placeFood() {
    let newFood = {};
    let valid = false;

    const randomChance = Math.random();
    if (randomChance < LOGO_FOOD_SPAWN_CHANCE) {
        newFood.type = ITEM_TYPE.LOGO_FOOD;
    } else if (foodEatenCount > 0 && foodEatenCount % SPECIAL_ITEM_SPAWN_FREQ === 0) {
        newFood.type = ITEM_TYPE.SPECIAL;
    } else if (randomChance < POWERUP_SPAWN_CHANCE + LOGO_FOOD_SPAWN_CHANCE) { 
        const powerups = [ITEM_TYPE.SPEED_BOOST, ITEM_TYPE.INVERSE_CONTROLS];
        newFood.type = powerups[Math.floor(Math.random() * powerups.length)];
    } else {
        newFood.type = ITEM_TYPE.NORMAL;
    }

    while (!valid) {
        newFood.x = Math.floor(Math.random() * (canvas.width / GRID_SIZE)) * GRID_SIZE;
        newFood.y = Math.floor(Math.random() * (canvas.height / GRID_SIZE)) * GRID_SIZE;
        valid = !checkCollision(newFood, snake);
    }
    food = newFood;
    logSystemMessage(`NEW ITEM SPAWNED: ${newFood.type.toUpperCase().replace('_', ' ')}`);
}

function checkCollision(head, body) {
    for (let i = 1; i < body.length; i++) {
        if (head.x === body[i].x && head.y === body[i].y) {
            return true;
        }
    }
    return false;
}

// --- Drawing and Animation (Unchanged) ---

function drawGame(timestamp) {
    if (!gameStarted || isPaused) {
        if (!gameStarted && !isPaused) {
            ctx.fillStyle = COLOR_CANVAS_BG;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawFood(food.x, food.y, food.type);
            drawSnake(1); 
        }
        animationFrameId = requestAnimationFrame(drawGame); 
        return;
    }

    const deltaTime = timestamp - lastTickTime;

    if (deltaTime >= targetGameSpeed) {
        gameTickLogic();
        lastTickTime = timestamp; 
    }

    animationProgress = Math.min(1, (timestamp - lastTickTime) / targetGameSpeed);

    ctx.fillStyle = COLOR_CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawFood(food.x, food.y, food.type);
    drawSnake(animationProgress);

    animationFrameId = requestAnimationFrame(drawGame);
}

function drawFood(x, y, type) {
    if (type === ITEM_TYPE.LOGO_FOOD && foodLogo.complete && foodLogo.naturalWidth !== 0) {
        const drawSize = GRID_SIZE - LOGO_FOOD_PADDING * 2;
        ctx.drawImage(foodLogo, x + LOGO_FOOD_PADDING, y + LOGO_FOOD_PADDING, drawSize, drawSize);
    } else {
        let color = COLOR_NORMAL_FOOD_FALLBACK;
        let radius = (GRID_SIZE - LOGO_FOOD_PADDING * 2) / 2;
        let centerX = x + GRID_SIZE / 2;
        let centerY = y + GRID_SIZE / 2;

        if (type === ITEM_TYPE.SPECIAL) {
            color = COLOR_SPECIAL_FOOD;
        } else if (type === ITEM_TYPE.SPEED_BOOST) {
            color = COLOR_SPEED_BOOST;
        } else if (type === ITEM_TYPE.INVERSE_CONTROLS) {
            color = COLOR_INVERSE_CONTROLS;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (type === ITEM_TYPE.SPEED_BOOST || type === ITEM_TYPE.INVERSE_CONTROLS) {
            let text;
            if (type === ITEM_TYPE.SPEED_BOOST) { text = '⚡'; }
            else { text = '🔄'; }

            ctx.fillStyle = 'white';
            ctx.font = `${GRID_SIZE * 0.9}px sans-serif`; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, centerX, centerY);
        }
    }

    const twinkleAlpha = 0.5 + Math.sin(performance.now() / 100) * 0.2;
    ctx.fillStyle = `rgba(255, 255, 255, ${twinkleAlpha})`;
    ctx.beginPath();
    ctx.arc(x + GRID_SIZE / 2, y + GRID_SIZE / 2, (GRID_SIZE - LOGO_FOOD_PADDING * 2) / 4, 0, Math.PI * 2);
    ctx.fill();
}

function drawSnake(progress) {
    const bodyRadius = GRID_SIZE / 2.2; 
    for (let i = 1; i < snake.length; i++) {
        const gradient = ctx.createLinearGradient(snake[i].x, snake[i].y, snake[i].x + GRID_SIZE, snake[i].y + GRID_SIZE);
        gradient.addColorStop(0, COLOR_SNAKE_BODY_START);
        gradient.addColorStop(1, COLOR_SNAKE_BODY_END);
        ctx.fillStyle = gradient;

        ctx.beginPath();
        ctx.arc(snake[i].x + GRID_SIZE / 2, snake[i].y + GRID_SIZE / 2, bodyRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Draw the head using the RE Logo
    const currentX = lastHeadPosition.x + (nextHeadPosition.x - lastHeadPosition.x) * progress;
    const currentY = lastHeadPosition.y + (nextHeadPosition.y - lastHeadPosition.y) * progress;
    
    // HEAD SCALING AND OFFSET
    const headDrawSize = GRID_SIZE * LOGO_HEAD_SCALE; // Menggunakan LOGO_HEAD_SCALE (1.5)
    const headOffset = (headDrawSize - GRID_SIZE) / -2; 
    
    if (snakeHeadLogo.complete && snakeHeadLogo.naturalWidth !== 0) {
        ctx.drawImage(snakeHeadLogo, currentX + headOffset, currentY + headOffset, headDrawSize, headDrawSize);
    } else {
        ctx.fillStyle = COLOR_SNAKE_HEAD_FALLBACK;
        drawRoundedRect(currentX, currentY, GRID_SIZE, GRID_SIZE, GRID_SIZE / 4);
    }

    if (isInverseControlsActive) {
        ctx.strokeStyle = COLOR_INVERSE_CONTROLS;
        ctx.lineWidth = 3;
        ctx.strokeRect(currentX + headOffset, currentY + headOffset, headDrawSize, headDrawSize);
        ctx.lineWidth = 1; 
    }
}

function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

function showModal(title, message, buttonText, buttonAction) {
    modalContent.innerHTML = `
        <h2>${title}</h2>
        ${message}
        <button id="modalStartButton" class="neon-btn">${buttonText}</button>
    `;
    overlay.classList.remove('hidden');

    document.getElementById('modalStartButton').onclick = () => {
        overlay.classList.add('hidden');
        buttonAction();
    };
}

document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        if (gameStarted) {
            togglePause(); 
        } else if (!gameStarted && overlay.classList.contains('hidden')) {
            startGame();
        }
        e.preventDefault(); 
        return;
    }
    
    if (!gameStarted || isPaused) return;

    const key = e.key.toLowerCase(); 
    let newDx = dx;
    let newDy = dy;
    
    const effectiveKey = isInverseControlsActive ? inverseKey(key) : key;

    switch (effectiveKey) {
        case 'w':    if (dy === 0) { newDx = 0; newDy = -GRID_SIZE; } break; 
        case 's':  if (dy === 0) { newDx = 0; newDy = GRID_SIZE; } break; 
        case 'a':  if (dx === 0) { newDx = -GRID_SIZE; newDy = 0; } break; 
        case 'd': if (dx === 0) { newDx = GRID_SIZE; newDy = 0; } break; 
        // Fallback for Arrow Keys
        case 'arrowup':    if (dy === 0) { newDx = 0; newDy = -GRID_SIZE; } break; 
        case 'arrowdown':  if (dy === 0) { newDx = 0; newDy = GRID_SIZE; } break;
        case 'arrowleft':  if (dx === 0) { newDx = -GRID_SIZE; newDy = 0; } break;
        case 'arrowright': if (dx === 0) { newDx = GRID_SIZE; newDy = 0; } break;
    }

    if (!(newDx === -dx && newDy === -dy)) { 
        dx = newDx;
        dy = newDy;
    }
});

function inverseKey(key) {
    switch (key) {
        case 'w':    return 's';
        case 's':  return 'w';
        case 'a':  return 'd';
        case 'd': return 'a';
        case 'arrowup':    return 'arrowdown';
        case 'arrowdown':  return 'arrowup';
        case 'arrowleft':  return 'arrowright';
        case 'arrowright': return 'arrowleft';
        default: return key;
    }
}


// Event Listeners
startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);


// Initial Load (Unchanged)
window.onload = () => {
    const loadHandler = () => {
        initializeGame();
        drawGame(performance.now());
        
        showModal('WELCOME TO RE:WARP GRID', 
                  `<p>Navigate the grid using **WASD** or Arrow Keys. Consume data to grow the RE-CORE.</p>
                   <p>Warning: Boundary walls are warped (teleportation active).</p>`, 
                  'START SIMULATION', startGame);
    };

    let imagesToLoad = 0;
    const snakeHeadLogo = document.getElementById('snakeHeadLogo');
    const foodLogo = document.getElementById('foodLogo');
    const decoLogo = document.getElementById('decoLogo');

    const checkAllImagesLoaded = () => {
        imagesToLoad--;
        if (imagesToLoad === 0) {
            loadHandler();
        }
    };

    const registerImage = (imgElement) => {
        if (!imgElement) return; 
        imagesToLoad++;
        if (imgElement.complete && imgElement.naturalWidth !== 0) {
            checkAllImagesLoaded();
        } else {
            imgElement.onload = checkAllImagesLoaded;
            imgElement.onerror = () => {
                console.error(`Failed to load image: ${imgElement.id}. Using fallback graphics.`);
                checkAllImagesLoaded();
            };
        }
    };

    registerImage(snakeHeadLogo);
    registerImage(foodLogo);      
    registerImage(decoLogo);      
};