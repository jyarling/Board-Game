const socket = io();
const joinDiv = document.getElementById('join');
const gameDiv = document.getElementById('game');
const nameInput = document.getElementById('name');
const joinBtn = document.getElementById('joinBtn');
const rollBtn = document.getElementById('rollBtn');
const logDiv = document.getElementById('log');
const boardDiv = document.getElementById('board');
let boardSize = 40;
const spaces = [
    {name: 'Go', color: ''},
    {name: 'Mediterranean Ave', color: '#8B4513'},
    {name: 'Community Chest', icon: '🎁'},
    {name: 'Baltic Ave', color: '#8B4513'},
    {name: 'Income Tax', icon: '💰'},
    {name: 'Reading RR', color: '#000'},
    {name: 'Oriental Ave', color: '#ADD8E6'},
    {name: 'Chance', icon: '❓'},
    {name: 'Vermont Ave', color: '#ADD8E6'},
    {name: 'Connecticut Ave', color: '#ADD8E6'},
    {name: 'Jail', icon: '🚓'},
    {name: 'St. Charles Pl', color: '#FF00FF'},
    {name: 'Electric Co', icon: '💡'},
    {name: 'States Ave', color: '#FF00FF'},
    {name: 'Virginia Ave', color: '#FF00FF'},
    {name: 'Pennsylvania RR', color: '#000'},
    {name: 'St. James Pl', color: '#FFA500'},
    {name: 'Community Chest', icon: '🎁'},
    {name: 'Tennessee Ave', color: '#FFA500'},
    {name: 'New York Ave', color: '#FFA500'},
    {name: 'Free Parking', icon: '🅿️'},
    {name: 'Kentucky Ave', color: '#FF0000'},
    {name: 'Chance', icon: '❓'},
    {name: 'Indiana Ave', color: '#FF0000'},
    {name: 'Illinois Ave', color: '#FF0000'},
    {name: 'B&O RR', color: '#000'},
    {name: 'Atlantic Ave', color: '#FFFF00'},
    {name: 'Ventnor Ave', color: '#FFFF00'},
    {name: 'Water Works', icon: '🚰'},
    {name: 'Marvin Gardens', color: '#FFFF00'},
    {name: 'Go To Jail', icon: '🚔'},
    {name: 'Pacific Ave', color: '#008000'},
    {name: 'North Carolina Ave', color: '#008000'},
    {name: 'Community Chest', icon: '🎁'},
    {name: 'Pennsylvania Ave', color: '#008000'},
    {name: 'Short Line', color: '#000'},
    {name: 'Chance', icon: '❓'},
    {name: 'Park Place', color: '#0000FF'},
    {name: 'Luxury Tax', icon: '💎'},
    {name: 'Boardwalk', color: '#0000FF'}
];
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
    const N = 11; // 11x11 grid => 40 spaces
    boardCoords = [];
    boardDiv.querySelectorAll('.space').forEach(s => s.remove());
    for (let c = N - 1; c >= 0; c--) boardCoords.push({ row: N - 1, col: c });
    for (let r = N - 2; r >= 0; r--) boardCoords.push({ row: r, col: 0 });
    for (let c = 1; c <= N - 1; c++) boardCoords.push({ row: 0, col: c });
    for (let r = 1; r <= N - 2; r++) boardCoords.push({ row: r, col: N - 1 });
    boardCoords.forEach((pos, idx) => {
        const spaceData = spaces[idx] || { name: '', color: '' };
        const div = document.createElement('div');
        div.className = 'space';
        if (spaceData.color) {
            div.classList.add('property');
            div.style.borderTopColor = spaceData.color;
        }
        div.dataset.index = idx;
        div.style.gridRowStart = pos.row + 1;
        div.style.gridColumnStart = pos.col + 1;
        div.innerHTML = `<div>${spaceData.icon || ''}</div><div>${spaceData.name}</div><div class="tokens"></div>`;
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
            const container = space.querySelector('.tokens');
            container.appendChild(token);
        }
    });
}
