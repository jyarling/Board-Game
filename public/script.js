const socket = io();
const joinDiv = document.getElementById('join');
const gameDiv = document.getElementById('game');
const nameInput = document.getElementById('name');
const joinBtn = document.getElementById('joinBtn');
const rollBtn = document.getElementById('rollBtn');
const buyBtn = document.getElementById('buyBtn');
const tradeBtn = document.getElementById('tradeBtn');
const endTurnBtn = document.getElementById('endTurnBtn');
const payJailBtn = document.getElementById('payJailBtn');
const useCardBtn = document.getElementById('useCardBtn');
const logDiv = document.getElementById('log');
const boardDiv = document.getElementById('board');
const tokenLayer = document.getElementById('tokenLayer');
const statsDiv = document.getElementById('stats');
const tradeModal = document.getElementById('tradeModal');
const tradeStartDiv = document.getElementById('tradeStart');
const tradeWindowDiv = document.getElementById('tradeWindow');
const tradeTargetSelect = document.getElementById('tradeTarget');
const tradeInitBtn = document.getElementById('tradeInitBtn');
const tradeTitle = document.getElementById('tradeTitle');
const yourPropsDiv = document.getElementById('yourProps');
const theirPropsDiv = document.getElementById('theirProps');
const yourMoneyInput = document.getElementById('yourMoney');
const theirMoneyInput = document.getElementById('theirMoney');
const yourCardsInput = document.getElementById('yourCards');
const theirCardsInput = document.getElementById('theirCards');
const tradeUpdateBtn = document.getElementById('tradeUpdateBtn');
const tradeAcceptBtn = document.getElementById('tradeAcceptBtn');
const tradeCancelBtn = document.getElementById('tradeCancelBtn');
const tradeStatusDiv = document.getElementById('tradeStatus');
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
let spaceCenters = [];
let players = [];
let propertyOwners = [];
let propertyMortgaged = [];
let propertyHouses = [];
let playerId = null;
let currentTrade = null;
let lastPositions = {};
let tokenElems = {};

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

tradeBtn.onclick = () => {
    tradeTargetSelect.innerHTML = '';
    players.forEach((p, idx) => {
        if (p.id !== playerId) {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = p.name;
            tradeTargetSelect.appendChild(opt);
        }
    });
    tradeStartDiv.style.display = 'block';
    tradeWindowDiv.style.display = 'none';
    tradeModal.style.display = 'flex';
};

tradeInitBtn.onclick = () => {
    const target = parseInt(tradeTargetSelect.value, 10);
    if (isNaN(target)) return;
    socket.emit('initiateTrade', target);
};

tradeCancelBtn.onclick = () => {
    if (currentTrade) {
        socket.emit('cancelTrade', currentTrade.id);
    }
    tradeModal.style.display = 'none';
    currentTrade = null;
};

tradeUpdateBtn.onclick = () => {
    if (!currentTrade) return;
    const offer = {
        money: parseInt(yourMoneyInput.value, 10) || 0,
        cards: parseInt(yourCardsInput.value, 10) || 0,
        properties: Array.from(yourPropsDiv.querySelectorAll('input:checked')).map(c => parseInt(c.value, 10))
    };
    socket.emit('updateTrade', { id: currentTrade.id, offer });
};

tradeAcceptBtn.onclick = () => {
    if (!currentTrade) return;
    socket.emit('acceptTrade', currentTrade.id);
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
    tradeBtn.disabled = false;
    updateJailButtons();
    updateBuyButton();
});

socket.on('notYourTurn', () => {
    rollBtn.disabled = true;
    buyBtn.disabled = true;
    payJailBtn.disabled = true;
    useCardBtn.disabled = true;
    endTurnBtn.disabled = true;
    tradeBtn.disabled = true;
});

socket.on('state', state => {
    boardSize = state.boardSize;
    players = state.players;
    propertyOwners = state.propertyOwners || [];
    propertyMortgaged = state.propertyMortgaged || [];
    propertyHouses = state.propertyHouses || [];
    if (boardCoords.length === 0) {
        buildBoard();
    }
    renderTokens();
    renderOwnership();
    renderStats();
    updateJailButtons();
    updateBuyButton();
});

socket.on('tradeStarted', trade => {
    currentTrade = trade;
    tradeStartDiv.style.display = 'none';
    tradeWindowDiv.style.display = 'block';
    tradeModal.style.display = 'flex';
    populateTradeWindow();
});

socket.on('tradeUpdated', trade => {
    if (!currentTrade || currentTrade.id !== trade.id) return;
    currentTrade = trade;
    populateTradeWindow();
});

socket.on('tradeEnded', () => {
    tradeModal.style.display = 'none';
    currentTrade = null;
});

function buildBoard() {
    const N = 11; // 11x11 grid => 40 spaces
    boardCoords = [];
    spaceCenters = [];
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
        div.innerHTML = `<div>${spaceData.icon || ''}</div><div>${spaceData.name}</div>${price}<div class="buildings"></div><div class="tokens"></div>`;
        boardDiv.appendChild(div);
        const rect = div.getBoundingClientRect();
        const boardRect = boardDiv.getBoundingClientRect();
        spaceCenters[idx] = {
            x: rect.left - boardRect.left + rect.width / 2,
            y: rect.top - boardRect.top + rect.height / 2
        };
    });
}

function renderTokens() {
    Object.keys(tokenElems).forEach(i => {
        if (!players[i]) {
            tokenElems[i].remove();
            delete tokenElems[i];
            delete lastPositions[i];
        }
    });
    players.forEach((p, idx) => {
        const target = spaceCenters[p.position];
        if (!target) return;
        let token = tokenElems[idx];
        if (!token) {
            token = document.createElement('div');
            token.className = `token p${idx}`;
            token.title = p.name;
            tokenLayer.appendChild(token);
            tokenElems[idx] = token;
            token.style.transform = `translate(${target.x}px, ${target.y}px)`;
        } else {
            const prev = lastPositions[idx];
            const diff = prev == null ? 1 : Math.abs((p.position - prev + boardSize) % boardSize);
            const dur = (diff / 5) * 1000;
            token.style.transitionDuration = dur + 'ms';
            token.style.transform = `translate(${target.x}px, ${target.y}px)`;
        }
        lastPositions[idx] = p.position;
    });
}

function renderOwnership() {
    document.querySelectorAll('.space').forEach(div => {
        div.classList.remove('owned-0', 'owned-1', 'owned-2', 'owned-3', 'mortgaged');
        const b = div.querySelector('.buildings');
        if (b) b.textContent = '';
    });
    propertyOwners.forEach((owner, idx) => {
        const space = boardDiv.querySelector(`.space[data-index="${idx}"]`);
        if (!space) return;
        if (owner != null) space.classList.add(`owned-${owner}`);
        if (propertyMortgaged[idx]) space.classList.add('mortgaged');
        const b = space.querySelector('.buildings');
        if (b) {
            const count = propertyHouses[idx] || 0;
            if (count > 0) {
                b.textContent = count === 5 ? '🏨' : '🏠'.repeat(count);
            }
        }
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
        let props = p.properties.map(i => {
            const mort = propertyMortgaged[i];
            const houses = propertyHouses[i] || 0;
            let html = `${spaces[i].name} ${mort ? '(M)' : ''} ${houses>0 ? 'H:'+houses : ''}`;
            if (p.id === playerId) {
                const mortBtn = `<button data-act="mortgage" data-index="${i}">${mort?'Unmortgage':'Mortgage'}</button>`;
                const buyBtn = !mort && houses < 5 ? `<button data-act="buyHouse" data-index="${i}">+House</button>` : '';
                const sellBtn = houses > 0 ? `<button data-act="sellHouse" data-index="${i}">Sell</button>` : '';
                html += ` ${mortBtn}${buyBtn}${sellBtn}`;
            }
            return `<div>${html}</div>`;
        }).join('');
        div.innerHTML = `<strong style="color:${getTokenColor(idx)}">${p.name}</strong><br>$${p.money}<br>${props}<br>${cardInfo}`;
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

statsDiv.addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON') return;
    const idx = parseInt(e.target.dataset.index, 10);
    const act = e.target.dataset.act;
    if (act === 'mortgage') socket.emit('mortgageProperty', idx);
    if (act === 'buyHouse') socket.emit('buyHouse', idx);
    if (act === 'sellHouse') socket.emit('sellHouse', idx);
});

function populateTradeWindow() {
    if (!currentTrade) return;
    const myIdx = players.findIndex(p => p.id === playerId);
    const otherIdx = currentTrade.playerA === myIdx ? currentTrade.playerB : currentTrade.playerA;
    tradeTitle.textContent = `Trading with ${players[otherIdx].name}`;

    yourPropsDiv.innerHTML = '';
    theirPropsDiv.innerHTML = '';
    players[myIdx].properties.forEach(i => {
        if (!propertyMortgaged[i]) {
            const cb = document.createElement('label');
            cb.innerHTML = `<input type="checkbox" value="${i}"> ${spaces[i].name}`;
            if (currentTrade.playerA === myIdx ? currentTrade.offerA.properties.includes(i) : currentTrade.offerB.properties.includes(i)) {
                cb.querySelector('input').checked = true;
            }
            yourPropsDiv.appendChild(cb);
        }
    });
    players[otherIdx].properties.forEach(i => {
        if (!propertyMortgaged[i]) {
            const cb = document.createElement('label');
            cb.innerHTML = `<input type="checkbox" value="${i}"> ${spaces[i].name}`;
            if (currentTrade.playerA === otherIdx ? currentTrade.offerA.properties.includes(i) : currentTrade.offerB.properties.includes(i)) {
                cb.querySelector('input').checked = true;
            }
            theirPropsDiv.appendChild(cb);
        }
    });

    if (currentTrade.playerA === myIdx) {
        yourMoneyInput.value = currentTrade.offerA.money;
        yourCardsInput.value = currentTrade.offerA.cards;
        theirMoneyInput.value = currentTrade.offerB.money;
        theirCardsInput.value = currentTrade.offerB.cards;
        tradeStatusDiv.textContent = currentTrade.acceptedA ? 'You accepted' : '';
        if (currentTrade.acceptedB) tradeStatusDiv.textContent += ' | Opponent accepted';
    } else {
        yourMoneyInput.value = currentTrade.offerB.money;
        yourCardsInput.value = currentTrade.offerB.cards;
        theirMoneyInput.value = currentTrade.offerA.money;
        theirCardsInput.value = currentTrade.offerA.cards;
        tradeStatusDiv.textContent = currentTrade.acceptedB ? 'You accepted' : '';
        if (currentTrade.acceptedA) tradeStatusDiv.textContent += ' | Opponent accepted';
    }
}

