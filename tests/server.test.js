const request = require('supertest');
const app = require('../server');

describe('GET /', () => {
  it('serves the index page', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Board Game Dice Roller');
  });
});
