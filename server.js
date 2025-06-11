const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { EventEmitter } = require('events');
const setupGame = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const lobbies = {};
const gameEvents = new EventEmitter();

function createLobby(code, name) {
  const nsp = io.of(`/game-${code}`);
  setupGame(nsp, gameEvents);
  lobbies[code] = { name };
}

gameEvents.on('cleanup', code => {
  const nspName = `/game-${code}`;
  delete lobbies[code];
  const nsp = io._nsps.get(nspName);
  if (nsp) {
    nsp.adapter.close();
    io._nsps.delete(nspName);
  }
});

io.on('connection', socket => {
  socket.on('createLobby', data => {
    const { code, name } = data || {};
    if (!code) return;
    if (lobbies[code]) {
      socket.emit('lobbyError', 'Code already exists');
      return;
    }
    createLobby(code, name || '');
    socket.emit('lobbyCreated', code);
  });

  socket.on('joinLobby', code => {
    if (!lobbies[code]) {
      socket.emit('lobbyError', 'Lobby not found');
      return;
    }
    socket.emit('lobbyJoined', code);
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
module.exports.io = io;
module.exports.lobbies = lobbies;
module.exports.createLobby = createLobby;
module.exports.gameEvents = gameEvents;
