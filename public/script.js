const socket = io();
const joinDiv = document.getElementById('join');
const gameDiv = document.getElementById('game');
const nameInput = document.getElementById('name');
const joinBtn = document.getElementById('joinBtn');
const rollBtn = document.getElementById('rollBtn');
const logDiv = document.getElementById('log');
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
