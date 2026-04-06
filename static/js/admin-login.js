    // admin-login.js - Simple and Clean
    document.addEventListener('DOMContentLoaded', function() {
        // DOM Elements
        const passwordToggle = document.querySelector('.password-toggle');
        const passwordInput = document.getElementById('password');
        const loginForm = document.getElementById('adminLoginForm');
        const usernameField = document.getElementById('username');
        const formMessages = document.getElementById('formMessages');

        // Password toggle functionality
        if (passwordToggle && passwordInput) {
            passwordToggle.addEventListener('click', function() {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
                const icon = this.querySelector('i');
                if (icon) {
                    icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
                }
            });
        }

        // Focus on username field when page loads
        if (usernameField) {
            usernameField.focus();
        }

        // Auto-hide flash messages after 5 seconds
        const flashMessages = document.querySelectorAll('.flashed-message');
        flashMessages.forEach(message => {
            setTimeout(() => {
                message.style.transition = 'opacity 0.3s ease';
                message.style.opacity = '0';
                setTimeout(() => {
                    if (message.parentNode) {
                        message.remove();
                    }
                }, 300);
            }, 5000);
        });

        // Show error message
        function showError(message) {
            if (formMessages) {
                formMessages.innerHTML = `
                    <div class="admin-message admin-message-error">
                        <i class="fas fa-exclamation-circle"></i>
                        ${message}
                    </div>
                `;

                // Auto-hide after 5 seconds
                setTimeout(() => {
                    if (formMessages) {
                        formMessages.innerHTML = '';
                    }
                }, 5000);
            }
        }

        // Clear error messages
        function clearErrors() {
            if (formMessages) {
                formMessages.innerHTML = '';
            }
        }

        // Form submission
        if (loginForm) {
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();

                // Get form values
                const username = usernameField ? usernameField.value.trim() : '';
                const password = passwordInput ? passwordInput.value : '';

                // Basic validation
                if (!username) {
                    showError('Username is required');
                    if (usernameField) {
                        usernameField.focus();
                        usernameField.style.borderColor = '#ef4444';
                    }
                    return;
                }

                if (!password) {
                    showError('Password is required');
                    if (passwordInput) {
                        passwordInput.focus();
                        passwordInput.style.borderColor = '#ef4444';
                    }
                    return;
                }

                // Clear previous errors and border colors
                clearErrors();
                if (usernameField) usernameField.style.borderColor = '';
                if (passwordInput) passwordInput.style.borderColor = '';

                // Set loading state
                const submitButton = loginForm.querySelector('button[type="submit"]');
                const originalButtonText = submitButton.innerHTML;
                submitButton.disabled = true;
                submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

                // Prepare form data
                const formData = new FormData(loginForm);

                // Send login request
                fetch(loginForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        // Login successful - redirect
                        window.location.href = data.redirect || '/admin/dashboard';
                    } else {
                        // Login failed - show error message
                        showError(data.error || 'Invalid username or password');
                        // Clear password field for security
                        if (passwordInput) {
                            passwordInput.value = '';
                            passwordInput.focus();
                        }
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showError('An error occurred. Please try again.');
                    if (passwordInput) {
                        passwordInput.value = '';
                    }
                })
                .finally(() => {
                    // Reset button state
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalButtonText;
                });
            });
        }

        // Clear border color when user starts typing
        if (usernameField) {
            usernameField.addEventListener('input', function() {
                this.style.borderColor = '';
                clearErrors();
            });
        }

        if (passwordInput) {
            passwordInput.addEventListener('input', function() {
                this.style.borderColor = '';
            });
        }
    });