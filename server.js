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
  
  // Wrap the functions to ensure they have the correct code context
  const wrappedUpdatePlayerCount = (count) => updateLobbyPlayerCount(code, count);
  const wrappedSetGameStarted = (started) => setLobbyGameStarted(code, started);
  
  setupGame(nsp, code, wrappedUpdatePlayerCount, wrappedSetGameStarted);
  lobbies[code] = { 
    name,
    players: 0,
    gameStarted: false,
    created: Date.now()
  };
}

function updateLobbyPlayerCount(code, count) {
  if (lobbies[code]) {
    lobbies[code].players = count;
    // Broadcast updated lobby list to all connected clients
    io.emit('lobbyListUpdated', getActiveLobbies());
  }
}

function setLobbyGameStarted(code, started) {
  if (lobbies[code]) {
    lobbies[code].gameStarted = started;
    // Broadcast updated lobby list to all connected clients
    io.emit('lobbyListUpdated', getActiveLobbies());
  }
}

function getActiveLobbies() {
  return Object.entries(lobbies)
    .filter(([code, lobby]) => !lobby.gameStarted && lobby.players < 4)
    .map(([code, lobby]) => ({
      code,
      name: lobby.name || `Game ${code}`,
      players: lobby.players,
      maxPlayers: 4,
      created: lobby.created
    }))
    .sort((a, b) => b.created - a.created);
}

io.on('connection', socket => {
  socket.on('listLobbies', (cb) => {
    const activeLobbies = getActiveLobbies();
    if (cb) cb({ lobbies: activeLobbies });
  });

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
    
    // Broadcast updated lobby list to all connected clients
    io.emit('lobbyListUpdated', getActiveLobbies());
    
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

// Lobby management functions are passed directly to game modules

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
module.exports.httpServer = server;
