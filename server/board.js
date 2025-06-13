const state = require('./state');
const players = require('./players');

function advanceToNearestUtility(idx, io, log) {
  const utilities = [12, 28];
  const player = state.players[idx];
  if (!player) return;
  const pos = player.position;
  let next = utilities.find(u => u > pos);
  if (next === undefined) next = utilities[0];
  const passGo = next < pos;
  movePlayer(idx, next, io, log, passGo);
  const ownerIdx = state.propertyOwners[next];
  if (ownerIdx != null && ownerIdx !== idx && !state.propertyMortgaged[next]) {
    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const rent = (roll1 + roll2) * 10;
    state.players[idx].money -= rent;
    state.players[ownerIdx].money += rent;
    log(`${player.name} rolled ${roll1} and ${roll2} and paid $${rent} rent to ${state.players[ownerIdx].name}.`, idx);
  }
  io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
}

function calculateIncomeTax(idx) {
  const player = state.players[idx];
  if (!player) return 0;
  let worth = player.money;
  player.properties.forEach(i => {
    if (!state.propertyMortgaged[i]) {
      worth += state.PROPERTY_INFO[i].price / 2;
    }
  });
  const percent = Math.floor(worth * 0.15);
  return percent < 200 ? percent : 200;
}

function movePlayer(idx, target, io, log, passGo = false, endTurnCallback = null) {
  const player = state.players[idx];
  if (!player) return;
  const old = player.position;
  if (passGo && target < old) {
    player.money += 200;
    log(`${player.name} passed Go and collected $200.`, idx);
  }
  player.position = target;
  handleLanding(player, idx, io, log, endTurnCallback);
}

function movePlayerRelative(idx, offset, io, log, endTurnCallback = null) {
  const player = state.players[idx];
  if (!player) return;
  const newPos = (player.position + offset + state.BOARD_SIZE) % state.BOARD_SIZE;
  movePlayer(idx, newPos, io, log, newPos < player.position, endTurnCallback);
}

function moveToNearest(idx, targets, io, log, doubleRent) {
  const player = state.players[idx];
  if (!player) return;
  const pos = player.position;
  let next = targets.find(t => t > pos);
  if (next === undefined) next = targets[0];
  movePlayer(idx, next, io, log, next < pos);
  if (doubleRent) chargeRent(player, next, io, log, true);
}

function sendToJail(player, io, log, endTurnCallback) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  player.hasRolled = true; // Prevent further actions this turn
  log(`${player.name} was sent to Jail.`, state.players.indexOf(player));
  // End turn immediately when going to jail
  if (endTurnCallback) {
    setTimeout(() => endTurnCallback(), 1000); // Small delay for message to display
  }
}

function chargeRent(player, index, io, log, doubleRent = false) {
  const info = state.PROPERTY_INFO[index];
  const ownerIdx = state.propertyOwners[index];
  if (ownerIdx == null || ownerIdx === state.players.indexOf(player) || state.propertyMortgaged[index]) return;
  let rent = 0;
  if (info.railroad) {
    const count = state.PROPERTY_INFO.reduce((c, p, i) => c + (p.railroad && state.propertyOwners[i] === ownerIdx ? 1 : 0), 0);
    rent = info.rentTable[count - 1];
    if (doubleRent) rent *= 2;
  } else if (info.utility) {
    const count = state.PROPERTY_INFO.reduce((c, p, i) => c + (p.utility && state.propertyOwners[i] === ownerIdx ? 1 : 0), 0);
    const roll = player.lastRoll || (Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1);
    const multiplier = count === 2 ? 10 : 4;
    rent = roll * multiplier;
  } else if (info.group) {
    rent = info.rentTable[state.propertyHouses[index]];
    if (players.hasMonopoly(ownerIdx, info.group) && state.propertyHouses[index] === 0) rent *= 2;
    if (doubleRent) rent *= 2;
  }
  if (rent > 0) {
    player.money -= rent;
    state.players[ownerIdx].money += rent;
    log(`${player.name} paid $${rent} rent to ${state.players[ownerIdx].name}.`, state.players.indexOf(player));
  }
}

function handleLanding(player, idx, io, log, endTurnCallback) {
  const pos = player.position;
  const name = state.SPACE_NAMES[pos];
  log(`${player.name} landed on ${name}.`, idx);

  if (pos === 30) {
    sendToJail(player, io, log, endTurnCallback);
    io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
    return;
  }

  if ([2,17,33].includes(pos)) {
    drawChest(idx, io, log);
    return;
  }
  if ([7,22,36].includes(pos)) {
    drawChance(idx, io, log);
    return;
  }

  if (state.PROPERTY_INFO[pos].price) {
    chargeRent(player, pos, io, log);
  }

  if (pos === 4) {
    const tax = calculateIncomeTax(idx);
    players.changeMoney(idx, -tax, io, log);
  }
  if (pos === 38) players.changeMoney(idx, -100, io, log);

  io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
}

let chanceDeck = [];
let chestDeck = [];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function initDecks() {
  chanceDeck = shuffle([
    { text: 'Advance to Go (Collect $200)', action: i => movePlayer(i, 0, ioRef, logRef, true) },
    { text: 'Advance to Illinois Ave', action: i => movePlayer(i, 24, ioRef, logRef) },
    { text: 'Advance to St. Charles Place', action: i => movePlayer(i, 11, ioRef, logRef) },
    { text: 'Advance token to nearest Utility', action: i => advanceToNearestUtility(i, ioRef, logRef) },
    { text: 'Advance token to nearest Railroad', action: i => moveToNearest(i, [5,15,25,35], ioRef, logRef, true) },
    { text: 'Bank pays you dividend of $50', action: i => players.changeMoney(i, 50, ioRef, logRef) },
    { text: 'Get Out of Jail Free', action: i => { state.players[i].items.getOutOfJail++; } },
    { text: 'Go Back 3 Spaces', action: i => movePlayerRelative(i, -3, ioRef, logRef) },
    { text: 'Go to Jail', action: i => sendToJail(state.players[i], ioRef, logRef) },
    { text: 'Make general repairs on all your property', action: i => players.payRepairs(i, 25, 100) },
    { text: 'Pay poor tax of $15', action: i => players.changeMoney(i, -15, ioRef, logRef) },
    { text: 'Take a trip to Reading Railroad', action: i => movePlayer(i, 5, ioRef, logRef, true) },
    { text: 'Take a walk on the Boardwalk', action: i => movePlayer(i, 39, ioRef, logRef) },
    { text: 'You have been elected Chairman of the Board – Pay each player $50', action: i => players.payEachPlayer(i, 50) },
    { text: 'Your building loan matures – Collect $150', action: i => players.changeMoney(i, 150, ioRef, logRef) },
    { text: 'You have won a crossword competition – Collect $100', action: i => players.changeMoney(i, 100, ioRef, logRef) },
  ]);
  chestDeck = shuffle([
    { text: 'Advance to Go (Collect $200)', action: i => movePlayer(i, 0, ioRef, logRef, true) },
    { text: 'Bank error in your favor – Collect $200', action: i => players.changeMoney(i, 200, ioRef, logRef) },
    { text: "Doctor's fees – Pay $50", action: i => players.changeMoney(i, -50, ioRef, logRef) },
    { text: 'From sale of stock you get $50', action: i => players.changeMoney(i, 50, ioRef, logRef) },
    { text: 'Get Out of Jail Free', action: i => { state.players[i].items.getOutOfJail++; } },
    { text: 'Go to Jail – Go directly to jail', action: i => sendToJail(state.players[i], ioRef, logRef) },
    { text: 'Grand Opera Night – Collect $50 from every player', action: i => players.collectFromAll(i, 50) },
    { text: 'Holiday Fund matures – Receive $100', action: i => players.changeMoney(i, 100, ioRef, logRef) },
    { text: 'Income tax refund – Collect $20', action: i => players.changeMoney(i, 20, ioRef, logRef) },
    { text: 'It is your birthday – Collect $10 from every player', action: i => players.collectFromAll(i, 10) },
    { text: 'Life insurance matures – Collect $100', action: i => players.changeMoney(i, 100, ioRef, logRef) },
    { text: 'Pay hospital fees of $100', action: i => players.changeMoney(i, -100, ioRef, logRef) },
    { text: 'Pay school fees of $150', action: i => players.changeMoney(i, -150, ioRef, logRef) },
    { text: 'Receive $25 consultancy fee', action: i => players.changeMoney(i, 25, ioRef, logRef) },
    { text: 'You are assessed for street repairs – $40 per house', action: i => players.payRepairs(i, 40, 115) },
    { text: 'You have won second prize in a beauty contest – Collect $10', action: i => players.changeMoney(i, 10, ioRef, logRef) },
    { text: 'You inherit $100', action: i => players.changeMoney(i, 100, ioRef, logRef) },
  ]);
}

let ioRef;
let logRef;
function init(io, log) {
  ioRef = io;
  logRef = log;
  initDecks();
}

function drawChance(idx, io, log) {
  if (chanceDeck.length === 0) initDecks();
  const card = chanceDeck.shift();
  log(`${state.players[idx].name} drew Chance: ${card.text}`, idx);
  card.action(idx);
  io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
}

function drawChest(idx, io, log) {
  if (chestDeck.length === 0) initDecks();
  const card = chestDeck.shift();
  log(`${state.players[idx].name} drew Community Chest: ${card.text}`, idx);
  card.action(idx);
  io.emit('state', { players: state.players, boardSize: state.BOARD_SIZE, propertyOwners: state.propertyOwners, propertyMortgaged: state.propertyMortgaged, propertyHouses: state.propertyHouses });
}

module.exports = {
  init,
  movePlayer,
  movePlayerRelative,
  moveToNearest,
  sendToJail,
  chargeRent,
  handleLanding,
  advanceToNearestUtility,
  calculateIncomeTax,
  drawChance,
  drawChest
};
