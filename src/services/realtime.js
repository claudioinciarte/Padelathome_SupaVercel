// Servicio de tiempo real (Socket.IO).
// En despliegues serverless (Vercel) no hay servidor WebSocket persistente,
// así que getIo() devuelve null y las emisiones se ignoran de forma segura.
// En modo servidor persistente (Raspberry Pi / Docker), server.js llama a setIo().
let io = null;

const setIo = (instance) => {
  io = instance;
};

const getIo = () => io;

// Emite un evento solo si hay una instancia de Socket.IO disponible
const emit = (event, payload) => {
  if (io) {
    try {
      io.emit(event, payload);
    } catch (error) {
      console.error(`Error emitiendo evento realtime ${event}:`, error);
    }
  }
};

// Emite un evento a una sala concreta (chat de partida)
const emitToMatch = (bookingId, event, payload) => {
  if (io) {
    try {
      io.to(`match_${bookingId}`).emit(event, payload);
    } catch (error) {
      console.error(`Error emitiendo evento realtime ${event} a match_${bookingId}:`, error);
    }
  }
};

module.exports = { setIo, getIo, emit, emitToMatch };
