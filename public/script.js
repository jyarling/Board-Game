const socket = io();
const joinDiv = document.getElementById('join');
const gameDiv = document.getElementById('game');
const nameInput = document.getElementById('name');
const joinBtn = document.getElementById('joinBtn');
const rollBtn = document.getElementById('rollBtn');
const logDiv = document.getElementById('log');
const boardDiv = document.getElementById('board');

const NUM_SPACES = 20;
const COLORS = ['red', 'blue', 'green', 'purple'];
for (let i = 0; i < NUM_SPACES; i++) {
    const cell = document.createElement('div');
    cell.className = 'space';
    cell.textContent = i;
    boardDiv.appendChild(cell);
}
let playerId = null;

joinBtn.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) return;
    socket.emit('joinGame', name);
};

rollBtn.onclick = () => {
    socket.emit('rollDice');
};

socket.on('joined', (id) => {
    playerId = id;
    joinDiv.style.display = 'none';
    gameDiv.style.display = 'block';
});

socket.on('message', msg => {
    const p = document.createElement('p');
    p.textContent = msg;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
});

socket.on('yourTurn', () => {
    rollBtn.disabled = false;
});

socket.on('notYourTurn', () => {
    rollBtn.disabled = true;
});

socket.on('gameFull', () => {
    alert('Game is full. Maximum 4 players can join.');
});

function updateBoard(state) {
    document.querySelectorAll('.token').forEach(t => t.remove());
    state.players.forEach((p, idx) => {
        const token = document.createElement('div');
        token.className = 'token';
        token.style.backgroundColor = COLORS[idx % COLORS.length];
        const cell = boardDiv.children[p.position];
        if (cell) cell.appendChild(token);
    });
}

socket.on('gameState', state => {
    updateBoard(state);
});
