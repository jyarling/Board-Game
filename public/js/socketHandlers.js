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
    applyState,
    setCurrentTrade,
    clearCurrentTrade,
    setCurrentAuction,
    clearCurrentAuction
} from './index.js';

export function registerGameEvents(s) {
    s.on('joined', id => {
        setPlayerId(id);
        joinDiv.style.display = 'none';
        gameDiv.style.display = 'block';
        if (boardCoords.length === 0) {
            buildBoard();
            renderOwnership();
        }
    });

    s.on('message', msg => {
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

    s.on('chat', msg => {
        const p = document.createElement('div');
        p.textContent = msg;
        chatMessages.appendChild(p);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    s.on('yourTurn', () => {
        rollBtn.disabled = false;
        endTurnBtn.disabled = false;
        tradeBtn.disabled = false;
        updateJailButtons();
        updateBuyButton();
        if (turnIndicator) {
            turnIndicator.textContent = 'Your Turn!';
            turnIndicator.classList.add('active');
        }
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
    });

    s.on('tradeUpdated', trade => {
        if (!currentTrade || currentTrade.id !== trade.id) return;
        setCurrentTrade(trade);
        populateTradeWindow();
    });

    s.on('tradeEnded', () => {
        tradeModal.style.display = 'none';
        clearCurrentTrade();
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
