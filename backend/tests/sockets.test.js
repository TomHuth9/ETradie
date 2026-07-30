const http = require('http');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const app = require('../src/app');
const initSockets = require('../src/sockets');
const prisma = require('../src/prismaClient');
const { registerAndVerify } = require('./helpers/registerAndVerify');

let server;
let io;
let port;

beforeAll((done) => {
  // Mirrors src/server.js's wiring exactly, but on an OS-assigned ephemeral
  // port so this can run alongside other test files without clashing.
  server = http.createServer(app);
  io = initSockets(server);
  app.set('serverInstance', server);
  app.set('io', io);
  server.listen(0, () => {
    port = server.address().port;
    done();
  });
});

afterAll(async () => {
  // Force-disconnect any sockets still lingering server-side (client-side
  // .close() doesn't always finish tearing down the server-side half within
  // the same tick), then close the io/http servers in sequence — otherwise
  // Jest reports open handles even though nothing is actually leaking.
  for (const [, socket] of io.sockets.sockets) {
    socket.disconnect(true);
  }
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));
});

function connectClient(token) {
  return ioClient(`http://localhost:${port}`, {
    auth: { token },
    reconnection: false,
    transports: ['websocket'],
    forceNew: true,
  });
}

// Waits for either 'connect' or 'connect_error' and resolves with which one
// happened (and the error, if any) rather than throwing, so tests can assert
// on the outcome either way.
function waitForConnectionOutcome(client) {
  return new Promise((resolve) => {
    client.once('connect', () => resolve({ connected: true }));
    client.once('connect_error', (err) => resolve({ connected: false, error: err }));
  });
}

const password = 'Password123';

async function registerVerifiedUser(overrides) {
  const email = `sock-${Math.random().toString(36).slice(2)}-${Date.now()}@example.com`;
  const { verifyRes } = await registerAndVerify({
    name: 'Socket Test User', email, password, role: 'homeowner',
    addressLine1: '10 High Street', addressCity: 'Glasgow', addressPostcode: 'G1 1AA',
    ...overrides,
  });
  return verifyRes.body;
}

describe('Socket.IO', () => {
  describe('authentication', () => {
    test('rejects a connection with no token', async () => {
      const client = connectClient(undefined);
      const outcome = await waitForConnectionOutcome(client);
      expect(outcome.connected).toBe(false);
      client.close();
    });

    test('rejects a connection with a malformed token', async () => {
      const client = connectClient('not-a-real-jwt');
      const outcome = await waitForConnectionOutcome(client);
      expect(outcome.connected).toBe(false);
      client.close();
    });

    test('accepts a connection with a valid token', async () => {
      const { token } = await registerVerifiedUser({});
      const client = connectClient(token);
      const outcome = await waitForConnectionOutcome(client);
      expect(outcome.connected).toBe(true);
      client.close();
    });

    test('rejects a token whose tokenVersion has been invalidated by a password change', async () => {
      const { token } = await registerVerifiedUser({});

      // Confirm the token works before the password change.
      const before = connectClient(token);
      expect((await waitForConnectionOutcome(before)).connected).toBe(true);
      before.close();

      await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: password, newPassword: 'NewPassword456' });

      const after = connectClient(token);
      const outcome = await waitForConnectionOutcome(after);
      expect(outcome.connected).toBe(false);
      after.close();
    });
  });

  describe('online status tracking', () => {
    test('marks a user online on connect and offline on disconnect', async () => {
      const { user, token } = await registerVerifiedUser({});
      const client = connectClient(token);
      await waitForConnectionOutcome(client);

      await new Promise((resolve) => setTimeout(resolve, 100));
      const online = await prisma.user.findUnique({ where: { id: user.id }, select: { isOnline: true } });
      expect(online.isOnline).toBe(true);

      client.close();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const offline = await prisma.user.findUnique({ where: { id: user.id }, select: { isOnline: true } });
      expect(offline.isOnline).toBe(false);
    });

    test('stays online while a second connection for the same user is still open', async () => {
      const { user, token } = await registerVerifiedUser({});
      const clientA = connectClient(token);
      const clientB = connectClient(token);
      await Promise.all([waitForConnectionOutcome(clientA), waitForConnectionOutcome(clientB)]);
      await new Promise((resolve) => setTimeout(resolve, 100));

      clientA.close();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const stillOnline = await prisma.user.findUnique({ where: { id: user.id }, select: { isOnline: true } });
      expect(stillOnline.isOnline).toBe(true);

      clientB.close();
    });
  });

  describe('broadcastNewJob (job:new)', () => {
    test('a nearby tradesperson receives job:new when a homeowner posts a job', async () => {
      const trade = await registerVerifiedUser({ role: 'tradesperson', townOrCity: 'Glasgow', addressLine1: undefined, addressCity: undefined, addressPostcode: undefined });
      const homeowner = await registerVerifiedUser({});

      const tradeSocket = connectClient(trade.token);
      await waitForConnectionOutcome(tradeSocket);

      const jobNewPromise = new Promise((resolve) => tradeSocket.once('job:new', resolve));

      const jobRes = await request(app)
        .post('/jobs')
        .set('Authorization', `Bearer ${homeowner.token}`)
        .send({ title: 'Fix leaking tap', description: 'Drips constantly.', category: 'PLUMBING', locationText: '10 High Street, Glasgow' });
      expect(jobRes.status).toBe(201);

      const received = await Promise.race([
        jobNewPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('job:new not received in time')), 3000)),
      ]);

      expect(received.id).toBe(jobRes.body.id);
      expect(received.title).toBe('Fix leaking tap');
      tradeSocket.close();
    });

    test('a tradesperson far outside the radius does not receive job:new', async () => {
      const trade = await registerVerifiedUser({ role: 'tradesperson', townOrCity: 'Glasgow', addressLine1: undefined, addressCity: undefined, addressPostcode: undefined });
      const homeowner = await registerVerifiedUser({});

      // Test-mode geocoding returns identical dummy coordinates for every
      // address, so move this tradesperson to London directly to actually
      // exercise the distance filter.
      await prisma.user.update({ where: { id: trade.user.id }, data: { lat: 51.5072, lng: -0.1276 } });

      const tradeSocket = connectClient(trade.token);
      await waitForConnectionOutcome(tradeSocket);

      let received = false;
      tradeSocket.on('job:new', () => { received = true; });

      const jobRes = await request(app)
        .post('/jobs')
        .set('Authorization', `Bearer ${homeowner.token}`)
        .send({ title: 'Fix leaking tap', description: 'Drips constantly.', category: 'PLUMBING', locationText: '10 High Street, Glasgow' });
      expect(jobRes.status).toBe(201);

      // Give the (correctly, in this case) absent event a moment to arrive if it were going to.
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(received).toBe(false);
      tradeSocket.close();
    });
  });

  describe('live message push (message:new)', () => {
    test('sending a message pushes message:new to the other participant\'s socket', async () => {
      const homeowner = await registerVerifiedUser({});
      const trade = await registerVerifiedUser({ role: 'tradesperson', townOrCity: 'Glasgow', addressLine1: undefined, addressCity: undefined, addressPostcode: undefined });

      const jobRes = await request(app)
        .post('/jobs')
        .set('Authorization', `Bearer ${homeowner.token}`)
        .send({ title: 'Job for messaging', description: 'Test.', category: 'PLUMBING', locationText: '10 High Street, Glasgow' });
      const jobId = jobRes.body.id;

      await request(app)
        .post(`/jobs/${jobId}/respond`)
        .set('Authorization', `Bearer ${trade.token}`)
        .send({ response: 'ACCEPTED' });

      const homeownerSocket = connectClient(homeowner.token);
      await waitForConnectionOutcome(homeownerSocket);

      const messagePromise = new Promise((resolve) => homeownerSocket.once('message:new', resolve));

      await request(app)
        .post(`/jobs/${jobId}/messages`)
        .set('Authorization', `Bearer ${trade.token}`)
        .send({ content: 'On my way' });

      const received = await Promise.race([
        messagePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('message:new not received in time')), 3000)),
      ]);

      expect(received.jobId).toBe(jobId);
      expect(received.message.content).toBe('On my way');
      homeownerSocket.close();
    });
  });

  describe('live notification push (notification:new)', () => {
    test('a job acceptance pushes notification:new to the homeowner\'s socket', async () => {
      const homeowner = await registerVerifiedUser({});
      const trade = await registerVerifiedUser({ role: 'tradesperson', townOrCity: 'Glasgow', addressLine1: undefined, addressCity: undefined, addressPostcode: undefined });

      const jobRes = await request(app)
        .post('/jobs')
        .set('Authorization', `Bearer ${homeowner.token}`)
        .send({ title: 'Job for notification', description: 'Test.', category: 'PLUMBING', locationText: '10 High Street, Glasgow' });
      const jobId = jobRes.body.id;

      const homeownerSocket = connectClient(homeowner.token);
      await waitForConnectionOutcome(homeownerSocket);

      const notificationPromise = new Promise((resolve) => homeownerSocket.once('notification:new', resolve));

      await request(app)
        .post(`/jobs/${jobId}/respond`)
        .set('Authorization', `Bearer ${trade.token}`)
        .send({ response: 'ACCEPTED' });

      const received = await Promise.race([
        notificationPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('notification:new not received in time')), 3000)),
      ]);

      expect(received.type).toBe('job_accepted');
      homeownerSocket.close();
    });
  });
});
