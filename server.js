// Carga las variables de entorno desde .env al principio de todo
require('dotenv').config();

const http = require('http');
const socketIo = require('socket.io');
const { initCronJobs } = require('./cronJobs');
const app = require('./src/app');
const pool = require('./src/config/database');
const realtime = require('./src/services/realtime');

// Servidor HTTP + Socket.IO (solo para despliegues con proceso persistente: Raspberry Pi / Docker.
// En Vercel serverless se usa directamente src/app.js y los eventos realtime quedan desactivados).
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

realtime.setIo(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected via WebSocket');

  // El usuario se une a una "sala" específica de esa partida
  socket.on('joinMatchChat', (bookingId) => {
    socket.join(`match_${bookingId}`);
    console.log(`Usuario unido al chat de la partida: ${bookingId}`);
  });

  // Escuchar cuando alguien envía un mensaje
  socket.on('sendMessage', async (data) => {
    const { bookingId, userId, message, userName } = data;

    try {
      // Guardar el mensaje en la base de datos
      await pool.query(
        `INSERT INTO match_messages (booking_id, user_id, message)
         VALUES ($1, $2, $3)`,
        [bookingId, userId, message]
      );

      // Emitir el mensaje a todos los que estén en la "sala" de esa partida
      io.to(`match_${bookingId}`).emit('receiveMessage', {
        bookingId,
        userId,
        userName,
        message,
        created_at: new Date()
      });
    } catch (error) {
      console.error('Error enviando mensaje por socket:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from WebSocket');
  });
});

// --- Arranque del Servidor ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo y escuchando en el puerto ${PORT}`);
  initCronJobs(); // Initialize cron jobs (solo en modo servidor persistente)
});
