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
  { price: 60 },
  { price: 0 },
  { price: 60 },
  { price: 0 },
  { price: 200 },
  { price: 100 },
  { price: 0 },
  { price: 100 },
  { price: 120 },
  { price: 0 },
  { price: 140 },
  { price: 150 },
  { price: 140 },
  { price: 160 },
  { price: 200 },
  { price: 180 },
  { price: 0 },
  { price: 180 },
  { price: 200 },
  { price: 0 },
  { price: 220 },
  { price: 0 },
  { price: 220 },
  { price: 240 },
  { price: 200 },
  { price: 260 },
  { price: 260 },
  { price: 150 },
  { price: 280 },
  { price: 0 },
  { price: 300 },
  { price: 300 },
  { price: 0 },
  { price: 320 },
  { price: 200 },
  { price: 0 },
  { price: 350 },
  { price: 0 },
  { price: 400 }
];
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
let players = [];
let currentTurn = 0;

io.on('connection', socket => {
  socket.on('joinGame', name => {
    if (players.length >= 4) {
      socket.emit('message', 'Game is full');
      return;
    }
    const player = { id: socket.id, name, position: 0, money: 1500, properties: [] };
    players.push(player);
    socket.emit('joined', socket.id);
    io.emit('message', `${name} joined the game.`);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners });
    if (players.length === 1) {
      io.to(players[0].id).emit('yourTurn');
    } else {
      socket.emit('notYourTurn');
    }
  });

  socket.on('rollDice', () => {
    const player = players[currentTurn];
    if (!player || player.id !== socket.id) {
      socket.emit('notYourTurn');
      return;
    }
    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const total = roll1 + roll2;
    const oldPos = player.position;
    player.position = (player.position + total) % BOARD_SIZE;
    if (player.position < oldPos) {
      player.money += 200;
      io.emit('message', `${player.name} passed Go and collected $200.`);
    }
    io.emit('message', `${player.name} rolled ${roll1} and ${roll2} (total ${total})`);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners });
    if (roll1 === roll2) {
      io.to(player.id).emit('yourTurn');
      players.forEach(p => { if (p.id !== player.id) io.to(p.id).emit('notYourTurn'); });
      return;
    }
    currentTurn = (currentTurn + 1) % players.length;
    io.to(players[currentTurn].id).emit('yourTurn');
    players.forEach(p => {
      if (p.id !== players[currentTurn].id) {
        io.to(p.id).emit('notYourTurn');
      }
    });
  });

  socket.on('buyProperty', index => {
    const player = players.find(p => p.id === socket.id);
    if (!player) return;
    const info = PROPERTY_INFO[index];
    if (!info || !info.price || propertyOwners[index]) return;
    if (player.money < info.price) return;
    player.money -= info.price;
    player.properties.push(index);
    propertyOwners[index] = players.indexOf(player);
    io.emit('message', `${player.name} bought ${SPACE_NAMES[index]} for $${info.price}.`);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners });
  });

  socket.on('disconnect', () => {
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;

    const [leaving] = players.splice(idx, 1);
    propertyOwners = propertyOwners.map(o => (o === idx ? null : o));
    // adjust indices for owners after the leaving player
    propertyOwners = propertyOwners.map(o => (o !== null && o > idx ? o - 1 : o));
    io.emit('message', `${leaving.name} left the game.`);
    io.emit('state', { players, boardSize: BOARD_SIZE, propertyOwners });

    if (players.length === 0) {
      currentTurn = 0;
      propertyOwners = Array(BOARD_SIZE).fill(null);
      return;
    }

    if (idx < currentTurn) {
      currentTurn--;
    }

    if (idx === currentTurn) {
      currentTurn = currentTurn % players.length;
      io.to(players[currentTurn].id).emit('yourTurn');
      players.forEach(p => {
        if (p.id !== players[currentTurn].id) {
          io.to(p.id).emit('notYourTurn');
        }
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
