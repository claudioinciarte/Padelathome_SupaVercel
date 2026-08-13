// Carga las variables de entorno desde .env al principio de todo
require('dotenv').config();

// Imports de las librerías
const express = require('express');
const cors = require('cors');
const http = require('http'); // Import http module
const socketIo = require('socket.io'); // Import socket.io
const { initCronJobs } = require('./cronJobs'); // Import cron jobs

// Imports de nuestros módulos de rutas (comentados para depuración)
const authRoutes = require('./src/api/authRoutes');
const userRoutes = require('./src/api/userRoutes');
const scheduleRoutes = require('./src/api/scheduleRoutes');
const bookingRoutes = require('./src/api/bookingRoutes');
const courtRoutes = require('./src/api/courtRoutes');
const adminRoutes = require('./src/api/adminRoutes');
const waitingListRoutes = require('./src/api/waitingListRoutes');
const matchRoutes = require('./src/api/matchRoutes');


// Creación de la aplicación Express
const app = express();
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server, {
    cors: {
        origin: "*", // Adjust for your frontend domain in production
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// --- Middlewares --- (comentados para depuración)
// Habilitar CORS para permitir peticiones desde otros orígenes
app.use(cors());
// Permitir que el servidor entienda peticiones con cuerpo en formato JSON
app.use(express.json());
// Servir los archivos estáticos (HTML, CSS, JS del frontend) desde la carpeta 'public'
app.use(express.static('public'));

// --- Definición de Rutas de la API --- (comentados para depuración)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/waiting-list', waitingListRoutes);
app.use('/api/matches', matchRoutes);

// Import DB pool for saving chat messages
const pool = require('./src/config/database');

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
// Esta es la línea que mantiene el proceso vivo y escuchando peticiones
server.listen(PORT, () => { // Change app.listen to server.listen
    console.log(`Servidor corriendo y escuchando en el puerto ${PORT}`);
    initCronJobs(); // Initialize cron jobs
});

module.exports = { io }; // Export io instance
