const state = require('./state');
const players = require('./players');
const board = require('./board');
const auction = require('./auction');

module.exports = function(io) {
  const TURN_TIMEOUT_MS = 30000;
  const COLORS = ['red', 'blue', 'green', 'yellow'];

  function log(message, playerIdx) {
    if (playerIdx != null) {
      io.emit('message', { text: message, color: COLORS[playerIdx] });
    } else {
      io.emit('message', { text: message });
    }
  }

  board.init(io, log);

  function startTurnTimer() {
    clearTimeout(state.turnTimer);
    state.turnTimer = setTimeout(handleTurnTimeout, TURN_TIMEOUT_MS);
  }

  function handleTurnTimeout() {
    const player = state.players[state.currentTurn];
    if (!player) return;
    if (!player.hasRolled) {
      const roll1 = Math.floor(Math.random() * 6) + 1;
      const roll2 = Math.floor(Math.random() * 6) + 1;
      const total = roll1 + roll2;
      log(`${player.name} auto-rolled ${roll1} and ${roll2} (total ${total})`, state.currentTurn);
      board.movePlayerRelative(state.currentTurn, total, io, log);
    }
    const pos = player.position;
    if (!state.currentAuction && state.PROPERTY_INFO[pos].price && state.propertyOwners[pos] == null) {
      auction.startAuction(pos, io, log, endCurrentTurn);
    } else {
      endCurrentTurn();
    }
  }

  function endCurrentTurn() {
    if (state.players.length === 0) return;
    let idx = state.currentTurn;
    if (state.players[idx].money <= 0) {
      players.eliminatePlayer(idx, io, log, startTurnTimer);
      if (state.players.length === 0) return;
      if (idx >= state.players.length) idx = 0;
    }
    state.currentTurn = (idx + 1) % state.players.length;
    state.players[state.currentTurn].hasRolled = false;
    io.to(state.players[state.currentTurn].id).emit('yourTurn');
    state.players.forEach(p => {
      if (p.id !== state.players[state.currentTurn].id) {
        io.to(p.id).emit('notYourTurn');
      }
    });
    io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
    startTurnTimer();
  }

  io.on('connection', socket => {
    socket.on('joinGame', name => {
      if (state.players.length >= 4) {
        socket.emit('message', 'Game is full');
        return;
      }
      const player = {
        id: socket.id,
        name,
        position: 0,
        money: 1500,
        properties: [],
        hasRolled: false,
        inJail: false,
        jailTurns: 0,
        items: { getOutOfJail: 0 },
        lastRoll: 0
      };
      state.players.push(player);
      socket.emit('joined', socket.id);
      log(`${name} joined the game.`);
      io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
      if (state.players.length === 1) {
        io.to(state.players[0].id).emit('yourTurn');
        startTurnTimer();
      } else {
        socket.emit('notYourTurn');
      }
    });

    socket.on('chat', text => {
      const player = state.players.find(p => p.id === socket.id);
      if (!player) return;
      io.emit('chat', `${player.name}: ${text}`);
    });

    socket.on('rollDice', () => {
      const player = state.players[state.currentTurn];
      if (!player || player.id !== socket.id) {
        socket.emit('notYourTurn');
        return;
      }
      if (player.hasRolled) return;
      player.hasRolled = true;

      const roll1 = Math.floor(Math.random() * 6) + 1;
      const roll2 = Math.floor(Math.random() * 6) + 1;
      const total = roll1 + roll2;
      player.lastRoll = total;
      log(`${player.name} rolled ${roll1} and ${roll2} (total ${total})`, state.currentTurn);

      if (player.inJail) {
        if (roll1 === roll2) {
          player.inJail = false;
          player.jailTurns = 0;
          log(`${player.name} rolled doubles and got out of jail!`, state.currentTurn);
          board.movePlayerRelative(state.currentTurn, total, io, log);
        } else {
          player.jailTurns++;
          log(`${player.name} failed to roll doubles in jail (${player.jailTurns}/3).`, state.currentTurn);
          if (player.jailTurns >= 3) {
            players.changeMoney(state.currentTurn, -50, io, log);
            player.inJail = false;
            player.jailTurns = 0;
            board.movePlayerRelative(state.currentTurn, total, io, log);
          }
        }
        io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
        startTurnTimer();
        return;
      }

      board.movePlayerRelative(state.currentTurn, total, io, log);

      if (roll1 === roll2) {
        player.hasRolled = false;
        io.to(player.id).emit('yourTurn');
        state.players.forEach(p => { if (p.id !== player.id) io.to(p.id).emit('notYourTurn'); });
        startTurnTimer();
        return;
      }
      startTurnTimer();
    });

    socket.on('buyProperty', index => {
      const player = state.players.find(p => p.id === socket.id);
      if (!player) return;
      const info = state.PROPERTY_INFO[index];
      if (!info || !info.price || state.propertyOwners[index] != null) return;
      if (player.money < info.price) return;
      player.money -= info.price;
      player.properties.push(index);
      state.propertyOwners[index] = state.players.indexOf(player);
      state.propertyMortgaged[index] = false;
      state.propertyHouses[index] = 0;
      log(`${player.name} bought ${state.SPACE_NAMES[index]} for $${info.price}.`, state.players.indexOf(player));
      io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
      startTurnTimer();
    });

    socket.on('mortgageProperty', index => {
      const playerIdx = state.players.findIndex(p => p.id === socket.id);
      if (playerIdx === -1) return;
      if (state.propertyOwners[index] !== playerIdx) return;
      if (state.propertyMortgaged[index]) {
        const cost = Math.floor(state.PROPERTY_INFO[index].price / 2 * 1.1);
        if (state.players[playerIdx].money < cost) return;
        state.players[playerIdx].money -= cost;
        state.propertyMortgaged[index] = false;
      } else {
        state.players[playerIdx].money += Math.floor(state.PROPERTY_INFO[index].price / 2);
        state.propertyMortgaged[index] = true;
      }
      io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
    });

    socket.on('buyHouse', index => {
      const playerIdx = state.players.findIndex(p => p.id === socket.id);
      if (playerIdx === -1) return;
      if (state.propertyOwners[index] !== playerIdx) return;
      const info = state.PROPERTY_INFO[index];
      if (!info.houseCost || state.propertyMortgaged[index]) return;
      if (!players.hasMonopoly(playerIdx, info.group)) return;
      if (state.propertyHouses[index] >= 5) return;
      if (state.players[playerIdx].money < info.houseCost) return;
      state.players[playerIdx].money -= info.houseCost;
      state.propertyHouses[index] += 1;
      io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
    });

    socket.on('sellHouse', index => {
      const playerIdx = state.players.findIndex(p => p.id === socket.id);
      if (playerIdx === -1) return;
      if (state.propertyOwners[index] !== playerIdx) return;
      if (state.propertyHouses[index] <= 0) return;
      const info = state.PROPERTY_INFO[index];
      state.propertyHouses[index] -= 1;
      state.players[playerIdx].money += Math.floor(info.houseCost / 2);
      io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
    });

    socket.on('payJail', () => {
      const playerIdx = state.players.findIndex(p => p.id === socket.id);
      if (playerIdx === -1) return;
      const player = state.players[playerIdx];
      if (!player.inJail || player.money < 50) return;
      player.money -= 50;
      player.inJail = false;
      player.jailTurns = 0;
      io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
    });

    socket.on('useJailCard', () => {
      const playerIdx = state.players.findIndex(p => p.id === socket.id);
      if (playerIdx === -1) return;
      const player = state.players[playerIdx];
      if (!player.inJail || player.items.getOutOfJail <= 0) return;
      player.items.getOutOfJail -= 1;
      player.inJail = false;
      player.jailTurns = 0;
      io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
    });

    socket.on('initiateTrade', targetIdx => {
      const playerIdx = state.players.findIndex(p => p.id === socket.id);
      if (playerIdx === -1 || playerIdx !== state.currentTurn) return;
      if (targetIdx < 0 || targetIdx >= state.players.length || targetIdx === playerIdx) return;
      const trade = {
        id: Date.now() + Math.random(),
        playerA: playerIdx,
        playerB: targetIdx,
        offerA: { money: 0, properties: [], cards: 0 },
        offerB: { money: 0, properties: [], cards: 0 },
        acceptedA: false,
        acceptedB: false
      };
      state.trades.push(trade);
      io.to(state.players[playerIdx].id).emit('tradeStarted', trade);
      io.to(state.players[targetIdx].id).emit('tradeStarted', trade);
    });

    socket.on('updateTrade', data => {
      const trade = state.trades.find(t => t.id === data.id);
      if (!trade) return;
      const idx = state.players.findIndex(p => p.id === socket.id);
      if (idx === trade.playerA) {
        trade.offerA = data.offer;
        trade.acceptedA = false;
        trade.acceptedB = false;
      } else if (idx === trade.playerB) {
        trade.offerB = data.offer;
        trade.acceptedA = false;
        trade.acceptedB = false;
      } else return;
      io.to(state.players[trade.playerA].id).emit('tradeUpdated', trade);
      io.to(state.players[trade.playerB].id).emit('tradeUpdated', trade);
    });

    socket.on('acceptTrade', id => {
      const trade = state.trades.find(t => t.id === id);
      if (!trade) return;
      const idx = state.players.findIndex(p => p.id === socket.id);
      if (idx === trade.playerA) trade.acceptedA = true;
      else if (idx === trade.playerB) trade.acceptedB = true;
      io.to(state.players[trade.playerA].id).emit('tradeUpdated', trade);
      io.to(state.players[trade.playerB].id).emit('tradeUpdated', trade);
      if (trade.acceptedA && trade.acceptedB) {
        finalizeTrade(trade);
        state.trades = state.trades.filter(t => t.id !== id);
        io.to(state.players[trade.playerA].id).emit('tradeEnded');
        io.to(state.players[trade.playerB].id).emit('tradeEnded');
      }
    });

    socket.on('cancelTrade', id => {
      const trade = state.trades.find(t => t.id === id);
      if (!trade) return;
      state.trades = state.trades.filter(t => t.id !== id);
      io.to(state.players[trade.playerA].id).emit('tradeEnded');
      io.to(state.players[trade.playerB].id).emit('tradeEnded');
    });

    socket.on('placeBid', () => {
      const idx = state.players.findIndex(p => p.id === socket.id);
      if (idx === -1) return;
      auction.placeBid(idx, io);
    });

    socket.on('endTurn', () => {
      const player = state.players[state.currentTurn];
      if (!player || player.id !== socket.id) {
        socket.emit('notYourTurn');
        return;
      }
      const pos = player.position;
      if (!state.currentAuction && state.PROPERTY_INFO[pos].price && state.propertyOwners[pos] == null) {
        auction.startAuction(pos, io, log, endCurrentTurn);
      } else {
        endCurrentTurn();
      }
    });

    socket.on('disconnect', () => {
      const idx = state.players.findIndex(p => p.id === socket.id);
      if (idx === -1) return;

      const [leaving] = state.players.splice(idx, 1);
      state.propertyOwners = state.propertyOwners.map(o => (o === idx ? null : o));
      state.propertyMortgaged = state.propertyMortgaged.map((m, i) => (state.propertyOwners[i] === null ? false : m));
      state.propertyHouses = state.propertyHouses.map((h, i) => (state.propertyOwners[i] === null ? 0 : h));
      state.propertyOwners = state.propertyOwners.map(o => (o !== null && o > idx ? o - 1 : o));
      log(`${leaving.name} left the game.`);
      io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });

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
        startTurnTimer();
      }
    });
  });

  function finalizeTrade(trade) {
    const a = state.players[trade.playerA];
    const b = state.players[trade.playerB];
    if (!a || !b) return;
    if (a.money < trade.offerA.money || b.money < trade.offerB.money) return;
    if (trade.offerA.properties.some(i => state.propertyOwners[i] !== trade.playerA || state.propertyMortgaged[i])) return;
    if (trade.offerB.properties.some(i => state.propertyOwners[i] !== trade.playerB || state.propertyMortgaged[i])) return;
    if (a.items.getOutOfJail < trade.offerA.cards || b.items.getOutOfJail < trade.offerB.cards) return;

    a.money -= trade.offerA.money;
    b.money += trade.offerA.money;
    b.money -= trade.offerB.money;
    a.money += trade.offerB.money;

    trade.offerA.properties.forEach(i => {
      state.propertyOwners[i] = trade.playerB;
      a.properties = a.properties.filter(p => p !== i);
      b.properties.push(i);
    });
    trade.offerB.properties.forEach(i => {
      state.propertyOwners[i] = trade.playerA;
      b.properties = b.properties.filter(p => p !== i);
      a.properties.push(i);
    });

    a.items.getOutOfJail -= trade.offerA.cards;
    b.items.getOutOfJail += trade.offerA.cards;
    b.items.getOutOfJail -= trade.offerB.cards;
    a.items.getOutOfJail += trade.offerB.cards;

    log(`${a.name} traded with ${b.name}.`);
    io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
  }
};
