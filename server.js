const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const BOARD_SIZE = 20; // spaces around the board
let players = [];
let currentTurn = 0;

io.on('connection', socket => {
  socket.on('joinGame', name => {
    if (players.length >= 4) {
      socket.emit('message', 'Game is full');
      return;
    }
    const player = { id: socket.id, name, position: 0 };
    players.push(player);
    socket.emit('joined', socket.id);
    io.emit('message', `${name} joined the game.`);
    io.emit('state', { players, boardSize: BOARD_SIZE });
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
    player.position = (player.position + total) % BOARD_SIZE;
    io.emit('message', `${player.name} rolled ${roll1} and ${roll2} (total ${total})`);
    io.emit('state', { players, boardSize: BOARD_SIZE });
    currentTurn = (currentTurn + 1) % players.length;
    io.to(players[currentTurn].id).emit('yourTurn');
    players.forEach(p => {
      if (p.id !== players[currentTurn].id) {
        io.to(p.id).emit('notYourTurn');
      }
    });
  });

  socket.on('disconnect', () => {
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx === -1) return;

    const [leaving] = players.splice(idx, 1);
    io.emit('message', `${leaving.name} left the game.`);
    io.emit('state', { players, boardSize: BOARD_SIZE });

    if (players.length === 0) {
      currentTurn = 0;
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
