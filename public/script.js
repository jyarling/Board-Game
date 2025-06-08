const socket = io();
const joinDiv = document.getElementById('join');
const gameDiv = document.getElementById('game');
const nameInput = document.getElementById('name');
const joinBtn = document.getElementById('joinBtn');
const rollBtn = document.getElementById('rollBtn');
const logDiv = document.getElementById('log');
const boardDiv = document.getElementById('board');
let boardSize = 20;
let boardCoords = [];
let players = [];
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
    if (boardCoords.length === 0) buildBoard();
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

socket.on('state', state => {
    boardSize = state.boardSize;
    players = state.players;
    if (boardCoords.length === 0) {
        buildBoard();
    }
    renderTokens();
});

function buildBoard() {
    const N = 6; // 6x6 grid => 20 spaces
    boardCoords = [];
    boardDiv.innerHTML = '';
    for (let c = N - 1; c >= 0; c--) boardCoords.push({ row: N - 1, col: c });
    for (let r = N - 2; r >= 0; r--) boardCoords.push({ row: r, col: 0 });
    for (let c = 1; c <= N - 1; c++) boardCoords.push({ row: 0, col: c });
    for (let r = 1; r <= N - 2; r++) boardCoords.push({ row: r, col: N - 1 });
    boardCoords.forEach((pos, idx) => {
        const div = document.createElement('div');
        div.className = 'space';
        div.dataset.index = idx;
        div.style.gridRowStart = pos.row + 1;
        div.style.gridColumnStart = pos.col + 1;
        boardDiv.appendChild(div);
    });
}

function renderTokens() {
    document.querySelectorAll('.token').forEach(t => t.remove());
    players.forEach((p, idx) => {
        const space = boardDiv.querySelector(`.space[data-index="${p.position}"]`);
        if (space) {
            const token = document.createElement('div');
            token.className = `token p${idx}`;
            token.title = p.name;
            space.appendChild(token);
        }
    });
}
