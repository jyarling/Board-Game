const state = require('./state');

function startAuction(index, io, log, cb) {
  if (state.currentAuction || state.PROPERTY_INFO[index].price <= 0) { if (cb) cb(); return; }
  const price = state.PROPERTY_INFO[index].price;
  const increment = Math.ceil(price * 0.1);
  const startBid = Math.ceil(price * 0.5);
  state.currentAuction = {
    property: index,
    increment,
    startBid,
    currentBid: startBid,
    highestBidder: null,
    timeRemaining: 5,
    interval: null,
    endCallback: cb
  };
  io.emit('auctionStarted', { index, startBid, increment, timeRemaining: 5 });
  state.currentAuction.interval = setInterval(() => {
    state.currentAuction.timeRemaining -= 1;
    if (state.currentAuction.timeRemaining <= 0) {
      endAuction(io, log);
    } else {
      io.emit('auctionUpdate', {
        currentBid: state.currentAuction.currentBid,
        highestBidder: state.currentAuction.highestBidder != null ? state.players[state.currentAuction.highestBidder].name : null,
        timeRemaining: state.currentAuction.timeRemaining
      });
    }
  }, 1000);
}

function placeBid(playerIdx, io) {
  if (!state.currentAuction) return;
  const bid = state.currentAuction.currentBid === state.currentAuction.startBid && state.currentAuction.highestBidder == null
    ? state.currentAuction.startBid
    : state.currentAuction.currentBid + state.currentAuction.increment;
  if (state.players[playerIdx].money < bid) return;
  state.currentAuction.currentBid = bid;
  state.currentAuction.highestBidder = playerIdx;
  state.currentAuction.timeRemaining = 5;
  io.emit('auctionUpdate', {
    currentBid: state.currentAuction.currentBid,
    highestBidder: state.players[playerIdx].name,
    timeRemaining: state.currentAuction.timeRemaining
  });
}

function endAuction(io, log) {
  if (!state.currentAuction) return;
  clearInterval(state.currentAuction.interval);
  let winner = null;
  if (state.currentAuction.highestBidder != null) {
    const idx = state.currentAuction.highestBidder;
    winner = state.players[idx];
    winner.money -= state.currentAuction.currentBid;
    winner.properties.push(state.currentAuction.property);
    state.propertyOwners[state.currentAuction.property] = idx;
    state.propertyMortgaged[state.currentAuction.property] = false;
    state.propertyHouses[state.currentAuction.property] = 0;
    log(`${winner.name} won the auction for ${state.SPACE_NAMES[state.currentAuction.property]} at $${state.currentAuction.currentBid}.`, idx);
  } else {
    log(`No one bid on ${state.SPACE_NAMES[state.currentAuction.property]}.`);
  }
  io.emit('auctionEnded', {
    winner: winner ? winner.name : null,
    finalBid: state.currentAuction.currentBid,
    property: state.currentAuction.property
  });
  io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
  const cb = state.currentAuction.endCallback;
  state.currentAuction = null;
  if (cb) cb();
}

module.exports = { startAuction, placeBid, endAuction };
