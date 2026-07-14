document.addEventListener('DOMContentLoaded', () => {

    // Tab Switching Logic completely removed

    // Toggle Password Visibility
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);

        // Toggle Icon
        togglePassword.classList.toggle('fa-eye-slash');
        togglePassword.classList.toggle('fa-eye');
    });

    // Form Submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = document.querySelector('.login-submit');
            const originalText = submitBtn.innerHTML;

            // Loading state
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';
            submitBtn.disabled = true;

            try {

                // --- USER CHECK via API ---
                const response = await fetch('php/api.php?action=login_user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();

                if (result.success) {
                    // Guardar datos en localStorage para la sesión
                    localStorage.setItem('tempAccount', JSON.stringify({ 
                        email: result.user.email, 
                        cellphone: result.user.cellphone 
                    }));
                    window.location.href = 'registro.html';
                } else if (result.not_registered) {
                    // Correo sin cuenta: invitar a crear una
                    if (confirm('Error: ' + result.error + '\n\n¿Deseas crear tu cuenta ahora?')) {
                        window.location.href = 'crear-cuenta.html';
                    }
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Ocurrió un error al conectar con el servidor.');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }


});
