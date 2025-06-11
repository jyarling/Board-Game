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
    let stateCount = 0;
    game.on('state', state => {
      stateCount++;
      if (stateCount === 1) {
        // initial state after joining
        game.emit('rollDice');
      } else if (stateCount === 2) {
        expect(state.players[0].position).toBeGreaterThan(0);
        game.close();
        root.close();
        done();
      }
    });
    game.on('yourTurn', () => {
      // nothing, wait for state listener to trigger rollDice
    });
    game.emit('joinGame', 'Alice');
  });
});

test('buying property updates money and ownership', done => {
  const root = new Client(url, { transports: ['websocket'], forceNew: true });
  root.emit('createLobby', { code: 'game2' });
  root.on('lobbyCreated', () => {
    const game = new Client(`${url}/game-game2`, { transports: ['websocket'], forceNew: true });
    let stateCount = 0;
    game.on('state', state => {
      stateCount++;
      if (stateCount === 1) {
        game.emit('buyProperty', 1);
      } else if (stateCount === 2) {
        expect(state.players[0].money).toBe(1440);
        expect(state.propertyOwners[1]).toBe(0);
        game.close();
        root.close();
        done();
      }
    });
    game.emit('joinGame', 'Bob');
  });
});
