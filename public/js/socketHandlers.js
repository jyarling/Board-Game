export function registerGameEvents(s) {
    s.on('joined', id => {
        playerId = id;
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
    });

    s.on('notYourTurn', () => {
        rollBtn.disabled = true;
        buyBtn.disabled = true;
        payJailBtn.disabled = true;
        useCardBtn.disabled = true;
        endTurnBtn.disabled = true;
        tradeBtn.disabled = true;
    });

    s.on('state', state => {
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

    s.on('tradeStarted', trade => {
        currentTrade = trade;
        tradeStartDiv.style.display = 'none';
        tradeWindowDiv.style.display = 'block';
        tradeModal.style.display = 'flex';
        populateTradeWindow();
    });

    s.on('tradeUpdated', trade => {
        if (!currentTrade || currentTrade.id !== trade.id) return;
        currentTrade = trade;
        populateTradeWindow();
    });

    s.on('tradeEnded', () => {
        tradeModal.style.display = 'none';
        currentTrade = null;
    });

    s.on('auctionStarted', data => {
        currentAuction = data;
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
        currentAuction = null;
        setTimeout(() => { auctionModal.style.display = 'none'; }, 2000);
    });
