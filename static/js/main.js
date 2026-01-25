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
    // UNIVERSAL LOADER MANAGEMENT (Single Instance)
    // =============================================

    // Only create LoaderManager if it doesn't exist
    if (typeof LoaderManager === 'undefined') {
        window.LoaderManager = {
            config: {
                zIndex: 9999,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                spinnerColor: '#ffffff',
                textColor: '#ffffff',
                blurEffect: '5px',
                animationDuration: '0.3s'
            },

            activeLoaders: 0,

            show: function(message = 'Loading...', options = {}) {
                this.activeLoaders++;

                let overlay = document.getElementById('universalLoadingOverlay');

                if (!overlay) {
                    overlay = this.createLoader();
                }

                if (message) {
                    const messageElement = overlay.querySelector('.loading-message');
                    if (messageElement) {
                        messageElement.textContent = message;
                    }
                }

                this.applyOptions(overlay, options);

                overlay.style.display = 'flex';
                document.body.style.overflow = 'hidden';

                console.log(`🔄 Loader shown: ${message} (Active: ${this.activeLoaders})`);

                return overlay;
            },

            hide: function(force = false) {
                if (force) {
                    this.activeLoaders = 0;
                } else {
                    this.activeLoaders = Math.max(0, this.activeLoaders - 1);
                }

                if (this.activeLoaders <= 0) {
                    const overlay = document.getElementById('universalLoadingOverlay');
                    if (overlay) {
                        overlay.style.opacity = '0';
                        overlay.style.transition = `opacity ${this.config.animationDuration} ease`;

                        setTimeout(() => {
                            overlay.style.display = 'none';
                            overlay.style.opacity = '1';
                            document.body.style.overflow = '';
                            console.log('✅ All loaders hidden');
                        }, 300);
                    }
                    this.activeLoaders = 0;
                } else {
                    console.log(`⏳ Loader kept active: ${this.activeLoaders} pending operations`);
                }
            },

            createLoader: function() {
                const overlay = document.createElement('div');
                overlay.id = 'universalLoadingOverlay';
                overlay.className = 'universal-loading-overlay';

                overlay.innerHTML = `
                    <div class="universal-loading-content">
                        <div class="universal-spinner"></div>
                        <p class="loading-message">Loading...</p>
                    </div>
                `;

                this.applyStyles(overlay);
                document.body.appendChild(overlay);

                return overlay;
            },

            applyStyles: function(overlay) {
                Object.assign(overlay.style, {
                    display: 'none',
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    backgroundColor: this.config.backgroundColor,
                    zIndex: this.config.zIndex,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backdropFilter: `blur(${this.config.blurEffect})`,
                    transition: `opacity ${this.config.animationDuration} ease`
                });

                const content = overlay.querySelector('.universal-loading-content');
                if (content) {
                    Object.assign(content.style, {
                        textAlign: 'center',
                        color: this.config.textColor,
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '30px 40px',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    });
                }

                const spinner = overlay.querySelector('.universal-spinner');
                if (spinner) {
                    Object.assign(spinner.style, {
                        width: '50px',
                        height: '50px',
                        border: `4px solid rgba(255, 255, 255, 0.3)`,
                        borderTop: `4px solid ${this.config.spinnerColor}`,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px',
                        display: 'block'
                    });
                }

                const message = overlay.querySelector('.loading-message');
                if (message) {
                    Object.assign(message.style, {
                        margin: '0',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: this.config.textColor
                    });
                }
            },

            applyOptions: function(overlay, options) {
                if (options.backgroundColor) {
                    overlay.style.backgroundColor = options.backgroundColor;
                }

                if (options.zIndex) {
                    overlay.style.zIndex = options.zIndex;
                }

                if (options.message) {
                    const messageElement = overlay.querySelector('.loading-message');
                    if (messageElement) {
                        messageElement.textContent = options.message;
                    }
                }
            },

            reset: function() {
                this.activeLoaders = 0;
                this.hide(true);
                console.log('🔄 All loaders reset');
            },

            getStatus: function() {
                return {
                    active: this.activeLoaders > 0,
                    count: this.activeLoaders,
                    visible: document.getElementById('universalLoadingOverlay')?.style.display === 'flex'
                };
            }
        };

        // Add spinner animation style if not already present
        if (!document.querySelector('#loader-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'loader-spinner-style';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Convenience functions - Only define if they don't exist
    if (typeof showLoader === 'undefined') {
        window.showLoader = function(message = 'Loading...', options = {}) {
            return LoaderManager.show(message, options);
        };
    }

    if (typeof hideLoader === 'undefined') {
        window.hideLoader = function(force = false) {
            return LoaderManager.hide(force);
        };
    }

    if (typeof resetLoader === 'undefined') {
        window.resetLoader = function() {
            return LoaderManager.reset();
        };
    }

    if (typeof withLoader === 'undefined') {
        window.withLoader = async function(promise, loadingMessage = 'Loading...', successMessage = null, errorMessage = null) {
            showLoader(loadingMessage);

            try {
                const result = await promise;

                if (successMessage) {
                    showToast(successMessage, 'success');
                }

                return result;
            } catch (error) {
                console.error('Operation failed:', error);

                if (errorMessage) {
                    showToast(errorMessage, 'error');
                } else {
                    showToast(error.message || 'Operation failed', 'error');
                }

                throw error;
            } finally {
                hideLoader();
            }
        };
    }

    // Update existing loading functions to use universal loader
    function showLoading() {
        return showLoader('Loading...');
    }

    function hideLoading() {
        return hideLoader();
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
    // Initialize Application
    // =============================================
    function initializeHomePage() {
        handleLogoErrors();
        initializeModals(); // Initialize modals first
        initializeBookmarkButtons();
        initializeContentCards();
        initializeTestimonialModal(); // Add this line
        loadTestimonials(); // Add this line

        // Mobile navigation
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

            // Close mobile menu when clicking on links
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

    }

    // =============================================
    // NAVIGATION PROFILE PICTURE LOADER
    // =============================================

    function loadNavigationProfilePicture() {
        const profilePicElement = document.getElementById('navProfilePic');
        const initialsElement = document.getElementById('navAvatarInitials');

        if (!profilePicElement || !initialsElement) return;

        // Check if user is logged in
        fetch('/api/check-session', {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(sessionData => {
            if (!sessionData.logged_in) {
                // User not logged in, hide profile section
                const userProfileNav = document.querySelector('.user-profile-nav');
                if (userProfileNav) {
                    userProfileNav.style.display = 'none';
                }
                return;
            }

            // User is logged in, load profile picture
            const username = sessionData.username || 'User';
            const userInitial = username[0].toUpperCase();

            // Set initials first
            initialsElement.textContent = userInitial;

            // Check for recent update timestamp
            const cacheBust = localStorage.getItem('profilePicCacheBust') || Date.now();

            // Fetch profile picture with aggressive cache busting
            fetch(`/get-profile-pic?t=${cacheBust}&_=${Date.now()}`, {
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success && data.image_url) {
                    // Create new image to test loading
                    const testImage = new Image();
                    testImage.onload = function() {
                        // Image loaded successfully
                        profilePicElement.src = data.image_url;
                        profilePicElement.style.display = 'block';
                        initialsElement.style.display = 'none';

                        // Store in session for quick access
                        sessionStorage.setItem('navProfilePicUrl', data.image_url);
                        sessionStorage.setItem('navProfilePicTimestamp', Date.now());
                    };
                    testImage.onerror = function() {
                        // Image failed to load, show initials
                        profilePicElement.style.display = 'none';
                        initialsElement.style.display = 'flex';
                    };
                    testImage.src = data.image_url;
                } else {
                    // No profile picture, show initials
                    profilePicElement.style.display = 'none';
                    initialsElement.style.display = 'flex';
                }
            })
            .catch(error => {
                console.error('Error loading profile picture:', error);
                profilePicElement.style.display = 'none';
                initialsElement.style.display = 'flex';
            });
        })
        .catch(error => {
            console.error('Error checking session:', error);
        });
    }

    // Also add this function to refresh profile picture when updated
    function refreshNavigationProfilePicture() {
        // Clear cached data
        sessionStorage.removeItem('navProfilePicUrl');
        sessionStorage.removeItem('navProfilePicTimestamp');

        // Reload with fresh cache busting
        loadNavigationProfilePicture();
    }

    // =============================================
    // Modal Management - ENHANCED FOR NAVIGATION
    // =============================================
    function initializeModals() {
        // Login modal triggers - handle both navigation and bookmark buttons
        document.querySelectorAll('.login-btn, #navLoginBtn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openLoginModal();
            });
        });

        // Register modal triggers - handle both navigation and other register buttons
        document.querySelectorAll('.register-btn, #navRegisterBtn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openRegisterModal();
            });
        });

        // Modal switching
        document.getElementById('showRegister')?.addEventListener('click', function(e) {
            e.preventDefault();
            closeLoginModal();
            openRegisterModal();
        });

        document.getElementById('showLogin')?.addEventListener('click', function(e) {
            e.preventDefault();
            closeRegisterModal();
            openLoginModal();
        });

        // Close modal handlers
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', function() {
                closeAllModals();
            });
        });

        // Close modal when clicking outside
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', function() {
                closeAllModals();
            });
        });

        // Logout modal handlers
        document.getElementById('logoutBtn')?.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('logoutModal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });

        document.getElementById('cancelLogoutBtn')?.addEventListener('click', closeLogoutModal);
        document.getElementById('closeLogoutModal')?.addEventListener('click', closeLogoutModal);
        document.getElementById('confirmLogoutBtn')?.addEventListener('click', handleLogout);
    }

    function openLoginModal() {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            // Close mobile menu if open
            closeMobileMenu();
            // Focus on email input
            const emailInput = loginModal.querySelector('#loginEmail');
            if (emailInput) {
                setTimeout(() => emailInput.focus(), 100);
            }
        }
    }

    function openRegisterModal() {
        const registerModal = document.getElementById('registerModal');
        if (registerModal) {
            registerModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            // Close mobile menu if open
            closeMobileMenu();
            // Focus on username input
            const usernameInput = registerModal.querySelector('#registerUsername');
            if (usernameInput) {
                setTimeout(() => usernameInput.focus(), 100);
            }
        }
    }

    function closeMobileMenu() {
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const navContainer = document.getElementById('navContainer');
        if (mobileMenuToggle && navContainer) {
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
            navContainer.classList.remove('active');
            mobileMenuToggle.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    // =============================================
    // Enhanced Bookmark Functionality - INSTANT UI UPDATES
    // =============================================

    // Store bookmark state for quick access
    let bookmarkState = new Map();

    function initializeBookmarkButtons() {
        // Initialize from server-side data first
        initializeBookmarkStatesFromServer();

        // Then set up click handlers
        document.addEventListener('click', function(e) {
            const bookmarkBtn = e.target.closest('.bookmark-btn');
            if (bookmarkBtn) {
                e.preventDefault();
                e.stopPropagation();
                handleBookmarkAction(bookmarkBtn);
            }
        });
    }

    function initializeBookmarkStatesFromServer() {
        // Initialize from server-side rendered data
        const bookmarkButtons = document.querySelectorAll('.bookmark-btn');
        bookmarkButtons.forEach(button => {
            const itemId = button.dataset.id;
            const itemType = button.dataset.type;
            const isBookmarked = button.classList.contains('bookmarked');

            // Store in memory for quick access
            if (itemId && itemType) {
                bookmarkState.set(`${itemType}-${itemId}`, isBookmarked);
            }

            // Ensure correct icon is displayed
            updateBookmarkIcon(button, isBookmarked);
        });
    }

    async function handleBookmarkAction(bookmarkBtn) {
        const itemId = bookmarkBtn.dataset.id;
        const itemType = bookmarkBtn.dataset.type;
        const currentState = bookmarkBtn.classList.contains('bookmarked');

        // Check if user is logged in first
        try {
            const sessionResponse = await fetch('/api/check-session', {
                credentials: 'include'
            });

            if (!sessionResponse.ok) {
                throw new Error('Failed to check session');
            }

            const sessionData = await sessionResponse.json();

            if (!sessionData.logged_in) {
                showToast('Please login to bookmark items', 'warning');
                openLoginModal();
                return;
            }

            // User is logged in - perform optimistic update
            const newState = !currentState;

            // INSTANT UI UPDATE - Optimistic update
            bookmarkBtn.classList.toggle('bookmarked', newState);
            updateBookmarkIcon(bookmarkBtn, newState);
            bookmarkState.set(`${itemType}-${itemId}`, newState);

            // Show loading state
            const loader = showLoader(newState ? 'Adding bookmark...' : 'Removing bookmark...');
            const originalHTML = bookmarkBtn.innerHTML;
            bookmarkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            bookmarkBtn.disabled = true;

            // Make API call
            try {
                const response = await fetch(`/api/bookmark/${itemType}/${itemId}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                if (data.success) {
                    hideLoader();
                    const action = newState ? 'added' : 'removed';
                    showToast(data.message || `Bookmark ${action} successfully`, 'success');
                } else {
                    throw new Error(data.error || 'Bookmark operation failed');
                }
            } catch (error) {
                console.error('Bookmark API error:', error);
                hideLoader();

                // REVERT UI UPDATE on error
                bookmarkBtn.classList.toggle('bookmarked', currentState);
                updateBookmarkIcon(bookmarkBtn, currentState);
                bookmarkState.set(`${itemType}-${itemId}`, currentState);

                showToast(error.message || 'Failed to update bookmark', 'error');
            } finally {
                // Restore button state
                bookmarkBtn.disabled = false;
                const finalState = bookmarkBtn.classList.contains('bookmarked');
                updateBookmarkIcon(bookmarkBtn, finalState);
            }

        } catch (error) {
            console.error('Bookmark session check error:', error);
            showToast('Please login to bookmark items', 'warning');
            openLoginModal();
        }
    }

    function updateBookmarkIcon(element, isBookmarked) {
        const icon = element.querySelector('i');
        if (icon) {
            if (isBookmarked) {
                icon.className = 'fas fa-bookmark';
                icon.style.color = '#007bff';
            } else {
                icon.className = 'far fa-bookmark';
                icon.style.color = '';
            }
        }
    }

    // =============================================
    // Enhanced Content Card Initialization
    // =============================================
    function initializeContentCards() {
        // Initialize bookmark buttons
        initializeBookmarkButtons();

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
              <input type="text" id="otpCode" name="otp" maxlength="6" required placeholder=" " autocomplete="off" inputmode="numeric" style="
                width: 100%;
                padding: 12px;
                font-size: 18px;
                letter-spacing: 8px;
                text-align: center;
                border: 2px solid #ddd;
                border-radius: 8px;
                outline: none;
                background: white;
                cursor: text;
                pointer-events: auto;
              ">
              <label for="otpCode">OTP Code</label>
              <div class="form-error" id="otpError" style="display:none; color: #dc3545; font-size: 0.875em; margin-top: 5px;"></div>
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

      // Initialize OTP input - SIMPLIFIED VERSION
      const otpInput = document.getElementById('otpCode');

      // Focus and select the input
      setTimeout(() => {
        otpInput.focus();
        otpInput.select();
      }, 100);

      // Ensure the input is clickable and editable
      otpInput.style.pointerEvents = 'auto';
      otpInput.style.cursor = 'text';
      otpInput.style.userSelect = 'auto';

      // Remove any inherited disabled/readonly attributes
      otpInput.removeAttribute('disabled');
      otpInput.removeAttribute('readonly');

      // SIMPLIFIED input handler - just allow typing
      otpInput.addEventListener('input', function(e) {
        // Only allow digits
        this.value = this.value.replace(/\D/g, '');

        // Limit to 6 digits
        if (this.value.length > 6) {
          this.value = this.value.substring(0, 6);
        }

        // Clear any error messages
        const errorElement = document.getElementById('otpError');
        if (errorElement) {
          errorElement.style.display = 'none';
        }
      });

      // Prevent any key that's not a number
      otpInput.addEventListener('keydown', function(e) {
        // Allow all control keys (backspace, delete, tab, arrows, etc.)
        if (e.key.length === 1 && !/\d/.test(e.key)) {
          e.preventDefault();
          return;
        }
      });

      // Handle paste events
      otpInput.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const numbersOnly = pastedText.replace(/\D/g, '').substring(0, 6);
        this.value = numbersOnly;
      });

      // Add a click handler to ensure focus
      otpInput.addEventListener('click', function(e) {
        this.focus();
        this.select();
      });

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

          // Clear and focus on OTP input after resend
          otpInput.value = '';
          setTimeout(() => {
            otpInput.focus();
            otpInput.select();
          }, 100);

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

        // Basic OTP validation
        const otpValue = otpInput.value.trim();

        if (!otpValue) {
          const errorElement = document.getElementById('otpError');
          errorElement.textContent = 'Please enter the OTP code';
          errorElement.style.display = 'block';
          otpInput.focus();
          return;
        }

        if (otpValue.length !== 6) {
          const errorElement = document.getElementById('otpError');
          errorElement.textContent = 'OTP must be exactly 6 digits';
          errorElement.style.display = 'block';
          otpInput.focus();
          return;
        }

        const btnText = verifyBtn.querySelector('.btn-text');
        const loadingIcon = verifyBtn.querySelector('.loading-icon');

        otpResponse.style.display = 'none';
        otpResponse.textContent = '';

        btnText.textContent = 'Verifying...';
        loadingIcon.style.display = 'inline-block';
        verifyBtn.disabled = true;
        otpInput.disabled = true;

        try {
          const formData = new FormData(otpForm);
          const response = await fetch('/api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: formData.get('email'),
              otp: otpValue,
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

          // Re-enable input for correction
          otpInput.disabled = false;
          setTimeout(() => {
            otpInput.focus();
            otpInput.select();
          }, 100);
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

            // Validation
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

            // Show universal loader
            const loader = showLoader('Creating your account...', {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                message: 'Creating your account...'
            });

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
                    hideLoader(); // Hide loader on error

                    if (data.message && data.message.includes('Email already registered')) {
                        showFieldError(emailInput, data.message);
                    } else if (data.message && data.message.includes('Username')) {
                        showFieldError(usernameInput, data.message);
                    } else {
                        throw new Error(data.message || 'Registration failed. Please try again.');
                    }
                    return;
                }

                // Hide the universal loader
                hideLoader();

                if (data.requires_verification) {
                    // Update loader message for verification
                    showLoader('Account created! Please verify your email...', {
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        message: 'Account created! Please verify your email...'
                    });

                    setTimeout(() => {
                        hideLoader();
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
                    }, 1000);

                } else {
                    // Show success loader
                    const successLoader = showLoader('Registration successful!', {
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        message: 'Registration successful!'
                    });

                    // Change loader to success state
                    const messageElement = successLoader.querySelector('.loading-message');
                    const spinner = successLoader.querySelector('.universal-spinner');

                    if (messageElement) {
                        messageElement.style.color = '#4ade80';
                        messageElement.innerHTML = `
                            <i class="fas fa-check-circle" style="margin-right: 8px; font-size: 18px;"></i>
                            Registration successful!
                        `;
                    }

                    if (spinner) {
                        spinner.style.borderTopColor = '#4ade80';
                        spinner.style.borderColor = '#4ade80';

                        setTimeout(() => {
                            spinner.style.animation = 'none';
                            spinner.innerHTML = '<i class="fas fa-check" style="font-size: 24px;"></i>';
                            spinner.style.border = 'none';
                            spinner.style.display = 'flex';
                            spinner.style.alignItems = 'center';
                            spinner.style.justifyContent = 'center';
                        }, 300);
                    }

                    setTimeout(() => {
                        hideLoader();
                        window.location.href = data.redirect || '/dashboard';
                    }, 1500);
                }
            } catch (error) {
                console.error('Registration error:', error);
                hideLoader(); // Hide loader on error
                formResponse.className = 'form-response error';
                formResponse.textContent = error.message || 'Registration failed. Please try again.';
                formResponse.style.display = 'block';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });

        // Helper functions
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
        const btnText = submitBtn.querySelector('.btn-text');
        const responseDiv = document.getElementById('loginResponse');

        btnText.style.display = 'none';
        submitBtn.disabled = true;
        responseDiv.style.display = 'none';

        // Show loader
        const loader = showLoader('Logging in...');

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
                hideLoader();
                showToast('Please verify your email first', 'warning');
                showOTPVerificationModal(data.email, null, null, 'login-verification');
            } else if (data.status === 'success' && data.redirect) {
                hideLoader();
                showToast('Login successful!', 'success');
                setTimeout(() => window.location.href = data.redirect, 1000);
            }
        })
        .catch(error => {
            hideLoader();
            responseDiv.style.display = 'block';
            responseDiv.className = 'form-response error';
            responseDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.error || 'Login failed'}`;
        })
        .finally(() => {
            btnText.style.display = 'inline-block';
            submitBtn.disabled = false;
        });
    });

    // =============================================
    // Logout Handling
    // =============================================

    function setupLogout() {
        console.log('🔧 Setting up logout functionality...');

        const logoutBtn = document.getElementById('logoutBtn');
        const logoutModal = document.getElementById('logoutModal');

        // Make sure logout modal exists
        if (!logoutModal) {
            console.warn('⚠️ Logout modal not found in DOM');
            return;
        }

        // Initialize modal setup first
        setupLogoutModal();

        // Handle logout button click
        if (logoutBtn) {
            // Remove any existing listeners first
            const freshLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(freshLogoutBtn, logoutBtn);

            // Add click event to fresh button
            freshLogoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🟡 Logout button clicked');

                // Show the logout modal
                const modal = document.getElementById('logoutModal');
                if (modal) {
                    modal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                    console.log('✅ Logout modal displayed');
                } else {
                    console.warn('❌ Logout modal not found after click');
                }
            });
        } else {
            console.warn('⚠️ Logout button not found');
        }

        console.log('✅ Logout setup complete');
    }

    function setupLogoutModal() {
        const logoutModal = document.getElementById('logoutModal');
        if (!logoutModal) {
            console.warn('⚠️ Logout modal not found, skipping modal setup');
            return;
        }

        const cancelBtn = logoutModal.querySelector('#cancelLogoutBtn');
        const confirmBtn = logoutModal.querySelector('#confirmLogoutBtn');
        const closeBtn = logoutModal.querySelector('#closeLogoutModal');

        // Remove any existing event listeners first to prevent duplicates
        if (cancelBtn) {
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        }
        if (closeBtn) {
            closeBtn.replaceWith(closeBtn.cloneNode(true));
        }
        if (confirmBtn) {
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        }

        // Get fresh references after cloning
        const freshCancelBtn = logoutModal.querySelector('#cancelLogoutBtn');
        const freshConfirmBtn = logoutModal.querySelector('#confirmLogoutBtn');
        const freshCloseBtn = logoutModal.querySelector('#closeLogoutModal');

        // Cancel logout - FIXED
        if (freshCancelBtn) {
            freshCancelBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('❌ Logout cancelled');
                logoutModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
        }

        // Close modal
        if (freshCloseBtn) {
            freshCloseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('❌ Logout modal closed');
                logoutModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
        }

        // Confirm logout - SIMPLIFIED AND FIXED
        if (freshConfirmBtn) {
            freshConfirmBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('✅ Logout confirmed, executing...');

                // Show loader
                const loader = showLoader('Logging you out...');

                try {
                    // Clear local storage first
                    localStorage.removeItem('profilePicUrl');
                    localStorage.removeItem('profilePicTimestamp');
                    localStorage.removeItem('profilePicCacheBust');
                    localStorage.removeItem('profilePicLastUpdate');
                    sessionStorage.clear();

                    // Close the modal
                    logoutModal.style.display = 'none';
                    document.body.style.overflow = 'auto';

                    // Perform logout request
                    const response = await fetch('/logout', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache'
                        }
                    });

                    // Show success message
                    showToast('You have been logged out successfully', 'success');

                    // Store logout message for next page
                    sessionStorage.setItem('logoutMessage', 'You have been successfully logged out');

                    // Wait a moment to show the toast, then redirect
                    setTimeout(() => {
                        hideLoader();
                        window.location.href = '/';
                    }, 1500);

                } catch (error) {
                    console.error('❌ Logout error:', error);
                    hideLoader();
                    showToast('Logout failed. Please try again.', 'error');

                    // Ensure modal is closed on error
                    logoutModal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                }
            });
        }

        // Close on overlay click - FIXED
        logoutModal.addEventListener('click', function(e) {
            if (e.target === logoutModal) {
                console.log('❌ Logout cancelled (overlay click)');
                logoutModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    async function performLogout() {
        // Show loader (use the universal loader)
        showLoader('Logging you out...', {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            message: 'Logging you out...'
        });

        try {
            // Clear profile picture cache
            localStorage.removeItem('profilePicUrl');
            localStorage.removeItem('profilePicTimestamp');
            localStorage.removeItem('profilePicCacheBust');
            localStorage.removeItem('profilePicLastUpdate');
            sessionStorage.clear();

            // Perform logout request
            const response = await fetch('/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            // Close logout modal if open
            const logoutModal = document.getElementById('logoutModal');
            if (logoutModal) {
                logoutModal.style.display = 'none';
            }

            if (response.ok || response.redirected) {
                // Show success message
                showToast('You have been logged out successfully', 'success');

                // Store logout message for next page
                sessionStorage.setItem('logoutMessage', 'You have been successfully logged out');

                // Wait a moment to show the loader message
                setTimeout(() => {
                    // Redirect to home page
                    window.location.href = '/';
                }, 1500);

            } else {
                throw new Error('Logout failed');
            }

        } catch (error) {
            console.error('Logout error:', error);
            showToast('Logout failed. Please try again.', 'error');
            hideLoader();

            // Close logout modal if open
            const logoutModal = document.getElementById('logoutModal');
            if (logoutModal) {
                logoutModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        }
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
    // Apply for Content Function
    // =============================================
    function applyForContent(contentId, contentType, button) {
        // Show loading state
        const loader = showLoader('Opening application...');
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
                hideLoader(); // Hide universal loader first
                window.open(data.application_link, '_blank');
                showToast('Application opened in new tab', 'success');
            } else if (data.error) {
                hideLoader();
                showToast(data.error, 'error');
            } else {
                hideLoader();
                showToast('Application link not available', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            hideLoader();
            showToast(error.message || 'Failed to get application link', 'error');
        })
        .finally(() => {
            // Restore button state
            button.disabled = false;
            button.innerHTML = originalHTML;
        });
    }

    // =============================================
    // Dashboard Link Handling
    // =============================================
    document.addEventListener('click', function(e) {
        const dashboardLink = e.target.closest('a[href="/dashboard"]');
        if (dashboardLink) {
            e.preventDefault();

            // Show loader
            const loader = showLoader('Checking session...');

            fetch('/api/check-session', { credentials: 'same-origin' })
            .then(response => response.json())
            .then(data => {
                if (data.logged_in) {
                    hideLoader();
                    window.location.href = '/dashboard';
                } else {
                    hideLoader();
                    showToast('Please login to access your dashboard', 'warning');
                    document.getElementById('loginModal').style.display = 'flex';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                hideLoader();
                showToast('Failed to check session status', 'error');
            });
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
            const btnText = submitBtn.querySelector('.btn-text');
            const formResponse = document.getElementById('formResponse');

            btnText.style.display = 'none';
            submitBtn.disabled = true;
            formResponse.style.display = 'none';

            // Show loader
            const loader = showLoader('Sending message...');

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

                hideLoader(); // Hide loader first
                formResponse.className = 'form-response success';
                formResponse.textContent = data.message;
                formResponse.style.display = 'block';
                contactForm.reset();

                // Show success toast
                showToast('Message sent successfully!', 'success');

            } catch (error) {
                hideLoader(); // Hide loader first
                formResponse.className = 'form-response error';
                formResponse.textContent = error.message || 'An error occurred. Please try again.';
                formResponse.style.display = 'block';
                showToast('Failed to send message', 'error');
            } finally {
                btnText.style.display = 'inline-block';
                submitBtn.disabled = false;
            }
        });
    }

    // =============================================
    // TESTIMONIAL SYSTEM - UPDATED (No Clone Cards)
    // =============================================

    const testimonialSystem = {
        isModalOpen: false,
        currentTestimonials: [],
        currentIndex: 0,
        autoSlideInterval: null,
        testimonialToDelete: null,
        testimonialToEdit: null,
        autoPlayDelay: 5000, // 5 seconds for smooth chain movement
        cardsPerView: 3,
        isAnimating: false,
        isAutoPlay: true,
        direction: 'forward', // Always left to right
        trackWidth: 0,
        testimonialDetailModal: null,
        currentDetailTestimonial: null,

        // Add new properties for touch/swipe
        touchStartX: 0,
        touchStartY: 0,
        touchEndX: 0,
        touchEndY: 0,
        minSwipeDistance: 50,
        isTouchDevice: false,
        isDragging: false,
        dragStartX: 0,
        currentTranslateX: 0,

        init() {
            console.log('🚀 Initializing testimonial system...');
            this.loadTestimonials();
            this.bindEvents();
            this.setupDetailModal();
            this.bindGlobalEventListeners();
            this.setupSwipeGestures();
            if (this.currentTestimonials.length > 3 && this.isAutoPlay) {
                setTimeout(() => this.startAutoSlide(), 1000);
            }
        },

        detectTouchDevice() {
            this.isTouchDevice = ('ontouchstart' in window) ||
                                (navigator.maxTouchPoints > 0) ||
                                (navigator.msMaxTouchPoints > 0);
            console.log('📱 Touch device detected:', this.isTouchDevice);
        },

        setupSwipeGestures() {
            const track = document.getElementById('testimonialTrack');
            if (!track) return;

            // Mouse events for desktop touchpad
            track.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            track.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            track.addEventListener('mouseup', () => this.handleMouseUp());
            track.addEventListener('mouseleave', () => this.handleMouseUp());

            // Touch events for mobile devices
            track.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
            track.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            track.addEventListener('touchend', (e) => this.handleTouchEnd(e));

            // Prevent text selection while dragging
            track.addEventListener('selectstart', (e) => {
                if (this.isDragging) e.preventDefault();
            });
        },

        handleMouseDown(e) {
            if (this.isAnimating) return;

            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.currentTranslateX = this.getCurrentTranslateX();

            // Pause auto-slide during drag
            this.pauseAutoSlide();

            // Add dragging class for visual feedback
            const track = document.getElementById('testimonialTrack');
            if (track) track.classList.add('dragging');

            // Prevent text selection
            e.preventDefault();
        },

        handleMouseMove(e) {
            if (!this.isDragging || this.isAnimating) return;

            const dragCurrentX = e.clientX;
            const dragDistance = dragCurrentX - this.dragStartX;

            // Apply drag effect with resistance
            const resistance = 0.5;
            const newTranslateX = this.currentTranslateX + (dragDistance * resistance);

            const track = document.getElementById('testimonialTrack');
            if (track) {
                track.style.transition = 'none';
                track.style.transform = `translateX(${newTranslateX}px)`;
            }

            e.preventDefault();
        },

        handleMouseUp() {
            if (!this.isDragging) return;

            this.isDragging = false;

            const track = document.getElementById('testimonialTrack');
            if (track) {
                track.classList.remove('dragging');

                // Calculate final drag distance
                const dragEndX = event ? event.clientX : 0;
                const dragDistance = dragEndX - this.dragStartX;

                // Determine if it's a swipe
                if (Math.abs(dragDistance) > this.minSwipeDistance) {
                    if (dragDistance < 0) {
                        // Swipe left - next slide
                        this.nextSlide();
                    } else {
                        // Swipe right - previous slide
                        this.prevSlide();
                    }
                } else {
                    // Not a swipe, snap back to current position
                    this.updateCarousel();
                }
            }

            // Resume auto-slide after a delay
            if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                setTimeout(() => this.startAutoSlide(), 1000);
            }
        },

        handleTouchStart(e) {
            if (this.isAnimating) return;

            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.isDragging = true;

            // Pause auto-slide during touch
            this.pauseAutoSlide();

            // Add dragging class
            const track = document.getElementById('testimonialTrack');
            if (track) track.classList.add('dragging');
        },

        handleTouchMove(e) {
            if (!this.isDragging || this.isAnimating) return;

            const touch = e.touches[0];
            const touchCurrentX = touch.clientX;
            const touchDistance = touchCurrentX - this.touchStartX;

            // Only prevent default if horizontal movement is significant
            if (Math.abs(touchDistance) > 10) {
                e.preventDefault();
            }

            // Apply touch drag with resistance
            const resistance = 0.7;
            const newTranslateX = this.getCurrentTranslateX() + (touchDistance * resistance);

            const track = document.getElementById('testimonialTrack');
            if (track) {
                track.style.transition = 'none';
                track.style.transform = `translateX(${newTranslateX}px)`;
            }
        },

        handleTouchEnd(e) {
            if (!this.isDragging) return;

            this.isDragging = false;

            const touch = e.changedTouches[0];
            this.touchEndX = touch.clientX;
            this.touchEndY = touch.clientY;

            const track = document.getElementById('testimonialTrack');
            if (track) track.classList.remove('dragging');

            // Calculate swipe distance and direction
            const swipeDistanceX = this.touchEndX - this.touchStartX;
            const swipeDistanceY = this.touchEndY - this.touchStartY;

            // Check if it's a horizontal swipe (not vertical scroll)
            if (Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY) &&
                Math.abs(swipeDistanceX) > this.minSwipeDistance) {

                if (swipeDistanceX < 0) {
                    // Swipe left - next slide
                    this.nextSlide();
                } else {
                    // Swipe right - previous slide
                    this.prevSlide();
                }
            } else {
                // Not a valid swipe, snap back
                this.updateCarousel();
            }

            // Resume auto-slide
            if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                setTimeout(() => this.startAutoSlide(), 1500);
            }
        },

        getCurrentTranslateX() {
            const track = document.getElementById('testimonialTrack');
            if (!track) return 0;

            const style = window.getComputedStyle(track);
            const matrix = new DOMMatrixReadOnly(style.transform);
            return matrix.m41; // The translateX value
        },
        // End Touch Functions //

        // Detail modal :
        setupDetailModal() {
            this.testimonialDetailModal = document.getElementById('testimonialDetailModal');
            if (this.testimonialDetailModal) {
                // Close modal handlers
                const closeBtn = this.testimonialDetailModal.querySelector('.close-modal');
                const overlay = this.testimonialDetailModal.querySelector('.modal-overlay');

                if (closeBtn) {
                    closeBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.closeDetailModal();
                    });
                }

                if (overlay) {
                    overlay.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.closeDetailModal();
                    });
                }

                // Close with escape key
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && this.testimonialDetailModal.style.display === 'flex') {
                        this.closeDetailModal();
                    }
                });
            }
        },

        // Add this function to open detail modal:
        openDetailModal(testimonial) {
            if (!this.testimonialDetailModal) return;

            this.currentDetailTestimonial = testimonial;

            // Populate modal with testimonial data
            const avatar = document.getElementById('detailAvatar');
            const authorName = document.getElementById('detailAuthorName');
            const rating = document.getElementById('detailRating');
            const fullText = document.getElementById('detailFullText');
            const date = document.getElementById('detailDate');

            if (avatar) {
                avatar.src = testimonial.profile_pic_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.username)}&background=10b981&color=fff&bold=true`;
                avatar.alt = testimonial.username;
            }

            if (authorName) {
                authorName.textContent = testimonial.username;
            }

            if (rating) {
                rating.innerHTML = Array.from({length: 5}, (_, i) =>
                    `<span class="star ${i < testimonial.rating ? '' : 'empty'}">★</span>`
                ).join('');
            }

            if (fullText) {
                fullText.textContent = testimonial.content;
            }

            if (date && testimonial.created_at) {
                const formattedDate = new Date(testimonial.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                date.textContent = `Shared on ${formattedDate}`;
            }

            // Show modal
            this.testimonialDetailModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        },

        // Add this function to handle Read More clicks:
        setupReadMoreHandlers() {
            const readMoreLinks = document.querySelectorAll('.read-more-link');
            readMoreLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const testimonialId = link.getAttribute('data-testimonial-id');
                    this.openTestimonialDetail(testimonialId);
                });
            });
        },

        // Add this function to open detail view:
        openTestimonialDetail(testimonialId) {
            const testimonial = this.currentTestimonials.find(t => t.id === testimonialId);
            if (testimonial) {
                this.openDetailModal(testimonial);
            }
        },

        // Add this function to close detail modal:
        closeDetailModal() {
            if (!this.testimonialDetailModal) return;

            this.testimonialDetailModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.currentDetailTestimonial = null;
        },


        bindEvents() {
            // Main testimonial button
            const testimonialBtn = document.getElementById('testimonialBtn');
            if (testimonialBtn) {
                testimonialBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openTestimonialForm();
                });
            }

            // Navigation buttons
            const prevBtn = document.querySelector('.carousel-prev');
            const nextBtn = document.querySelector('.carousel-next');
            if (prevBtn) prevBtn.addEventListener('click', () => this.prevSlide());
            if (nextBtn) nextBtn.addEventListener('click', () => this.nextSlide());

            // Auto-play indicator click
            const autoPlayIndicator = document.getElementById('autoPlayIndicator');
            if (autoPlayIndicator) {
                autoPlayIndicator.addEventListener('click', () => this.toggleAutoPlay());
            }

            // Modal events
            this.setupModalEvents();

            // Pause on hover (only for non-touch devices)
            if (!this.isTouchDevice) {
                const carousel = document.querySelector('.testimonials-carousel');
                if (carousel) {
                    carousel.addEventListener('mouseenter', () => this.pauseAutoSlide());
                    carousel.addEventListener('mouseleave', () => {
                        if (this.isAutoPlay && this.currentTestimonials.length > 3) this.startAutoSlide();
                    });
                }
            }

            // Handle window resize
            window.addEventListener('resize', () => this.handleResize());

            // Handle wheel events for touchpad/mouse wheel
            this.setupWheelNavigation();
        },

        setupWheelNavigation() {
            const carousel = document.querySelector('.testimonials-carousel');
            if (!carousel) return;

            let wheelTimeout;
            let wheelDelta = 0;

            carousel.addEventListener('wheel', (e) => {
                // Only handle horizontal wheel events
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                    e.preventDefault();

                    wheelDelta += e.deltaX;

                    // Clear previous timeout
                    clearTimeout(wheelTimeout);

                    // Set a timeout to trigger navigation after wheel stops
                    wheelTimeout = setTimeout(() => {
                        if (Math.abs(wheelDelta) > 100) { // Sensitivity threshold
                            if (wheelDelta > 0) {
                                this.prevSlide(); // Wheel right = previous
                            } else {
                                this.nextSlide(); // Wheel left = next
                            }
                        }
                        wheelDelta = 0; // Reset delta
                    }, 150);
                }
            }, { passive: false });
        },

        setupModalEvents() {
            // Close buttons
            const closeButtons = document.querySelectorAll('.close-btn');
            closeButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const modal = btn.closest('.modal');
                    if (modal.id === 'testimonialModal') {
                        this.closeModal();
                    } else if (modal.id === 'deleteConfirmModal') {
                        this.closeDeleteModal();
                    }
                });
            });

            // Modal overlays
            const overlays = document.querySelectorAll('.modal-overlay');
            overlays.forEach(overlay => {
                overlay.addEventListener('click', (e) => {
                    e.preventDefault();
                    const modal = overlay.closest('.modal');
                    if (modal.id === 'testimonialModal') {
                        this.closeModal();
                    } else if (modal.id === 'deleteConfirmModal') {
                        this.closeDeleteModal();
                    }
                });
            });

            // Cancel buttons
            const cancelBtns = document.querySelectorAll('.btn-secondary');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const modal = btn.closest('.modal');
                    if (modal.id === 'testimonialModal') {
                        this.closeModal();
                    } else if (modal.id === 'deleteConfirmModal') {
                        this.closeDeleteModal();
                    }
                });
            });

            // Form submission
            const form = document.getElementById('testimonialForm');
            if (form) {
                form.addEventListener('submit', (e) => this.handleSubmit(e));
            }

            // Delete confirmation
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.confirmDelete());
            }
        },

        async openTestimonialForm() {
            console.log('📝 Opening testimonial form...');

            try {
                const response = await fetch('/api/testimonial/auth-check');
                const data = await response.json();

                if (data.can_post) {
                    this.showModal(data.username);
                } else {
                    this.showLoginPrompt();
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                this.showLoginPrompt();
            }
        },

        showModal(username, testimonial = null) {
            const isEdit = !!testimonial;
            const modal = document.getElementById('testimonialModal');
            const modalTitle = document.getElementById('modalTitle');
            const userName = document.getElementById('userName');
            const testimonialText = document.getElementById('testimonialText');
            const ratingValue = document.getElementById('ratingValue');
            const submitBtn = document.querySelector('#testimonialForm .btn-text');

            if (!modal) {
                console.error('❌ Testimonial modal not found');
                return;
            }

            // Store the testimonial ID if editing
            if (isEdit) {
                this.testimonialToEdit = testimonial.id;
            } else {
                this.testimonialToEdit = null;
            }

            modalTitle.textContent = isEdit ? 'Edit Your Experience' : 'Share Your Experience';
            userName.value = username || 'Current User';
            testimonialText.value = isEdit ? testimonial.content : '';
            ratingValue.value = isEdit ? testimonial.rating : 5;
            if (submitBtn) submitBtn.textContent = isEdit ? 'Update Experience' : 'Share Experience';

            this.setupStarRating(isEdit ? testimonial.rating : 5);
            modal.style.display = 'flex';
            this.isModalOpen = true;
        },

        setupStarRating(initialRating = 5) {
            const stars = document.querySelectorAll('.star-btn');
            const ratingInput = document.getElementById('ratingValue');

            stars.forEach((star, index) => {
                star.classList.toggle('active', index < initialRating);
                star.innerHTML = index < initialRating ? '★' : '☆';

                star.onclick = () => {
                    const rating = parseInt(star.dataset.rating);
                    ratingInput.value = rating;

                    stars.forEach((s, i) => {
                        s.classList.toggle('active', i < rating);
                        s.innerHTML = i < rating ? '★' : '☆';
                    });
                };
            });
        },

        async handleSubmit(event) {
            event.preventDefault();
            console.log('📤 Submitting testimonial...');

            const form = event.target;
            const submitBtn = form.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn-text');
            const spinner = submitBtn.querySelector('.loading-spinner');
            const messageDiv = document.getElementById('formMessage');

            const content = document.getElementById('testimonialText').value.trim();
            const rating = parseInt(document.getElementById('ratingValue').value);

            if (!content) {
                this.showMessage('Please share your experience', 'error', messageDiv);
                return;
            }

            btnText.style.display = 'none';
            spinner.style.display = 'inline-block';
            submitBtn.disabled = true;

            try {
                // Determine if this is an edit or create operation
                const isEdit = !!this.testimonialToEdit;
                const url = isEdit
                    ? `/api/testimonial/update/${this.testimonialToEdit}`
                    : '/api/testimonial/submit';

                const method = isEdit ? 'PUT' : 'POST';

                console.log(`${isEdit ? 'Editing' : 'Creating'} testimonial:`, {
                    url,
                    method,
                    content,
                    rating
                });

                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: content,
                        rating: rating
                    })
                });

                const data = await response.json();

                if (data.success) {
                    this.showMessage(data.message, 'success', messageDiv);
                    setTimeout(() => {
                        this.closeModal();
                        this.loadTestimonials(); // Reload to get updated list
                        if (typeof showToast === 'function') {
                            showToast(
                                isEdit
                                    ? 'Experience updated successfully!'
                                    : 'Thank you for sharing your experience!',
                                'success'
                            );
                        }
                    }, 1500);
                } else {
                    throw new Error(data.message);
                }

            } catch (error) {
                console.error('Submission error:', error);
                this.showMessage(error.message, 'error', messageDiv);
            } finally {
                btnText.style.display = 'inline-block';
                spinner.style.display = 'none';
                submitBtn.disabled = false;
            }
        },

        showDeleteConfirmation(testimonialId) {
            this.testimonialToDelete = testimonialId;
            const modal = document.getElementById('deleteConfirmModal');
            if (modal) {
                modal.style.display = 'flex';
            }
        },

        async confirmDelete() {
            if (!this.testimonialToDelete) return;

            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const btnText = deleteBtn.querySelector('.btn-text');
            const spinner = deleteBtn.querySelector('.loading-spinner');

            btnText.style.display = 'none';
            spinner.style.display = 'inline-block';
            deleteBtn.disabled = true;

            try {
                const response = await fetch(`/api/testimonial/delete/${this.testimonialToDelete}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    this.closeDeleteModal();
                    if (typeof showToast === 'function') {
                        showToast('Testimonial deleted successfully!', 'success');
                    }
                    this.loadTestimonials();
                } else {
                    throw new Error(data.message);
                }

            } catch (error) {
                console.error('Delete error:', error);
                if (typeof showToast === 'function') {
                    showToast(error.message, 'error');
                }
            } finally {
                btnText.style.display = 'inline-block';
                spinner.style.display = 'none';
                deleteBtn.disabled = false;
            }
        },

        deleteTestimonial(testimonialId) {
            console.log('🗑️ Deleting testimonial:', testimonialId);
            this.showDeleteConfirmation(testimonialId);
        },

        showMessage(message, type, element) {
            if (element) {
                element.textContent = message;
                element.className = `form-message ${type}`;
                element.style.display = 'block';
            }
        },

        showLoginPrompt() {
            if (typeof showToast === 'function') {
                showToast('Please login to share your experience', 'warning');
            }

            if (typeof openLoginModal === 'function') {
                openLoginModal();
            }
        },

        closeModal() {
            const modal = document.getElementById('testimonialModal');
            if (modal) {
                modal.style.display = 'none';
                this.clearForm();
            }
            this.isModalOpen = false;
            this.testimonialToEdit = null; // Reset edit state
        },

        closeDeleteModal() {
            const modal = document.getElementById('deleteConfirmModal');
            if (modal) {
                modal.style.display = 'none';
            }
            this.testimonialToDelete = null;
        },

        clearForm() {
            const testimonialText = document.getElementById('testimonialText');
            const messageDiv = document.getElementById('formMessage');

            if (testimonialText) testimonialText.value = '';
            if (messageDiv) {
                messageDiv.style.display = 'none';
                messageDiv.textContent = '';
            }

            this.setupStarRating(5);
            this.testimonialToEdit = null; // Reset edit state
        },

        async loadTestimonials() {
            try {
                const track = document.getElementById('testimonialTrack');
                if (!track) {
                    console.error('❌ Testimonial track not found');
                    return;
                }

                track.innerHTML = `
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading experiences...</p>
                    </div>
                `;

                const response = await fetch('/api/testimonial/list');
                const data = await response.json();

                console.log('📊 Loaded testimonials from backend:', data);

                if (data.testimonials) {
                    this.currentTestimonials = data.testimonials;
                } else {
                    throw new Error('No testimonials data received');
                }

                this.renderTestimonials();
                this.updateNavigation();

            } catch (error) {
                console.error('❌ Failed to load testimonials:', error);
                const track = document.getElementById('testimonialTrack');
                if (track) {
                    track.innerHTML = `
                        <div class="empty-testimonials">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h4>Unable to Load Experiences</h4>
                            <p>Please try again later</p>
                        </div>`;
                }
            }
        },

        bindGlobalEventListeners() {
            // Use event delegation for all testimonial actions
            document.addEventListener('click', async (e) => {
                // Edit button
                if (e.target.closest('.btn-edit')) {
                    e.preventDefault();
                    e.stopPropagation();

                    const editBtn = e.target.closest('.btn-edit');
                    const testimonialCard = editBtn.closest('.testimonial-card');

                    if (testimonialCard) {
                        const testimonialId = testimonialCard.dataset.testimonialId;
                        if (testimonialId) {
                            await this.handleEditClick(testimonialId);
                        }
                    }
                }

                // Delete button
                if (e.target.closest('.btn-delete')) {
                    e.preventDefault();
                    e.stopPropagation();

                    const deleteBtn = e.target.closest('.btn-delete');
                    const testimonialCard = deleteBtn.closest('.testimonial-card');

                    if (testimonialCard) {
                        const testimonialId = testimonialCard.dataset.testimonialId;
                        if (testimonialId) {
                            this.deleteTestimonial(testimonialId);
                        }
                    }
                }

                // Read More button (updated to use event delegation for buttons)
                if (e.target.closest('.read-more-link')) {
                    e.preventDefault();
                    e.stopPropagation();

                    const link = e.target.closest('.read-more-link');
                    const testimonialId = link.getAttribute('data-testimonial-id');
                    if (testimonialId) {
                        this.openTestimonialDetail(testimonialId);
                    }
                }
            });
        },

        async handleEditClick(testimonialId) {
            console.log('✏️ Edit button clicked for testimonial:', testimonialId);

            try {
                // First check if user is logged in
                const authResponse = await fetch('/api/testimonial/auth-check');
                const authData = await authResponse.json();

                if (!authData.can_post) {
                    this.showLoginPrompt();
                    return;
                }

                // Find the testimonial in current list
                const testimonial = this.currentTestimonials.find(t => t.id === testimonialId);

                if (!testimonial) {
                    console.error('Testimonial not found:', testimonialId);
                    showToast('Testimonial not found', 'error');
                    return;
                }

                // Check if user can edit this testimonial
                if (!testimonial.can_edit) {
                    showToast('You can only edit your own testimonials', 'error');
                    return;
                }

                // Open modal with testimonial data
                this.showModal(authData.username || 'User', testimonial);

            } catch (error) {
                console.error('Error checking edit permissions:', error);
                showToast('Unable to edit testimonial', 'error');
            }
        },

        renderTestimonials() {
            const track = document.getElementById('testimonialTrack');
            if (!track) return;

            if (this.currentTestimonials.length === 0) {
                track.innerHTML = `
                    <div class="empty-testimonials">
                        <i class="fas fa-comments"></i>
                        <h4>No Experiences Shared Yet</h4>
                        <p>Be the first to share your journey!</p>
                    </div>`;
                this.stopAutoSlide();
                this.updateNavigation();
                return;
            }

            // Create testimonial cards - ONE CARD PER TESTIMONIAL
            const cardsHTML = this.currentTestimonials.map((testimonial, index) => {
                const canEdit = testimonial.can_edit || false;
                // Check if text is long enough to need truncation
                const needsTruncation = testimonial.content.length > 300;
                const truncatedText = needsTruncation ?
                    testimonial.content.substring(0, 300) + '...' :
                    testimonial.content;

                return `
                <div class="testimonial-card"
                     data-index="${index}"
                     data-testimonial-id="${testimonial.id}">
                    <div class="testimonial-card-inner">
                        <div class="testimonial-quote">"</div>

                        ${canEdit ? `
                        <div class="testimonial-actions">
                            <button class="btn-edit" data-testimonial-id="${testimonial.id}" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-delete" data-testimonial-id="${testimonial.id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        ` : ''}

                        <div class="testimonial-rating">
                            ${Array.from({length: 5}, (_, i) =>
                                `<span class="star ${i < testimonial.rating ? '' : 'empty'}">★</span>`
                            ).join('')}
                        </div>

                        <div class="testimonial-text-container">
                            <p class="testimonial-text" title="${testimonial.content}">${truncatedText}</p>
                        </div>

                        <div class="read-more-section">
                            <button class="read-more-link" data-testimonial-id="${testimonial.id}">
                                <span>Read Full Experience</span>
                                <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>

                        <div class="testimonial-author">
                            <img src="${testimonial.profile_pic_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(testimonial.username) + '&background=10b981&color=fff&bold=true'}"
                                 alt="${testimonial.username}"
                                 class="author-avatar"
                                 onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.username)}&background=10b981&color=fff&bold=true'">
                            <div class="author-info">
                                <h4>${testimonial.username}</h4>
                                <p>CareerMaker User</p>
                            </div>
                        </div>
                    </div>
                </div>
            `}).join('');

            track.innerHTML = cardsHTML;

            // Add click handlers for Read More links
            this.setupReadMoreHandlers();

            // Calculate track width
            this.calculateTrackWidth();

            // Set initial position
            this.currentIndex = 0;
            this.updateCarousel();
            this.updateDots();
            this.updateButtonStates();

            // Start auto-slide only if we have more than 3 testimonials
            if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                setTimeout(() => this.startAutoSlide(), 1000);
            }
        },

        calculateTrackWidth() {
            const track = document.getElementById('testimonialTrack');
            if (!track) return;

            const cards = track.querySelectorAll('.testimonial-card');
            const cardWidth = 340; // Fixed card width from CSS
            const gap = 30; // Gap between cards from CSS

            this.trackWidth = (cards.length * cardWidth) + ((cards.length - 1) * gap);
            track.style.width = `${this.trackWidth}px`;
        },

        nextSlide() {
            if (this.currentTestimonials.length <= 3 || this.isAnimating) return;

            this.isAnimating = true;
            this.pauseAutoSlide();

            // Move to next testimonial - chain movement
            const nextIndex = this.currentIndex + 1;

            // Check if we're at the end
            if (nextIndex >= this.currentTestimonials.length) {
                // We've reached the end - for chain effect, we should animate to show
                // that we're wrapping around, but visually continue in same direction
                this.currentIndex = 0;

                // Reset transform position for seamless chain effect
                const track = document.getElementById('testimonialTrack');
                if (track) {
                    // Quickly reset to start without animation
                    track.style.transition = 'none';
                    track.style.transform = 'translateX(0)';

                    // Force reflow
                    void track.offsetWidth;

                    // Restore transition
                    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                }
            } else {
                this.currentIndex = nextIndex;
            }

            this.updateCarousel();
            this.updateDots();
            this.updateButtonStates();

            setTimeout(() => {
                this.isAnimating = false;
                if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                    this.startAutoSlide();
                }
            }, 600);
        },

        prevSlide() {
            if (this.currentTestimonials.length <= 3 || this.isAnimating) return;

            this.isAnimating = true;
            this.pauseAutoSlide();

            // For chain movement in one direction, "previous" should actually show
            // the last card to continue the visual flow
            const prevIndex = this.currentIndex - 1;

            if (prevIndex < 0) {
                // Go to the last card to continue chain movement
                this.currentIndex = this.currentTestimonials.length - 1;

                // For visual continuity, we need to jump to a position that makes sense
                const track = document.getElementById('testimonialTrack');
                if (track) {
                    const cardWidth = 340;
                    const gap = 30;
                    const totalCards = this.currentTestimonials.length;
                    // Jump to a position that shows we're going "back" to the end
                    const jumpPosition = -(totalCards * (cardWidth + gap));

                    track.style.transition = 'none';
                    track.style.transform = `translateX(${jumpPosition}px)`;

                    // Force reflow
                    void track.offsetWidth;

                    // Restore transition and animate to correct position
                    track.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                }
            } else {
                this.currentIndex = prevIndex;
            }

            this.updateCarousel();
            this.updateDots();
            this.updateButtonStates();

            setTimeout(() => {
                this.isAnimating = false;
                if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                    this.startAutoSlide();
                }
            }, 600);
        },

        goToSlide(index) {
            if (this.currentTestimonials.length <= 3 || this.isAnimating) return;

            this.isAnimating = true;
            this.pauseAutoSlide();

            // Ensure index is within bounds
            const targetIndex = Math.max(0, Math.min(index, this.currentTestimonials.length - 1));
            this.currentIndex = targetIndex;

            this.updateCarousel();
            this.updateDots();
            this.updateButtonStates();

            setTimeout(() => {
                this.isAnimating = false;
                if (this.isAutoPlay) {
                    this.startAutoSlide();
                }
            }, 600);
        },

        updateCarousel() {
            const track = document.getElementById('testimonialTrack');
            if (!track || this.currentTestimonials.length === 0) return;

            const cardWidth = 340;
            const gap = 30;
            const translateX = -(this.currentIndex * (cardWidth + gap));

            track.style.transform = `translateX(${translateX}px)`;

            // Update card states for chain effect
            this.updateCardStates();
        },

        updateCardStates() {
            const cards = document.querySelectorAll('.testimonial-card');

            cards.forEach((card, index) => {
                // Remove all state classes
                card.classList.remove('active', 'prev-card', 'next-card');

                if (index === this.currentIndex) {
                    // Current active card
                    card.classList.add('active');
                } else if (index === (this.currentIndex + 1) % this.currentTestimonials.length) {
                    // Next card
                    card.classList.add('next-card');
                } else if (index === (this.currentIndex - 1 + this.currentTestimonials.length) % this.currentTestimonials.length) {
                    // Previous card
                    card.classList.add('prev-card');
                }
            });
        },

        updateDots() {
            const dotsContainer = document.getElementById('carouselDots');
            if (!dotsContainer) return;

            // Only show dots when we have more than 3 testimonials
            if (this.currentTestimonials.length <= 3) {
                dotsContainer.style.display = 'none';
                return;
            }

            dotsContainer.style.display = 'flex';
            dotsContainer.innerHTML = '';

            // Create dots for each testimonial
            for (let i = 0; i < this.currentTestimonials.length; i++) {
                const dot = document.createElement('button');
                dot.className = `carousel-dot ${i === this.currentIndex ? 'active' : ''}`;
                dot.setAttribute('data-index', i);
                dot.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
                dot.title = i === this.currentIndex ? 'Current testimonial' : `Go to testimonial ${i + 1}`;

                dot.addEventListener('click', () => this.goToSlide(i));
                dotsContainer.appendChild(dot);
            }
        },

        updateButtonStates() {
            const prevBtn = document.querySelector('.carousel-prev');
            const nextBtn = document.querySelector('.carousel-next');

            if (prevBtn && nextBtn) {
                // Only enable buttons when we have more than 3 testimonials
                const canScroll = this.currentTestimonials.length > 3;
                prevBtn.disabled = !canScroll;
                nextBtn.disabled = !canScroll;

                // Update tooltips
                prevBtn.title = canScroll ? 'View previous testimonial' : 'No previous testimonials';
                nextBtn.title = canScroll ? 'View next testimonial' : 'No more testimonials';
            }
        },

        updateNavigation() {
            const navContainer = document.querySelector('.carousel-nav-container');
            if (!navContainer) return;

            // Show navigation only when we have more than 3 testimonials
            const canScroll = this.currentTestimonials.length > 3;
            navContainer.style.display = canScroll ? 'flex' : 'none';

            // Also update button states
            this.updateButtonStates();
        },

        toggleAutoPlay() {
            this.isAutoPlay = !this.isAutoPlay;

            const indicator = document.getElementById('autoPlayIndicator');
            if (indicator) {
                const icon = indicator.querySelector('i');
                const text = indicator.querySelector('span');

                if (this.isAutoPlay) {
                    icon.className = 'fas fa-play-circle';
                    text.textContent = 'Auto';
                    indicator.title = 'Auto-play enabled';
                    if (this.currentTestimonials.length > 3) {
                        this.startAutoSlide();
                    }
                } else {
                    icon.className = 'fas fa-pause-circle';
                    text.textContent = 'Paused';
                    indicator.title = 'Auto-play paused';
                    this.stopAutoSlide();
                }
            }
        },

        startAutoSlide() {
            this.stopAutoSlide();

            // Only start auto-slide when we have more than 3 testimonials AND auto-play is enabled
            if (this.currentTestimonials.length > 3 && this.isAutoPlay) {
                this.autoSlideInterval = setInterval(() => {
                    this.nextSlide();
                }, this.autoPlayDelay);

                // Update indicator if exists
                const indicator = document.getElementById('autoPlayIndicator');
                if (indicator) {
                    indicator.querySelector('i').className = 'fas fa-play-circle';
                    indicator.querySelector('span').textContent = 'Auto';
                    indicator.style.display = 'flex'; // Make sure it's visible
                }
            }
        },

        stopAutoSlide() {
            if (this.autoSlideInterval) {
                clearInterval(this.autoSlideInterval);
                this.autoSlideInterval = null;
            }
        },

        pauseAutoSlide() {
            this.stopAutoSlide();
        },

        handleResize() {
            // Recalculate on resize
            this.calculateTrackWidth();
            this.updateCarousel();
        }
    };

    // =============================================
    // BLOG MODAL SYSTEM - UPDATED
    // =============================================

    const blogModal = {
        currentBlogId: null,
        isOpen: false,

        init() {
            console.log('🌟 Blog modal system initialized');
            this.initializeEventListeners();
            this.limitBlogCards(); // Show only 3 latest cards on homepage
        },

        limitBlogCards() {
            // Only apply to homepage, not blogs.html
            if (!window.location.pathname.includes('blogs.html')) {
                const blogCards = document.querySelectorAll('.blog-card-vertical');
                if (blogCards.length > 3) {
                    blogCards.forEach((card, index) => {
                        if (index >= 3) {
                            card.style.display = 'none';
                        }
                    });

                    // Show View All button only if there are more than 3 blogs
                    const viewAllSection = document.querySelector('.blog-section-footer');
                    if (viewAllSection) {
                        viewAllSection.style.display = 'block';
                    }
                } else {
                    // Hide View All button if 3 or fewer blogs
                    const viewAllSection = document.querySelector('.blog-section-footer');
                    if (viewAllSection) {
                        viewAllSection.style.display = 'none';
                    }
                }
            }
        },

        initializeEventListeners() {
            // Read More buttons
            document.addEventListener('click', (e) => {
                const readMoreBtn = e.target.closest('.read-more-btn-vertical');
                if (readMoreBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const blogId = readMoreBtn.dataset.id;
                    this.openModal(blogId);
                }

                // Bookmark buttons in cards
                const bookmarkBtn = e.target.closest('.btn-bookmark-vertical');
                if (bookmarkBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const blogId = bookmarkBtn.dataset.id;
                    this.handleBookmark(bookmarkBtn, blogId);
                }

                // Bookmark button in modal
                const modalBookmarkBtn = e.target.closest('#modalBookmarkBtn');
                if (modalBookmarkBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const blogId = modalBookmarkBtn.dataset.id;
                    this.handleBookmark(modalBookmarkBtn, blogId);
                }

                // Like buttons in cards - REQUIRES LOGIN
                const likeBtn = e.target.closest('.btn-like-vertical');
                if (likeBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const blogId = likeBtn.dataset.id;
                    this.handleLike(likeBtn, blogId);
                }

                // Like button in modal - REQUIRES LOGIN
                const modalLikeBtn = e.target.closest('.btn-like-modal');
                if (modalLikeBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const blogId = modalLikeBtn.dataset.id;
                    this.handleLike(modalLikeBtn, blogId);
                }
            });

            // Close modal with escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.closeModal();
                }
            });

            // Handle View All button
            const viewAllBtn = document.querySelector('.view-all-blogs');
            if (viewAllBtn) {
                viewAllBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = '/blogs.html';
                });
            }
        },

        async openModal(blogId) {
            try {
                console.log('📖 Opening blog modal for:', blogId);
                showLoading();

                // Fetch blog details
                const response = await fetch(`/api/blog/${blogId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load blog post');
                }

                if (!data.success) {
                    throw new Error(data.error || 'Blog post not found');
                }

                const blog = data.blog;
                this.currentBlogId = blogId;

                // Populate modal with blog data
                this.populateModal(blog);

                // Show modal
                document.getElementById('blogDetailModal').style.display = 'flex';
                document.body.style.overflow = 'hidden';
                this.isOpen = true;

                // Track view - COUNT VIEW WHEN MODAL OPENS (NO LOGIN REQUIRED)
                this.trackView(blogId);

            } catch (error) {
                console.error('❌ Error loading blog:', error);
                showToast('Failed to load blog post', 'error');
            } finally {
                hideLoading();
            }
        },

        populateModal(blog) {
            // Set category
            const category = blog.categories?.[0] || 'Career';
            document.getElementById('modalCategory').textContent = category;

            // Set title
            document.getElementById('modalTitle').textContent = blog.title;

            // Set author info
            document.getElementById('modalAuthorName').textContent = blog.author || 'CareerMaker Team';

            // Format date
            const date = blog.published_at || blog.created_at;
            document.getElementById('modalDate').textContent = this.formatDate(date);

            // Set read time and views
            document.getElementById('modalReadTime').innerHTML =
                `<i class="far fa-clock"></i> ${blog.read_time || '5 min read'}`;

            // Set view count
            document.getElementById('viewsCount').textContent = blog.views || 0;

            // Set images
            const modalImage = document.getElementById('modalImage');
            modalImage.src = blog.image || '/static/images/default-blog.jpg';
            modalImage.alt = blog.title;

            const authorAvatar = document.getElementById('modalAuthorAvatar');
            authorAvatar.src = blog.author_avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(blog.author || 'CareerMaker Team')}&background=8B5FBF&color=fff&bold=true`;
            authorAvatar.alt = blog.author || 'CareerMaker Team';

            // Set content
            const contentElement = document.getElementById('modalContent');
            contentElement.innerHTML = this.formatContent(blog.content || blog.description || 'No content available.');

            // Setup bookmark button
            const bookmarkBtn = document.getElementById('modalBookmarkBtn');
            bookmarkBtn.dataset.id = blog.id;
            bookmarkBtn.classList.toggle('bookmarked', blog.is_bookmarked);

            const bookmarkIcon = bookmarkBtn.querySelector('i');
            const bookmarkText = bookmarkBtn.querySelector('.bookmark-text');

            if (blog.is_bookmarked) {
                bookmarkIcon.className = 'fas fa-bookmark';
                bookmarkText.textContent = 'Bookmarked';
            } else {
                bookmarkIcon.className = 'far fa-bookmark';
                bookmarkText.textContent = 'Bookmark';
            }

            // Setup like button - REQUIRES LOGIN
            const likeBtn = document.getElementById('modalLikeBtn');
            likeBtn.dataset.id = blog.id;
            const likeCount = blog.like_count || 0;
            const isLiked = blog.is_liked || false;

            this.updateLikeUI(likeBtn, likeCount, isLiked);

            // Update card UI to match
            this.updateCardBookmarkStatus(blog.id, blog.is_bookmarked);
            this.updateCardLikeStatus(blog.id, likeCount, isLiked);
            this.updateCardViewStatus(blog.id, blog.views || 0);
        },

        formatContent(content) {
            // Convert plain text to HTML paragraphs
            if (!content.includes('<')) {
                return content.split('\n').filter(para => para.trim()).map(para =>
                    `<p>${para.trim()}</p>`
                ).join('');
            }
            return content;
        },

        formatDate(dateString) {
            if (!dateString) return 'Unknown date';

            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (error) {
                return dateString;
            }
        },

        async handleBookmark(button, blogId) {
            try {
                // Check if user is logged in (required for bookmarking)
                const sessionResponse = await fetch('/api/check-session');
                const sessionData = await sessionResponse.json();

                if (!sessionData.logged_in) {
                    showToast('Please login to bookmark articles', 'warning');
                    openLoginModal();
                    return;
                }

                const isCurrentlyBookmarked = button.classList.contains('bookmarked');
                const newBookmarkState = !isCurrentlyBookmarked;

                // Optimistic UI update
                this.updateBookmarkUI(button, newBookmarkState);

                // Make API call
                const response = await fetch(`/api/bookmark/blog/${blogId}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Bookmark operation failed');
                }

                if (data.success) {
                    const action = newBookmarkState ? 'added to' : 'removed from';
                    showToast(`Article ${action} bookmarks`, 'success');

                    // Sync all bookmark buttons for this blog
                    this.syncAllBookmarkButtons(blogId, newBookmarkState);
                } else {
                    throw new Error(data.error || 'Bookmark operation failed');
                }

            } catch (error) {
                console.error('❌ Bookmark error:', error);

                // Revert optimistic update
                const isCurrentlyBookmarked = button.classList.contains('bookmarked');
                this.updateBookmarkUI(button, !isCurrentlyBookmarked);

                showToast(error.message || 'Failed to update bookmark', 'error');
            }
        },

        async handleLike(button, blogId) {
            try {
                // Check if user is logged in (REQUIRED FOR LIKES)
                const sessionResponse = await fetch('/api/check-session');
                const sessionData = await sessionResponse.json();

                if (!sessionData.logged_in) {
                    showToast('Please login to like articles', 'warning');
                    openLoginModal();
                    return;
                }

                const isCurrentlyLiked = button.classList.contains('liked');
                const currentCount = parseInt(button.querySelector('.like-count').textContent) || 0;
                const newLikeState = !isCurrentlyLiked;
                const newCount = newLikeState ? currentCount + 1 : Math.max(0, currentCount - 1);

                // Optimistic UI update
                this.updateLikeUI(button, newCount, newLikeState);

                // Make API call
                const response = await fetch(`/api/blog/${blogId}/like`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Like operation failed');
                }

                if (data.success) {
                    const action = newLikeState ? 'liked' : 'unliked';
                    showToast(`Article ${action}`, 'success');

                    // Sync all like buttons for this blog
                    this.syncAllLikeButtons(blogId, data.like_count || newCount, newLikeState);
                } else {
                    throw new Error(data.error || 'Like operation failed');
                }

            } catch (error) {
                console.error('❌ Like error:', error);

                // Revert optimistic update
                const isCurrentlyLiked = button.classList.contains('liked');
                const currentCount = parseInt(button.querySelector('.like-count').textContent) || 0;
                const originalCount = isCurrentlyLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
                this.updateLikeUI(button, originalCount, !isCurrentlyLiked);

                showToast(error.message || 'Failed to update like', 'error');
            }
        },

        updateBookmarkUI(button, isBookmarked) {
            const icon = button.querySelector('i');
            const text = button.querySelector('.bookmark-text');

            button.classList.toggle('bookmarked', isBookmarked);

            if (icon) {
                icon.className = isBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
            }

            if (text) {
                text.textContent = isBookmarked ? 'Bookmarked' : 'Bookmark';
            }
        },

        updateLikeUI(button, count, isLiked) {
            const icon = button.querySelector('i');
            const countElement = button.querySelector('.like-count');

            button.classList.toggle('liked', isLiked);

            if (icon) {
                icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
            }

            if (countElement) {
                countElement.textContent = count;
            }
        },

        updateViewUI(blogId, viewCount) {
            // Update modal view count
            if (this.currentBlogId === blogId) {
                document.getElementById('viewsCount').textContent = viewCount;
            }

            // Update card view count
            const cardViewBadge = document.querySelector(`.blog-card-vertical[data-id="${blogId}"] .views-count`);
            if (cardViewBadge) {
                cardViewBadge.textContent = viewCount;
            }
        },

        syncAllBookmarkButtons(blogId, isBookmarked) {
            // Update all bookmark buttons for this blog
            const allBookmarkButtons = document.querySelectorAll(`.btn-bookmark-vertical[data-id="${blogId}"], #modalBookmarkBtn[data-id="${blogId}"]`);

            allBookmarkButtons.forEach(button => {
                this.updateBookmarkUI(button, isBookmarked);
            });
        },

        syncAllLikeButtons(blogId, count, isLiked) {
            // Update all like buttons for this blog
            const allLikeButtons = document.querySelectorAll(`.btn-like-vertical[data-id="${blogId}"], .btn-like-modal[data-id="${blogId}"]`);

            allLikeButtons.forEach(button => {
                this.updateLikeUI(button, count, isLiked);
            });
        },

        updateCardBookmarkStatus(blogId, isBookmarked) {
            const cardBookmarkBtn = document.querySelector(`.btn-bookmark-vertical[data-id="${blogId}"]`);
            if (cardBookmarkBtn) {
                this.updateBookmarkUI(cardBookmarkBtn, isBookmarked);
            }
        },

        updateCardLikeStatus(blogId, count, isLiked) {
            const cardLikeBtn = document.querySelector(`.btn-like-vertical[data-id="${blogId}"]`);
            if (cardLikeBtn) {
                this.updateLikeUI(cardLikeBtn, count, isLiked);
            }
        },

        updateCardViewStatus(blogId, viewCount) {
            const cardViewBadge = document.querySelector(`.blog-card-vertical[data-id="${blogId}"] .views-count`);
            if (cardViewBadge) {
                cardViewBadge.textContent = viewCount;
            }
        },

        async trackView(blogId) {
            try {
                // Track view when modal opens (NO LOGIN REQUIRED)
                const response = await fetch(`/api/blog/${blogId}/view`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();

                if (data.success) {
                    console.log('👀 View tracked for blog:', blogId, 'Total views:', data.views);
                    // Update view count in UI
                    this.updateViewUI(blogId, data.views);
                } else {
                    console.error('Failed to track view:', data.error);
                }
            } catch (error) {
                console.error('Error tracking view:', error);
            }
        },

        closeModal() {
            const modal = document.getElementById('blogDetailModal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
                this.isOpen = false;
                this.currentBlogId = null;
            }
        }
    };

    // =============================================
    // NEWSLETTER SUBSCRIPTION SYSTEM
    // =============================================

    function initializeNewsletter() {
        const newsletterForm = document.getElementById('newsletterForm');
        if (!newsletterForm) return;

        newsletterForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const emailInput = this.querySelector('input[type="email"]');
            const submitBtn = this.querySelector('button[type="submit"]');
            const responseDiv = document.getElementById('newsletterResponse');

            if (!emailInput || !submitBtn) return;

            const email = emailInput.value.trim();

            // Validate email
            if (!validateEmail(email)) {
                showToast('Please enter a valid email address', 'error');
                emailInput.focus();
                return;
            }

            // Get button text and loading icon
            const btnText = submitBtn.querySelector('.btn-text');
            const loadingIcon = submitBtn.querySelector('.loading-icon');

            // Show loading state
            if (btnText) btnText.style.display = 'none';
            if (loadingIcon) loadingIcon.style.display = 'inline-block';
            submitBtn.disabled = true;

            // Hide any previous response
            if (responseDiv) {
                responseDiv.style.display = 'none';
                responseDiv.textContent = '';
                responseDiv.className = 'form-response';
            }

            try {
                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email })
                });

                const data = await response.json();

                if (data.status === 'success') {
                    // Success - show message
                    if (responseDiv) {
                        responseDiv.className = 'form-response success';
                        responseDiv.textContent = data.message;
                        responseDiv.style.display = 'block';
                    }

                    // Show toast notification
                    showToast(data.message, 'success');

                    // Clear form
                    emailInput.value = '';

                    // Reset form state
                    const formGroup = emailInput.closest('.form-group');
                    if (formGroup) {
                        formGroup.classList.remove('has-value');
                    }

                    // Auto-hide success message after 5 seconds
                    if (responseDiv) {
                        setTimeout(() => {
                            responseDiv.style.display = 'none';
                        }, 5000);
                    }
                } else {
                    // Error from backend
                    throw new Error(data.message || 'Subscription failed');
                }

            } catch (error) {
                console.error('Newsletter subscription error:', error);

                // Show error message
                if (responseDiv) {
                    responseDiv.className = 'form-response error';
                    responseDiv.textContent = error.message || 'Failed to subscribe. Please try again.';
                    responseDiv.style.display = 'block';
                }

                showToast(error.message || 'Failed to subscribe. Please try again.', 'error');

                // Focus on email field for correction
                emailInput.focus();
                emailInput.select();

            } finally {
                // Always reset button state
                if (btnText) btnText.style.display = 'inline-block';
                if (loadingIcon) loadingIcon.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
    }

    // =============================================
    // UNSUBSCRIBE PAGE FUNCTIONALITY
    // =============================================

    function initializeUnsubscribePage() {
        const unsubscribeForm = document.querySelector('.unsubscribe-form');
        if (!unsubscribeForm) return;

        unsubscribeForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const emailInput = unsubscribeForm.querySelector('input[type="email"]');
            const submitBtn = unsubscribeForm.querySelector('button[type="submit"]');

            if (!emailInput || !submitBtn) return;

            const email = emailInput.value.trim();

            // Validate email
            if (!validateEmail(email)) {
                showToast('Please enter a valid email address', 'error');
                emailInput.focus();
                return;
            }

            // Show loading state
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            submitBtn.disabled = true;

            // Submit the form via POST to /api/unsubscribe
            // But let the backend handle the redirect
            const formData = new FormData();
            formData.append('email', email);

            fetch('/api/unsubscribe', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (response.redirected) {
                    // If backend redirects (to /unsubscribe page), follow it
                    window.location.href = response.url;
                } else {
                    // Handle JSON response
                    return response.json().then(data => {
                        if (data.status === 'success') {
                            // Show success and reload page to show flash message
                            showToast(data.message, 'success');
                            setTimeout(() => {
                                window.location.reload();
                            }, 1500);
                        } else {
                            throw new Error(data.message);
                        }
                    });
                }
            })
            .catch(error => {
                console.error('Unsubscribe error:', error);

                // Re-enable button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;

                // Show error
                showToast(error.message || 'Failed to unsubscribe. Please try again.', 'error');

                // Focus on email field
                emailInput.focus();
                emailInput.select();
            });
        });
    }

    // =============================================
    // EMAIL VALIDATION HELPER
    // =============================================

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // =============================================
    // FLASH MESSAGE HANDLER FOR UNSUBSCRIBE PAGE
    // =============================================

    function handleUnsubscribeFlashMessages() {
        // If on unsubscribe page and there are flash messages, show them
        if (window.location.pathname.includes('/unsubscribe')) {
            const flashMessages = document.querySelectorAll('.flash');
            flashMessages.forEach(message => {
                // Make sure flash messages are visible
                message.style.display = 'block';
                message.style.opacity = '1';

                // Auto-hide after 10 seconds
                setTimeout(() => {
                    message.style.opacity = '0';
                    setTimeout(() => {
                        message.remove();
                    }, 300);
                }, 10000);

                // Add close button functionality
                const closeBtn = message.querySelector('.flash-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        message.style.opacity = '0';
                        setTimeout(() => message.remove(), 300);
                    });
                }
            });

            // If there's a success message, update the page UI
            const successMessage = document.querySelector('.flash-success');
            if (successMessage) {
                // You can add additional success UI updates here
                const emailInput = document.getElementById('email');
                if (emailInput) {
                    emailInput.disabled = true;
                }
            }
        }
    }

    // =============================================
    // ONE-CLICK UNSUBSCRIBE HANDLER
    // =============================================

    function handleOneClickUnsubscribe() {
        // Check if we're on unsubscribe page with email parameter
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email');

        if (email && window.location.pathname.includes('/unsubscribe')) {
            // Auto-fill the email field
            const emailInput = document.getElementById('email');
            if (emailInput) {
                emailInput.value = email;

                // Auto-submit if there's a query parameter for one-click
                if (urlParams.get('auto') === 'true') {
                    setTimeout(() => {
                        const submitBtn = document.querySelector('.unsubscribe-form button[type="submit"]');
                        if (submitBtn) {
                            submitBtn.click();
                        }
                    }, 1000);
                }
            }
        }
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
    // Testimonial auto SCROLL + MODAL AUTO-OPEN
    // =============================================

    function handleDashboardTestimonialRedirect() {
        console.log('🔍 Checking for dashboard redirect...');

        // Check if we came from dashboard and should scroll+open
        const shouldScrollAndOpen = localStorage.getItem('dashboardTestimonialAction') === 'scroll-and-open';
        const isTestimonialSection = window.location.hash === '#testimonials-section';

        if (shouldScrollAndOpen && isTestimonialSection) {
            console.log('✅ Should scroll and open modal');

            // Clear the flag immediately
            localStorage.removeItem('dashboardTestimonialAction');

            // Wait for page to be ready
            setTimeout(() => {
                // 1. FIRST: Scroll to section
                const section = document.getElementById('testimonials-section') ||
                               document.getElementById('testimonials') ||
                               document.querySelector('.testimonials');

                if (section) {
                    console.log('📜 Scrolling to section...');
                    section.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });

                    // Add highlight effect
                    section.style.boxShadow = '0 0 0 3px #4361ee';
                    setTimeout(() => {
                        section.style.boxShadow = 'none';
                    }, 2000);

                    // 2. THEN: Open modal after scroll completes
                    setTimeout(() => {
                        console.log('🚪 Opening modal...');
                        openTestimonialModal();
                    }, 800); // Wait for scroll to finish
                }
            }, 300);
        }
    }

    function openTestimonialModal() {
        // Try to find and click the testimonial button
        const testimonialBtn = document.getElementById('testimonialBtn');

        if (testimonialBtn) {
            console.log('🎯 Found testimonial button, clicking...');
            testimonialBtn.click();

            // Set flag to prevent re-opening in this session
            sessionStorage.setItem('modalAutoOpened', 'true');

            // Listen for modal close
            const modal = document.getElementById('testimonialModal');
            if (modal) {
                // Check when modal closes
                const observer = new MutationObserver(() => {
                    if (modal.style.display === 'none') {
                        console.log('✅ Modal closed');
                        observer.disconnect();
                    }
                });

                observer.observe(modal, {
                    attributes: true,
                    attributeFilter: ['style']
                });
            }
        } else {
            console.warn('⚠️ Testimonial button not found');
            // Fallback: try after a delay
            setTimeout(() => {
                const retryBtn = document.getElementById('testimonialBtn');
                if (retryBtn) retryBtn.click();
            }, 1000);
        }
    }

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
    // Smooth Scrolling for anchor links (excluding nav links)
    // =============================================
    document.querySelectorAll('a[href^="#"]:not(.nav-links a)').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          const headerHeight = document.querySelector('header').offsetHeight;
          window.scrollTo({
            top: targetElement.offsetTop - headerHeight,
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

    // Add this to your main.js file
    function initializeBadgeColors() {
        // Color code categories
        const categoryColors = {
            'technology': 'technology',
            'programming': 'technology',
            'web development': 'technology',
            'data science': 'technology',
            'business': 'business',
            'finance': 'business',
            'marketing': 'marketing',
            'design': 'design',
            'ux/ui': 'design',
            'science': 'science',
            'engineering': 'science'
        };

        // Add category badges
        document.querySelectorAll('.category').forEach(categoryEl => {
            const categoryText = categoryEl.textContent.toLowerCase();
            const colorClass = categoryColors[categoryText] || 'technology';

            const badge = document.createElement('span');
            badge.className = `category-badge ${colorClass}`;
            badge.innerHTML = `<i class="fas fa-tag"></i>${categoryEl.textContent}`;

            categoryEl.parentNode.replaceChild(badge, categoryEl);
        });

        // Update expiration badges based on date
        document.querySelectorAll('.expiration-badge').forEach(badge => {
            if (badge.classList.contains('active')) {
                const dateText = badge.textContent;
                if (dateText.includes('Expires:')) {
                    const dateStr = dateText.replace('Expires:', '').trim();
                    const expireDate = new Date(dateStr);
                    const today = new Date();
                    const daysUntilExpire = Math.ceil((expireDate - today) / (1000 * 60 * 60 * 24));

                    if (daysUntilExpire <= 3) {
                        badge.classList.remove('active');
                        badge.classList.add('urgent');
                    }
                }
            }
        });
    }

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
        // Setup logout functionality FIRST and early
        setTimeout(() => {
            setupLogout();
        }, 100);

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

        // Initialize blog modal system
        blogModal.init();

        // Initialize testimonial system
        if (typeof testimonialSystem !== 'undefined' && testimonialSystem.init) {
            testimonialSystem.init();
        }

        // Initialize newsletter subscription
        initializeNewsletter();

        // Initialize unsubscribe page
        if (window.location.pathname.includes('/unsubscribe')) {
            initializeUnsubscribePage();
            handleUnsubscribeFlashMessages();
            handleOneClickUnsubscribe();

            // Auto-focus email field if empty
            const emailInput = document.getElementById('email');
            if (emailInput && !emailInput.value) {
                setTimeout(() => {
                    emailInput.focus();
                }, 500);
            }
        }

        // Add this as a backup logout handler
        document.addEventListener('click', function(e) {
            // Check if clicked on logout button (including in mobile menu)
            const logoutBtn = e.target.closest('#logoutBtn');

            if (logoutBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔧 Direct logout handler triggered');

                // Show the logout modal
                const logoutModal = document.getElementById('logoutModal');
                if (logoutModal) {
                    logoutModal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';

                    // Re-initialize modal handlers just in case
                    setTimeout(() => {
                        setupLogoutModal();
                    }, 100);
                }
            }
        });

        // Add click handlers for entire blog cards
        document.querySelectorAll('.blog-card-vertical').forEach(card => {
            card.addEventListener('click', function(e) {
                // Don't trigger if clicking on buttons or links
                if (e.target.closest('button') || e.target.closest('a')) {
                    return;
                }

                const blogId = this.dataset.id;
                if (typeof blogModal !== 'undefined' && blogModal.openModal) {
                    blogModal.openModal(blogId);
                }
            });
        });

        // Initialize flash messages
        initFlashMessages();

        // Initialize navigation profile picture
        if (typeof loadNavigationProfilePicture === 'function') {
            setTimeout(() => {
                loadNavigationProfilePicture();
            }, 500);
        }

        // Listen for login events
        document.addEventListener('userLoggedIn', function() {
            setTimeout(() => {
                if (typeof loadNavigationProfilePicture === 'function') {
                    loadNavigationProfilePicture();
                }
            }, 1000);
        });

        // Listen for profile picture updates
        document.addEventListener('profilePictureUpdated', function() {
            setTimeout(() => {
                if (typeof refreshNavigationProfilePicture === 'function') {
                    refreshNavigationProfilePicture();
                }
            }, 500);
        });

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

        // Initialize badge colors
        if (typeof initializeBadgeColors === 'function') {
            initializeBadgeColors();
        }

        // Initialize share modal theme listener
        if (typeof initShareModalThemeListener === 'function') {
            initShareModalThemeListener();
        }

        console.log('🎯 Application fully initialized');
    });

    // Also run when hash changes (in case of direct navigation)
    window.addEventListener('hashchange', function() {
        if (window.location.hash === '#testimonials-section') {
            // Small delay to ensure DOM is ready
            setTimeout(handleDashboardTestimonialRedirect, 100);
        }
        // Also re-initialize logout after a short delay to catch dynamically loaded elements
        setTimeout(() => {
            setupLogout();
        }, 500);
    });

    // =============================================
    // ENHANCED MOBILE MENU SYSTEM WITH AUTH SUPPORT
    // =============================================

    class MobileMenu {
      constructor() {
        this.isOpen = false;
        this.navContainer = document.querySelector('.nav-container');
        this.mobileToggle = null;
        this.mobileOverlay = null;
        this.isLoggedIn = false;
        this.userData = null;

        this.init();
      }

      init() {
        console.log('📱 Initializing mobile menu...');
        this.checkAuthStatus();
        this.createMobileElements();
        this.bindEvents();
        this.setupInitialState();
      }

      async checkAuthStatus() {
        try {
          const response = await fetch('/api/check-session', {
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            this.isLoggedIn = data.logged_in;
            this.userData = data;
          }
        } catch (error) {
          console.error('Error checking auth status:', error);
          this.isLoggedIn = false;
        }
      }

      createMobileElements() {
        // Create mobile toggle button if it doesn't exist
        this.mobileToggle = document.getElementById('mobileMenuToggle');
        if (!this.mobileToggle) {
          this.mobileToggle = document.createElement('button');
          this.mobileToggle.id = 'mobileMenuToggle';
          this.mobileToggle.className = 'mobile-menu-toggle';
          this.mobileToggle.innerHTML = '<span class="hamburger"></span>';
          this.mobileToggle.setAttribute('aria-label', 'Toggle mobile menu');
          this.mobileToggle.setAttribute('aria-expanded', 'false');

          // Insert into navbar
          const navbar = document.querySelector('.navbar');
          if (navbar) {
            const logo = navbar.querySelector('.logo');
            if (logo) {
              navbar.insertBefore(this.mobileToggle, logo.nextSibling);
            } else {
              navbar.appendChild(this.mobileToggle);
            }
          }
        }

        // Create mobile overlay if it doesn't exist
        this.mobileOverlay = document.querySelector('.mobile-overlay');
        if (!this.mobileOverlay) {
          this.mobileOverlay = document.createElement('div');
          this.mobileOverlay.className = 'mobile-overlay';
          document.body.appendChild(this.mobileOverlay);
        }

        // Ensure nav container has mobile-active class
        if (this.navContainer) {
          this.navContainer.classList.add('mobile-active');
        }
      }

      setupInitialState() {
        // Check if we're on mobile
        const isMobile = window.innerWidth <= 991;

        if (isMobile) {
          this.hideDesktopNavigation();
          this.updateMobileAuthButtons();
        } else {
          this.showDesktopNavigation();
        }
      }

      updateMobileAuthButtons() {
        if (!this.navContainer || !this.isLoggedIn) return;

        // Find the auth buttons container or create it
        let authContainer = this.navContainer.querySelector('.auth-buttons-container');
        if (!authContainer) {
          authContainer = document.createElement('div');
          authContainer.className = 'auth-buttons-container';

          // Insert after user profile section if it exists
          const userProfile = this.navContainer.querySelector('.user-profile-nav');
          if (userProfile) {
            userProfile.parentNode.insertBefore(authContainer, userProfile.nextSibling);
          } else {
            // Insert at the end of nav-right
            const navRight = this.navContainer.querySelector('.nav-right');
            if (navRight) {
              navRight.appendChild(authContainer);
            }
          }
        }

        // Clear existing buttons
        authContainer.innerHTML = '';

        if (this.isLoggedIn && this.userData) {
          // Create user info section
          const userInfoDiv = document.createElement('div');
          userInfoDiv.className = 'user-info-mobile';
          userInfoDiv.innerHTML = `
            <div class="username">${this.userData.username || 'User'}</div>
            <div class="email">${this.userData.email || ''}</div>
          `;

          // Insert user info at the beginning
          authContainer.appendChild(userInfoDiv);

          // Dashboard button
          const dashboardBtn = document.createElement('a');
          dashboardBtn.href = '/dashboard';
          dashboardBtn.className = 'btn dashboard-btn';
          dashboardBtn.innerHTML = '<i class="fas fa-tachometer-alt"></i> Dashboard';
          authContainer.appendChild(dashboardBtn);

          // Logout button
          const logoutBtn = document.createElement('button');
          logoutBtn.type = 'button';
          logoutBtn.className = 'btn logout-btn';
          logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
          logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeMenu();

            // Trigger logout
            const logoutModal = document.getElementById('logoutModal');
            if (logoutModal) {
              logoutModal.style.display = 'flex';
              document.body.style.overflow = 'hidden';
            }
          });
          authContainer.appendChild(logoutBtn);
        } else {
          // Login button
          const loginBtn = document.createElement('button');
          loginBtn.type = 'button';
          loginBtn.className = 'btn login-btn';
          loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
          loginBtn.addEventListener('click', () => {
            this.closeMenu();
            setTimeout(() => {
              openLoginModal();
            }, 300);
          });
          authContainer.appendChild(loginBtn);

          // Register button
          const registerBtn = document.createElement('button');
          registerBtn.type = 'button';
          registerBtn.className = 'btn register-btn';
          registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Register';
          registerBtn.addEventListener('click', () => {
            this.closeMenu();
            setTimeout(() => {
              openRegisterModal();
            }, 300);
          });
          authContainer.appendChild(registerBtn);
        }
         // After updating buttons, recalculate menu height
        setTimeout(() => {
          this.calculateMenuHeight();
        }, 50);
      }

      bindEvents() {
        // Mobile toggle click
        if (this.mobileToggle) {
          this.mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
          });
        }

        // Overlay click
        if (this.mobileOverlay) {
          this.mobileOverlay.addEventListener('click', () => {
            this.closeMenu();
          });
        }

        // Close on escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.isOpen) {
            this.closeMenu();
          }
        });

        // Close when clicking outside on mobile
        document.addEventListener('click', (e) => {
          if (this.isOpen &&
              this.navContainer &&
              !this.navContainer.contains(e.target) &&
              this.mobileToggle &&
              !this.mobileToggle.contains(e.target)) {
            this.closeMenu();
          }
        });

        // Close menu when clicking links inside
        if (this.navContainer) {
          this.navContainer.addEventListener('click', (e) => {
            if (e.target.closest('a') && this.isOpen) {
              setTimeout(() => {
                this.closeMenu();
              }, 300);
            }
          });
        }

        // Window resize with debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            const isMobile = window.innerWidth <= 991;

            if (isMobile) {
              this.hideDesktopNavigation();
              this.updateMobileAuthButtons();
            } else {
              this.showDesktopNavigation();
              this.closeMenu();
            }
          }, 150);
        });

        // Listen for login/logout events
        document.addEventListener('userLoggedIn', () => {
          this.isLoggedIn = true;
          this.checkAuthStatus().then(() => {
            this.updateMobileAuthButtons();
          });
        });

        document.addEventListener('userLoggedOut', () => {
          this.isLoggedIn = false;
          this.userData = null;
          this.updateMobileAuthButtons();
        });
      }

      hideDesktopNavigation() {
        // On mobile, ensure nav container is hidden initially
        if (this.navContainer) {
          this.navContainer.classList.remove('active');
          this.navContainer.style.display = 'none';
        }

        // Show mobile toggle
        if (this.mobileToggle) {
          this.mobileToggle.style.display = 'flex';
        }
      }

      showDesktopNavigation() {
        // On desktop, show nav container and hide mobile toggle
        if (this.navContainer) {
          this.navContainer.classList.remove('mobile-active', 'active');
          this.navContainer.style.display = 'flex';
          this.navContainer.style.transform = '';
        }

        // Hide mobile toggle
        if (this.mobileToggle) {
          this.mobileToggle.style.display = 'none';
        }

        // Hide overlay
        if (this.mobileOverlay) {
          this.mobileOverlay.classList.remove('active');
        }

        // Enable body scroll
        document.body.classList.remove('menu-open');
      }

      toggleMenu() {
        if (this.isOpen) {
          this.closeMenu();
        } else {
          this.openMenu();
        }
      }

      openMenu() {
        if (!this.navContainer || !this.mobileToggle || !this.mobileOverlay) return;

        console.log('📱 Opening mobile menu...');

        this.isOpen = true;

        // Update toggle button
        this.mobileToggle.classList.add('active');
        this.mobileToggle.setAttribute('aria-expanded', 'true');

        // Show nav container with slide-in animation
        this.navContainer.style.display = 'flex';

        // Force a reflow to ensure proper rendering
        void this.navContainer.offsetWidth;

        // Add active class after display
        setTimeout(() => {
          this.navContainer.classList.add('active');

          // Update auth buttons after menu is visible
          this.updateMobileAuthButtons();

          // Force a layout recalculation
          this.calculateMenuHeight();
        }, 10);

        // Show overlay
        this.mobileOverlay.classList.add('active');

        // Prevent body scroll
        document.body.classList.add('menu-open');

        // Focus management
        setTimeout(() => {
          const firstFocusable = this.navContainer.querySelector('a, button, input');
          if (firstFocusable) firstFocusable.focus();
        }, 100);
      }

      calculateMenuHeight() {
        if (!this.navContainer || !this.isOpen) return;

        // Calculate total height of all menu items
        const navLinks = this.navContainer.querySelector('.nav-links');
        const navRight = this.navContainer.querySelector('.nav-right');
        const authContainer = this.navContainer.querySelector('.auth-buttons-container');

        let totalHeight = 0;

        if (navLinks) {
          const linksHeight = navLinks.getBoundingClientRect().height;
          totalHeight += linksHeight;
        }

        if (navRight) {
          const rightHeight = navRight.getBoundingClientRect().height;
          totalHeight += rightHeight;
        }

        if (authContainer) {
          const authHeight = authContainer.getBoundingClientRect().height;
          totalHeight += authHeight;
        }

        // Add padding and margins
        totalHeight += 80; // Account for padding

        // Get viewport height
        const viewportHeight = window.innerHeight;
        const availableHeight = viewportHeight - 70; // Subtract header height

        // Set dynamic max-height
        this.navContainer.style.maxHeight = Math.min(totalHeight, availableHeight) + 'px';

        // Ensure overflow is visible if content fits
        if (totalHeight <= availableHeight) {
          this.navContainer.style.overflowY = 'hidden';
        } else {
          this.navContainer.style.overflowY = 'auto';
        }
      }

      closeMenu() {
        if (!this.isOpen) return;

        console.log('📱 Closing mobile menu...');

        this.isOpen = false;

        // Update toggle button
        if (this.mobileToggle) {
          this.mobileToggle.classList.remove('active');
          this.mobileToggle.setAttribute('aria-expanded', 'false');
        }

        // Hide nav container with slide-out animation
        if (this.navContainer) {
          this.navContainer.classList.remove('active');
          setTimeout(() => {
            if (!this.isOpen) {
              this.navContainer.style.display = 'none';
            }
          }, 300);
        }

        // Hide overlay
        if (this.mobileOverlay) {
          this.mobileOverlay.classList.remove('active');
        }

        // Allow body scroll
        document.body.classList.remove('menu-open');

        // Return focus to toggle button
        if (this.mobileToggle) {
          this.mobileToggle.focus();
        }
      }
    }

    // Initialize mobile menu
    document.addEventListener('DOMContentLoaded', function() {
      window.mobileMenu = new MobileMenu();

      // Also initialize the logout functionality
      setTimeout(() => {
        if (typeof setupLogout === 'function') {
          setupLogout();
        }
      }, 100);
    });

