const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let players = [];
let currentTurn = 0;

io.on('connection', socket => {
  socket.on('joinGame', name => {
    players.push({ id: socket.id, name });
    socket.emit('joined', socket.id);
    io.emit('message', `${name} joined the game.`);
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
    const roll = Math.floor(Math.random() * 6) + 1;
    io.emit('message', `${player.name} rolled a ${roll}`);
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
