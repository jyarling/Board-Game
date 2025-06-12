const state = require('./state');

function hasMonopoly(playerIdx, group) {
  const indices = state.PROPERTY_INFO.map((p, i) => ({...p, index: i}))
    .filter(p => p.group === group)
    .map(p => p.index);
  return indices.every(i => state.propertyOwners[i] === playerIdx);
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
  eliminatePlayer,
  changeMoney,
  payEachPlayer,
  collectFromAll,
  payRepairs
};
