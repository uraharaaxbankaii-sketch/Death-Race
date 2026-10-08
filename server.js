const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

const players = new Map();

console.log(`Death Race server running on port ${PORT}`);

wss.on("connection", (ws) => {
    if (players.size >= 2) {
        ws.send(JSON.stringify({
            type: "full",
            message: "Game is full."
        }));
        ws.close();
        return;
    }

    const id = players.size === 0 ? 1 : 2;

    players.set(id, {
        ws,
        x: id === 1 ? 250 : 750,
        y: 300,
        angle: id === 1 ? 0 : Math.PI,
        health: 100,
        nitro: 100
    });

    ws.send(JSON.stringify({
        type: "welcome",
        id
    }));

    broadcastState();

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            const player = players.get(id);

            if (!player) return;

            if (data.type === "state") {
                player.x = data.x;
                player.y = data.y;
                player.angle = data.angle;
                player.health = data.health;
                player.nitro = data.nitro;
            }

            if (data.type === "hit") {
                const target = id === 1 ? players.get(2) : players.get(1);

                if (target) {
                    target.health = Math.max(
                        0,
                        target.health - Number(data.damage || 10)
                    );
                }
            }

            broadcastState();

        } catch (error) {
            console.log("Invalid message");
        }
    });

    ws.on("close", () => {
        players.delete(id);

        for (const player of players.values()) {
            player.ws.send(JSON.stringify({
                type: "opponentLeft"
            }));
        }
    });
});

function broadcastState() {
    const state = {};

    for (const [id, player] of players) {
        state[id] = {
            x: player.x,
            y: player.y,
            angle: player.angle,
            health: player.health,
            nitro: player.nitro
        };
    }

    const message = JSON.stringify({
        type: "state",
        players: state
    });

    for (const player of players.values()) {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(message);
        }
    }
}
