const socket = io();
const joinDiv = document.getElementById('join');
const gameDiv = document.getElementById('game');
const nameInput = document.getElementById('name');
const joinBtn = document.getElementById('joinBtn');
const rollBtn = document.getElementById('rollBtn');
const buyBtn = document.getElementById('buyBtn');
const endTurnBtn = document.getElementById('endTurnBtn');
const payJailBtn = document.getElementById('payJailBtn');
const useCardBtn = document.getElementById('useCardBtn');
const logDiv = document.getElementById('log');
const boardDiv = document.getElementById('board');
const statsDiv = document.getElementById('stats');
let boardSize = 40;
const spaces = [
    {name: 'Go', color: '', price: 0},
    {name: 'Mediterranean Ave', color: '#8B4513', price: 60},
    {name: 'Community Chest', icon: '🎁'},
    {name: 'Baltic Ave', color: '#8B4513', price: 60},
    {name: 'Income Tax', icon: '💰'},
    {name: 'Reading RR', color: '#000', price: 200},
    {name: 'Oriental Ave', color: '#ADD8E6', price: 100},
    {name: 'Chance', icon: '❓'},
    {name: 'Vermont Ave', color: '#ADD8E6', price: 100},
    {name: 'Connecticut Ave', color: '#ADD8E6', price: 120},
    {name: 'Jail', icon: '🚓'},
    {name: 'St. Charles Pl', color: '#FF00FF', price: 140},
    {name: 'Electric Co', icon: '💡', price: 150},
    {name: 'States Ave', color: '#FF00FF', price: 140},
    {name: 'Virginia Ave', color: '#FF00FF', price: 160},
    {name: 'Pennsylvania RR', color: '#000', price: 200},
    {name: 'St. James Pl', color: '#FFA500', price: 180},
    {name: 'Community Chest', icon: '🎁'},
    {name: 'Tennessee Ave', color: '#FFA500', price: 180},
    {name: 'New York Ave', color: '#FFA500', price: 200},
    {name: 'Free Parking', icon: '🅿️'},
    {name: 'Kentucky Ave', color: '#FF0000', price: 220},
    {name: 'Chance', icon: '❓'},
    {name: 'Indiana Ave', color: '#FF0000', price: 220},
    {name: 'Illinois Ave', color: '#FF0000', price: 240},
    {name: 'B&O RR', color: '#000', price: 200},
    {name: 'Atlantic Ave', color: '#FFFF00', price: 260},
    {name: 'Ventnor Ave', color: '#FFFF00', price: 260},
    {name: 'Water Works', icon: '🚰', price: 150},
    {name: 'Marvin Gardens', color: '#FFFF00', price: 280},
    {name: 'Go To Jail', icon: '🚔'},
    {name: 'Pacific Ave', color: '#008000', price: 300},
    {name: 'North Carolina Ave', color: '#008000', price: 300},
    {name: 'Community Chest', icon: '🎁'},
    {name: 'Pennsylvania Ave', color: '#008000', price: 320},
    {name: 'Short Line', color: '#000', price: 200},
    {name: 'Chance', icon: '❓'},
    {name: 'Park Place', color: '#0000FF', price: 350},
    {name: 'Luxury Tax', icon: '💎'},
    {name: 'Boardwalk', color: '#0000FF', price: 400}
];
let boardCoords = [];
let players = [];
let propertyOwners = [];
let playerId = null;

joinBtn.onclick = () => {
    const name = nameInput.value.trim();
    if (!name) return;
    socket.emit('joinGame', name);
};

rollBtn.onclick = () => {
    rollBtn.disabled = true;
    socket.emit('rollDice');
};

buyBtn.onclick = () => {
    const me = players.find(p => p.id === playerId);
    if (!me) return;
    socket.emit('buyProperty', me.position);
};

endTurnBtn.onclick = () => {
    socket.emit('endTurn');
};

payJailBtn.onclick = () => {
    socket.emit('payJail');
};

useCardBtn.onclick = () => {
    socket.emit('useJailCard');
};

socket.on('joined', (id) => {
    playerId = id;
    joinDiv.style.display = 'none';
    gameDiv.style.display = 'block';
    if (boardCoords.length === 0) {
        buildBoard();
        renderOwnership();
    }
});

socket.on('message', msg => {
    const p = document.createElement('p');
    if (typeof msg === 'object') {
        p.textContent = msg.text;
        if (msg.color) p.style.color = msg.color;
    } else {
        p.textContent = msg;
    }
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
});

socket.on('yourTurn', () => {
    rollBtn.disabled = false;
    endTurnBtn.disabled = false;
    updateJailButtons();
    updateBuyButton();
});

socket.on('notYourTurn', () => {
    rollBtn.disabled = true;
    buyBtn.disabled = true;
    payJailBtn.disabled = true;
    useCardBtn.disabled = true;
    endTurnBtn.disabled = true;
});

socket.on('state', state => {
    boardSize = state.boardSize;
    players = state.players;
    propertyOwners = state.propertyOwners || [];
    if (boardCoords.length === 0) {
        buildBoard();
    }
    renderTokens();
    renderOwnership();
    renderStats();
    updateJailButtons();
    updateBuyButton();
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
        const price = spaceData.price ? `<div>$${spaceData.price}</div>` : '';
        div.innerHTML = `<div>${spaceData.icon || ''}</div><div>${spaceData.name}</div>${price}<div class="tokens"></div>`;
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

function renderOwnership() {
    document.querySelectorAll('.space').forEach(div => {
        div.classList.remove('owned-0', 'owned-1', 'owned-2', 'owned-3');
    });
    propertyOwners.forEach((owner, idx) => {
        if (owner == null) return;
        const space = boardDiv.querySelector(`.space[data-index="${idx}"]`);
        if (space) space.classList.add(`owned-${owner}`);
    });
}

function renderStats() {
    statsDiv.innerHTML = '';
    players.forEach((p, idx) => {
        const div = document.createElement('div');
        div.style.border = '1px solid #ccc';
        div.style.padding = '4px';
        div.style.marginBottom = '4px';
        const cardInfo = p.items && p.items.getOutOfJail ? `Get Out of Jail: ${p.items.getOutOfJail}` : '';
        div.innerHTML = `<strong style="color:${getTokenColor(idx)}">${p.name}</strong><br>$${p.money}<br>${p.properties.map(i => spaces[i].name).join(', ')}<br>${cardInfo}`;
        statsDiv.appendChild(div);
    });
}

function getTokenColor(idx) {
    const colors = ['red','blue','green','yellow'];
    return colors[idx] || 'black';
}

function updateBuyButton() {
    const me = players.find(p => p.id === playerId);
    if (!me) { buyBtn.disabled = true; return; }
    const pos = me.position;
    const space = spaces[pos];
    if (space && space.price && propertyOwners[pos] == null && me.money >= space.price) {
        buyBtn.disabled = false;
    } else {
        buyBtn.disabled = true;
    }
}

function updateJailButtons() {
    const me = players.find(p => p.id === playerId);
    if (!me || !me.inJail) {
        payJailBtn.disabled = true;
        useCardBtn.disabled = true;
        return;
    }
    payJailBtn.disabled = false;
    useCardBtn.disabled = me.items.getOutOfJail <= 0;
}
