const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const BOARD_SIZE = 20;
let players = [];
let currentTurn = 0;

io.on('connection', socket => {
  socket.on('joinGame', name => {
    if (players.length >= 4) {
      socket.emit('gameFull');
      return;
    }
    players.push({ id: socket.id, name, position: 0 });
    socket.emit('joined', socket.id);
    io.emit('message', `${name} joined the game.`);
    io.emit('gameState', { players, currentTurn });
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
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    player.position = (player.position + total) % BOARD_SIZE;
    io.emit('message', `${player.name} rolled ${die1} and ${die2} (total ${total})`);
    io.emit('gameState', { players, currentTurn });
    currentTurn = (currentTurn + 1) % players.length;
    io.to(players[currentTurn].id).emit('yourTurn');
    players.forEach(p => {
      if (p.id !== players[currentTurn].id) {
        io.to(p.id).emit('notYourTurn');
      }
    });
  });

  socket.on('disconnect', () => {
    players = players.filter(p => p.id !== socket.id);
    io.emit('gameState', { players, currentTurn });
    if (players.length === 0) {
      currentTurn = 0;
    } else if (currentTurn >= players.length) {
      currentTurn = 0;
      io.to(players[currentTurn].id).emit('yourTurn');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
