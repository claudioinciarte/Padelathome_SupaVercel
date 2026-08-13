document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = '';
    const resetForm = document.getElementById('reset-password-form');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const messageParagraph = document.getElementById('message');

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        messageParagraph.className = 'error-text';
        messageParagraph.textContent = 'Token de restablecimiento no encontrado.';
        return;
    }

    resetForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newPassword = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (newPassword !== confirmPassword) {
            messageParagraph.className = 'error-text';
            messageParagraph.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        if (newPassword.length < 6) {
            messageParagraph.className = 'error-text';
            messageParagraph.textContent = 'La contraseña debe tener al menos 6 caracteres.';
            return;
        }

        messageParagraph.textContent = 'Restableciendo contraseña...';
        messageParagraph.className = '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error al restablecer la contraseña.');
            }

            messageParagraph.className = 'success-text';
            messageParagraph.textContent = 'Contraseña restablecida con éxito. Redirigiendo a login...';
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 3000);

        } catch (error) {
            messageParagraph.className = 'error-text';
            messageParagraph.textContent = error.message;
        }
    });
});