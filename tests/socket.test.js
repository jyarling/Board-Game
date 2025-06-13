const request = require('supertest');
const { io: Client } = require('socket.io-client');
const app = require('../server');
let server;
let port;
let url;

beforeAll(done => {
  server = app.httpServer;
  server.listen(() => {
    port = server.address().port;
    url = `http://localhost:${port}`;
    done();
  });
});

afterAll(done => {
  server.close(done);
});

test('create lobby via websocket', done => {
  const client = new Client(url, { transports: ['websocket'], forceNew: true });
  client.emit('createLobby', { code: 'l1', name: 'Lobby 1' });
  client.on('lobbyCreated', code => {
    expect(code).toBe('l1');
    client.close();
    done();
  });
});

test('join existing lobby via websocket', done => {
  const host = new Client(url, { transports: ['websocket'], forceNew: true });
  host.emit('createLobby', { code: 'l2' });
  host.on('lobbyCreated', () => {
    const guest = new Client(url, { transports: ['websocket'], forceNew: true });
    guest.emit('joinLobby', 'l2');
    guest.on('lobbyJoined', code => {
      expect(code).toBe('l2');
      host.close();
      guest.close();
      done();
    });
  });
});

test('rolling dice updates player position', done => {
  const root = new Client(url, { transports: ['websocket'], forceNew: true });
  root.emit('createLobby', { code: 'game1' });
  root.on('lobbyCreated', () => {
    const game = new Client(`${url}/game-game1`, { transports: ['websocket'], forceNew: true });
    let rolled = false;

    game.on('joined', data => {
      if (data.isHost) game.emit('startGame');
    });

    game.on('yourTurn', () => {
      if (!rolled) {
        rolled = true;
        game.emit('rollDice');
      }
    });

    game.on('state', state => {
      if (rolled && state.players[0].position > 0) {
        expect(state.players[0].position).toBeGreaterThan(0);
        game.close();
        root.close();
        done();
      }
    });

    game.emit('joinGame', 'Alice');
  });
});

test('buying property updates money and ownership', done => {
  const state = require('../server/state');
  const root = new Client(url, { transports: ['websocket'], forceNew: true });
  root.emit('createLobby', { code: 'game2' });
  root.on('lobbyCreated', () => {
    const game = new Client(`${url}/game-game2`, { transports: ['websocket'], forceNew: true });
    let purchased = false;

    game.on('joined', data => {
      if (data.isHost) game.emit('startGame');
    });

    game.on('yourTurn', () => {
      state.players[0].position = 1;
      game.emit('buyProperty', 1);
    });

    game.on('state', s => {
      if (!purchased && s.propertyOwners[1] === 0) {
        purchased = true;
        expect(s.players[0].money).toBe(1440);
        expect(s.propertyOwners[1]).toBe(0);
        game.close();
        root.close();
        done();
      }
    });

    game.emit('joinGame', 'Bob');
  });
});

test('cannot buy property when not your turn', done => {
  const state = require('../server/state');
  const root = new Client(url, { transports: ['websocket'], forceNew: true });
  root.emit('createLobby', { code: 'game3' });
  root.on('lobbyCreated', () => {
    const host = new Client(`${url}/game-game3`, { transports: ['websocket'], forceNew: true });
    const guest = new Client(`${url}/game-game3`, { transports: ['websocket'], forceNew: true });

    let joined = 0;
    function tryStart() {
      if (joined === 2) host.emit('startGame');
    }

    host.on('joined', data => { joined++; tryStart(); });
    guest.on('joined', () => { joined++; tryStart(); });

    guest.on('state', () => {
      if (state.players.length === 2 && state.currentTurn === 0) {
        state.players[1].position = 1;
        guest.emit('buyProperty', 1);
        setTimeout(() => {
          expect(state.propertyOwners[1]).toBeNull();
          host.close();
          guest.close();
          root.close();
          done();
        }, 50);
      }
    });

    host.emit('joinGame', 'Host');
    guest.emit('joinGame', 'Guest');
  });
});
