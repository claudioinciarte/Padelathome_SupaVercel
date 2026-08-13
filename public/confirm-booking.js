// Fichero: public/confirm-booking.js
// Mismo origen: funciona tanto en Vercel como en la Raspberry Pi
const API_BASE_URL = '';

const statusTitle = document.getElementById('status-title');
const statusMessage = document.getElementById('status-message');
const loginLink = document.getElementById('login-link');

// Esta función se ejecuta automáticamente al cargar la página
async function confirmBooking() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    statusTitle.textContent = 'Error';
    statusMessage.textContent = 'Falta el token de confirmación. Por favor, usa el enlace de tu correo.';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/waiting-list/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    statusTitle.textContent = '¡Reserva Confirmada!';
    statusTitle.style.color = 'var(--success-color)';
    statusMessage.textContent = 'Tu reserva se ha realizado con éxito. Ya puedes verla en tu dashboard.';
    loginLink.style.display = 'block';

  } catch (error) {
    statusTitle.textContent = 'Error en la Confirmación';
    statusTitle.style.color = 'var(--danger-color)';
    statusMessage.textContent = error.message;
  }
}

// Llamamos a la función cuando se carga la ventana
window.addEventListener('load', confirmBooking);