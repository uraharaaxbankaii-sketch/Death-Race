const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const gameUI = document.getElementById("gameUI");
const startBtn = document.getElementById("startBtn");
const statusText = document.getElementById("status");

const myHealthBar = document.getElementById("myHealth");
const enemyHealthBar = document.getElementById("enemyHealth");
const timerElement = document.getElementById("timer");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let socket;
let myID = null;

const keys = {};

const players = {
    1: {
        x: 250,
        y: 300,
        angle: 0,
        health: 100,
        nitro: 100
    },

    2: {
        x: 750,
        y: 300,
        angle: Math.PI,
        health: 100,
        nitro: 100
    }
};

let bullets = [];
let rockets = [];
let bombs = [];

let gameStarted = false;
let startTime = 0;

document.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;

    if (e.code === "Space") {
        keys.space = true;
    }
});

document.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;

    if (e.code === "Space") {
        keys.space = false;
    }
});

startBtn.onclick = () => {

    menu.style.display = "none";
    gameUI.style.display = "block";

    connectServer();
};

function connectServer() {

    /*
        Change this to your multiplayer server URL
        when you deploy it.
    */

    const serverURL =
        "ws://localhost:3000";

    socket = new WebSocket(serverURL);

    socket.onopen = () => {

        statusText.textContent = "CONNECTED";

        gameStarted = true;
        startTime = Date.now();

        requestAnimationFrame(gameLoop);
    };

    socket.onmessage = event => {

        const data = JSON.parse(event.data);

        if (data.type === "welcome") {

            myID = data.id;

            console.log("You are Player", myID);
        }

        if (data.type === "state") {

            for (const id in data.players) {

                players[id] = {
                    ...players[id],
                    ...data.players[id]
                };
            }

            updateUI();
        }

        if (data.type === "full") {

            alert("Game is already full.");
        }

        if (data.type === "opponentLeft") {

            alert("Opponent left the race.");
        }
    };

    socket.onclose = () => {

        console.log("Disconnected");
    };
}

function updatePlayer() {

    if (!myID) return;

    const player = players[myID];

    const acceleration = 0.35;
    const rotation = 0.055;

    if (keys.w) {

        player.x += Math.cos(player.angle) * acceleration * 8;
        player.y += Math.sin(player.angle) * acceleration * 8;
    }

    if (keys.s) {

        player.x -= Math.cos(player.angle) * acceleration * 5;
        player.y -= Math.sin(player.angle) * acceleration * 5;
    }

    if (keys.a) {
        player.angle -= rotation;
    }

    if (keys.d) {
        player.angle += rotation;
    }

    if (keys.shift && player.nitro > 0) {

        player.x += Math.cos(player.angle) * 5;
        player.y += Math.sin(player.angle) * 5;

        player.nitro -= 1;
    }

    if (!keys.shift && player.nitro < 100) {
        player.nitro += 0.1;
    }

    player.x = Math.max(40, Math.min(canvas.width - 40, player.x));
    player.y = Math.max(100, Math.min(canvas.height - 40, player.y));

    if (keys.space) {
        shoot();
    }

    if (keys.r) {
        fireRocket();
    }

    if (keys.b) {
        dropBomb();
    }
}

let lastShot = 0;

function shoot() {

    const now = Date.now();

    if (now - lastShot < 250) return;

    lastShot = now;

    const p = players[myID];

    bullets.push({
        x: p.x,
        y: p.y,
        angle: p.angle,
        speed: 10,
        owner: myID
    });
}

let lastRocket = 0;

function fireRocket() {

    const now = Date.now();

    if (now - lastRocket < 1000) return;

    lastRocket = now;

    const p = players[myID];

    rockets.push({
        x: p.x,
        y: p.y,
        angle: p.angle,
        speed: 6,
        owner: myID
    });
}

let lastBomb = 0;

function dropBomb() {

    const now = Date.now();

    if (now - lastBomb < 1500) return;

    lastBomb = now;

    const p = players[myID];

    bombs.push({
        x: p.x,
        y: p.y,
        owner: myID,
        life: 180
    });
}

function updateWeapons() {

    bullets.forEach(b => {

        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        checkHit(b, 10);
    });

    rockets.forEach(r => {

        r.x += Math.cos(r.angle) * r.speed;
        r.y += Math.sin(r.angle) * r.speed;

        checkHit(r, 30);
    });

    bombs.forEach(b => {

        b.life--;

        if (b.life <= 0) {

            const enemyID = b.owner === 1 ? 2 : 1;
            const enemy = players[enemyID];

            const distance = Math.hypot(
                enemy.x - b.x,
                enemy.y - b.y
            );

            if (distance < 100) {

                damageEnemy(40);
            }

            b.life = -999;
        }
    });

    bullets = bullets.filter(
        b => b.x > 0 &&
             b.x < canvas.width &&
             b.y > 0 &&
             b.y < canvas.height
    );

    rockets = rockets.filter(
        r => r.x > 0 &&
             r.x < canvas.width &&
             r.y > 0 &&
             r.y < canvas.height
    );

    bombs = bombs.filter(b => b.life > -100);
}

function checkHit(projectile, damage) {

    const enemyID = projectile.owner === 1 ? 2 : 1;
    const enemy = players[enemyID];

    if (!enemy) return;

    const distance = Math.hypot(
        enemy.x - projectile.x,
        enemy.y - projectile.y
    );

    if (distance < 25) {

        damageEnemy(damage);

        projectile.x = -9999;
        projectile.y = -9999;
    }
}

function damageEnemy(damage) {

    if (!socket || socket.readyState !== WebSocket.OPEN)
        return;

    socket.send(JSON.stringify({
        type: "hit",
        damage
    }));
}

function sendState() {

    if (!socket || socket.readyState !== WebSocket.OPEN)
        return;

    if (!myID) return;

    const p = players[myID];

    socket.send(JSON.stringify({
        type: "state",
        x: p.x,
        y: p.y,
        angle: p.angle,
        health: p.health,
        nitro: p.nitro
    }));
}

function drawTrack() {

    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 100;

    ctx.beginPath();

    ctx.rect(
        50,
        120,
        canvas.width - 100,
        canvas.height - 180
    );

    ctx.stroke();

    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 4;
    ctx.setLineDash([30, 30]);

    ctx.strokeRect(
        50,
        120,
        canvas.width - 100,
        canvas.height - 180
    );

    ctx.setLineDash([]);

    // Start line

    ctx.strokeStyle = "white";
    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.moveTo(canvas.width / 2, 120);
    ctx.lineTo(canvas.width / 2, 220);

    ctx.stroke();
}

function drawCar(player, color) {

    ctx.save();

    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Shadow

    ctx.fillStyle = "rgba(0,0,0,0.4)";

    ctx.fillRect(
        -23,
        -13,
        50,
        28
    );

    // Body

    ctx.fillStyle = color;

    ctx.beginPath();

    ctx.roundRect(
        -25,
        -14,
        50,
        28,
        7
    );

    ctx.fill();

    // Windows

    ctx.fillStyle = "#111";

    ctx.fillRect(
        -5,
        -10,
        17,
        20
    );

    // Front

    ctx.fillStyle = "#eee";

    ctx.fillRect(
        18,
        -8,
        5,
        5
    );

    ctx.fillRect(
        18,
        3,
        5,
        5
    );

    ctx.restore();
}

function drawWeapons() {

    bullets.forEach(b => {

        ctx.fillStyle = "yellow";

        ctx.beginPath();

        ctx.arc(
            b.x,
            b.y,
            4,
            0,
            Math.PI * 2
        );

        ctx.fill();
    });

    rockets.forEach(r => {

        ctx.save();

        ctx.translate(r.x, r.y);
        ctx.rotate(r.angle);

        ctx.fillStyle = "orange";

        ctx.fillRect(
            -10,
            -4,
            20,
            8
        );

        ctx.restore();
    });

    bombs.forEach(b => {

        ctx.fillStyle = "black";

        ctx.beginPath();

        ctx.arc(
            b.x,
            b.y,
            8,
            0,
            Math.PI * 2
        );

        ctx.fill();
    });
}

function updateUI() {

    if (!myID) return;

    const enemyID = myID === 1 ? 2 : 1;

    myHealthBar.style.width =
        players[myID].health + "%";

    enemyHealthBar.style.width =
        players[enemyID].health + "%";

    if (players[myID].health <= 0) {

        alert("YOU LOST!");
        location.reload();
    }

    if (players[enemyID].health <= 0) {

        alert("YOU WON!");
        location.reload();
    }
}

function draw() {

    drawTrack();

    if (players[1]) {
        drawCar(players[1], "#e00000");
    }

    if (players[2]) {
        drawCar(players[2], "#0066ff");
    }

    drawWeapons();
}

function gameLoop() {

    if (!gameStarted) return;

    updatePlayer();
    updateWeapons();

    draw();

    sendState();

    const seconds =
        Math.floor((Date.now() - startTime) / 1000);

    const minutes =
        String(Math.floor(seconds / 60)).padStart(2, "0");

    const secs =
        String(seconds % 60).padStart(2, "0");

    timerElement.textContent =
        `${minutes}:${secs}`;

    requestAnimationFrame(gameLoop);
}

window.addEventListener("resize", () => {

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
