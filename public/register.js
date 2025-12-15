import { fetchApi } from './js/services/api.js';

const registerForm = document.getElementById('register-form');
const messageParagraph = document.getElementById('message');

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(registerForm);
  const data = Object.fromEntries(formData.entries());

  // Extraemos IDs específicos si es necesario, o usamos el objeto data directamente
  // (FormData ya captura todos los inputs con 'name')
  // Asegúrate de que los inputs en HTML tengan atributo 'name' correcto.
  // El HTML original tenía IDs pero no 'name' en todos. Vamos a usar los IDs para estar seguros.

  const payload = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      building: document.getElementById('building').value,
      floor: document.getElementById('floor').value,
      door: document.getElementById('door').value
  };

  messageParagraph.textContent = 'Enviando registro...';
  messageParagraph.className = '';
  messageParagraph.style.color = 'black';

  try {
    await fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    registerForm.reset();
    messageParagraph.className = 'success-text';
    messageParagraph.style.color = 'green'; // Force style just in case class is not enough
    messageParagraph.textContent = '¡Registro exitoso! Un administrador debe aprobar tu cuenta. Redirigiendo...';

    setTimeout(() => {
      window.location.href = '/login.html';
    }, 5000);

  } catch (error) {
    messageParagraph.className = 'error-text';
    messageParagraph.style.color = 'red';
    messageParagraph.textContent = error.message;
  }
});
