const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const startContent = document.getElementById('startContent');
const startButtons = document.getElementById('startButtons');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const bgMusic = document.getElementById('bgMusic');

const canvasWidth = canvas.width;
const canvasHeight = canvas.height;

/* Player */
const playerImg = new Image();
playerImg.src = 'assets/player.png';
const player = {
  x: canvasWidth / 2 - 25,
  y: canvasHeight - 140,
  width: 50,
  height: 50,
  speed: 7,
  lives: 1
};

/* Obstacles config */
let obstacles = [];
const obstacleTypes = [
  {src:'assets/mud.png', width:100, height:80},
  {src:'assets/puddle.png', width:100, height:60},
  {src:'assets/defender.png', width:150, height:150},
  {src:'assets/defender2.png', width:100, height:100},
  {src:'assets/sled.png', width:200, height:100},
  {src:'assets/sled2.png', width:200, height:100}
];

let baseObstacleSpeed = 1.5;
let obstacleSpeed = baseObstacleSpeed;
let spawnTimer = 0;
let score = 0;

/* Streaker */
const streakerImg = new Image();
streakerImg.src = 'assets/streaker.png';
let streakerX = -50;
let streakerActive = false;
let streakerNextScore = 1000;
let streakerDirection = 1;

/* Pause / game state */
let isPaused = false;
let gameActive = false;

/* Life change visual */
let lifeChangeTimer = 0;
let lifeChangeValue = 0;
let lifeChangeY = 0;

function showLifeChange(val){
  lifeChangeValue = val;
  lifeChangeTimer = 60;
  lifeChangeY = player.y - 10;
}

function drawLifeChange(){
  if(lifeChangeTimer > 0){
    ctx.fillStyle = lifeChangeValue > 0 ? 'lime' : 'red';
    ctx.font = '24px sans-serif';
    const text = lifeChangeValue > 0 ? '+1 Life' : '-1 Life';
    ctx.fillText(text, player.x + player.width/2 - 30, lifeChangeY);
    lifeChangeY -= 1;
    lifeChangeTimer--;
  }
}

/* Input */
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

/* Mobile input binding */
const mobileControls = document.querySelector('.mobile-controls');
if(mobileControls && 'ontouchstart' in window){
  const btnUp = mobileControls.querySelector('.up');
  const btnDown = mobileControls.querySelector('.down');
  const btnLeft = mobileControls.querySelector('.left');
  const btnRight = mobileControls.querySelector('.right');

  function bindTouch(btn, key){
    if(!btn) return;
    btn.addEventListener('touchstart', e => { keys[key] = true; e.preventDefault(); });
    btn.addEventListener('touchend', e => { keys[key] = false; e.preventDefault(); });
    btn.addEventListener('touchcancel', e => { keys[key] = false; e.preventDefault(); });
    btn.addEventListener('mousedown', e => { keys[key] = true; e.preventDefault(); });
    window.addEventListener('mouseup', e => { keys[key] = false; });
  }

  bindTouch(btnUp, 'ArrowUp');
  bindTouch(btnDown, 'ArrowDown');
  bindTouch(btnLeft, 'ArrowLeft');
  bindTouch(btnRight, 'ArrowRight');
}

/* Start button behavior */
startBtn.addEventListener('click', () => {
  startScreen.style.display = 'none';
  initAndStart();
});

/* Pause button behavior */
pauseBtn.addEventListener('click', () => {
  if(!gameActive) return;
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  if(isPaused) bgMusic.pause();
  else bgMusic.play();
});

/* Initialize or restart the game state */
function initAndStart(){
  resetGameState();
  startGame();
}

/* Reset state (full reset) */
function resetGameState(){
  obstacles = [];
  score = 0;
  obstacleSpeed = baseObstacleSpeed;
  spawnTimer = 0;
  streakerX = -50;
  streakerActive = false;
  streakerNextScore = 1000;
  streakerDirection = 1;
  player.x = canvasWidth / 2 - player.width/2;
  player.y = canvasHeight - 140;
  player.lives = 1;
  isPaused = false;
}

/* Start game loop and music */
function startGame(){
  gameActive = true;
  isPaused = false;
  pauseBtn.textContent = 'Pause';
  try {
    bgMusic.src = 'assets/lucid-dreams.mp3';
    bgMusic.volume = 0.5;
    bgMusic.loop = true;
    const p = bgMusic.play();
    if(p) p.catch(()=>{});
  } catch(e){}
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

/* Main loop */
let lastTime = 0;
function gameLoop(timestamp){
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  if(gameActive && !isPaused){
    movePlayer();
    updateGame(deltaTime);
    drawGame();
  }

  requestAnimationFrame(gameLoop);
}

/* Continuous movement from key hold */
function movePlayer(){
  if(keys['ArrowLeft'] && player.x > 0) player.x -= player.speed;
  if(keys['ArrowRight'] && player.x + player.width < canvasWidth) player.x += player.speed;
  if(keys['ArrowUp'] && player.y > 0) player.y -= player.speed;
  if(keys['ArrowDown'] && player.y + player.height < canvasHeight) player.y += player.speed;
}

/* Game state update */
function updateGame(deltaTime){
  spawnTimer += deltaTime;
  score++;

  let dynamicSpawnRate;
  if(score < 500){
    dynamicSpawnRate = 2000;
  } else if(score < 2000){
    dynamicSpawnRate = Math.max(600, 2200 - score / 2);
  } else {
    dynamicSpawnRate = Math.max(800, 2200 - score / 3);
  }

  if(spawnTimer >= dynamicSpawnRate){
    spawnObstacle();
    spawnTimer = 0;
  }

  obstacleSpeed = baseObstacleSpeed + score / 4000;

  for(let i=obstacles.length-1;i>=0;i--){
    obstacles[i].y += obstacleSpeed;
    if(collision(player, obstacles[i])){
      if(player.lives > 1){
        player.lives--;
        showLifeChange(-1);
        obstacles.splice(i,1);
      } else {
        triggerGameOver();
        return;
      }
    }
    if(obstacles[i].y > canvasHeight + 50){
      obstacles.splice(i,1);
    }
  }

  handleStreaker();
}

/* Spawn random obstacles ensuring no overlaps */
function spawnObstacle(){
  const maxAttempts = 12;
  const count = Math.floor(Math.random()*2)+1;
  for(let k=0;k<count;k++){
    const type = obstacleTypes[Math.floor(Math.random()*obstacleTypes.length)];
    const img = new Image();
    img.src = type.src;
    const width = type.width;
    const height = type.height;

    let attempts = 0;
    let x, y, overlap;
    do {
      x = Math.random() * (canvasWidth - width);
      y = -height - Math.random()*80;
      overlap = obstacles.some(o => rectanglesOverlap({x,y,width,height}, o));
      attempts++;
    } while(overlap && attempts < maxAttempts);

    if(!overlap){
      obstacles.push({x, y, width, height, img});
    }
  }
}

/* rectangle overlap test */
function rectanglesOverlap(a,b){
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}

/* Drawing */
function drawGame(){
  ctx.clearRect(0,0,canvasWidth,canvasHeight);
  drawField();
  drawPlayer();
  drawObstacles();
  drawScore();
  drawLives();
  drawLifeChange();
  drawStreaker();
}

/* Field */
let fieldOffset = 0;
function drawField(){
  fieldOffset += 2;
  if(fieldOffset > 50) fieldOffset = 0;
  ctx.fillStyle = 'green';
  ctx.fillRect(0,0,canvasWidth,canvasHeight);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  for(let i=-1;i<canvasHeight/50;i++){
    ctx.beginPath();
    ctx.moveTo(0, i*50 + fieldOffset);
    ctx.lineTo(canvasWidth, i*50 + fieldOffset);
    ctx.stroke();
  }
}

/* Player and obstacles drawing */
function drawPlayer(){
  ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
}
function drawObstacles(){
  obstacles.forEach(o => ctx.drawImage(o.img, o.x, o.y, o.width, o.height));
}

/* collision using 72% hitboxes */
function collision(a,b){
  const bufferA = { w: a.width * 0.72, h: a.height * 0.72 };
  const bufferB = { w: b.width * 0.72, h: b.height * 0.72 };
  const ax = a.x + (a.width - bufferA.w)/2;
  const ay = a.y + (a.height - bufferA.h)/2;
  const bx = b.x + (b.width - bufferB.w)/2;
  const by = b.y + (b.height - bufferB.h)/2;

  return ax < bx + bufferB.w && ax + bufferA.w > bx &&
         ay < by + bufferB.h && ay + bufferA.h > by;
}

/* Score rendering */
function drawScore(){
  ctx.fillStyle = 'white';
  ctx.font = '24px sans-serif';
  ctx.fillText('Score: '+score, 12, 36);
}

/* Lives rendering top-right */
function drawLives(){
  ctx.fillStyle = 'white';
  ctx.font = '24px sans-serif';
  ctx.fillText('Lives: '+player.lives, canvasWidth - 120, 36);
}

/* Handle streaker across screen every 1000 points */
function handleStreaker(){
  if(score >= streakerNextScore && !streakerActive){
    streakerActive = true;
    streakerDirection = Math.random() < 0.5 ? 1 : -1;
    streakerX = streakerDirection === 1 ? -50 : canvasWidth + 50;
    streakerNextScore += 1000;
  }

  if(streakerActive){
    streakerX += 4 * streakerDirection;
    if((streakerDirection === 1 && streakerX > canvasWidth + 50) ||
       (streakerDirection === -1 && streakerX < -50)) streakerActive = false;

    if(collision(player,{x:streakerX,y:canvasHeight/2,width:50,height:50})){
      player.lives++;
      showLifeChange(1);
      streakerActive = false;
    }
  }
}

function drawStreaker(){
  if(streakerActive){
    ctx.drawImage(streakerImg, streakerX, canvasHeight/2, 50, 50);
  }
}

/* Game over handling - no restart button */
function triggerGameOver(){
  gameActive = false;
  startContent.querySelector('h1').textContent = 'Game Over!';
  startButtons.innerHTML = '';
  const scoreP = document.createElement('p');
  scoreP.textContent = `Score: ${score}`;
  startButtons.appendChild(scoreP);
  startScreen.style.display = 'flex';
}

/* Responsive canvas */
(function responsiveCanvas(){
  function fit() {
    const margin = 20;
    const maxW = window.innerWidth - margin;
    const maxH = window.innerHeight - margin;
    let scale = Math.min(maxW / canvasWidth, maxH / canvasHeight, 1);
    canvas.style.width = Math.floor(canvasWidth * scale) + 'px';
    canvas.style.height = Math.floor(canvasHeight * scale) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();
})();
