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
      document.body.style.overflow = 'hidden';
    }

    function hideLoading() {
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      document.body.style.overflow = 'auto';
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
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      document.body.appendChild(overlay);
      return overlay;
    }

    // =============================================
    // Logo Preview System
    // =============================================
    function setupLogoPreview() {
        // Listen for input on company fields in all modals
        document.addEventListener('input', function(e) {
            if (e.target.name === 'company' || e.target.id.includes('Company')) {
                const companyName = e.target.value.trim();
                if (companyName.length > 2) {
                    // Add delay to avoid too many API calls
                    clearTimeout(e.target.logoPreviewTimeout);
                    e.target.logoPreviewTimeout = setTimeout(() => {
                        previewCompanyLogo(companyName, e.target);
                    }, 500);
                } else {
                    // Clear preview if company name is too short
                    clearLogoPreview(e.target);
                }
            }
        });

        // Also handle blur event for immediate response
        document.addEventListener('blur', function(e) {
            if ((e.target.name === 'company' || e.target.id.includes('Company')) && e.target.value.trim().length > 2) {
                previewCompanyLogo(e.target.value.trim(), e.target);
            }
        }, true);
    }

    function clearLogoPreview(inputField) {
        const formGroup = inputField.closest('.form-group');
        if (!formGroup) return;

        const existingPreview = formGroup.querySelector('.logo-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
    }

    function previewCompanyLogo(companyName, inputField) {
        // Clear any existing preview first
        clearLogoPreview(inputField);

        const formGroup = inputField.closest('.form-group');
        if (!formGroup) return;

        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'logo-preview';
        previewContainer.innerHTML = `
            <div class="logo-preview-content">
                <div class="logo-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Searching logo for "${companyName}"...</span>
                </div>
                <div class="logo-result" style="display: none;">
                    <img src="" alt="${companyName} logo" class="logo-image" style="max-width: 32px; max-height: 32px; margin-right: 8px;">
                    <span class="logo-text" style="font-size: 12px; color: #666;">Logo preview available</span>
                </div>
                <div class="logo-error" style="display: none;">
                    <i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i>
                    <span style="font-size: 12px; color: #666;">No logo found</span>
                </div>
            </div>
        `;

        // Add some basic styles
        previewContainer.style.cssText = `
            margin-top: 8px;
            padding: 8px;
            border-radius: 4px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
        `;

        // Insert after the input field's parent container
        inputField.parentNode.appendChild(previewContainer);

        // Fetch logo preview
        fetch(`/api/company-logo/preview?company=${encodeURIComponent(companyName)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                const loading = previewContainer.querySelector('.logo-loading');
                const result = previewContainer.querySelector('.logo-result');
                const error = previewContainer.querySelector('.logo-error');
                const logoImage = previewContainer.querySelector('.logo-image');

                if (loading) loading.style.display = 'none';

                if (data.success && data.logo_url) {
                    if (result) {
                        logoImage.src = data.logo_url;
                        logoImage.alt = `${companyName} logo`;
                        result.style.display = 'flex';
                        result.style.alignItems = 'center';
                    }
                } else {
                    if (error) {
                        error.style.display = 'flex';
                        error.style.alignItems = 'center';
                        error.style.gap = '8px';
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching logo preview:', error);
                const loading = previewContainer.querySelector('.logo-loading');
                const errorDiv = previewContainer.querySelector('.logo-error');
                if (loading) loading.style.display = 'none';
                if (errorDiv) {
                    errorDiv.style.display = 'flex';
                    errorDiv.style.alignItems = 'center';
                    errorDiv.style.gap = '8px';
                }
            });
    }

    // =============================================
    // Enhanced Content Card Initialization
    // =============================================
    function initializeContentCards() {
        // Bookmark buttons
        document.querySelectorAll('.bookmark-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const contentId = this.dataset.id;
                const contentType = this.dataset.type;
                toggleBookmark(contentId, contentType, this);
            });
        });

        // Apply buttons
        document.querySelectorAll('.apply-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                if (this.disabled) return;

                const contentId = this.dataset.id;
                const contentType = this.dataset.type;
                applyForContent(contentId, contentType, this);
            });
        });

        // Share buttons - Fixed for all content types
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const contentId = this.dataset.id;
                const contentType = this.dataset.type;

                console.log('Share button clicked:', contentType, contentId);

                // Use the fixed share function
                shareContent(contentId, contentType, this);
            });
        });
    }



    // =============================================
    // Logo Error Handling
    // =============================================
    function handleLogoErrors() {
        document.querySelectorAll('.company-logo').forEach(logo => {
            logo.onerror = function() {
                console.log('Logo failed to load:', this.src);
                this.style.display = 'none';
                // Show default logo
                const defaultLogo = this.nextElementSibling;
                if (defaultLogo && defaultLogo.classList.contains('default-logo')) {
                    defaultLogo.style.display = 'flex';
                }
            };

            logo.onload = function() {
                console.log('Logo loaded successfully:', this.src);
                this.style.display = 'block';
                // Hide default logo
                const defaultLogo = this.nextElementSibling;
                if (defaultLogo && defaultLogo.classList.contains('default-logo')) {
                    defaultLogo.style.display = 'none';
                }
            };

            // Initial check for empty or default logos
            if (!logo.src ||
                logo.src === '' ||
                logo.src === window.location.href ||
                logo.src.includes('/static/images/default-')) {
                logo.style.display = 'none';
                const defaultLogo = logo.nextElementSibling;
                if (defaultLogo && defaultLogo.classList.contains('default-logo')) {
                    defaultLogo.style.display = 'flex';
                }
            } else {
                // Logo exists, hide default
                const defaultLogo = logo.nextElementSibling;
                if (defaultLogo && defaultLogo.classList.contains('default-logo')) {
                    defaultLogo.style.display = 'none';
                }
            }
        });
    }

    // =============================================
    // Initialize Home Page
    // =============================================
    function initializeHomePage() {
        handleLogoErrors();
        initializeContentCards();

        // Add loading states to buttons
        document.querySelectorAll('.apply-btn, .bookmark-btn, .share-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                if (!this.disabled) {
                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;

                    // Reset after 3 seconds if something goes wrong
                    setTimeout(() => {
                        if (this.disabled) {
                            this.innerHTML = originalHTML;
                            this.disabled = false;
                        }
                    }, 3000);
                }
            });
        });
    }

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        initializeHomePage();
    });

    // Also initialize when page is fully loaded
    window.addEventListener('load', function() {
        console.log('Window fully loaded');
    });

    // =============================================
    // Bookmark Functionality
    // =============================================
    function toggleBookmark(contentId, contentType, button) {
        // Check if user is logged in
        fetch('/api/check-session', {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to check session');
            }
            return response.json();
        })
        .then(data => {
            if (!data.logged_in) {
                showToast('Please login to bookmark items', 'warning');
                document.getElementById('loginModal').style.display = 'flex';
                return;
            }

            // User is logged in, proceed with bookmarking
            const isBookmarked = button.classList.contains('bookmarked');
            const icon = button.querySelector('i');

            if (isBookmarked) {
                removeBookmark(contentId, contentType, button, icon);
            } else {
                addBookmark(contentId, contentType, button, icon);
            }
        })
        .catch(error => {
            console.error('Session check error:', error);
            showToast('Please login to bookmark items', 'warning');
            document.getElementById('loginModal').style.display = 'flex';
        });
    }

    function addBookmark(contentId, contentType, button, icon) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        fetch(`/api/bookmark/${contentType}/${contentId}`, {
            method: 'POST',
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'added') {
                button.classList.add('bookmarked');
                icon.className = 'fas fa-bookmark';
                showToast('Added to bookmarks!', 'success');
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                throw new Error('Failed to bookmark item');
            }
        })
        .catch(error => {
            console.error('Bookmark error:', error);
            showToast(error.message || 'Failed to bookmark item', 'error');
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = originalHTML;
        });
    }

    function removeBookmark(contentId, contentType, button, icon) {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        fetch(`/api/bookmark/${contentType}/${contentId}`, {
            method: 'POST',
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'removed') {
                button.classList.remove('bookmarked');
                icon.className = 'far fa-bookmark';
                showToast('Removed from bookmarks!', 'success');
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                throw new Error('Failed to remove bookmark');
            }
        })
        .catch(error => {
            console.error('Bookmark error:', error);
            showToast(error.message || 'Failed to remove bookmark', 'error');
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = originalHTML;
        });
    }

    // =============================================
    // Share Functionality - Fixed
    // =============================================
    function shareContent(contentId, contentType, button) {
        console.log('Share function called:', { contentType, contentId, button });

        // Show loading state
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        // Construct share URL
        const shareUrl = `/share/${contentType}/${contentId}`;

        console.log('Redirecting to share URL:', shareUrl);

        // Redirect to share page
        window.location.href = shareUrl;

        // Reset button after a short delay (in case redirect fails)
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.disabled = false;
        }, 1000);
    }

     // Alternative: Copy to clipboard function
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Link copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Link copied to clipboard!', 'success');
        });
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
          } else if (data.showLoginModal) {
            setTimeout(() => {
              document.querySelector('.modal').remove();
              showLoginModal();
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

            document.getElementById('registerModal').style.display = 'none';

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
      const loadingIcon = submitBtn.querySelector('.loading-icon');
      const btnText = submitBtn.querySelector('.btn-text');
      const responseDiv = document.getElementById('loginResponse');

      btnText.style.display = 'none';
      loadingIcon.style.display = 'inline-block';
      submitBtn.disabled = true;
      responseDiv.style.display = 'none';

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
        responseDiv.style.display = 'block';
        responseDiv.className = 'form-response error';
        responseDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.error || 'Login failed'}`;
      })
      .finally(() => {
        btnText.style.display = 'inline-block';
        loadingIcon.style.display = 'none';
        submitBtn.disabled = false;
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
    // Bookmark Functionality - COMPLETE FIX
    // =============================================
    document.addEventListener('click', function(e) {
      const bookmarkBtn = e.target.closest('.bookmark-btn');
      if (bookmarkBtn) {
        e.preventDefault();
        e.stopPropagation();

        handleBookmarkClick(bookmarkBtn);
      }
    });

    function handleBookmarkClick(bookmarkBtn) {
      // Check if user is logged in
      fetch('/api/check-session', {
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to check session');
        }
        return response.json();
      })
      .then(data => {
        if (!data.logged_in) {
          showToast('Please login to bookmark items', 'warning');
          document.getElementById('loginModal').style.display = 'flex';
          return;
        }

        // User is logged in, proceed with bookmarking
        const itemId = bookmarkBtn.dataset.id;
        const itemType = bookmarkBtn.dataset.type;
        const isBookmarked = bookmarkBtn.classList.contains('bookmarked');

        if (isBookmarked) {
          removeBookmark(itemId, itemType, bookmarkBtn);
        } else {
          addBookmark(itemId, itemType, bookmarkBtn);
        }
      })
      .catch(error => {
        console.error('Session check error:', error);
        showToast('Please login to bookmark items', 'warning');
        document.getElementById('loginModal').style.display = 'flex';
      });
    }

    function addBookmark(itemId, itemType, element) {
      // Show loading state on the specific button
      const originalHTML = element.innerHTML;
      element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      element.disabled = true;

      fetch(`/api/bookmark/${itemType}/${itemId}`, {
        method: 'POST',
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.status === 'added') {
          element.classList.add('bookmarked');
          updateBookmarkButton(element, true);
          showToast('Item bookmarked successfully', 'success');
        } else if (data.error) {
          throw new Error(data.error);
        } else {
          throw new Error('Failed to bookmark item');
        }
      })
      .catch(error => {
        console.error('Bookmark error:', error);

        if (error.message.includes('login') || error.message.includes('401')) {
          showToast('Please login to bookmark items', 'warning');
          document.getElementById('loginModal').style.display = 'flex';
        } else {
          showToast(error.message || 'Failed to bookmark item', 'error');
        }
      })
      .finally(() => {
        element.disabled = false;
        element.innerHTML = originalHTML;
      });
    }

    function removeBookmark(itemId, itemType, element) {
      // Show loading state on the specific button
      const originalHTML = element.innerHTML;
      element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      element.disabled = true;

      fetch(`/api/bookmark/${itemType}/${itemId}`, {
        method: 'POST',
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
          });
        }
        return response.json();
      })
      .then(data => {
        if (data.status === 'removed') {
          element.classList.remove('bookmarked');
          updateBookmarkButton(element, false);
          showToast('Bookmark removed successfully', 'success');
        } else if (data.error) {
          throw new Error(data.error);
        } else {
          throw new Error('Failed to remove bookmark');
        }
      })
      .catch(error => {
        console.error('Bookmark error:', error);

        if (error.message.includes('login') || error.message.includes('401')) {
          showToast('Please login to manage bookmarks', 'warning');
          document.getElementById('loginModal').style.display = 'flex';
        } else {
          showToast(error.message || 'Failed to remove bookmark', 'error');
        }
      })
      .finally(() => {
        element.disabled = false;
        element.innerHTML = originalHTML;
      });
    }

    function updateBookmarkButton(element, isBookmarked) {
      const icon = element.querySelector('i') || document.createElement('i');
      const textSpan = element.querySelector('.btn-text') || document.createElement('span');

      textSpan.className = 'btn-text';

      if (isBookmarked) {
        icon.className = 'fas fa-bookmark';
        textSpan.textContent = 'Saved';
      } else {
        icon.className = 'far fa-bookmark';
        textSpan.textContent = 'Save';
      }

      element.innerHTML = icon.outerHTML + ' ' + textSpan.outerHTML;
    }

    // =============================================
    // Apply for Content Function
    // =============================================
    function applyForContent(contentId, contentType, button) {
        // Show loading state
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;

        fetch(`/get-application-link/${contentType}/${contentId}`, {
            credentials: 'same-origin'
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.error || 'Failed to get application link');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.application_link) {
                window.open(data.application_link, '_blank');
                showToast('Application opened in new tab', 'success');
            } else if (data.error) {
                showToast(data.error, 'error');
            } else {
                showToast('Application link not available', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(error.message || 'Failed to get application link', 'error');
        })
        .finally(() => {
            // Restore button state
            button.disabled = false;
            button.innerHTML = originalHTML;
        });
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
        const loadingIcon = submitBtn.querySelector('.loading-icon');
        const btnText = submitBtn.querySelector('.btn-text');
        const formResponse = document.getElementById('formResponse');

        btnText.style.display = 'none';
        loadingIcon.style.display = 'inline-block';
        submitBtn.disabled = true;
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
          btnText.style.display = 'inline-block';
          loadingIcon.style.display = 'none';
          submitBtn.disabled = false;
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
        const loadingIcon = submitBtn.querySelector('.loading-icon');
        const btnText = submitBtn.querySelector('.btn-text');
        const formResponse = document.getElementById('newsletterResponse');
        const emailInput = newsletterForm.querySelector('input[type="email"]');

        btnText.style.display = 'none';
        loadingIcon.style.display = 'inline-block';
        submitBtn.disabled = true;
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
          btnText.style.display = 'inline-block';
          loadingIcon.style.display = 'none';
          submitBtn.disabled = false;
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
    // Dark Mode Toggle
    // =============================================
    function initDarkMode() {
      const themeToggle = document.querySelector('.theme-toggle');
      if (!themeToggle) return;

      const body = document.body;

      // Check for saved theme preference or use system preference
      const savedTheme = localStorage.getItem('theme');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      // Set initial theme
      if (savedTheme === 'dark-mode' || (!savedTheme && systemPrefersDark)) {
        body.classList.add('dark-mode');
      }

      // Toggle theme when button is clicked
      themeToggle.addEventListener('click', function() {
        body.classList.toggle('dark-mode');
        const isDarkMode = body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark-mode' : 'light-mode');

        // Update icon
        const icon = this.querySelector('i');
        if (icon) {
          icon.className = isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
        }
      });

      // Update icon based on current theme
      const icon = themeToggle.querySelector('i');
      if (icon) {
        icon.className = body.classList.contains('dark-mode') ? 'fas fa-sun' : 'fas fa-moon';
      }
    }

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

          // Show success message if provided in URL
          const message = urlParams.get('message');
          if (message) {
            showToast(message, 'success');
          }

          // Remove the parameters from URL without refreshing
          const url = new URL(window.location);
          url.searchParams.delete('showLogin');
          url.searchParams.delete('message');
          window.history.replaceState({}, '', url);
        }
      }

      // Initialize dark mode
      initDarkMode();

      // Initialize logo preview system
      setupLogoPreview();

      // Initialize content cards functionality
      initializeContentCards();

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