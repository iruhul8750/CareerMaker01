    document.addEventListener('DOMContentLoaded', function() {
      // Password toggle functionality
      const passwordToggle = document.querySelector('.password-toggle');
      const passwordInput = document.getElementById('password');

      if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', function() {
          const isPassword = passwordInput.type === 'password';
          passwordInput.type = isPassword ? 'text' : 'password';
          const icon = this.querySelector('i');
          icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
      }

      // Form submission handling
      const loginForm = document.getElementById('adminLoginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
          e.preventDefault();

          const form = e.target;
          const formData = new FormData(form);
          const submitButton = form.querySelector('button[type="submit"]');
          const originalButtonText = submitButton.innerHTML;

          // Show loading state
          submitButton.disabled = true;
          submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

          // Clear previous errors
          clearErrors();

          fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          })
          .then(response => {
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return response.json().then(data => {
                if (response.ok) {
                  return { success: true, data };
                } else {
                  return { success: false, data };
                }
              });
            } else {
              // If not JSON, it's probably a redirect or HTML response
              if (response.redirected) {
                window.location.href = response.url;
                return { redirected: true };
              }
              // If we get HTML when expecting JSON, show error
              return { success: false, data: { error: 'Unexpected response from server' } };
            }
          })
          .then(result => {
            if (result.redirected) {
              return; // Already handled redirect
            }

            if (result.success) {
              if (result.data.success) {
                // Successful login via AJAX
                window.location.href = result.data.redirect || '/admin/dashboard';
              } else {
                // Login failed via AJAX
                showError(result.data.error || 'Invalid credentials');
              }
            } else {
              // Error case
              showError(result.data.error || 'An error occurred. Please try again.');
            }
          })
          .catch(error => {
            console.error('Login error:', error);
            showError('An error occurred. Please try again.');
          })
          .finally(() => {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
          });
        });
      }

      function showError(message) {
        const formMessages = document.getElementById('formMessages');
        if (formMessages) {
          formMessages.innerHTML = `
            <div class="alert alert-danger">
              <i class="fas fa-exclamation-circle"></i> ${message}
            </div>
          `;

          // Auto-hide error after 5 seconds
          setTimeout(() => {
            clearErrors();
          }, 5000);
        }
      }

      function clearErrors() {
        const formMessages = document.getElementById('formMessages');
        if (formMessages) {
          formMessages.innerHTML = '';
        }
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

      // Focus on username field when page loads
      const usernameField = document.getElementById('username');
      if (usernameField) {
        usernameField.focus();
      }
    });