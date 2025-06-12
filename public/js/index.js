import * as DOM from './dom.js';
import { setSocket } from './dom.js';
import { registerGameEvents } from './socketHandlers.js';
const { rootSocket, joinDiv, gameDiv, nameInput, createBtn, createCodeInput, lobbyNameInput, joinCodeInput, joinBtn, rollBtn, buyBtn, tradeBtn, endTurnBtn, payJailBtn, useCardBtn, logDiv, boardDiv, boardWrapper, tokenLayer, statsDiv, tradeModal, tradeStartDiv, tradeWindowDiv, tradeTargetSelect, tradeInitBtn, tradeTitle, yourPropsDiv, theirPropsDiv, yourMoneyInput, theirMoneyInput, yourCardsInput, theirCardsInput, tradeAcceptBtn, tradeCancelBtn, tradeStatusDiv, auctionModal, auctionTitle, auctionBidSpan, auctionBidderSpan, auctionCountdown, auctionBidBtn, auctionCloseBtn, chatMessages, chatInput, chatSend, propertyMenu } = DOM;
let { socket } = DOM;
let menuPropertyIndex = null;
let boardSize = 40;
let currentAuction = null;
let spaces = [];
const boardPromise = fetch('/data/board.json')
    .then(r => r.json())
    .then(d => { spaces = d.spaces; });
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

function startGame(code, name) {
    boardPromise.then(() => {
        const s = io(`/game-${code}`);
        setSocket(s);
        socket = s;
        registerGameEvents(socket);
        socket.emit('joinGame', name);
    });
}

createBtn.onclick = () => {
    const name = nameInput.value.trim();
    const code = createCodeInput.value.trim();
    const lobbyName = lobbyNameInput.value.trim();
    if (!name || !code) return;
    rootSocket.emit('createLobby', { code, name: lobbyName });
    rootSocket.once('lobbyCreated', c => startGame(c, name));
    rootSocket.once('lobbyError', msg => alert(msg));
};

joinBtn.onclick = () => {
    const name = nameInput.value.trim();
    const code = joinCodeInput.value.trim();
    if (!name || !code) return;
    rootSocket.emit('joinLobby', code);
    rootSocket.once('lobbyJoined', c => startGame(c, name));
    rootSocket.once('lobbyError', msg => alert(msg));
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

function sendTradeUpdate() {
    if (!currentTrade) return;
    const offer = {
        money: parseInt(yourMoneyInput.value, 10) || 0,
        cards: parseInt(yourCardsInput.value, 10) || 0,
        properties: Array.from(yourPropsDiv.querySelectorAll('input:checked')).map(c => parseInt(c.value, 10))
    };
    socket.emit('updateTrade', { id: currentTrade.id, offer });
}

// Live update trade offer when user changes inputs
yourMoneyInput.addEventListener('input', sendTradeUpdate);
yourCardsInput.addEventListener('input', sendTradeUpdate);
yourPropsDiv.addEventListener('change', e => {
    if (e.target.tagName === 'INPUT') sendTradeUpdate();
});

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

auctionBidBtn.onclick = () => {
    socket.emit('placeBid');
};

auctionCloseBtn.onclick = () => {
    auctionModal.style.display = 'none';
};

chatSend.onclick = () => {
    const txt = chatInput.value.trim();
    if (txt) {
        socket.emit('chat', txt);
        chatInput.value = '';
    }
};

chatInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') chatSend.click();
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
        div.addEventListener('contextmenu', e => {
            e.preventDefault();
            const rect = boardWrapper.getBoundingClientRect();
            showPropertyMenu(idx, e.clientX - rect.left, e.clientY - rect.top);
        });
        boardDiv.appendChild(div);
    });
    updateSpaceCenters();
}

function updateSpaceCenters() {
    const boardRect = boardDiv.getBoundingClientRect();
    boardDiv.querySelectorAll('.space').forEach(div => {
        const idx = parseInt(div.dataset.index, 10);
        const rect = div.getBoundingClientRect();
        spaceCenters[idx] = {
            x: rect.left - boardRect.left + rect.width / 2,
            y: rect.top - boardRect.top + rect.height / 2
        };
    });

    Object.keys(tokenElems).forEach(i => {
        const posIdx = lastPositions[i];
        if (posIdx == null || spaceCenters[posIdx] == null) return;
        const token = tokenElems[i];
        const pos = spaceCenters[posIdx];
        token.style.transition = 'none';
        token.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
        requestAnimationFrame(() => { token.style.transition = ''; });
    });
}

function animateTokenMove(token, idx, from, to) {
    if (from == null) {
        // place token instantly on first render
        token.style.transition = 'none';
        const start = spaceCenters[to];
        token.style.transform = `translate(${start.x}px, ${start.y}px) translate(-50%, -50%)`;
        requestAnimationFrame(() => { token.style.transition = ''; });
        lastPositions[idx] = to;
        return;
    }

    if (from === to) return;

    let current = from;
    const step = () => {
        current = (current + 1) % boardSize;
        const pos = spaceCenters[current];
        token.style.transitionDuration = '200ms';
        token.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
        if (current !== to) {
            token.addEventListener('transitionend', step, { once: true });
        } else {
            lastPositions[idx] = to;
        }
    };
    step();
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
        const targetPos = p.position;
        if (spaceCenters[targetPos] == null) return;
        let token = tokenElems[idx];
        if (!token) {
            token = document.createElement('div');
            token.className = `token p${idx}`;
            token.title = p.name;
            tokenLayer.appendChild(token);
            tokenElems[idx] = token;
        }
        animateTokenMove(token, idx, lastPositions[idx], targetPos);
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

function showPropertyMenu(idx, x, y) {
    hidePropertyMenu();
    const myIdx = players.findIndex(p => p.id === playerId);
    if (myIdx === -1 || propertyOwners[idx] !== myIdx) return;
    menuPropertyIndex = idx;
    const mortgaged = propertyMortgaged[idx];
    const houses = propertyHouses[idx] || 0;
    let html = `<button data-act="mortgage">${mortgaged ? 'Unmortgage' : 'Mortgage'}</button>`;
    if (!mortgaged && houses < 5) html += `<button data-act="buyHouse">Buy House</button>`;
    if (houses > 0) html += `<button data-act="sellHouse">Sell House</button>`;
    propertyMenu.innerHTML = html;
    propertyMenu.style.left = `${x}px`;
    propertyMenu.style.top = `${y}px`;
    propertyMenu.style.display = 'block';
}

function hidePropertyMenu() {
    propertyMenu.style.display = 'none';
    menuPropertyIndex = null;
}

propertyMenu.addEventListener('click', e => {
    if (e.target.tagName !== 'BUTTON' || menuPropertyIndex == null) return;
    const act = e.target.dataset.act;
    if (act === 'mortgage') socket.emit('mortgageProperty', menuPropertyIndex);
    if (act === 'buyHouse') socket.emit('buyHouse', menuPropertyIndex);
    if (act === 'sellHouse') socket.emit('sellHouse', menuPropertyIndex);
    hidePropertyMenu();
});

document.addEventListener('mousedown', e => {
    if (!propertyMenu.contains(e.target)) hidePropertyMenu();
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
            cb.innerHTML = `<input type="checkbox" value="${i}" disabled> ${spaces[i].name}`;
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

    // Opponent fields should be read-only
    theirMoneyInput.disabled = true;
    theirCardsInput.disabled = true;
}

window.addEventListener('resize', () => {
    updateSpaceCenters();
    hidePropertyMenu();
});

document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    if (!rollBtn.disabled) {
        rollBtn.click();
    } else if (!endTurnBtn.disabled) {
        endTurnBtn.click();
    }
});

