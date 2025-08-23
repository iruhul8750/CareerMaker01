// =============================================
// Unified Notification System
// =============================================
function showToast(message, type = 'success', duration = 3000) {
  const existingToasts = document.querySelectorAll('.toast');
  existingToasts.forEach(toast => toast.remove());

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  void toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// =============================================
// Loading State Management
// =============================================
function showLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay') || createLoadingOverlay();
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0,0,0,0.5);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  `;
  overlay.innerHTML = `
    <div class="spinner" style="
      width: 50px;
      height: 50px;
      border: 5px solid #f3f3f3;
      border-top: 5px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    "></div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

// =============================================
// OTP Verification System
// =============================================
function showOTPVerificationModal(email, username = null, password = null, purpose = 'registration') {
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
        ${username ? `<input type="hidden" name="username" value="${username}">` : ''}
        ${password ? `<input type="hidden" name="password" value="${password}">` : ''}
        <input type="hidden" name="purpose" value="${purpose}">
        <div class="form-group floating-label-group">
          <input type="text" id="otpCode" name="otp" maxlength="6" pattern="\\d{6}" required placeholder=" " autocomplete="off" inputmode="numeric">
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
  document.getElementById('otpCode').focus();

  const otpForm = document.getElementById('otpForm');
  const verifyBtn = document.getElementById('verifyOtpBtn');
  const otpResponse = document.getElementById('otpResponse');
  const resendOtpBtn = document.getElementById('resendOtp');
  const resendTimer = document.getElementById('resendTimer');
  const timerCount = document.getElementById('timerCount');

  startResendTimer(resendOtpBtn, resendTimer, timerCount);

  // OTP Resend Handler
  resendOtpBtn?.addEventListener('click', async function(e) {
    e.preventDefault();
    if (this.style.pointerEvents === 'none') return;

    const originalContent = this.innerHTML;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    this.style.pointerEvents = 'none';

    try {
      const formData = new FormData(otpForm);
      const payload = {
        email: formData.get('email'),
        purpose: formData.get('purpose')
      };

      if (formData.has('username')) {
        payload.username = formData.get('username');
      }

      const response = await fetch('/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to resend OTP');
      }

      const data = await response.json();
      showToast(data.message || 'New OTP sent successfully!', 'success');
      startResendTimer(resendOtpBtn, resendTimer, timerCount);

      if (data.otp) {
        console.log('Development OTP:', data.otp);
      }
    } catch (error) {
      console.error('Resend OTP Error:', error);
      showToast(error.message || 'Failed to resend OTP. Please try again.', 'error');
    } finally {
      this.innerHTML = originalContent;
      setTimeout(() => {
        this.style.pointerEvents = 'auto';
      }, 30000);
    }
  });

  // OTP Verification Handler
  otpForm?.addEventListener('submit', async function(e) {
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
          password: formData.get('password'),
          purpose: formData.get('purpose')
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Verification failed');

      otpResponse.className = 'form-response success';
      otpResponse.textContent = data.message || 'Verification successful!';
      otpResponse.style.display = 'block';

      if (data.redirect) {
        setTimeout(() => {
          window.location.href = data.redirect;
        }, 1500);
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

// =============================================
// Registration Form
// =============================================
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
    const emailInput = this.querySelector('#registerEmail');
    const usernameInput = this.querySelector('#registerUsername');

    formResponse.style.display = 'none';
    emailInput.classList.remove('input-error');
    usernameInput.classList.remove('input-error');

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = this.querySelector('#registerPassword').value;
    const confirmPassword = this.querySelector('#registerConfirmPassword').value;
    const termsAgreement = this.querySelector('#termsAgreement').checked;

    if (!username || username.length < 3) {
      showFieldError(usernameInput, 'Username must be at least 3 characters');
      return;
    }

    if (!email || !validateEmail(email)) {
      showFieldError(emailInput, 'Please enter a valid email address');
      return;
    }

    if (!isPasswordStrong(password)) {
      formResponse.className = 'form-response error';
      formResponse.textContent = 'Password must meet all requirements';
      formResponse.style.display = 'block';
      this.querySelector('#registerPassword').focus();
      return;
    }

    if (password !== confirmPassword) {
      formResponse.className = 'form-response error';
      formResponse.textContent = 'Passwords do not match';
      formResponse.style.display = 'block';
      this.querySelector('#registerConfirmPassword').focus();
      return;
    }

    if (!termsAgreement) {
      formResponse.className = 'form-response error';
      formResponse.textContent = 'You must agree to the Terms of Service and Privacy Policy';
      formResponse.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
      const formData = new FormData(this);
      const response = await fetch('/register', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.message && data.message.includes('Email already registered')) {
          showFieldError(emailInput, data.message);
        } else if (data.message && data.message.includes('Username')) {
          showFieldError(usernameInput, data.message);
        } else {
          throw new Error(data.message || 'Registration failed. Please try again.');
        }
        return;
      }

      if (data.requires_verification) {
        showOTPVerificationModal(
          data.email,
          formData.get('username'),
          formData.get('password')
        );

        registerModal.style.display = 'none';

        if (data.otp) {
          console.log('Development OTP:', data.otp);
          showToast('OTP generated. Check console for development.', 'info');
        } else {
          showToast('Verification email sent! Please check your inbox.', 'success');
        }
      } else {
        showToast('Registration successful!', 'success');
        setTimeout(() => {
          window.location.href = data.redirect || '/dashboard';
        }, 1500);
      }
    } catch (error) {
      console.error('Registration error:', error);
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

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function showFieldError(inputElement, message) {
    inputElement.classList.add('input-error');
    const errorElement = inputElement.nextElementSibling;
    if (errorElement && errorElement.classList.contains('error-message')) {
      errorElement.textContent = message;
    } else {
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.textContent = message;
      inputElement.parentNode.insertBefore(errorMsg, inputElement.nextSibling);
    }
    inputElement.focus();
  }
}

// =============================================
// Login Form
// =============================================
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
      showOTPVerificationModal(data.email, null, null, 'login-verification');
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

// =============================================
// Logout Handling
// =============================================
const logoutBtn = document.getElementById('logoutBtn');
const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
const closeLogoutModalBtn = document.getElementById('closeLogoutModal');
const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

if (logoutBtn) {
  logoutBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('logoutModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  });
}

function closeLogoutModal() {
  document.getElementById('logoutModal').style.display = 'none';
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

// =============================================
// Modal Handling
// =============================================
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const detailModal = document.getElementById('detailModal');
const logoutModal = document.getElementById('logoutModal');

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

// =============================================
// Bookmark Functionality
// =============================================
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

// =============================================
// Share Functionality
// =============================================
document.addEventListener('click', function(e) {
  const shareBtn = e.target.closest('.share-btn');
  if (shareBtn) {
    e.preventDefault();
    const type = shareBtn.dataset.type;
    const id = shareBtn.dataset.id;
    window.location.href = `/share/${type}/${id}`;
  }
});

// =============================================
// Apply/Enroll Functionality
// =============================================
document.addEventListener('click', function(e) {
  const applyBtn = e.target.closest('.apply-btn');
  if (applyBtn) {
    e.preventDefault();
    const itemType = applyBtn.dataset.type;
    const itemId = applyBtn.closest('.preview-card').dataset.id;

    if (applyBtn.disabled) return;

    showLoading();

    fetch(`/get-application-link/${itemType}/${itemId}`, {
      credentials: 'same-origin'
    })
    .then(response => response.json())
    .then(data => {
      if (data.application_link) {
        window.open(data.application_link, '_blank');
      } else {
        showToast('Application link not available', 'error');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      showToast('Failed to get application link', 'error');
    })
    .finally(hideLoading);
  }
});

// =============================================
// Dashboard Link Handling
// =============================================
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

// =============================================
// Contact Form Handling
// =============================================
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

// =============================================
// Newsletter Form Handling
// =============================================
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

// =============================================
// Flash Message Handling
// =============================================
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

// =============================================
// Scroll to Top Button
// =============================================
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

// =============================================
// Active Navigation on Scroll
// =============================================
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

// =============================================
// Smooth Scrolling for anchor links
// =============================================
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

// =============================================
// Set current year in footer
// =============================================
const currentYear = document.getElementById('currentYear');
if (currentYear) currentYear.textContent = new Date().getFullYear();

// =============================================
// Close flash messages
// =============================================
document.querySelectorAll('.flash-close').forEach(btn => {
  btn.addEventListener('click', function() {
    this.parentElement.remove();
  });
});

// =============================================
// Initialize application when DOM is loaded
// =============================================
document.addEventListener('DOMContentLoaded', function() {
  // Check for logout message
  if (sessionStorage.getItem('logoutMessage')) {
    const message = sessionStorage.getItem('logoutMessage');
    sessionStorage.removeItem('logoutMessage');
    showToast(message, 'success');
  }

  // Check URL for login modal parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('showLogin') === 'true') {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
      loginModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // Focus on the email input when modal opens
      const emailInput = loginModal.querySelector('#loginEmail');
      if (emailInput) {
        setTimeout(() => emailInput.focus(), 100);
      }

      // Remove the parameter from URL without refreshing
      const url = new URL(window.location);
      url.searchParams.delete('showLogin');
      window.history.replaceState({}, '', url);
    }
  }

  // Theme Management
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') ||
                     (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-mode' : '');

    if (savedTheme === 'dark-mode') {
      body.classList.add('dark-mode');
    }

    themeToggle.addEventListener('click', function() {
      body.classList.toggle('dark-mode');
      const isDarkMode = body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDarkMode ? 'dark-mode' : '');
    });
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

  // Initialize flash messages
  initFlashMessages();

  // Enhance form fields
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
});