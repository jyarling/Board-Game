const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const BOARD_SIZE = 40; // spaces around the board
const PROPERTY_INFO = [
  { price: 0 },
  { price: 60, group: 'brown', houseCost: 50 },
  { price: 0 },
  { price: 60, group: 'brown', houseCost: 50 },
  { price: 0 },
  { price: 200 },
  { price: 100, group: 'lightblue', houseCost: 50 },
  { price: 0 },
  { price: 100, group: 'lightblue', houseCost: 50 },
  { price: 120, group: 'lightblue', houseCost: 50 },
  { price: 0 },
  { price: 140, group: 'pink', houseCost: 100 },
  { price: 150 },
  { price: 140, group: 'pink', houseCost: 100 },
  { price: 160, group: 'pink', houseCost: 100 },
  { price: 200 },
  { price: 180, group: 'orange', houseCost: 100 },
  { price: 0 },
  { price: 180, group: 'orange', houseCost: 100 },
  { price: 200, group: 'orange', houseCost: 100 },
  { price: 0 },
  { price: 220, group: 'red', houseCost: 150 },
  { price: 0 },
  { price: 220, group: 'red', houseCost: 150 },
  { price: 240, group: 'red', houseCost: 150 },
  { price: 200 },
  { price: 260, group: 'yellow', houseCost: 150 },
  { price: 260, group: 'yellow', houseCost: 150 },
  { price: 150 },
  { price: 280, group: 'yellow', houseCost: 150 },
  { price: 0 },
  { price: 300, group: 'green', houseCost: 200 },
  { price: 300, group: 'green', houseCost: 200 },
  { price: 0 },
  { price: 320, group: 'green', houseCost: 200 },
  { price: 200 },
  { price: 0 },
  { price: 350, group: 'blue', houseCost: 200 },
  { price: 0 },
  { price: 400, group: 'blue', houseCost: 200 }
].map(info => ({ ...info, rent: info.price ? Math.ceil(info.price / 10) : 0 }));
const SPACE_NAMES = [
  'Go',
  'Mediterranean Ave',
  'Community Chest',
  'Baltic Ave',
  'Income Tax',
  'Reading RR',
  'Oriental Ave',
  'Chance',
  'Vermont Ave',
  'Connecticut Ave',
  'Jail',
  'St. Charles Pl',
  'Electric Co',
  'States Ave',
  'Virginia Ave',
  'Pennsylvania RR',
  'St. James Pl',
  'Community Chest',
  'Tennessee Ave',
  'New York Ave',
  'Free Parking',
  'Kentucky Ave',
  'Chance',
  'Indiana Ave',
  'Illinois Ave',
  'B&O RR',
  'Atlantic Ave',
  'Ventnor Ave',
  'Water Works',
  'Marvin Gardens',
  'Go To Jail',
  'Pacific Ave',
  'North Carolina Ave',
  'Community Chest',
  'Pennsylvania Ave',
  'Short Line',
  'Chance',
  'Park Place',
  'Luxury Tax',
  'Boardwalk'
];
let propertyOwners = Array(BOARD_SIZE).fill(null);
let propertyMortgaged = Array(BOARD_SIZE).fill(false);
let propertyHouses = Array(BOARD_SIZE).fill(0); // 0-4 houses, 5=hotel
let players = [];
let currentTurn = 0;
const TURN_TIMEOUT_MS = 30000;
let turnTimer = null;
const COLORS = ['red', 'blue', 'green', 'yellow'];
let trades = [];
let currentAuction = null;

function hasMonopoly(playerIdx, group) {
  const indices = PROPERTY_INFO.map((p, i) => ({...p, index: i}))
    .filter(p => p.group === group)
    .map(p => p.index);
  return indices.every(i => propertyOwners[i] === playerIdx);
}

function eliminatePlayer(idx) {
  const [out] = players.splice(idx, 1);
  propertyOwners = propertyOwners.map(o => (o === idx ? null : o));
  propertyMortgaged = propertyMortgaged.map((m, i) => (propertyOwners[i] === null ? false : m));
  propertyHouses = propertyHouses.map((h, i) => (propertyOwners[i] === null ? 0 : h));
  propertyOwners = propertyOwners.map(o => (o !== null && o > idx ? o - 1 : o));
  log(`${out.name} was eliminated from the game.`);
  io.to(out.id).emit('spectator');
  io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });

  if (players.length === 1) {
    log(`${players[0].name} wins the game!`);
  }

  if (players.length === 0) {
    currentTurn = 0;
    propertyOwners = Array(BOARD_SIZE).fill(null);
    propertyMortgaged = Array(BOARD_SIZE).fill(false);
    propertyHouses = Array(BOARD_SIZE).fill(0);
    clearTimeout(turnTimer);
    return;
  }

  if (idx < currentTurn) {
    currentTurn--;
  }

  if (idx === currentTurn) {
    currentTurn = currentTurn % players.length;
    players[currentTurn].hasRolled = false;
    io.to(players[currentTurn].id).emit('yourTurn');
    players.forEach(p => {
      if (p.id !== players[currentTurn].id) {
        io.to(p.id).emit('notYourTurn');
      }
    });
    startTurnTimer();
  }
}

function log(message, playerIdx) {
  if (playerIdx != null) {
    io.emit('message', { text: message, color: COLORS[playerIdx] });
  } else {
    io.emit('message', { text: message });
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let chanceDeck = [];
let chestDeck = [];

function initDecks() {
  chanceDeck = shuffle([
    { text: 'Advance to Go (Collect $200)', action: i => movePlayer(i, 0, true) },
    { text: 'Advance to Illinois Ave', action: i => movePlayer(i, 24) },
    { text: 'Advance to St. Charles Place', action: i => movePlayer(i, 11) },
    { text: 'Advance token to nearest Utility', action: i => moveToNearest(i, [12,28], false) },
    { text: 'Advance token to nearest Railroad', action: i => moveToNearest(i, [5,15,25,35], true) },
    { text: 'Bank pays you dividend of $50', action: i => changeMoney(i, 50) },
    { text: 'Get Out of Jail Free', action: i => { players[i].items.getOutOfJail++; } },
    { text: 'Go Back 3 Spaces', action: i => movePlayerRelative(i, -3) },
    { text: 'Go to Jail', action: i => sendToJail(players[i]) },
    { text: 'Make general repairs on all your property', action: i => {} },
    { text: 'Pay poor tax of $15', action: i => changeMoney(i, -15) },
    { text: 'Take a trip to Reading Railroad', action: i => movePlayer(i, 5, true) },
    { text: 'Take a walk on the Boardwalk', action: i => movePlayer(i, 39) },
    { text: 'You have been elected Chairman of the Board – Pay each player $50', action: i => payEachPlayer(i, 50) },
    { text: 'Your building loan matures – Collect $150', action: i => changeMoney(i, 150) },
    { text: 'You have won a crossword competition – Collect $100', action: i => changeMoney(i, 100) },
  ]);
  chestDeck = shuffle([
    { text: 'Advance to Go (Collect $200)', action: i => movePlayer(i, 0, true) },
    { text: 'Bank error in your favor – Collect $200', action: i => changeMoney(i, 200) },
    { text: 'Doctor\'s fees – Pay $50', action: i => changeMoney(i, -50) },
    { text: 'From sale of stock you get $50', action: i => changeMoney(i, 50) },
    { text: 'Get Out of Jail Free', action: i => { players[i].items.getOutOfJail++; } },
    { text: 'Go to Jail – Go directly to jail', action: i => sendToJail(players[i]) },
    { text: 'Grand Opera Night – Collect $50 from every player', action: i => collectFromAll(i, 50) },
    { text: 'Holiday Fund matures – Receive $100', action: i => changeMoney(i, 100) },
    { text: 'Income tax refund – Collect $20', action: i => changeMoney(i, 20) },
    { text: 'It is your birthday – Collect $10 from every player', action: i => collectFromAll(i, 10) },
    { text: 'Life insurance matures – Collect $100', action: i => changeMoney(i, 100) },
    { text: 'Pay hospital fees of $100', action: i => changeMoney(i, -100) },
    { text: 'Pay school fees of $150', action: i => changeMoney(i, -150) },
    { text: 'Receive $25 consultancy fee', action: i => changeMoney(i, 25) },
    { text: 'You are assessed for street repairs – $40 per house', action: i => {} },
    { text: 'You have won second prize in a beauty contest – Collect $10', action: i => changeMoney(i, 10) },
    { text: 'You inherit $100', action: i => changeMoney(i, 100) },
  ]);
}

initDecks();

function changeMoney(idx, amount) {
  const player = players[idx];
  if (!player) return;
  player.money += amount;
  const action = amount >= 0 ? 'received' : 'paid';
  log(`${player.name} ${action} $${Math.abs(amount)}.`, idx);
}

function payEachPlayer(idx, amount) {
  players.forEach((p, i) => {
    if (i !== idx) {
      p.money += amount;
      players[idx].money -= amount;
    }
  });
  log(`${players[idx].name} paid each player $${amount}.`, idx);
}

function collectFromAll(idx, amount) {
  players.forEach((p, i) => {
    if (i !== idx) {
      p.money -= amount;
      players[idx].money += amount;
    }
  });
  log(`${players[idx].name} collected $${amount} from every player.`, idx);
}

function finalizeTrade(trade) {
  const a = players[trade.playerA];
  const b = players[trade.playerB];
  if (!a || !b) return;
  if (a.money < trade.offerA.money || b.money < trade.offerB.money) return;
  if (trade.offerA.properties.some(i => propertyOwners[i] !== trade.playerA || propertyMortgaged[i])) return;
  if (trade.offerB.properties.some(i => propertyOwners[i] !== trade.playerB || propertyMortgaged[i])) return;
  if (a.items.getOutOfJail < trade.offerA.cards || b.items.getOutOfJail < trade.offerB.cards) return;

  a.money -= trade.offerA.money;
  b.money += trade.offerA.money;
  b.money -= trade.offerB.money;
  a.money += trade.offerB.money;

  trade.offerA.properties.forEach(i => {
    propertyOwners[i] = trade.playerB;
    a.properties = a.properties.filter(p => p !== i);
    b.properties.push(i);
  });
  trade.offerB.properties.forEach(i => {
    propertyOwners[i] = trade.playerA;
    b.properties = b.properties.filter(p => p !== i);
    a.properties.push(i);
  });

  a.items.getOutOfJail -= trade.offerA.cards;
  b.items.getOutOfJail += trade.offerA.cards;
  b.items.getOutOfJail -= trade.offerB.cards;
  a.items.getOutOfJail += trade.offerB.cards;

  log(`${a.name} traded with ${b.name}.`);
  io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
}

function startAuction(index, cb) {
  if (currentAuction || PROPERTY_INFO[index].price <= 0) { if (cb) cb(); return; }
  const price = PROPERTY_INFO[index].price;
  const increment = Math.ceil(price * 0.1);
  const startBid = Math.ceil(price * 0.5);
  currentAuction = {
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
  currentAuction.interval = setInterval(() => {
    currentAuction.timeRemaining -= 1;
    if (currentAuction.timeRemaining <= 0) {
      endAuction();
    } else {
      io.emit('auctionUpdate', {
        currentBid: currentAuction.currentBid,
        highestBidder: currentAuction.highestBidder != null ? players[currentAuction.highestBidder].name : null,
        timeRemaining: currentAuction.timeRemaining
      });
    }
  }, 1000);
}

function placeBid(playerIdx) {
  if (!currentAuction) return;
  const bid = currentAuction.currentBid === currentAuction.startBid && currentAuction.highestBidder == null
    ? currentAuction.startBid
    : currentAuction.currentBid + currentAuction.increment;
  if (players[playerIdx].money < bid) return;
  currentAuction.currentBid = bid;
  currentAuction.highestBidder = playerIdx;
  currentAuction.timeRemaining = 5;
  io.emit('auctionUpdate', {
    currentBid: currentAuction.currentBid,
    highestBidder: players[playerIdx].name,
    timeRemaining: currentAuction.timeRemaining
  });
}

function endAuction() {
  if (!currentAuction) return;
  clearInterval(currentAuction.interval);
  let winner = null;
  if (currentAuction.highestBidder != null) {
    const idx = currentAuction.highestBidder;
    winner = players[idx];
    winner.money -= currentAuction.currentBid;
    winner.properties.push(currentAuction.property);
    propertyOwners[currentAuction.property] = idx;
    propertyMortgaged[currentAuction.property] = false;
    propertyHouses[currentAuction.property] = 0;
    log(`${winner.name} won the auction for ${SPACE_NAMES[currentAuction.property]} at $${currentAuction.currentBid}.`, idx);
  } else {
    log(`No one bid on ${SPACE_NAMES[currentAuction.property]}.`);
  }
  io.emit('auctionEnded', {
    winner: winner ? winner.name : null,
    finalBid: currentAuction.currentBid,
    property: currentAuction.property
  });
  io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
  const cb = currentAuction.endCallback;
  currentAuction = null;
  if (cb) cb();
}

function movePlayer(idx, target, passGo = false) {
  const player = players[idx];
  if (!player) return;
  const old = player.position;
  if (passGo && target < old) {
    player.money += 200;
    log(`${player.name} passed Go and collected $200.`, idx);
  }
  player.position = target;
  handleLanding(player, idx);
}

function movePlayerRelative(idx, offset) {
  const player = players[idx];
  if (!player) return;
  const newPos = (player.position + offset + BOARD_SIZE) % BOARD_SIZE;
  movePlayer(idx, newPos, newPos < player.position);
}

function moveToNearest(idx, targets, doubleRent) {
  const player = players[idx];
  if (!player) return;
  const pos = player.position;
  let next = targets.find(t => t > pos);
  if (next === undefined) next = targets[0];
  movePlayer(idx, next, next < pos);
  if (doubleRent) {
    chargeRent(players[idx], next, true);
  }
}

function sendToJail(player) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  log(`${player.name} was sent to Jail.`, players.indexOf(player));
}

function chargeRent(player, index, doubleRent) {
  const ownerIdx = propertyOwners[index];
  if (ownerIdx == null || ownerIdx === players.indexOf(player)) return;
  if (propertyMortgaged[index]) return; // no rent on mortgaged property

  let rent = PROPERTY_INFO[index].rent;

  // monopoly bonus
  const info = PROPERTY_INFO[index];
  if (info.group && hasMonopoly(ownerIdx, info.group) && propertyHouses[index] === 0) {
    rent *= 2;
  }

  // houses/hotel multiplier (simple scaling)
  if (propertyHouses[index] > 0) {
    rent *= (1 + propertyHouses[index]);
  }

  if (doubleRent) rent *= 2;

  player.money -= rent;
  players[ownerIdx].money += rent;
  log(`${player.name} paid $${rent} rent to ${players[ownerIdx].name}.`, players.indexOf(player));
}

function handleLanding(player, idx) {
  const pos = player.position;
  const name = SPACE_NAMES[pos];
  log(`${player.name} landed on ${name}.`, idx);

  if (pos === 30) { // Go to jail
    sendToJail(player);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
    return;
  }

  if ([2,17,33].includes(pos)) {
    drawChest(idx);
    return;
  }
  if ([7,22,36].includes(pos)) {
    drawChance(idx);
    return;
  }

  if (PROPERTY_INFO[pos].price) {
    chargeRent(player, pos);
  }

  if (pos === 4) changeMoney(idx, -200); // income tax
  if (pos === 38) changeMoney(idx, -100); // luxury tax

  io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
}

function drawChance(idx) {
  if (chanceDeck.length === 0) initDecks();
  const card = chanceDeck.shift();
  log(`${players[idx].name} drew Chance: ${card.text}`, idx);
  card.action(idx);
  io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
}

function drawChest(idx) {
  if (chestDeck.length === 0) initDecks();
  const card = chestDeck.shift();
  log(`${players[idx].name} drew Community Chest: ${card.text}`, idx);
  card.action(idx);
  io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
}

function startTurnTimer() {
  clearTimeout(turnTimer);
  turnTimer = setTimeout(handleTurnTimeout, TURN_TIMEOUT_MS);
}

function handleTurnTimeout() {
  const player = players[currentTurn];
  if (!player) return;
  if (!player.hasRolled) {
    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const total = roll1 + roll2;
    log(`${player.name} auto-rolled ${roll1} and ${roll2} (total ${total})`, currentTurn);
    movePlayerRelative(currentTurn, total);
  }
  const pos = player.position;
  if (!currentAuction && PROPERTY_INFO[pos].price && propertyOwners[pos] == null) {
    startAuction(pos, endCurrentTurn);
  } else {
    endCurrentTurn();
  }
}

function endCurrentTurn() {
  if (players.length === 0) return;
  let idx = currentTurn;
  if (players[idx].money <= 0) {
    eliminatePlayer(idx);
    if (players.length === 0) return;
    if (idx >= players.length) idx = 0;
  }
  currentTurn = (idx + 1) % players.length;
  players[currentTurn].hasRolled = false;
  io.to(players[currentTurn].id).emit('yourTurn');
  players.forEach(p => {
    if (p.id !== players[currentTurn].id) {
      io.to(p.id).emit('notYourTurn');
    }
  });
  io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
  startTurnTimer();
}

io.on('connection', socket => {
  socket.on('joinGame', name => {
    if (players.length >= 4) {
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
      items: { getOutOfJail: 0 }
    };
    players.push(player);
    socket.emit('joined', socket.id);
    log(`${name} joined the game.`);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
    if (players.length === 1) {
      io.to(players[0].id).emit('yourTurn');
      startTurnTimer();
    } else {
      socket.emit('notYourTurn');
    }
  });

  socket.on('chat', text => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;
    io.emit('chat', `${player.name}: ${text}`);
  });

  socket.on('rollDice', () => {
    const player = players[currentTurn];
    if (!player || player.id !== socket.id) {
      socket.emit('notYourTurn');
      return;
    }
    if (player.hasRolled) return;
    player.hasRolled = true;

    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const total = roll1 + roll2;
    log(`${player.name} rolled ${roll1} and ${roll2} (total ${total})`, currentTurn);

    if (player.inJail) {
      if (roll1 === roll2) {
        player.inJail = false;
        player.jailTurns = 0;
        log(`${player.name} rolled doubles and got out of jail!`, currentTurn);
        movePlayerRelative(currentTurn, total);
      } else {
        player.jailTurns++;
        log(`${player.name} failed to roll doubles in jail (${player.jailTurns}/3).`, currentTurn);
        if (player.jailTurns >= 3) {
          changeMoney(currentTurn, -50);
          player.inJail = false;
          player.jailTurns = 0;
          movePlayerRelative(currentTurn, total);
        }
      }
      io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
      startTurnTimer();
      return;
    }

    movePlayerRelative(currentTurn, total);

    if (roll1 === roll2) {
      player.hasRolled = false;
      io.to(player.id).emit('yourTurn');
      players.forEach(p => { if (p.id !== player.id) io.to(p.id).emit('notYourTurn'); });
      startTurnTimer();
      return;
    }
    startTurnTimer();
  });

  socket.on('buyProperty', index => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;
    const info = PROPERTY_INFO[index];
    // propertyOwners stores the index of the owning player or null when
    // unowned. A value of 0 is a valid owner index, so we must explicitly
    // check for null/undefined rather than relying on truthiness.
    if (!info || !info.price || propertyOwners[index] != null) return;
    if (player.money < info.price) return;
    player.money -= info.price;
    player.properties.push(index);
    propertyOwners[index] = players.indexOf(player);
    propertyMortgaged[index] = false;
    propertyHouses[index] = 0;
    log(`${player.name} bought ${SPACE_NAMES[index]} for $${info.price}.`, players.indexOf(player));
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
    startTurnTimer();
  });

  socket.on('mortgageProperty', index => {
    const playerIdx = players.findIndex(p => p.id === socket.id);
    if (playerIdx === -1) return;
    if (propertyOwners[index] !== playerIdx) return;
    if (propertyMortgaged[index]) {
      // unmortgage
      const cost = Math.floor(PROPERTY_INFO[index].price / 2 * 1.1);
      if (players[playerIdx].money < cost) return;
      players[playerIdx].money -= cost;
      propertyMortgaged[index] = false;
      log(`${players[playerIdx].name} unmortgaged ${SPACE_NAMES[index]} for $${cost}.`, playerIdx);
    } else {
      propertyMortgaged[index] = true;
      const value = Math.floor(PROPERTY_INFO[index].price / 2);
      players[playerIdx].money += value;
      log(`${players[playerIdx].name} mortgaged ${SPACE_NAMES[index]} for $${value}.`, playerIdx);
    }
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
    startTurnTimer();
  });

  socket.on('buyHouse', index => {
    const playerIdx = players.findIndex(p => p.id === socket.id);
    if (playerIdx === -1) return;
    const info = PROPERTY_INFO[index];
    if (!info.group || propertyOwners[index] !== playerIdx) return;
    if (!hasMonopoly(playerIdx, info.group)) return;
    if (propertyHouses[index] >= 5) return;
    const cost = info.houseCost;
    if (players[playerIdx].money < cost) return;
    players[playerIdx].money -= cost;
    propertyHouses[index] += 1;
    const desc = propertyHouses[index] === 5 ? 'a hotel' : 'a house';
    log(`${players[playerIdx].name} bought ${desc} on ${SPACE_NAMES[index]} for $${cost}.`, playerIdx);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
    startTurnTimer();
  });

  socket.on('sellHouse', index => {
    const playerIdx = players.findIndex(p => p.id === socket.id);
    if (playerIdx === -1) return;
    if (propertyOwners[index] !== playerIdx) return;
    if (propertyHouses[index] <= 0) return;
    const info = PROPERTY_INFO[index];
    propertyHouses[index] -= 1;
    const value = Math.floor(info.houseCost / 2);
    players[playerIdx].money += value;
    const desc = propertyHouses[index] === 4 ? 'sold a hotel' : 'sold a house';
    log(`${players[playerIdx].name} ${desc} on ${SPACE_NAMES[index]} for $${value}.`, playerIdx);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
    startTurnTimer();
  });

  socket.on('payJail', () => {
    const player = players[currentTurn];
    if (!player || player.id !== socket.id || !player.inJail) return;
    changeMoney(currentTurn, -50);
    player.inJail = false;
    player.jailTurns = 0;
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
    startTurnTimer();
  });

  socket.on('useJailCard', () => {
    const player = players[currentTurn];
    if (!player || player.id !== socket.id || !player.inJail) return;
    if (player.items.getOutOfJail > 0) {
      player.items.getOutOfJail--;
      player.inJail = false;
      player.jailTurns = 0;
      log(`${player.name} used a Get Out of Jail Free card.`, currentTurn);
      io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });
      startTurnTimer();
    }
  });

  socket.on('initiateTrade', targetIdx => {
    const playerIdx = players.findIndex(p => p.id === socket.id);
    if (playerIdx === -1 || playerIdx !== currentTurn) return;
    if (targetIdx < 0 || targetIdx >= players.length || targetIdx === playerIdx) return;
    const trade = {
      id: Date.now() + Math.random(),
      playerA: playerIdx,
      playerB: targetIdx,
      offerA: { money: 0, properties: [], cards: 0 },
      offerB: { money: 0, properties: [], cards: 0 },
      acceptedA: false,
      acceptedB: false
    };
    trades.push(trade);
    io.to(players[playerIdx].id).emit('tradeStarted', trade);
    io.to(players[targetIdx].id).emit('tradeStarted', trade);
  });

  socket.on('updateTrade', data => {
    const trade = trades.find(t => t.id === data.id);
    if (!trade) return;
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx === trade.playerA) {
      trade.offerA = data.offer;
      trade.acceptedA = false;
      trade.acceptedB = false;
    } else if (idx === trade.playerB) {
      trade.offerB = data.offer;
      trade.acceptedA = false;
      trade.acceptedB = false;
    } else return;
    io.to(players[trade.playerA].id).emit('tradeUpdated', trade);
    io.to(players[trade.playerB].id).emit('tradeUpdated', trade);
  });

  socket.on('acceptTrade', id => {
    const trade = trades.find(t => t.id === id);
    if (!trade) return;
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx === trade.playerA) trade.acceptedA = true;
    else if (idx === trade.playerB) trade.acceptedB = true;
    io.to(players[trade.playerA].id).emit('tradeUpdated', trade);
    io.to(players[trade.playerB].id).emit('tradeUpdated', trade);
    if (trade.acceptedA && trade.acceptedB) {
      finalizeTrade(trade);
      trades = trades.filter(t => t.id !== id);
      io.to(players[trade.playerA].id).emit('tradeEnded');
      io.to(players[trade.playerB].id).emit('tradeEnded');
    }
  });

  socket.on('cancelTrade', id => {
    const trade = trades.find(t => t.id === id);
    if (!trade) return;
    trades = trades.filter(t => t.id !== id);
    io.to(players[trade.playerA].id).emit('tradeEnded');
    io.to(players[trade.playerB].id).emit('tradeEnded');
  });

  socket.on('placeBid', () => {
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;
    placeBid(idx);
  });

  socket.on('endTurn', () => {
    const player = players[currentTurn];
    if (!player || player.id !== socket.id) {
      socket.emit('notYourTurn');
      return;
    }
    const pos = player.position;
    if (!currentAuction && PROPERTY_INFO[pos].price && propertyOwners[pos] == null) {
      startAuction(pos, endCurrentTurn);
    } else {
      endCurrentTurn();
    }
  });

  socket.on('disconnect', () => {
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;

    const [leaving] = players.splice(idx, 1);
    propertyOwners = propertyOwners.map(o => (o === idx ? null : o));
    propertyMortgaged = propertyMortgaged.map((m, i) => (propertyOwners[i] === null ? false : m));
    propertyHouses = propertyHouses.map((h, i) => (propertyOwners[i] === null ? 0 : h));
    // adjust indices for owners after the leaving player
    propertyOwners = propertyOwners.map(o => (o !== null && o > idx ? o - 1 : o));
    log(`${leaving.name} left the game.`);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners, propertyMortgaged, propertyHouses });

    if (players.length === 0) {
      currentTurn = 0;
      propertyOwners = Array(BOARD_SIZE).fill(null);
      propertyMortgaged = Array(BOARD_SIZE).fill(false);
      propertyHouses = Array(BOARD_SIZE).fill(0);
      clearTimeout(turnTimer);
      return;
    }

    if (idx < currentTurn) {
      currentTurn--;
    }

    if (idx === currentTurn) {
      currentTurn = currentTurn % players.length;
      players[currentTurn].hasRolled = false;
      io.to(players[currentTurn].id).emit('yourTurn');
      players.forEach(p => {
        if (p.id !== players[currentTurn].id) {
          io.to(p.id).emit('notYourTurn');
        }
      });
      startTurnTimer();
    }
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
