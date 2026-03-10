const http = require('http');
const app = require('./app');

const PORT = process.env.PORT || 4000;

// Create a plain HTTP server so Socket.IO can share the same port.
const server = http.createServer(app);

// Initialise Socket.IO and attach it to the HTTP server.
// We keep a reference to both the server and io instance on the Express app so controllers can broadcast new jobs without importing Socket.IO directly.
const io = require('./sockets')(server);
app.set('serverInstance', server);
app.set('io', io);

server.listen(PORT, () => {
  console.log(`ETradie backend listening on port ${PORT}`);
});


