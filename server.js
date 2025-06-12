const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const setupGame = require('./server/index');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use('/data', express.static('data'));

const lobbies = {};

function createLobby(code, name) {
  const nsp = io.of(`/game-${code}`);
  setupGame(nsp);
  lobbies[code] = { name };
}

io.on('connection', socket => {
  socket.on('createLobby', (data, cb) => {
    const { code, name } = data || {};
    if (!code) {
      if (cb) cb({ error: 'Invalid code' });
      return;
    }
    if (lobbies[code]) {
      if (cb) cb({ error: 'Code already exists' });
      socket.emit('lobbyError', 'Code already exists');
      return;
    }
    createLobby(code, name || '');
    socket.emit('lobbyCreated', code);
    if (cb) cb({ success: true });
  });

  socket.on('joinLobby', (code, cb) => {
    if (!lobbies[code]) {
      if (cb) cb({ error: 'Lobby not found' });
      socket.emit('lobbyError', 'Lobby not found');
      return;
    }
    socket.emit('lobbyJoined', code);
    if (cb) cb({ success: true });
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
module.exports.httpServer = server;
