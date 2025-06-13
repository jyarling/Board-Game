import {
    turnIndicator,
    joinDiv,
    gameDiv,
    logDiv,
    chatMessages,
    rollBtn,
    buyBtn,
    tradeBtn,
    endTurnBtn,
    payJailBtn,
    useCardBtn,
    tradeStartDiv,
    tradeWindowDiv,
    tradeModal,
    auctionTitle,
    auctionBidSpan,
    auctionBidderSpan,
    auctionCountdown,
    auctionBidBtn,
    auctionCloseBtn,
    auctionModal
} from './dom.js';

import {
    boardCoords,
    spaces,
    buildBoard,
    renderTokens,
    renderOwnership,
    renderStats,
    updateJailButtons,
    updateBuyButton,
    populateTradeWindow,
    currentTrade,
    currentAuction,
    setPlayerId,
    setIsHost,
    hideStartButton,
    applyState,
    setCurrentTrade,
    clearCurrentTrade,
    setCurrentAuction,
    clearCurrentAuction,
    animateDiceRoll,
    showNotification
} from './index.js';

export function registerGameEvents(s) {
    s.on('joined', data => {
        setPlayerId(data.id);
        setIsHost(data.isHost);
        joinDiv.style.display = 'none';
        gameDiv.style.display = 'block';
        if (boardCoords.length === 0) {
            buildBoard();
            renderOwnership();
        }
    });

    s.on('gameStarted', () => {
        hideStartButton();
        showNotification('Game Started! 🎮', 'success', 3000);
    });

    s.on('message', msg => {
        const p = document.createElement('p');
        let text = '';
        if (typeof msg === 'object') {
            text = msg.text;
            p.textContent = text;
            if (msg.color) p.style.color = msg.color;
        } else {
            text = msg;
            p.textContent = text;
        }
        
        // Check if this is a dice roll message and animate dice
        const rollMatch = text.match(/rolled (\d+) and (\d+)/);
        if (rollMatch) {
            const die1 = parseInt(rollMatch[1]);
            const die2 = parseInt(rollMatch[2]);
            animateDiceRoll(die1, die2);
            // Only enable end turn button if it's your turn (check if roll button is enabled)
            if (!rollBtn.disabled) {
                endTurnBtn.disabled = false;
            }
        }
        
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight;
    });

    s.on('chat', msg => {
        const p = document.createElement('div');
        p.className = 'chat-message';
        p.textContent = msg;
        chatMessages.appendChild(p);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    s.on('yourTurn', () => {
        rollBtn.disabled = false;
        endTurnBtn.disabled = true; // Only enable after dice roll
        tradeBtn.disabled = false;
        updateJailButtons();
        updateBuyButton();
        if (turnIndicator) {
            turnIndicator.textContent = 'Your Turn!';
            turnIndicator.classList.add('active');
        }
        showNotification('It\'s your turn! 🎲', 'info', 3000);
    });

    s.on('notYourTurn', () => {
        rollBtn.disabled = true;
        buyBtn.disabled = true;
        payJailBtn.disabled = true;
        useCardBtn.disabled = true;
        endTurnBtn.disabled = true;
        tradeBtn.disabled = true;
        if (turnIndicator) {
            turnIndicator.textContent = 'Waiting...';
            turnIndicator.classList.remove('active');
        }
    });

    s.on('state', state => {
        applyState(state);
        if (boardCoords.length === 0) {
            buildBoard();
        }
        renderTokens();
        renderOwnership();
        renderStats();
        updateJailButtons();
        updateBuyButton();
    });

    s.on('tradeStarted', trade => {
        setCurrentTrade(trade);
        tradeStartDiv.style.display = 'none';
        tradeWindowDiv.style.display = 'block';
        tradeModal.style.display = 'flex';
        populateTradeWindow();
        showNotification('Trade started! 🤝', 'info', 3000);
    });

    s.on('tradeUpdated', trade => {
        if (!currentTrade || currentTrade.id !== trade.id) return;
        setCurrentTrade(trade);
        populateTradeWindow();
    });

    s.on('tradeEnded', (data) => {
        tradeModal.style.display = 'none';
        clearCurrentTrade();
        if (data && data.cancelled) {
            showNotification('Trade cancelled! ❌', 'warning', 3000);
        } else {
            showNotification('Trade completed! 📋', 'success', 3000);
        }
    });

    s.on('auctionStarted', data => {
        setCurrentAuction(data);
        auctionTitle.textContent = `Auction: ${spaces[data.index].name}`;
        auctionBidSpan.textContent = data.startBid;
        auctionBidderSpan.textContent = '';
        auctionCountdown.textContent = data.timeRemaining;
        auctionBidBtn.textContent = `Bid +$${data.increment}`;
        auctionBidBtn.disabled = false;
        auctionCloseBtn.style.display = 'none';
        auctionModal.style.display = 'flex';
        showNotification(`Auction started for ${spaces[data.index].name}! 🏛️`, 'warning', 4000);
    });

    s.on('auctionUpdate', data => {
        if (!currentAuction) return;
        auctionBidSpan.textContent = data.currentBid;
        auctionBidderSpan.textContent = data.highestBidder || '';
        auctionCountdown.textContent = data.timeRemaining;
    });

    s.on('auctionEnded', data => {
        if (!currentAuction) return;
        auctionBidSpan.textContent = data.finalBid;
        auctionBidderSpan.textContent = data.winner || 'No bids';
        auctionCountdown.textContent = 0;
        auctionBidBtn.disabled = true;
        auctionCloseBtn.style.display = 'block';
        clearCurrentAuction();
        setTimeout(() => { auctionModal.style.display = 'none'; }, 2000);
    });

    // end of registerGameEvents
}
