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

      fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(response => {
        if (response.redirected) {
          window.location.href = response.url;
          return;
        }
        return response.json();
      })
      .then(data => {
        if (data && data.success) {
          window.location.href = data.redirect || '/admin/dashboard';
        } else if (data) {
          showError(data.error || 'Invalid credentials');
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
          ${message}
        </div>
      `;

      // Auto-hide error after 5 seconds
      setTimeout(() => {
        formMessages.style.opacity = '0';
        setTimeout(() => {
          formMessages.innerHTML = '';
          formMessages.style.opacity = '1';
        }, 300);
      }, 5000);
    }
  }

  // Auto-hide flash messages
  const flashMessages = document.querySelectorAll('.flashed-message');
  flashMessages.forEach(message => {
    setTimeout(() => {
      message.style.opacity = '0';
      setTimeout(() => message.remove(), 300);
    }, 5000);
  });
});