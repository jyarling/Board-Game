import * as DOM from './dom.js';
import { setSocket } from './dom.js';
import { registerGameEvents } from './socketHandlers.js';
const { rootSocket, joinDiv, gameDiv, nameInput, nameCreateInput, createBtn, createCodeInput, lobbyNameInput, joinCodeInput, joinBtn, joinTab, createTab, joinPanel, createPanel, lobbyListContainer, refreshLobbiesBtn, startGameBtn, rollBtn, buyBtn, tradeBtn, endTurnBtn, payJailBtn, useCardBtn, logDiv, boardDiv, boardWrapper, tokenLayer, statsDiv, tradeModal, tradeStartDiv, tradeWindowDiv, tradeTargetSelect, tradeInitBtn, tradeStartCloseBtn, tradeTitle, yourPropsDiv, theirPropsDiv, yourMoneyInput, theirMoneyInput, yourCardsInput, theirCardsInput, tradeAcceptBtn, tradeCancelBtn, tradeCloseBtn, tradeStatusDiv, auctionModal, auctionTitle, auctionBidSpan, auctionBidderSpan, auctionCountdown, auctionBidBtn, auctionCloseBtn, chatMessages, chatInput, chatSend, propertyMenu, turnIndicator, dice1, dice2, propertyCardModal, propertyCardHeader, propertyCardTitle, propertyCardPrice, propertyCardRent, propertyCardHouses, propertyCardMortgage, propertyCardOwner, propertyCardClose, notificationContainer, soundToggleBtn } = DOM;
let { socket } = DOM;
let menuPropertyIndex = null;
export let boardSize = 40;
export let currentAuction = null;
export let spaces = [];
const boardPromise = fetch('/data/board.json')
    .then(r => r.json())
    .then(d => { spaces = d.spaces; });
export let boardCoords = [];
export let spaceCenters = [];
export let players = [];
export let propertyOwners = [];
export let propertyMortgaged = [];
export let propertyHouses = [];
export let playerId = null;
export let currentTrade = null;
export let lastPositions = {};
export let tokenElems = {};
export let isHost = false;
export let currentTurn = 0;

function highlightMyToken() {
    const idx = players.findIndex(p => p.id === playerId);
    const token = tokenElems[idx];
    if (token) token.classList.add('active-token');
}

function unhighlightMyToken() {
    const idx = players.findIndex(p => p.id === playerId);
    const token = tokenElems[idx];
    if (token) token.classList.remove('active-token');
}

function startGame(code, name) {
    boardPromise.then(() => {
        const s = io(`/game-${code}`);
        setSocket(s);
        socket = s;
        registerGameEvents(socket);
        socket.on('yourTurn', highlightMyToken);
        socket.on('notYourTurn', unhighlightMyToken);
        socket.emit('joinGame', name);
    });
}

// Tab switching
joinTab.onclick = () => {
    joinTab.classList.add('active');
    createTab.classList.remove('active');
    joinPanel.classList.add('active');
    createPanel.classList.remove('active');
    loadLobbies();
};

createTab.onclick = () => {
    createTab.classList.add('active');
    joinTab.classList.remove('active');
    createPanel.classList.add('active');
    joinPanel.classList.remove('active');
};

// Lobby management
function loadLobbies() {
    lobbyListContainer.innerHTML = '<div class="loading">Loading lobbies...</div>';
    rootSocket.timeout(5000).emit('listLobbies', (err, res) => {
        if (err) {
            lobbyListContainer.innerHTML = '<div class="loading">Failed to load lobbies</div>';
            return;
        }
        displayLobbies(res.lobbies || []);
    });
}

function displayLobbies(lobbies) {
    if (lobbies.length === 0) {
        lobbyListContainer.innerHTML = `
            <div class="no-lobbies">
                <h4>No games available</h4>
                <p>Create a new game to get started!</p>
            </div>
        `;
        return;
    }
    
    lobbyListContainer.innerHTML = lobbies.map(lobby => `
        <div class="lobby-item" data-code="${lobby.code}">
            <div class="lobby-info">
                <h4>${lobby.name}</h4>
                <p>Created ${formatTimeAgo(lobby.created)}</p>
                <div class="lobby-code">Code: ${lobby.code}</div>
            </div>
            <div class="lobby-status">
                <div class="player-count">${lobby.players}/${lobby.maxPlayers}</div>
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.lobby-item').forEach(item => {
        item.onclick = () => {
            const code = item.dataset.code;
            const name = nameInput.value.trim();
            if (!name) {
                nameInput.focus();
                alert('Please enter your name');
                return;
            }
            joinLobby(code, name);
        };
    });
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function joinLobby(code, name) {
    if (!rootSocket.connected) {
        alert('Unable to reach server');
        return;
    }
    rootSocket.timeout(5000).emit('joinLobby', code, (err, res) => {
        if (err) { alert('Server timeout'); return; }
        if (res && res.error) {
            alert(res.error);
        } else {
            startGame(code, name);
        }
    });
}

refreshLobbiesBtn.onclick = loadLobbies;

createBtn.onclick = () => {
    const name = nameCreateInput.value.trim();
    const code = createCodeInput.value.trim();
    const lobbyName = lobbyNameInput.value.trim();
    if (!name || !code) return;
    if (!rootSocket.connected) {
        alert('Unable to reach server');
        return;
    }
    rootSocket.timeout(5000).emit('createLobby', { code, name: lobbyName }, (err, res) => {
        if (err) { alert('Server timeout'); return; }
        if (res && res.error) {
            alert(res.error);
        } else {
            startGame(code, name);
        }
    });
};

joinBtn.onclick = () => {
    const name = nameInput.value.trim();
    const code = joinCodeInput.value.trim();
    if (!name || !code) return;
    joinLobby(code, name);
};

// Auto-refresh lobbies and listen for updates
rootSocket.on('lobbyListUpdated', (lobbies) => {
    if (joinPanel.classList.contains('active')) {
        displayLobbies(lobbies);
    }
});

// Load lobbies on page load
window.addEventListener('load', () => {
    loadLobbies();
    
    // Initialize dice to show 1
    dice1.className = 'dice show-1';
    dice2.className = 'dice show-1';
});

startGameBtn.onclick = () => {
    if (isHost) {
        socket.emit('startGame');
        startGameBtn.style.display = 'none';
    }
};

export function animateDiceRoll(die1Value, die2Value) {
    // Play dice roll sound
    soundSystem.playDiceRoll();

    const showClasses = ['show-1', 'show-2', 'show-3', 'show-4', 'show-5', 'show-6'];

    // Remove any existing face classes and start rolling animation
    dice1.classList.remove(...showClasses);
    dice2.classList.remove(...showClasses);
    dice1.classList.add('rolling');
    dice2.classList.add('rolling');

    const onEnd1 = () => {
        dice1.className = `dice show-${die1Value}`;
    };
    const onEnd2 = () => {
        dice2.className = `dice show-${die2Value}`;
    };

    dice1.addEventListener('animationend', onEnd1, { once: true });
    dice2.addEventListener('animationend', onEnd2, { once: true });
}

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

tradeCloseBtn.onclick = () => {
    if (currentTrade) {
        socket.emit('cancelTrade', currentTrade.id);
    }
    tradeModal.style.display = 'none';
    currentTrade = null;
};

tradeStartCloseBtn.onclick = () => {
    tradeModal.style.display = 'none';
    currentTrade = null;
};

function sendTradeUpdate() {
    if (!currentTrade) return;
    const offer = {
        money: parseInt(yourMoneyInput.value, 10) || 0,
        cards: parseInt(yourCardsInput.value, 10) || 0,
        properties: Array.from(yourPropsDiv.querySelectorAll('.trade-property')).map(prop => parseInt(prop.dataset.propertyIndex, 10))
    };
    socket.emit('updateTrade', { id: currentTrade.id, offer });
}

// Live update trade offer when user changes inputs
yourMoneyInput.addEventListener('input', () => {
    const myIdx = players.findIndex(p => p.id === playerId);
    if (myIdx !== -1) {
        const maxMoney = players[myIdx].money;
        const value = parseInt(yourMoneyInput.value, 10) || 0;
        if (value > maxMoney) {
            yourMoneyInput.value = maxMoney;
        }
    }
    sendTradeUpdate();
});

yourCardsInput.addEventListener('input', () => {
    const myIdx = players.findIndex(p => p.id === playerId);
    if (myIdx !== -1) {
        const maxCards = players[myIdx].items.getOutOfJail || 0;
        const value = parseInt(yourCardsInput.value, 10) || 0;
        if (value > maxCards) {
            yourCardsInput.value = maxCards;
        }
        if (value < 0) {
            yourCardsInput.value = 0;
        }
    }
    sendTradeUpdate();
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

propertyCardClose.onclick = () => {
    propertyCardModal.style.display = 'none';
};

// Close property card when clicking outside
propertyCardModal.addEventListener('click', e => {
    if (e.target === propertyCardModal) {
        propertyCardModal.style.display = 'none';
    }
});

// Close trade modal when clicking outside
tradeModal.addEventListener('click', e => {
    if (e.target === tradeModal) {
        if (currentTrade) {
            socket.emit('cancelTrade', currentTrade.id);
        }
        tradeModal.style.display = 'none';
        currentTrade = null;
    }
});

soundToggleBtn.onclick = () => {
    const enabled = soundSystem.toggle();
    soundToggleBtn.textContent = enabled ? '🔊 Sound ON' : '🔇 Sound OFF';
    soundToggleBtn.classList.toggle('disabled', !enabled);
};


export function buildBoard() {
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
        
        // Add corner class for corner spaces
        if (idx === 0 || idx === 10 || idx === 20 || idx === 30) {
            div.classList.add('corner');
        }
        
        // Add property class and color for properties
        if (spaceData.color && !spaceData.railroad && !spaceData.utility) {
            div.classList.add('property');
            div.style.borderTopColor = spaceData.color;
        }
        
        // Add railroad class
        if (spaceData.railroad) {
            div.classList.add('railroad');
        }
        
        // Add utility class
        if (spaceData.utility) {
            div.classList.add('utility');
        }
        
        div.dataset.index = idx;
        div.style.gridRowStart = pos.row + 1;
        div.style.gridColumnStart = pos.col + 1;
        
        const price = spaceData.price && spaceData.price > 0 ? `<div class="space-price">$${spaceData.price}</div>` : '';
        const icon = spaceData.icon ? `<div class="space-icon">${spaceData.icon}</div>` : '';
        let nameDiv = '';
        
        if (spaceData.railroad) {
            nameDiv = `<div class="space-name">${spaceData.name}</div>`;
        } else {
            nameDiv = `<div class="space-name">${spaceData.name}</div>`;
        }
        
        div.innerHTML = `${icon}${nameDiv}${price}<div class="buildings"></div><div class="tokens"></div>`;
        div.addEventListener('contextmenu', e => {
            e.preventDefault();
            showPropertyMenu(idx, e.clientX, e.clientY);
        });
        
        // Add click handler to show property card
        div.addEventListener('click', e => {
            if (spaceData.price && spaceData.price > 0) {
                showPropertyCard(idx);
            }
        });
        
        boardDiv.appendChild(div);
    });
    updateSpaceCenters();
}

export function updateSpaceCenters() {
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
        requestAnimationFrame(() => {
            token.style.transition = '';
            // Add landing bounce effect without resetting position
            const pos = spaceCenters[to];
            token.animate([
                { transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(1.2)` },
                { transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(0.9)` },
                { transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(1)` }
            ], { duration: 300, easing: 'ease-out' });
        });
        lastPositions[idx] = to;
        return;
    }

    if (from === to) return;

    let current = from;
    const step = () => {
        current = (current + 1) % boardSize;
        const pos = spaceCenters[current];
        token.style.transitionDuration = '300ms';
        token.style.transitionTimingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Add slight bounce during movement
        if (current !== to) {
            token.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) scale(1.05)`;
        } else {
            token.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
        }
        
        if (current !== to) {
            token.addEventListener('transitionend', step, { once: true });
        } else {
            lastPositions[idx] = to;
            // Add landing effect without resetting position
            const posFinal = spaceCenters[to];
            token.animate([
                { transform: `translate(${posFinal.x}px, ${posFinal.y}px) translate(-50%, -50%) scale(1.2)` },
                { transform: `translate(${posFinal.x}px, ${posFinal.y}px) translate(-50%, -50%) scale(0.9)` },
                { transform: `translate(${posFinal.x}px, ${posFinal.y}px) translate(-50%, -50%) scale(1)` }
            ], { duration: 400, easing: 'ease-out' });
            // Play move sound when token lands
            soundSystem.playMove();
        }
    };
    step();
}

export function renderTokens() {
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

export function renderOwnership() {
    document.querySelectorAll('.space').forEach(div => {
        div.classList.remove('owned-0', 'owned-1', 'owned-2', 'owned-3', 'mortgaged');
        const b = div.querySelector('.buildings');
        if (b) b.innerHTML = '';
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
                b.innerHTML = ''; // Clear existing buildings
                if (count === 5) {
                    // Hotel
                    const hotel = document.createElement('div');
                    hotel.className = 'building hotel';
                    b.appendChild(hotel);
                } else {
                    // Houses
                    for (let i = 0; i < count; i++) {
                        const house = document.createElement('div');
                        house.className = 'building';
                        house.style.animationDelay = `${i * 0.1}s`;
                        b.appendChild(house);
                    }
                }
            }
        }
    });
}

export function renderStats() {
    statsDiv.innerHTML = '';
    players.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = 'player-card';
        const isCurrentPlayerTurn = idx === currentTurn;
        div.style.cssText = `
            background: linear-gradient(145deg, #ffffff, #f5f5f5);
            border: 2px solid ${getTokenColor(idx)};
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ${isCurrentPlayerTurn ? 'box-shadow: 0 0 15px rgba(255, 215, 0, 0.8), 0 2px 8px rgba(0,0,0,0.1); border-color: #ffd700; transform: scale(1.02);' : ''}
        `;
        
        const tokenColor = getTokenColor(idx);
        const cardInfo = p.items && p.items.getOutOfJail ? `<div class="jail-cards">🃏 Get Out of Jail: ${p.items.getOutOfJail}</div>` : '';
        
        // Sort properties by value and group by color
        const sortedProperties = p.properties
            .map(i => ({ index: i, space: spaces[i], price: spaces[i].price || 0 }))
            .sort((a, b) => {
                // First sort by group/color, then by price
                const aGroup = a.space.group || (a.space.railroad ? 'railroad' : a.space.utility ? 'utility' : 'other');
                const bGroup = b.space.group || (b.space.railroad ? 'railroad' : b.space.utility ? 'utility' : 'other');
                if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
                return a.price - b.price;
            });

        let props = sortedProperties.map(prop => {
            const i = prop.index;
            const mort = propertyMortgaged[i];
            const houses = propertyHouses[i] || 0;
            const spaceName = spaces[i].name;
            const spaceColor = spaces[i].color || (spaces[i].railroad ? '#000' : spaces[i].utility ? '#4a90e2' : '#888');
            
            let html = `<div class="property-item" style="border-left: 3px solid ${spaceColor}; padding-left: 5px; margin: 2px 0;">`;
            html += `<span class="property-name">${spaceName}</span>`;
            if (prop.price > 0) html += ` <span style="color: #666; font-size: 10px;">($${prop.price})</span>`;
            
            if (mort) html += ` <span class="mortgage-indicator">(M)</span>`;
            if (houses > 0) {
                const buildingText = houses === 5 ? '🏨' : '🏠'.repeat(houses);
                html += ` <span class="buildings-indicator">${buildingText}</span>`;
            }
            
            if (p.id === playerId) {
                html += `<div class="property-actions">`;
                html += `<button class="action-btn" data-act="mortgage" data-index="${i}">${mort?'Unmortgage':'Mortgage'}</button>`;
                // Only show house/hotel buttons if player has monopoly and property has houseCost
                const spaceInfo = spaces[i];
                if (spaceInfo && spaceInfo.group && spaceInfo.houseCost && hasMonopoly(idx, spaceInfo.group)) {
                    if (!mort && houses < 5) html += `<button class="action-btn" data-act="buyHouse" data-index="${i}">+House</button>`;
                    if (houses > 0) html += `<button class="action-btn" data-act="sellHouse" data-index="${i}">Sell</button>`;
                }
                html += `</div>`;
            }
            html += `</div>`;
            return html;
        }).join('');
        
        div.innerHTML = `
            <div class="player-header">
                <span class="player-token" style="background: ${tokenColor}; color: white; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px;">${['🎩','🚗','🐕','👢'][idx]}</span>
                <strong class="player-name" style="color: ${tokenColor}; margin-left: 8px;">${p.name}</strong>
                ${isCurrentPlayerTurn ? '<span style="background: #ffd700; color: #333; font-size: 10px; padding: 2px 6px; border-radius: 12px; margin-left: 8px; font-weight: bold;">🎯 TURN</span>' : ''}
            </div>
            <div class="player-money" style="font-size: 18px; font-weight: bold; color: #2c5234; margin: 5px 0;">$${p.money.toLocaleString()}</div>
            <div class="player-properties">${props}</div>
            ${cardInfo}
        `;
        
        statsDiv.appendChild(div);
    });
}

function getTokenColor(idx) {
    const colors = ['red','blue','green','yellow'];
    return colors[idx] || 'black';
}

function hasMonopoly(playerIdx, group) {
    const groupProperties = spaces
        .map((space, index) => ({ ...space, index }))
        .filter(space => space.group === group)
        .map(space => space.index);
    
    return groupProperties.every(index => propertyOwners[index] === playerIdx);
}

export function showPropertyCard(spaceIndex) {
    const spaceData = spaces[spaceIndex];
    if (!spaceData || !spaceData.price) return;
    
    // Set header color based on property type
    if (spaceData.color) {
        propertyCardHeader.style.background = spaceData.color;
    } else if (spaceData.railroad) {
        propertyCardHeader.style.background = 'linear-gradient(135deg, #000000, #333333)';
    } else if (spaceData.utility) {
        propertyCardHeader.style.background = 'linear-gradient(135deg, #4a90e2, #2980b9)';
    }
    
    // Set title and price
    propertyCardTitle.textContent = spaceData.name;
    propertyCardPrice.textContent = `$${spaceData.price}`;
    
    // Build rent information
    let rentHtml = '';
    if (spaceData.rentTable) {
        rentHtml = '<strong>RENT:</strong><br>';
        const rentLabels = spaceData.railroad ? 
            ['1 Railroad', '2 Railroads', '3 Railroads', '4 Railroads'] :
            spaceData.utility ? 
                ['If one utility owned', 'If both utilities owned'] :
                ['Base Rent', 'With 1 House', 'With 2 Houses', 'With 3 Houses', 'With 4 Houses', 'With Hotel'];
        
        spaceData.rentTable.forEach((rent, i) => {
            if (i < rentLabels.length) {
                rentHtml += `<div class="rent-line"><span>${rentLabels[i]}:</span><span>$${rent}</span></div>`;
            }
        });
    } else if (spaceData.utility) {
        rentHtml = '<strong>RENT:</strong><br>';
        rentHtml += '<div class="rent-line"><span>If one utility owned:</span><span>4 × dice roll</span></div>';
        rentHtml += '<div class="rent-line"><span>If both utilities owned:</span><span>10 × dice roll</span></div>';
    }
    propertyCardRent.innerHTML = rentHtml;
    
    // House cost information
    let houseInfo = '';
    if (spaceData.houseCost) {
        houseInfo = `House cost: $${spaceData.houseCost}`;
    }
    propertyCardHouses.innerHTML = houseInfo;
    
    // Mortgage information
    const mortgageValue = Math.floor(spaceData.price / 2);
    propertyCardMortgage.innerHTML = `Mortgage Value: $${mortgageValue}`;
    
    // Owner information
    const owner = propertyOwners[spaceIndex];
    if (owner !== null && owner !== undefined) {
        const ownerPlayer = players[owner];
        const mortgaged = propertyMortgaged[spaceIndex];
        const houses = propertyHouses[spaceIndex] || 0;
        let ownerInfo = `<strong>Owner:</strong> ${ownerPlayer?.name || 'Unknown'}`;
        if (mortgaged) ownerInfo += ' (MORTGAGED)';
        if (houses > 0) {
            ownerInfo += `<br><strong>Buildings:</strong> ${houses === 5 ? '1 Hotel' : houses + ' House' + (houses > 1 ? 's' : '')}`;
        }
        propertyCardOwner.innerHTML = ownerInfo;
    } else {
        propertyCardOwner.innerHTML = '<strong>Status:</strong> Available for purchase';
    }
    
    propertyCardModal.style.display = 'flex';
}

export function updateBuyButton() {
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

export function updateJailButtons() {
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
    const spaceInfo = spaces[idx];
    let html = `<button data-act="mortgage">${mortgaged ? 'Unmortgage' : 'Mortgage'}</button>`;
    // Only show house/hotel buttons if player has monopoly and property has houseCost
    if (spaceInfo && spaceInfo.group && spaceInfo.houseCost && hasMonopoly(myIdx, spaceInfo.group)) {
        if (!mortgaged && houses < 5) html += `<button data-act="buyHouse">Buy House</button>`;
        if (houses > 0) html += `<button data-act="sellHouse">Sell House</button>`;
    }
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

export function populateTradeWindow() {
    if (!currentTrade) return;
    const myIdx = players.findIndex(p => p.id === playerId);
    const otherIdx = currentTrade.playerA === myIdx ? currentTrade.playerB : currentTrade.playerA;
    tradeTitle.textContent = `Trading with ${players[otherIdx].name}`;

    // Clear previous properties
    yourPropsDiv.innerHTML = '';
    theirPropsDiv.innerHTML = '';

    // Clear any existing available properties div
    const existingAvailableDiv = document.getElementById('availableProps');
    if (existingAvailableDiv) {
        existingAvailableDiv.remove();
    }

    // Always create the available properties drop zone so items can be dragged back
    const availableDiv = document.createElement('div');
    availableDiv.id = 'availableProps';
    availableDiv.className = 'property-list';
    availableDiv.innerHTML = '<h5>Available Properties (drag to offer):</h5>';
    availableDiv.style.marginTop = '10px';
    availableDiv.style.padding = '10px';
    availableDiv.style.border = '1px solid #ddd';
    availableDiv.style.borderRadius = '6px';
    availableDiv.style.backgroundColor = '#f9f9f9';
    yourPropsDiv.parentElement.appendChild(availableDiv);

    // My available properties (draggable)
    players[myIdx].properties.forEach(i => {
        if (!propertyMortgaged[i]) {
            const propDiv = createTradeProperty(i, true);
            const isOffered = currentTrade.playerA === myIdx ?
                currentTrade.offerA.properties.includes(i) :
                currentTrade.offerB.properties.includes(i);

            if (isOffered) {
                yourPropsDiv.appendChild(propDiv);
            } else {
                availableDiv.appendChild(propDiv);
            }
        }
    });

    // Their offered properties (read-only)
    players[otherIdx].properties.forEach(i => {
        if (!propertyMortgaged[i]) {
            const isOffered = currentTrade.playerA === otherIdx ? 
                currentTrade.offerA.properties.includes(i) : 
                currentTrade.offerB.properties.includes(i);
            
            if (isOffered) {
                const propDiv = createTradeProperty(i, false);
                theirPropsDiv.appendChild(propDiv);
            }
        }
    });

    // Setup drop zones
    setupDropZones();

    // Update money and cards
    if (currentTrade.playerA === myIdx) {
        yourMoneyInput.value = currentTrade.offerA.money;
        yourCardsInput.value = currentTrade.offerA.cards;
        theirMoneyInput.value = currentTrade.offerB.money;
        theirCardsInput.value = currentTrade.offerB.cards;
        let statusText = '';
        if (currentTrade.acceptedA) statusText += 'You accepted';
        if (currentTrade.acceptedB) statusText += (statusText ? ' | ' : '') + 'Opponent accepted';
        tradeStatusDiv.textContent = statusText;
        tradeStatusDiv.className = 'trade-status' + (currentTrade.acceptedA || currentTrade.acceptedB ? ' accepted' : '');
    } else {
        yourMoneyInput.value = currentTrade.offerB.money;
        yourCardsInput.value = currentTrade.offerB.cards;
        theirMoneyInput.value = currentTrade.offerA.money;
        theirCardsInput.value = currentTrade.offerA.cards;
        let statusText = '';
        if (currentTrade.acceptedB) statusText += 'You accepted';
        if (currentTrade.acceptedA) statusText += (statusText ? ' | ' : '') + 'Opponent accepted';
        tradeStatusDiv.textContent = statusText;
        tradeStatusDiv.className = 'trade-status' + (currentTrade.acceptedA || currentTrade.acceptedB ? ' accepted' : '');
    }
}

function createTradeProperty(propertyIndex, draggable = false) {
    const space = spaces[propertyIndex];
    const propDiv = document.createElement('div');
    propDiv.className = 'trade-property';
    propDiv.dataset.propertyIndex = propertyIndex;
    
    if (draggable) {
        propDiv.draggable = true;
        propDiv.addEventListener('dragstart', handleDragStart);
        propDiv.addEventListener('dragend', handleDragEnd);
    }
    
    const colorBar = document.createElement('div');
    colorBar.className = 'property-color-bar';
    colorBar.style.backgroundColor = space.color || (space.railroad ? '#000' : '#4a90e2');
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'property-name';
    nameSpan.textContent = space.name;
    
    // Add remove button for properties in trade
    if (draggable) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'trade-property-remove';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove from trade';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            // Move back to available properties
            const availableDiv = document.getElementById('availableProps');
            if (availableDiv && propDiv.parentNode !== availableDiv) {
                propDiv.parentNode.removeChild(propDiv);
                availableDiv.appendChild(propDiv);
                sendTradeUpdate();
            }
        };
        propDiv.appendChild(removeBtn);
    }
    
    propDiv.appendChild(colorBar);
    propDiv.appendChild(nameSpan);
    
    return propDiv;
}

function setupDropZones() {
    const yourDropZone = document.getElementById('yourPropsDropZone');
    const availableProps = document.getElementById('availableProps');
    
    [yourDropZone, availableProps].forEach(zone => {
        if (zone) {
            zone.addEventListener('dragover', handleDragOver);
            zone.addEventListener('drop', handleDrop);
            zone.addEventListener('dragleave', handleDragLeave);
        }
    });
    
    // Also set up the yourProps div as a drop zone for removing items
    if (yourPropsDiv) {
        yourPropsDiv.addEventListener('dragover', handleDragOver);
        yourPropsDiv.addEventListener('drop', handleDrop);
        yourPropsDiv.addEventListener('dragleave', handleDragLeave);
    }
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.propertyIndex);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const propertyIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const draggedElement = document.querySelector(`.trade-property[data-property-index="${propertyIndex}"]`);
    
    if (!draggedElement) return;
    
    // Determine target container
    let targetContainer = null;
    if (e.currentTarget.id === 'yourPropsDropZone' || e.currentTarget === yourPropsDiv) {
        targetContainer = yourPropsDiv;
    } else if (e.currentTarget.id === 'availableProps') {
        targetContainer = e.currentTarget;
    }
    
    if (!targetContainer) return;
    
    // Only move if it's not already in the target container
    if (!targetContainer.contains(draggedElement)) {
        // Remove from current parent and add to new parent
        if (draggedElement.parentNode) {
            draggedElement.parentNode.removeChild(draggedElement);
        }
        targetContainer.appendChild(draggedElement);
        sendTradeUpdate();
    }
}

window.addEventListener('resize', () => {
    updateSpaceCenters();
    hidePropertyMenu();
});

document.addEventListener('keydown', e => {
    // Handle Escape key to close modals
    if (e.key === 'Escape') {
        if (tradeModal.style.display !== 'none') {
            // Close trade modal
            if (currentTrade) {
                socket.emit('cancelTrade', currentTrade.id);
            }
            tradeModal.style.display = 'none';
            currentTrade = null;
        }
        if (propertyCardModal.style.display !== 'none') {
            propertyCardModal.style.display = 'none';
        }
        return;
    }
    
    // Handle Enter key for game actions
    if (e.key !== 'Enter') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    if (!rollBtn.disabled) {
        rollBtn.click();
    } else if (!endTurnBtn.disabled) {
        endTurnBtn.click();
    }
});


export function setPlayerId(id) {
    playerId = id;
}

export function setIsHost(host) {
    isHost = host;
    if (isHost) {
        startGameBtn.style.display = 'block';
    }
}

export function hideStartButton() {
    startGameBtn.style.display = 'none';
}

export function applyState(state) {
    boardSize = state.boardSize;
    players = state.players;
    propertyOwners = state.propertyOwners || [];
    propertyMortgaged = state.propertyMortgaged || [];
    propertyHouses = state.propertyHouses || [];
    currentTurn = state.currentTurn || 0;
}

export function setCurrentTrade(trade) {
    currentTrade = trade;
}

export function clearCurrentTrade() {
    currentTrade = null;
}

export function setCurrentAuction(data) {
    currentAuction = data;
}

export function clearCurrentAuction() {
    currentAuction = null;
}

// Notification System
export function showNotification(message, type = 'info', duration = 4000) {
    // Play notification sound
    if (type === 'success') {
        soundSystem.playSuccess();
    } else if (type === 'error') {
        soundSystem.playError();
    } else {
        soundSystem.playNotification();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icons[type] || icons.info}</span>
            <span class="notification-text">${message}</span>
        </div>
        <button class="notification-close">×</button>
    `;
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.onclick = () => removeNotification(notification);
    
    notificationContainer.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentNode) {
            removeNotification(notification);
        }
    }, duration);
    
    return notification;
}

function removeNotification(notification) {
    notification.style.animation = 'notificationFadeOut 0.3s ease-in forwards';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 300);
}

// Sound System
class SoundSystem {
    constructor() {
        this.audioContext = null;
        this.enabled = true;
        this.volume = 0.3;
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
            this.enabled = false;
        }
    }

    async ensureContext() {
        if (!this.enabled || !this.audioContext) return false;
        
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
            } catch (e) {
                console.warn('Could not resume audio context');
                return false;
            }
        }
        return true;
    }

    playTone(frequency, duration, type = 'sine') {
        if (!this.enabled || !this.ensureContext()) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playDiceRoll() {
        // Dice rolling sound effect
        this.playTone(220, 0.1, 'square');
        setTimeout(() => this.playTone(330, 0.1, 'square'), 100);
        setTimeout(() => this.playTone(440, 0.15, 'sine'), 200);
    }

    playSuccess() {
        // Success sound (ascending notes)
        this.playTone(523, 0.2, 'sine'); // C
        setTimeout(() => this.playTone(659, 0.2, 'sine'), 100); // E
        setTimeout(() => this.playTone(784, 0.3, 'sine'), 200); // G
    }

    playError() {
        // Error sound (descending notes)
        this.playTone(330, 0.3, 'sawtooth');
        setTimeout(() => this.playTone(220, 0.4, 'sawtooth'), 150);
    }

    playNotification() {
        // Notification sound
        this.playTone(800, 0.1, 'sine');
        setTimeout(() => this.playTone(1000, 0.1, 'sine'), 50);
    }

    playMove() {
        // Token move sound
        this.playTone(400, 0.1, 'triangle');
    }

    playPurchase() {
        // Property purchase sound
        this.playTone(600, 0.15, 'sine');
        setTimeout(() => this.playTone(800, 0.15, 'sine'), 75);
        setTimeout(() => this.playTone(1000, 0.2, 'sine'), 150);
    }

    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

export const soundSystem = new SoundSystem();

// Initialize audio context on first user interaction
document.addEventListener('click', () => {
    soundSystem.ensureContext();
}, { once: true });
