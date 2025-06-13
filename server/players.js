const state = require('./state');

function hasMonopoly(playerIdx, group) {
  const indices = state.PROPERTY_INFO.map((p, i) => ({...p, index: i}))
    .filter(p => p.group === group)
    .map(p => p.index);
  return indices.every(i => state.propertyOwners[i] === playerIdx);
}

function getMonopolyProperties(playerIdx, group) {
  return state.PROPERTY_INFO.map((p, i) => ({...p, index: i}))
    .filter(p => p.group === group && state.propertyOwners[p.index] === playerIdx)
    .map(p => p.index);
}

function canBuyHouse(propertyIndex, playerIdx) {
  const info = state.PROPERTY_INFO[propertyIndex];
  if (!info || !info.houseCost || !info.group) return { canBuy: false, reason: 'Not a buildable property' };
  
  if (state.propertyOwners[propertyIndex] !== playerIdx) {
    return { canBuy: false, reason: 'Not owned by player' };
  }
  
  if (state.propertyMortgaged[propertyIndex]) {
    return { canBuy: false, reason: 'Property is mortgaged' };
  }
  
  if (!hasMonopoly(playerIdx, info.group)) {
    return { canBuy: false, reason: 'Must own complete color group' };
  }
  
  const currentHouses = state.propertyHouses[propertyIndex] || 0;
  if (currentHouses >= 5) {
    return { canBuy: false, reason: 'Property already has hotel' };
  }
  
  // Check even building rule - can't build if this would create more than 1 house difference
  const monopolyProps = getMonopolyProperties(playerIdx, info.group);
  const houseCounts = monopolyProps.map(i => state.propertyHouses[i] || 0);
  const minHouses = Math.min(...houseCounts);
  
  if (currentHouses > minHouses) {
    return { canBuy: false, reason: 'Must build evenly across color group' };
  }
  
  // Check if player has enough money
  if (state.players[playerIdx].money < info.houseCost) {
    return { canBuy: false, reason: 'Insufficient funds' };
  }
  
  // Check house/hotel availability (simplified - assume 32 houses, 12 hotels available)
  const totalHouses = Object.values(state.propertyHouses).reduce((sum, h) => sum + (h === 5 ? 0 : h), 0);
  const totalHotels = Object.values(state.propertyHouses).reduce((sum, h) => sum + (h === 5 ? 1 : 0), 0);
  
  if (currentHouses === 4) {
    // Buying hotel
    if (totalHotels >= 12) {
      return { canBuy: false, reason: 'No hotels available' };
    }
  } else {
    // Buying house
    if (totalHouses >= 32) {
      return { canBuy: false, reason: 'No houses available' };
    }
  }
  
  return { canBuy: true };
}

function canSellHouse(propertyIndex, playerIdx) {
  const info = state.PROPERTY_INFO[propertyIndex];
  if (!info || !info.group) return { canSell: false, reason: 'Not a buildable property' };
  
  if (state.propertyOwners[propertyIndex] !== playerIdx) {
    return { canSell: false, reason: 'Not owned by player' };
  }
  
  const currentHouses = state.propertyHouses[propertyIndex] || 0;
  if (currentHouses <= 0) {
    return { canSell: false, reason: 'No buildings to sell' };
  }
  
  // Check even building rule - can't sell if this would create more than 1 house difference
  const monopolyProps = getMonopolyProperties(playerIdx, info.group);
  const houseCounts = monopolyProps.map(i => state.propertyHouses[i] || 0);
  const maxHouses = Math.max(...houseCounts);
  
  if (currentHouses < maxHouses) {
    return { canSell: false, reason: 'Must sell evenly across color group' };
  }
  
  return { canSell: true };
}

function eliminatePlayer(idx, io, log, startTurnTimer) {
  const [out] = state.players.splice(idx, 1);
  state.propertyOwners = state.propertyOwners.map(o => (o === idx ? null : o));
  state.propertyMortgaged = state.propertyMortgaged.map((m, i) => (state.propertyOwners[i] === null ? false : m));
  state.propertyHouses = state.propertyHouses.map((h, i) => (state.propertyOwners[i] === null ? 0 : h));
  state.propertyOwners = state.propertyOwners.map(o => (o !== null && o > idx ? o - 1 : o));
  log(`${out.name} was eliminated from the game.`);
  io.to(out.id).emit('spectator');
  io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });

  if (state.players.length === 1) {
    log(`${state.players[0].name} wins the game!`);
  }

  if (state.players.length === 0) {
    state.currentTurn = 0;
    state.propertyOwners = Array(state.BOARD_SIZE).fill(null);
    state.propertyMortgaged = Array(state.BOARD_SIZE).fill(false);
    state.propertyHouses = Array(state.BOARD_SIZE).fill(0);
    clearTimeout(state.turnTimer);
    return;
  }

  if (idx < state.currentTurn) {
    state.currentTurn--;
  }

  if (idx === state.currentTurn) {
    state.currentTurn = state.currentTurn % state.players.length;
    state.players[state.currentTurn].hasRolled = false;
    io.to(state.players[state.currentTurn].id).emit('yourTurn');
    state.players.forEach(p => {
      if (p.id !== state.players[state.currentTurn].id) {
        io.to(p.id).emit('notYourTurn');
      }
    });
    if (typeof startTurnTimer === 'function') startTurnTimer();
  }
}

function changeMoney(idx, amount, io, log) {
  const player = state.players[idx];
  if (!player) return;
  player.money += amount;
  const action = amount >= 0 ? 'received' : 'paid';
  log(`${player.name} ${action} $${Math.abs(amount)}.`, idx);
}

function payEachPlayer(idx, amount) {
  state.players.forEach((p, i) => {
    if (i !== idx) {
      p.money += amount;
      state.players[idx].money -= amount;
    }
  });
}

function collectFromAll(idx, amount) {
  state.players.forEach((p, i) => {
    if (i !== idx) {
      p.money -= amount;
      state.players[idx].money += amount;
    }
  });
}

function payRepairs(idx, houseCost, hotelCost) {
  let cost = 0;
  state.players[idx].properties.forEach(i => {
    const houses = state.propertyHouses[i];
    if (houses === 5) {
      cost += hotelCost;
    } else {
      cost += houses * houseCost;
    }
  });
  if (cost > 0) state.players[idx].money -= cost;
}

module.exports = {
  hasMonopoly,
  getMonopolyProperties,
  canBuyHouse,
  canSellHouse,
  eliminatePlayer,
  changeMoney,
  payEachPlayer,
  collectFromAll,
  payRepairs
};
