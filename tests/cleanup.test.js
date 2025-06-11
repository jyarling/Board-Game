const { io, createLobby, lobbies, gameEvents } = require('../server');

describe('cleanup event', () => {
  it('removes lobby and namespace', () => {
    createLobby('XYZ', 'test');
    expect(lobbies['XYZ']).toBeDefined();
    expect(io._nsps.has('/game-XYZ')).toBe(true);

    gameEvents.emit('cleanup', 'XYZ');

    expect(lobbies['XYZ']).toBeUndefined();
    expect(io._nsps.has('/game-XYZ')).toBe(false);
  });
});
