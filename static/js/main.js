// Unified Notification System
function showToast(message, type = 'success', duration = 3000) {
  // Remove any existing toasts
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());

  // Create new toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Force reflow to enable transition
  void toast.offsetWidth;

  // Show toast
  toast.classList.add('show');

  // Auto-hide after duration
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Loading State Management
function showLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  // Check if we need to show login modal
  if (sessionStorage.getItem('showLoginModal') === 'true') {
    sessionStorage.removeItem('showLoginModal');
    setTimeout(() => {
      const loginModal = document.getElementById('loginModal');
      if (loginModal) {
        loginModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        loginModal.querySelector('#loginEmail')?.focus();
      }
    }, 100);
  }

  // Check for logout message
  if (sessionStorage.getItem('logoutMessage')) {
    const message = sessionStorage.getItem('logoutMessage');
    sessionStorage.removeItem('logoutMessage');
    showToast(message, 'success');
  }

  // Theme Management
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') ||
                     (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-mode' : '');

    if (savedTheme === 'dark-mode') {
      body.classList.add('dark-mode');
      updateThemeMeta('dark');
    }

    themeToggle.addEventListener('click', function() {
      body.classList.toggle('dark-mode');
      const isDarkMode = body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDarkMode ? 'dark-mode' : '');
      updateThemeMeta(isDarkMode ? 'dark' : 'light');
      updateDarkModeText(isDarkMode);
    });

    function updateThemeMeta(theme) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = theme === 'dark' ? '#111827' : '#10b981';
    }

    function updateDarkModeText(isDarkMode) {
      const toggleText = themeToggle.querySelector('.toggle-text');
      const toggleIcon = themeToggle.querySelector('.toggle-icon');
      if (toggleText && toggleIcon) {
        toggleText.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
        toggleIcon.className = isDarkMode ? 'fas fa-sun toggle-icon' : 'fas fa-moon toggle-icon';
      }
    }
  }

  // Mobile Navigation
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navContainer = document.getElementById('navContainer');
  if (mobileMenuToggle && navContainer) {
    mobileMenuToggle.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !isExpanded);
      navContainer.classList.toggle('active');
      this.classList.toggle('active');
      document.body.style.overflow = navContainer.classList.contains('active') ? 'hidden' : 'auto';
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', function() {
        if (navContainer.classList.contains('active')) {
          navContainer.classList.remove('active');
          mobileMenuToggle.classList.remove('active');
          mobileMenuToggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = 'auto';
        }
      });
    });
  }

  // Modal Handling
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  const detailModal = document.getElementById('detailModal');
  const logoutModal = document.getElementById('logoutModal');

  // Modal open/close handlers
  document.querySelectorAll('.login-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      loginModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  });

  document.querySelectorAll('.register-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      registerModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  });

  document.getElementById('showRegister')?.addEventListener('click', function(e) {
    e.preventDefault();
    loginModal.style.display = 'none';
    registerModal.style.display = 'flex';
  });

  document.getElementById('showLogin')?.addEventListener('click', function(e) {
    e.preventDefault();
    registerModal.style.display = 'none';
    loginModal.style.display = 'flex';
  });

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      loginModal.style.display = 'none';
      registerModal.style.display = 'none';
      if (detailModal) detailModal.style.display = 'none';
      if (logoutModal) logoutModal.style.display = 'none';
      document.body.style.overflow = 'auto';
    });
  });

  window.addEventListener('click', function(e) {
    if (e.target === loginModal || e.target === registerModal ||
        (detailModal && e.target === detailModal) ||
        (logoutModal && e.target === logoutModal)) {
      e.target.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  });

  // Logout Modal Handling
  const logoutBtn = document.getElementById('logoutBtn');
  const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
  const closeLogoutModalBtn = document.getElementById('closeLogoutModal');
  const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      logoutModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  }

  function closeLogoutModal() {
    logoutModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  if (cancelLogoutBtn) cancelLogoutBtn.addEventListener('click', closeLogoutModal);
  if (closeLogoutModalBtn) closeLogoutModalBtn.addEventListener('click', closeLogoutModal);

  if (confirmLogoutBtn) {
    confirmLogoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      showLoading();

      fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin'
      })
      .then(response => {
        if (response.redirected) {
          // Store logout message in sessionStorage
          sessionStorage.setItem('logoutMessage', 'You have been successfully logged out');
          window.location.href = response.url;
        }
      })
      .catch(error => {
        console.error('Logout error:', error);
        hideLoading();
        showToast('Logout failed. Please try again.', 'error');
      });
    });
  }

  // Form Field Enhancements
  function enhanceFormFields() {
    document.querySelectorAll('.form-group').forEach(group => {
      const input = group.querySelector('input, textarea, select');
      const label = group.querySelector('label');

      if (input && label) {
        group.classList.add('floating-label-group');
        if (input.value) group.classList.add('has-value');

        input.addEventListener('focus', () => group.classList.add('focused'));
        input.addEventListener('blur', () => {
          group.classList.remove('focused');
          if (!input.value) group.classList.remove('has-value');
        });
        input.addEventListener('input', () => {
          group.classList.toggle('has-value', !!input.value);
        });
      }
    });
  }
  enhanceFormFields();

  // Password Reset OTP Handling
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      const formResponse = document.getElementById('resetPasswordResponse');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      formResponse.style.display = 'none';

      try {
        const formData = {
          email: this.querySelector('[name="email"]').value,
          otp: this.querySelector('[name="otp"]').value,
          new_password: this.querySelector('[name="new_password"]').value,
          confirm_password: this.querySelector('[name="confirm_password"]').value
        };

        const response = await fetch('/reset-password-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Password reset failed');
        }

        formResponse.className = 'form-response success';
        formResponse.textContent = data.message || 'Password reset successfully!';
        formResponse.style.display = 'block';

        if (data.redirect) {
          setTimeout(() => {
            window.location.href = data.redirect;
          }, 1500);
        }
      } catch (error) {
        formResponse.className = 'form-response error';
        formResponse.textContent = error.message || 'Failed to reset password. Please try again.';
        formResponse.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Resend OTP for Password Reset
  const resendResetOtpBtn = document.getElementById('resendResetOtp');
  if (resendResetOtpBtn) {
    resendResetOtpBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      const email = document.querySelector('[name="email"]').value;
      if (!email) {
        showToast('Please enter your email first', 'error');
        return;
      }

      const originalText = resendResetOtpBtn.innerHTML;
      resendResetOtpBtn.disabled = true;
      resendResetOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

      try {
        const response = await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to send OTP');
        }

        showToast('New OTP sent successfully!', 'success');
      } catch (error) {
        showToast(error.message || 'Failed to send OTP', 'error');
      } finally {
        resendResetOtpBtn.disabled = false;
        resendResetOtpBtn.innerHTML = originalText;
      }
    });
  }

  // Registration Form
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    // Password validation UI
    const passwordInput = registerForm.querySelector('#registerPassword');
    if (passwordInput) {
      const requirementsContainer = document.createElement('div');
      requirementsContainer.className = 'password-requirements';
      requirementsContainer.innerHTML = `
        <p class="requirements-title">Password must contain:</p>
        <ul class="requirements-list">
          <li class="requirement" data-requirement="length">At least 8 characters</li>
          <li class="requirement" data-requirement="uppercase">At least one uppercase letter</li>
          <li class="requirement" data-requirement="number">At least one number</li>
          <li class="requirement" data-requirement="special">At least one special character</li>
        </ul>`;
      passwordInput.parentNode.insertBefore(requirementsContainer, passwordInput.nextSibling);

      const requirements = {
        length: registerForm.querySelector('[data-requirement="length"]'),
        uppercase: registerForm.querySelector('[data-requirement="uppercase"]'),
        number: registerForm.querySelector('[data-requirement="number"]'),
        special: registerForm.querySelector('[data-requirement="special"]')
      };

      passwordInput.addEventListener('input', function() {
        const value = this.value;
        requirements.length.classList.toggle('valid', value.length >= 8);
        requirements.uppercase.classList.toggle('valid', /[A-Z]/.test(value));
        requirements.number.classList.toggle('valid', /\d/.test(value));
        requirements.special.classList.toggle('valid', /[!@#$%^&*(),.?":{}|<>]/.test(value));
      });
    }

    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      const formResponse = document.getElementById('registerResponse');

      // Validate form
      const username = this.querySelector('#registerUsername').value;
      const email = this.querySelector('#registerEmail').value;
      const password = this.querySelector('#registerPassword').value;
      const confirmPassword = this.querySelector('#registerConfirmPassword').value;
      const termsAgreement = this.querySelector('#termsAgreement').checked;

      if (!isPasswordStrong(password)) {
        formResponse.className = 'form-response error';
        formResponse.textContent = 'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character.';
        formResponse.style.display = 'block';
        return;
      }

      if (password !== confirmPassword) {
        formResponse.className = 'form-response error';
        formResponse.textContent = 'Passwords do not match.';
        formResponse.style.display = 'block';
        return;
      }

      if (!termsAgreement) {
        formResponse.className = 'form-response error';
        formResponse.textContent = 'You must agree to the Terms of Service and Privacy Policy.';
        formResponse.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
      formResponse.style.display = 'none';

      try {
        const formData = new FormData(this);
        const response = await fetch('/register', {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Registration failed');

        if (data.requires_verification) {
          showOTPVerificationModal(
            data.email,
            formData.get('username'),
            formData.get('password')
          );
          registerModal.style.display = 'none';
        }
      } catch (error) {
        formResponse.className = 'form-response error';
        formResponse.textContent = error.message || 'Registration failed. Please try again.';
        formResponse.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });

    function isPasswordStrong(password) {
      return password.length >= 8 &&
             /[A-Z]/.test(password) &&
             /\d/.test(password) &&
             /[!@#$%^&*(),.?":{}|<>]/.test(password);
    }
  }

  // OTP Verification Modal
  function showOTPVerificationModal(email, username, password) {
    document.querySelectorAll('.modal').forEach(m => m.remove());

    const modalHTML = `
    <div class="modal" style="display: flex;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <button class="close-modal">&times;</button>
        <h2>Verify Your Email</h2>
        <p>Enter the 6-digit code sent to ${email}</p>
        <form id="otpForm">
          <input type="hidden" name="email" value="${email}">
          <input type="hidden" name="username" value="${username}">
          <input type="hidden" name="password" value="${password}">
          <div class="form-group floating-label-group">
            <input type="text" id="otpCode" name="otp" maxlength="6" pattern="\\d{6}" required placeholder=" ">
            <label for="otpCode">OTP Code</label>
          </div>
          <button type="submit" class="btn btn-primary" id="verifyOtpBtn">
            <span class="btn-text">Verify</span>
            <i class="fas fa-spinner fa-spin loading-icon" style="display: none;"></i>
          </button>
          <p class="resend-link">Didn't receive code? <a href="#" id="resendOtp">Resend</a> <span id="resendTimer" style="display:none">(Wait <span id="timerCount">60</span>s)</span></p>
        </form>
        <div id="otpResponse" class="form-response" style="display: none;"></div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    enhanceFormFields();

    const otpForm = document.getElementById('otpForm');
    const verifyBtn = document.getElementById('verifyOtpBtn');
    const otpResponse = document.getElementById('otpResponse');
    const resendOtpBtn = document.getElementById('resendOtp');
    const resendTimer = document.getElementById('resendTimer');
    const timerCount = document.getElementById('timerCount');

    startResendTimer(resendOtpBtn, resendTimer, timerCount);

    if (otpForm) {
      otpForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btnText = verifyBtn.querySelector('.btn-text');
        const loadingIcon = verifyBtn.querySelector('.loading-icon');

        otpResponse.style.display = 'none';
        otpResponse.textContent = '';

        btnText.textContent = 'Verifying...';
        loadingIcon.style.display = 'inline-block';
        verifyBtn.disabled = true;

        try {
          const formData = new FormData(otpForm);
          const response = await fetch('/api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.get('email'),
              otp: formData.get('otp'),
              username: formData.get('username'),
              password: formData.get('password')
            })
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.message || 'Verification failed');

          otpResponse.className = 'form-response success';
          otpResponse.textContent = data.message || 'Registration successful! Please login to access your dashboard.';
          otpResponse.style.display = 'block';

          if (data.redirect) {
            setTimeout(() => window.location.href = data.redirect, 2000);
          }
        } catch (error) {
          otpResponse.className = 'form-response error';
          otpResponse.textContent = error.message || 'Invalid OTP. Please try again.';
          otpResponse.style.display = 'block';
        } finally {
          btnText.textContent = 'Verify';
          loadingIcon.style.display = 'none';
          verifyBtn.disabled = false;
        }
      });
    }

    resendOtpBtn?.addEventListener('click', async function(e) {
      e.preventDefault();
      const email = document.querySelector('input[name="email"]').value;
      resendOtpBtn.style.pointerEvents = 'none';
      startResendTimer(resendOtpBtn, resendTimer, timerCount);

      try {
        const response = await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to resend OTP');
        showToast('New OTP sent successfully!', 'success');
      } catch (error) {
        showToast(error.message || 'Failed to send OTP', 'error');
      }
    });

    document.querySelector('.close-modal')?.addEventListener('click', function() {
      document.querySelector('.modal').remove();
    });
  }

  function startResendTimer(button, timerElement, countElement) {
    let seconds = 60;
    timerElement.style.display = 'inline';
    button.style.display = 'none';

    const timer = setInterval(() => {
      seconds--;
      countElement.textContent = seconds;

      if (seconds <= 0) {
        clearInterval(timer);
        timerElement.style.display = 'none';
        button.style.display = 'inline';
        button.style.pointerEvents = 'auto';
      }
    }, 1000);
  }

  // Login Form
  document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    const formData = {
      email: this.querySelector('#loginEmail').value,
      password: this.querySelector('#loginPassword').value
    };

    fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    .then(response => {
      if (!response.ok) return response.json().then(err => { throw err; });
      return response.json();
    })
    .then(data => {
      if (data.requires_verification) {
        showToast('Please verify your email first', 'warning');
        showOTPVerificationModal(data.email);
      } else if (data.status === 'success' && data.redirect) {
        showToast('Login successful!', 'success');
        setTimeout(() => window.location.href = data.redirect, 1000);
      }
    })
    .catch(error => {
      showToast(error.error || 'Login failed', 'error');
    })
    .finally(() => {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    });
  });

  // Dashboard Link Handling
  document.addEventListener('click', function(e) {
    const dashboardLink = e.target.closest('a[href="/dashboard"]');
    if (dashboardLink) {
      e.preventDefault();
      showLoading();

      fetch('/api/check-session', { credentials: 'same-origin' })
      .then(response => response.json())
      .then(data => {
        if (data.logged_in) {
          window.location.href = '/dashboard';
        } else {
          showToast('Please login to access your dashboard', 'warning');
          document.getElementById('loginModal').style.display = 'flex';
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showToast('Failed to check session status', 'error');
      })
      .finally(hideLoading);
    }
  });

// Contact Form Handling
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const formResponse = document.getElementById('formResponse');

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Sending...';
    submitBtn.querySelector('.loading-icon').style.display = 'inline-block';
    formResponse.style.display = 'none';

    try {
      const formData = new FormData(contactForm);
      const response = await fetch('/api/contact', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send message');
      }

      formResponse.className = 'form-response success';
      formResponse.textContent = data.message;
      formResponse.style.display = 'block';
      contactForm.reset();
    } catch (error) {
      formResponse.className = 'form-response error';
      formResponse.textContent = error.message || 'An error occurred. Please try again.';
      formResponse.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

// Newsletter Form Handling
const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = newsletterForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    const formResponse = document.getElementById('newsletterResponse');
    const emailInput = newsletterForm.querySelector('input[type="email"]');

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').textContent = 'Subscribing...';
    submitBtn.querySelector('.loading-icon').style.display = 'inline-block';
    formResponse.style.display = 'none';

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailInput.value
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to subscribe');
      }

      formResponse.className = 'form-response success';
      formResponse.textContent = data.message;
      formResponse.style.display = 'block';
      newsletterForm.reset();
    } catch (error) {
      formResponse.className = 'form-response error';
      formResponse.textContent = error.message || 'An error occurred. Please try again.';
      formResponse.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

  // Bookmark Functionality
  document.addEventListener('click', function(e) {
    const bookmarkBtn = e.target.closest('.bookmark-btn');
    if (bookmarkBtn) {
      e.preventDefault();
      const itemId = bookmarkBtn.dataset.id;
      const itemType = bookmarkBtn.dataset.type;
      const isBookmarked = bookmarkBtn.classList.contains('bookmarked');

      if (isBookmarked) {
        removeBookmark(itemId, itemType, bookmarkBtn);
      } else {
        addBookmark(itemId, itemType, bookmarkBtn);
      }
    }
  });

  function addBookmark(itemId, itemType, element) {
    showLoading();
    fetch('/bookmark/' + itemType + '/' + itemId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    })
    .then(response => {
      if (!response.ok) return response.json().then(err => { throw err; });
      return response.json();
    })
    .then(data => {
      if (data.status === 'added') {
        element.classList.add('bookmarked');
        const icon = element.querySelector('i') || document.createElement('i');
        icon.className = 'fas fa-bookmark';
        element.innerHTML = icon.outerHTML + ' <span class="btn-text">Saved</span>';
        showToast('Item bookmarked', 'success');
      } else {
        showToast('Failed to bookmark', 'error');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast(error.message || 'An error occurred. Please try again.', 'error');
    })
    .finally(hideLoading);
  }

  function removeBookmark(itemId, itemType, element) {
    showLoading();
    fetch('/bookmark/' + itemType + '/' + itemId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    })
    .then(response => {
      if (!response.ok) return response.json().then(err => { throw err; });
      return response.json();
    })
    .then(data => {
      if (data.status === 'removed') {
        element.classList.remove('bookmarked');
        const icon = element.querySelector('i') || document.createElement('i');
        icon.className = 'far fa-bookmark';
        element.innerHTML = icon.outerHTML + ' <span class="btn-text">Save</span>';
        showToast('Bookmark removed', 'success');
      } else {
        showToast('Failed to remove bookmark', 'error');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast(error.message || 'An error occurred. Please try again.', 'error');
    })
    .finally(hideLoading);
  }

  // Share Functionality
  document.addEventListener('click', function(e) {
    const shareBtn = e.target.closest('.share-btn');
    if (shareBtn) {
      e.preventDefault();
      const type = shareBtn.dataset.type;
      const id = shareBtn.dataset.id;
      window.location.href = `/share/${type}/${id}`;
    }
  });

  // Flash Message Handling
  function initFlashMessages() {
    const flashMessages = document.querySelectorAll('.alert');
    flashMessages.forEach(message => {
      setTimeout(() => {
        message.style.opacity = '0';
        setTimeout(() => message.remove(), 300);
      }, 5000);

      const closeBtn = message.querySelector('.close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          message.style.opacity = '0';
          setTimeout(() => message.remove(), 300);
        });
      }
    });
  }
  initFlashMessages();

  // Scroll to Top Button
  const scrollToTopBtn = document.createElement('div');
  scrollToTopBtn.className = 'scroll-to-top';
  scrollToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  document.body.appendChild(scrollToTopBtn);

  window.addEventListener('scroll', function() {
    scrollToTopBtn.classList.toggle('active', window.pageYOffset > 300);
  });

  scrollToTopBtn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Active Navigation on Scroll
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-links a');

  function updateActiveNav() {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (pageYOffset >= (sectionTop - 200)) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active-scroll');
      if (link.getAttribute('href').includes(current)) {
        link.classList.add('active-scroll');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav();

  // Smooth Scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: 'smooth'
        });
        history.pushState(null, null, targetId);
      }
    });
  });

  // Set current year in footer
  const currentYear = document.getElementById('currentYear');
  if (currentYear) currentYear.textContent = new Date().getFullYear();

  // Close flash messages
  document.querySelectorAll('.flash-close').forEach(btn => {
    btn.addEventListener('click', function() {
      this.parentElement.remove();
    });
  });
});