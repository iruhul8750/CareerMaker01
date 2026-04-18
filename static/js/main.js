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
    // UNIVERSAL LOADER MANAGEMENT
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
    // Modal Management
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
            resetLoginForm();
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

    async function fetchWithRetry(url, options, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, options);

                // If response is 503 (service unavailable) with retry flag, retry
                if (response.status === 503) {
                    const data = await response.json();
                    if (data.retry && i < maxRetries - 1) {
                        console.log(`Retry ${i + 1}/${maxRetries} after 503 error`);
                        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                        continue;
                    }
                }

                return response;
            } catch (error) {
                console.error(`Attempt ${i + 1} failed:`, error);
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }

    async function handleBookmarkAction(bookmarkBtn) {
        // Prevent multiple clicks
        if (bookmarkBtn.disabled) {
            console.log('Bookmark button already processing');
            return;
        }

        const itemId = bookmarkBtn.dataset.id;
        const itemType = bookmarkBtn.dataset.type;
        const currentState = bookmarkBtn.classList.contains('bookmarked');
        const newState = !currentState;

        // Store original state for rollback
        const previousState = currentState;

        // INSTANT UI UPDATE - Optimistic update
        bookmarkBtn.classList.toggle('bookmarked', newState);
        updateBookmarkIcon(bookmarkBtn, newState);

        // Show loading state
        const originalHTML = bookmarkBtn.innerHTML;
        bookmarkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        bookmarkBtn.disabled = true;

        try {
            // Use fetch with retry
            const response = await fetchWithRetry(`/api/bookmark/${itemType}/${itemId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned invalid response');
            }

            const data = await response.json();

            // Handle unauthorized
            if (response.status === 401) {
                bookmarkBtn.classList.toggle('bookmarked', previousState);
                updateBookmarkIcon(bookmarkBtn, previousState);
                showToast('Please login to bookmark items', 'warning');
                resetLoginForm();
                openLoginModal();
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            if (data.success) {
                showToast(data.message || `Bookmark ${data.status} successfully`, 'success');
            } else {
                throw new Error(data.error || 'Bookmark operation failed');
            }

        } catch (error) {
            console.error('Bookmark error:', error);

            // REVERT UI UPDATE on error
            bookmarkBtn.classList.toggle('bookmarked', previousState);
            updateBookmarkIcon(bookmarkBtn, previousState);

            let errorMessage = error.message || 'Failed to update bookmark';
            if (errorMessage.includes('Network') || errorMessage.includes('disconnected')) {
                errorMessage = 'Connection issue. Please try again.';
            }

            showToast(errorMessage, 'error');

        } finally {
            // Restore button state
            bookmarkBtn.disabled = false;
            bookmarkBtn.innerHTML = originalHTML;
            const finalState = bookmarkBtn.classList.contains('bookmarked');
            updateBookmarkIcon(bookmarkBtn, finalState);
        }
    }

    // Bookmark sync function for modal and card
    async function handleModalBookmark(courseId) {
        const modalBookmark = document.getElementById('horizontalModalBookmarkBtn');
        if (!modalBookmark) return;

        const isCurrentlyBookmarked = modalBookmark.classList.contains('bookmarked');
        const willBeBookmarked = !isCurrentlyBookmarked;

        // Update modal button
        modalBookmark.classList.toggle('bookmarked', willBeBookmarked);
        const icon = modalBookmark.querySelector('i');
        const text = modalBookmark.querySelector('.bookmark-text');
        if (icon) icon.className = willBeBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
        if (text) text.textContent = willBeBookmarked ? 'Bookmarked' : 'Bookmark';

        // Update card button (sync)
        const cardBtn = document.querySelector(`.bookmark-btn[data-id="${courseId}"][data-type="course"]`);
        if (cardBtn) {
            cardBtn.classList.toggle('bookmarked', willBeBookmarked);
            const cardIcon = cardBtn.querySelector('i');
            const cardText = cardBtn.querySelector('.bookmark-text');
            if (cardIcon) cardIcon.className = willBeBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
            if (cardText) cardText.textContent = willBeBookmarked ? 'Bookmarked' : 'Bookmark';
        }

        try {
            // Check session
            const sessionCheck = await fetch('/api/check-session', { credentials: 'include' });
            const session = await sessionCheck.json();

            if (!session.logged_in) {
                // Revert both
                modalBookmark.classList.toggle('bookmarked', isCurrentlyBookmarked);
                if (icon) icon.className = isCurrentlyBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
                if (text) text.textContent = isCurrentlyBookmarked ? 'Bookmarked' : 'Bookmark';
                if (cardBtn) {
                    cardBtn.classList.toggle('bookmarked', isCurrentlyBookmarked);
                    const cardIcon = cardBtn.querySelector('i');
                    const cardText = cardBtn.querySelector('.bookmark-text');
                    if (cardIcon) cardIcon.className = isCurrentlyBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
                    if (cardText) cardText.textContent = isCurrentlyBookmarked ? 'Bookmarked' : 'Bookmark';
                }
                showToast('Please login to bookmark courses', 'warning');
                openLoginModal();
                return;
            }

            // API call
            const response = await fetch(`/api/bookmark/course/${courseId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            showToast(data.message, data.status === 'added' ? 'success' : 'info');

        } catch (error) {
            console.error('Modal bookmark error:', error);

            // Revert both on error
            modalBookmark.classList.toggle('bookmarked', isCurrentlyBookmarked);
            if (icon) icon.className = isCurrentlyBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
            if (text) text.textContent = isCurrentlyBookmarked ? 'Bookmarked' : 'Bookmark';
            if (cardBtn) {
                cardBtn.classList.toggle('bookmarked', isCurrentlyBookmarked);
                const cardIcon = cardBtn.querySelector('i');
                const cardText = cardBtn.querySelector('.bookmark-text');
                if (cardIcon) cardIcon.className = isCurrentlyBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
                if (cardText) cardText.textContent = isCurrentlyBookmarked ? 'Bookmarked' : 'Bookmark';
            }

            showToast(error.message || 'Bookmark failed', 'error');
        }
    }

    function updateBookmarkIcon(element, isBookmarked) {
        const icon = element.querySelector('i');
        const bookmarkText = element.querySelector('.bookmark-text');

        if (icon) {
            if (isBookmarked) {
                icon.className = 'fas fa-bookmark';
                icon.style.color = '#007bff';
                if (bookmarkText) bookmarkText.textContent = 'Bookmarked';
            } else {
                icon.className = 'far fa-bookmark';
                icon.style.color = '';
                if (bookmarkText) bookmarkText.textContent = 'Bookmark';
            }
        }

        // Also update the button's class for CSS styling
        if (isBookmarked) {
            element.classList.add('bookmarked');
        } else {
            element.classList.remove('bookmarked');
        }
    }

    // =============================================
    // Enhanced Content Card Initialization
    // =============================================
    function initializeContentCards() {
        // Initialize bookmark buttons
        initializeBookmarkButtons();

        // Apply buttons - UPDATED with enrollment tracking
        document.querySelectorAll('.apply-btn').forEach(btn => {
            // Remove existing listener to avoid duplicates
            btn.removeEventListener('click', handleApplyClick);
            btn.addEventListener('click', handleApplyClick);
        });

        console.log('✅ Apply buttons initialized with enrollment tracking');
    }

    // function for apply button clicks
    function handleApplyClick(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.disabled) return;

        const contentId = this.dataset.id;
        const contentType = this.dataset.type;

        console.log(`📊 Apply button clicked: ${contentType} ID: ${contentId}`);

        // Call the original apply function
        applyForContent(contentId, contentType, this);
    }

    // =============================================
    // OTP Verification System
    // =============================================
    function showOTPVerificationModal(email, username = null, password = null, purpose = 'registration') {
        document.querySelectorAll('.modal').forEach(m => m.remove());

        const isDarkMode = document.body.classList.contains('dark-mode');

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

                    <!-- Fixed OTP input without floating label -->
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label for="otpCode" style="display: block; margin-bottom: 8px; font-weight: 500; font-size: 14px;">Please Enter The OTP Code To Verify</label>
                        <input type="text" id="otpCode" name="otp" maxlength="6" required
                               autocomplete="off" inputmode="numeric"
                               style="width: 100%; padding: 12px; font-size: 18px; letter-spacing: 8px;
                                      text-align: center; border: 2px solid #ddd; border-radius: 8px;
                                      outline: none; background: white; cursor: text; box-sizing: border-box;">
                        <div class="form-error" id="otpError" style="display:none; color: #dc3545; font-size: 12px; margin-top: 5px;"></div>
                    </div>

                    <button type="submit" class="btn btn-primary" id="verifyOtpBtn" style="width: 100%;">
                        <span class="btn-text">Verify</span>
                        <i class="fas fa-spinner fa-spin loading-icon" style="display: none;"></i>
                    </button>
                    <p class="resend-link" style="margin-top: 15px; text-align: center;">Didn't receive code? <a href="#" id="resendOtp">Resend</a> <span id="resendTimer" style="display:none">(Wait <span id="timerCount">60</span>s)</span></p>
                </form>
                <div id="otpResponse" class="form-response" style="display: none;"></div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Apply dark mode styles
        function applyOTPTheme() {
            const isDark = document.body.classList.contains('dark-mode');
            const modal = document.querySelector('.modal:has(#otpForm)');
            const modalContent = modal?.querySelector('.modal-content');
            const otpInput = document.getElementById('otpCode');
            const label = document.querySelector('#otpForm label');
            const resendLink = document.querySelector('.resend-link');
            const closeBtn = document.querySelector('.close-modal');

            if (modalContent) {
                modalContent.style.background = isDark ? '#1e1e2a' : 'white';
                modalContent.style.color = isDark ? '#ffffff' : '#000000';
            }

            if (otpInput) {
                otpInput.style.background = isDark ? '#2a2a35' : 'white';
                otpInput.style.borderColor = isDark ? '#3f3f46' : '#ddd';
                otpInput.style.color = isDark ? '#ffffff' : '#000000';
            }

            if (label) {
                label.style.color = isDark ? '#a1a1aa' : '#333';
            }

            if (resendLink) {
                resendLink.style.color = isDark ? '#a1a1aa' : '#666';
                const link = resendLink.querySelector('a');
                if (link) link.style.color = isDark ? '#60a5fa' : '#007bff';
            }

            if (closeBtn) {
                closeBtn.style.color = isDark ? '#a1a1aa' : '#666';
            }
        }

        // Watch for theme changes
        const themeObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'class') {
                    applyOTPTheme();
                }
            });
        });

        themeObserver.observe(document.body, { attributes: true });
        applyOTPTheme();

        // Get elements
        const otpInput = document.getElementById('otpCode');
        const otpForm = document.getElementById('otpForm');
        const verifyBtn = document.getElementById('verifyOtpBtn');
        const otpResponse = document.getElementById('otpResponse');
        const resendOtpBtn = document.getElementById('resendOtp');
        const resendTimer = document.getElementById('resendTimer');
        const timerCount = document.getElementById('timerCount');

        // Close button handler
        const closeBtn = document.querySelector('.modal .close-modal');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

            newCloseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const modal = document.querySelector('.modal:has(#otpForm)');
                if (modal) {
                    modal.remove();
                    themeObserver.disconnect();
                }
                document.body.style.overflow = 'auto';
            });
        }

        // Close when clicking on overlay
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', function(e) {
                e.preventDefault();
                const modal = document.querySelector('.modal:has(#otpForm)');
                if (modal) {
                    modal.remove();
                    themeObserver.disconnect();
                }
                document.body.style.overflow = 'auto';
            });
        }

        // Focus input
        setTimeout(() => {
            if (otpInput) {
                otpInput.focus();
                otpInput.select();
            }
        }, 100);

        // OTP Input handlers
        if (otpInput) {
            otpInput.style.pointerEvents = 'auto';
            otpInput.style.cursor = 'text';
            otpInput.style.userSelect = 'auto';
            otpInput.removeAttribute('disabled');
            otpInput.removeAttribute('readonly');

            otpInput.addEventListener('input', function(e) {
                this.value = this.value.replace(/\D/g, '');
                if (this.value.length > 6) {
                    this.value = this.value.substring(0, 6);
                }
                const errorElement = document.getElementById('otpError');
                if (errorElement) {
                    errorElement.style.display = 'none';
                }
            });

            otpInput.addEventListener('keydown', function(e) {
                if (e.key.length === 1 && !/\d/.test(e.key)) {
                    e.preventDefault();
                    return;
                }
            });

            otpInput.addEventListener('paste', function(e) {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const numbersOnly = pastedText.replace(/\D/g, '').substring(0, 6);
                this.value = numbersOnly;
            });

            otpInput.addEventListener('click', function(e) {
                this.focus();
                this.select();
            });
        }

        startResendTimer(resendOtpBtn, resendTimer, timerCount);

        // Resend OTP Handler
        if (resendOtpBtn) {
            resendOtpBtn.addEventListener('click', async function(e) {
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

                    if (otpInput) {
                        otpInput.value = '';
                        setTimeout(() => {
                            otpInput.focus();
                            otpInput.select();
                        }, 100);
                    }

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
        }

        // OTP Verification Handler
        if (otpForm) {
            otpForm.addEventListener('submit', async function(e) {
                e.preventDefault();

                const otpValue = otpInput ? otpInput.value.trim() : '';

                if (!otpValue) {
                    const errorElement = document.getElementById('otpError');
                    if (errorElement) {
                        errorElement.textContent = 'Please enter the OTP code';
                        errorElement.style.display = 'block';
                    }
                    if (otpInput) otpInput.focus();
                    return;
                }

                if (otpValue.length !== 6) {
                    const errorElement = document.getElementById('otpError');
                    if (errorElement) {
                        errorElement.textContent = 'OTP must be exactly 6 digits';
                        errorElement.style.display = 'block';
                    }
                    if (otpInput) otpInput.focus();
                    return;
                }

                const btnText = verifyBtn.querySelector('.btn-text');
                const loadingIcon = verifyBtn.querySelector('.loading-icon');

                if (otpResponse) {
                    otpResponse.style.display = 'none';
                    otpResponse.textContent = '';
                }

                if (btnText) btnText.textContent = 'Verifying...';
                if (loadingIcon) loadingIcon.style.display = 'inline-block';
                verifyBtn.disabled = true;
                if (otpInput) otpInput.disabled = true;

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

                    if (otpResponse) {
                        otpResponse.className = 'form-response success';
                        otpResponse.textContent = data.message || 'Verification successful!';
                        otpResponse.style.display = 'block';
                    }

                    if (data.redirect) {
                        setTimeout(() => {
                            window.location.href = data.redirect;
                        }, 1500);
                    } else if (data.showLoginModal) {
                        setTimeout(() => {
                            const modal = document.querySelector('.modal:has(#otpForm)');
                            resetLoginForm();
                            if (modal) modal.remove();
                            themeObserver.disconnect();
                            if (typeof openLoginModal === 'function') {
                                openLoginModal();
                            }
                        }, 1500);
                    }
                } catch (error) {
                    if (otpResponse) {
                        otpResponse.className = 'form-response error';
                        otpResponse.textContent = error.message || 'Invalid OTP. Please try again.';
                        otpResponse.style.display = 'block';
                    }

                    if (otpInput) {
                        otpInput.disabled = false;
                        setTimeout(() => {
                            otpInput.focus();
                            otpInput.select();
                        }, 100);
                    }
                } finally {
                    if (btnText) btnText.textContent = 'Verify';
                    if (loadingIcon) loadingIcon.style.display = 'none';
                    verifyBtn.disabled = false;
                }
            });
        }
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

            // Reset error states
            formResponse.style.display = 'none';
            formResponse.className = 'form-response';
            emailInput.classList.remove('input-error');
            usernameInput.classList.remove('input-error');

            // Remove any existing field-specific error messages
            document.querySelectorAll('.field-error-message').forEach(el => el.remove());

            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = this.querySelector('#registerPassword').value;
            const confirmPassword = this.querySelector('#registerConfirmPassword').value;
            const termsAgreement = this.querySelector('#termsAgreement').checked;

            // Frontend validation
            if (!username || username.length < 3) {
                showFieldError(usernameInput, 'Username must be at least 3 characters');
                return;
            }

            if (!email || !validateEmail(email)) {
                showFieldError(emailInput, 'Please enter a valid email address');
                return;
            }

            if (!isPasswordStrong(password)) {
                showFormError(formResponse, 'Password must meet all requirements');
                this.querySelector('#registerPassword').focus();
                return;
            }

            if (password !== confirmPassword) {
                showFormError(formResponse, 'Passwords do not match');
                this.querySelector('#registerConfirmPassword').focus();
                return;
            }

            if (!termsAgreement) {
                showFormError(formResponse, 'You must agree to the Terms of Service and Privacy Policy');
                return;
            }

            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            showLoader('Creating your account...');

            try {
                // Send as JSON
                const requestData = {
                    username: username,
                    email: email,
                    password: password,
                    confirm_password: confirmPassword,
                    terms_agreement: termsAgreement
                };

                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify(requestData)
                });

                const data = await response.json();

                if (!response.ok) {
                    // Handle specific error types
                    if (response.status === 400) {
                        // Check for specific error messages
                        if (data.message && data.message.includes('Email already registered')) {
                            showFieldError(emailInput, data.message);
                            hideLoader();
                            return;
                        }
                        if (data.message && data.message.includes('Username')) {
                            showFieldError(usernameInput, data.message);
                            hideLoader();
                            return;
                        }
                        throw new Error(data.message || 'Registration failed');
                    }
                    throw new Error(data.message || 'Registration failed');
                }

                // Success - handle OTP verification
                if (data.requires_verification) {
                    hideLoader();
                    showLoader('Account created! Please verify your email...');

                    setTimeout(() => {
                        hideLoader();
                        showOTPVerificationModal(
                            data.email,
                            requestData.username,
                            requestData.password
                        );
                        document.getElementById('registerModal').style.display = 'none';

                        if (data.otp) {
                            console.log('Development OTP:', data.otp);
                            showToast('OTP generated. Check console for development.', 'info');
                        } else {
                            showToast('Verification email sent! Please check your inbox.', 'success');
                        }
                    }, 1000);
                }

            } catch (error) {
                console.error('Registration error:', error);
                hideLoader();
                showFormError(formResponse, error.message || 'Registration failed. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });

        // Helper function to show form-level errors
        function showFormError(element, message) {
            element.className = 'form-response error';
            element.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            element.style.display = 'block';

            // Auto-hide after 5 seconds
            setTimeout(() => {
                if (element) element.style.display = 'none';
            }, 5000);
        }

        // Helper function to show field-specific errors
        function showFieldError(inputElement, message) {
            inputElement.classList.add('input-error');

            // Remove existing error message for this field
            const existingError = inputElement.parentNode.querySelector('.field-error-message');
            if (existingError) existingError.remove();

            // Create new error message
            const errorMsg = document.createElement('div');
            errorMsg.className = 'field-error-message';
            errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            errorMsg.style.cssText = `
                color: #dc3545;
                font-size: 12px;
                margin-top: 5px;
                display: flex;
                align-items: center;
                gap: 5px;
            `;

            inputElement.parentNode.insertBefore(errorMsg, inputElement.nextSibling);
            inputElement.focus();

            // Remove error styling when user starts typing
            inputElement.addEventListener('input', function onInput() {
                inputElement.classList.remove('input-error');
                const error = inputElement.parentNode.querySelector('.field-error-message');
                if (error) error.remove();
                inputElement.removeEventListener('input', onInput);
            });
        }

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

        btnText.textContent = "Logging in...";
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
            responseDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> Invalid email or password.`;
        })
        .finally(() => {
            btnText.style.display = 'inline-block';
            btnText.textContent = "Login";
            submitBtn.disabled = false;
        });
    });

    // =============================================
    // PASSWORD RESET MODAL SYSTEM
    // =============================================

    const PasswordResetModal = {
        init() {
            console.log('🔐 Password reset modal initialized');
            this.bindEvents();
        },

        // NEW: Reset all modals and data
        resetAllModals() {
            // Reset Step 1 Modal (Request)
            const requestForm = document.getElementById('passwordResetRequestForm');
            if (requestForm) requestForm.reset();

            const resetEmail = document.getElementById('resetEmail');
            if (resetEmail) {
                resetEmail.value = '';
                resetEmail.classList.remove('input-error');
            }

            const resetResponse = document.getElementById('resetPasswordResponse');
            if (resetResponse) {
                resetResponse.style.display = 'none';
                resetResponse.className = 'form-response';
                resetResponse.innerHTML = '';
            }

            // Reset Step 2 Modal (OTP)
            const otpForm = document.getElementById('passwordResetOtpForm');
            if (otpForm) otpForm.reset();

            const otpCode = document.getElementById('resetOtpCode');
            if (otpCode) {
                otpCode.value = '';
                otpCode.disabled = false;
            }

            const otpResponse = document.getElementById('resetOtpResponse');
            if (otpResponse) {
                otpResponse.style.display = 'none';
                otpResponse.className = 'form-response';
                otpResponse.innerHTML = '';
            }

            const otpError = document.getElementById('resetOtpError');
            if (otpError) {
                otpError.style.display = 'none';
                otpError.textContent = '';
            }

            // Reset Step 3 Modal (New Password)
            const newPasswordForm = document.getElementById('resetPasswordNewForm');
            if (newPasswordForm) newPasswordForm.reset();

            const newPassword = document.getElementById('newPassword');
            const confirmPassword = document.getElementById('confirmNewPassword');
            if (newPassword) newPassword.value = '';
            if (confirmPassword) confirmPassword.value = '';

            const newPasswordResponse = document.getElementById('newPasswordResponse');
            if (newPasswordResponse) {
                newPasswordResponse.style.display = 'none';
                newPasswordResponse.className = 'form-response';
                newPasswordResponse.innerHTML = '';
            }

            // Reset password validation styles
            this.resetPasswordValidation();

            // Clear stored data
            this.currentEmail = null;
            this.currentResetToken = null;

            // Stop any running timers
            this.stopResendTimer();

            console.log('🔄 All reset modals cleared');
        },

        resetPasswordValidation() {
            const checks = [
                { id: 'reqLength', text: 'At least 8 characters' },
                { id: 'reqUppercase', text: 'At least one uppercase letter' },
                { id: 'reqNumber', text: 'At least one number' },
                { id: 'reqSpecial', text: 'At least one special character' }
            ];
            checks.forEach(check => {
                const el = document.getElementById(check.id);
                if (el) {
                    el.innerHTML = '❌ ' + check.text;
                    el.style.color = '#dc3545';
                }
            });
        },

        stopResendTimer() {
            if (this.resendTimer) {
                clearInterval(this.resendTimer);
                this.resendTimer = null;
            }
            // Reset resend button UI
            const resendBtn = document.getElementById('resendResetOtp');
            const timerSpan = document.getElementById('resendResetTimer');
            if (resendBtn) {
                resendBtn.style.display = 'inline';
                resendBtn.style.pointerEvents = 'auto';
            }
            if (timerSpan) {
                timerSpan.style.display = 'none';
            }
        },

        bindEvents() {
            // Close all modals with reset
            const closeBtns = ['closePasswordResetRequestModal', 'closePasswordResetOtpModal', 'closeResetPasswordNewModal'];
            closeBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.onclick = () => {
                        this.closeAllModals();
                        this.resetAllModals(); // Reset when closing
                    };
                }
            });

            // Step 1: Send OTP
            const requestForm = document.getElementById('passwordResetRequestForm');
            if (requestForm) {
                requestForm.onsubmit = (e) => this.handleSendOtp(e);
            }

            // Step 2: Verify OTP
            const otpForm = document.getElementById('passwordResetOtpForm');
            if (otpForm) {
                otpForm.onsubmit = (e) => this.handleVerifyOtp(e);
            }

            // Step 3: Reset password
            const newPasswordForm = document.getElementById('resetPasswordNewForm');
            if (newPasswordForm) {
                newPasswordForm.onsubmit = (e) => this.handleResetPassword(e);
            }

            // Resend OTP
            const resendBtn = document.getElementById('resendResetOtp');
            if (resendBtn) {
                resendBtn.onclick = (e) => this.resendOtp(e);
            }

            // Login link in modal
            const loginLink = document.getElementById('showLoginFromResetModal');
            if (loginLink) {
                loginLink.onclick = (e) => {
                    e.preventDefault();
                    this.closeAllModals();
                    this.resetAllModals(); // Reset when switching to login
                    if (typeof openLoginModal === 'function') openLoginModal();
                };
            }

            // Password validation
            const newPassword = document.getElementById('newPassword');
            if (newPassword) {
                newPassword.oninput = () => this.validatePassword();
            }
        },

        closeAllModals() {
            const modals = ['passwordResetRequestModal', 'passwordResetOtpModal', 'resetPasswordNewModal'];
            modals.forEach(id => {
                const modal = document.getElementById(id);
                if (modal) modal.style.display = 'none';
            });
            document.body.style.overflow = 'auto';
        },

        async handleSendOtp(e) {
            e.preventDefault();

            // Reset previous responses
            const resetResponse = document.getElementById('resetPasswordResponse');
            if (resetResponse) {
                resetResponse.style.display = 'none';
                resetResponse.className = 'form-response';
            }

            const email = document.getElementById('resetEmail')?.value.trim();

            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                this.showError('Please enter a valid email address', 'resetPasswordResponse');
                return;
            }

            this.setLoading('passwordResetRequestForm', true);

            try {
                const response = await fetch('/reset-password-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();

                if (data.status === 'success') {
                    this.showToast(data.message, 'success');
                    this.closeAllModals();

                    // Clear OTP modal before opening
                    const otpCode = document.getElementById('resetOtpCode');
                    if (otpCode) otpCode.value = '';

                    const otpResponse = document.getElementById('resetOtpResponse');
                    if (otpResponse) {
                        otpResponse.style.display = 'none';
                        otpResponse.className = 'form-response';
                    }

                    document.getElementById('otpResetEmail').value = email;
                    document.getElementById('passwordResetOtpModal').style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                this.showError(error.message, 'resetPasswordResponse');
            } finally {
                this.setLoading('passwordResetRequestForm', false);
            }
        },

        async handleVerifyOtp(e) {
            e.preventDefault();

            // Reset previous responses
            const otpResponse = document.getElementById('resetOtpResponse');
            if (otpResponse) {
                otpResponse.style.display = 'none';
                otpResponse.className = 'form-response';
            }

            const otpError = document.getElementById('resetOtpError');
            if (otpError) otpError.style.display = 'none';

            const email = document.getElementById('otpResetEmail')?.value;
            const otp = document.getElementById('resetOtpCode')?.value.trim();

            if (!otp || otp.length !== 6) {
                this.showError('Please enter a valid 6-digit OTP', 'resetOtpResponse', 'resetOtpError');
                return;
            }

            this.setLoading('passwordResetOtpForm', true);

            try {
                const response = await fetch('/reset-password-verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });
                const data = await response.json();

                if (data.status === 'success') {
                    this.showToast('OTP verified!', 'success');
                    this.closeAllModals();
                    window.currentResetToken = data.reset_token;

                    // Clear new password modal before opening
                    const newPassword = document.getElementById('newPassword');
                    const confirmPassword = document.getElementById('confirmNewPassword');
                    if (newPassword) newPassword.value = '';
                    if (confirmPassword) confirmPassword.value = '';

                    const newPasswordResponse = document.getElementById('newPasswordResponse');
                    if (newPasswordResponse) {
                        newPasswordResponse.style.display = 'none';
                        newPasswordResponse.className = 'form-response';
                    }

                    this.resetPasswordValidation();

                    document.getElementById('resetPasswordNewModal').style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                this.showError(error.message, 'resetOtpResponse', 'resetOtpError');
            } finally {
                this.setLoading('passwordResetOtpForm', false);
            }
        },

        async handleResetPassword(e) {
            e.preventDefault();

            // Reset previous response
            const newPasswordResponse = document.getElementById('newPasswordResponse');
            if (newPasswordResponse) {
                newPasswordResponse.style.display = 'none';
                newPasswordResponse.className = 'form-response';
            }

            const newPassword = document.getElementById('newPassword')?.value;
            const confirmPassword = document.getElementById('confirmNewPassword')?.value;

            if (!newPassword || newPassword.length < 8) {
                this.showError('Password must be at least 8 characters', 'newPasswordResponse');
                return;
            }

            if (newPassword !== confirmPassword) {
                this.showError('Passwords do not match', 'newPasswordResponse');
                return;
            }

            this.setLoading('resetPasswordNewForm', true);

            try {
                const response = await fetch('/reset-password-confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reset_token: window.currentResetToken,
                        new_password: newPassword,
                        confirm_password: confirmPassword
                    })
                });
                const data = await response.json();

                if (data.status === 'success') {
                    this.showToast('Password reset successfully!', 'success');
                    this.closeAllModals();
                    this.resetAllModals(); // Reset all data after successful reset
                    setTimeout(() => {
                        if (typeof openLoginModal === 'function') openLoginModal();
                    }, 1500);
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                this.showError(error.message, 'newPasswordResponse');
            } finally {
                this.setLoading('resetPasswordNewForm', false);
            }
        },

        async resendOtp(e) {
            e.preventDefault();
            const email = document.getElementById('otpResetEmail')?.value;
            const btn = e.target;
            const originalText = btn.innerHTML;

            // Clear previous OTP input
            const otpCode = document.getElementById('resetOtpCode');
            if (otpCode) otpCode.value = '';

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            btn.style.pointerEvents = 'none';

            try {
                const response = await fetch('/reset-password-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await response.json();
                this.showToast(data.message || 'New OTP sent', data.status === 'success' ? 'success' : 'error');

                if (data.status === 'success') {
                    // Focus on OTP input after resend
                    setTimeout(() => {
                        if (otpCode) otpCode.focus();
                    }, 100);
                }
            } catch (error) {
                this.showToast('Failed to resend', 'error');
            } finally {
                btn.innerHTML = originalText;
                setTimeout(() => { btn.style.pointerEvents = 'auto'; }, 30000);
            }
        },

        validatePassword() {
            const password = document.getElementById('newPassword')?.value || '';
            const checks = [
                { id: 'reqLength', condition: password.length >= 8, text: 'At least 8 characters' },
                { id: 'reqUppercase', condition: /[A-Z]/.test(password), text: 'At least one uppercase letter' },
                { id: 'reqNumber', condition: /\d/.test(password), text: 'At least one number' },
                { id: 'reqSpecial', condition: /[!@#$%^&*(),.?":{}|<>]/.test(password), text: 'At least one special character' }
            ];
            checks.forEach(check => {
                const el = document.getElementById(check.id);
                if (el) {
                    el.innerHTML = (check.condition ? '✓ ' : '❌ ') + check.text;
                    el.style.color = check.condition ? '#10b981' : '#dc3545';
                }
            });
        },

        setLoading(formId, loading) {
            const btn = document.querySelector(`#${formId} button[type="submit"]`);
            if (!btn) return;
            const btnText = btn.querySelector('.btn-text');
            const loadingIcon = btn.querySelector('.loading-icon');

            if (loading) {
                if (btnText) btnText.style.display = 'none';
                if (loadingIcon) loadingIcon.style.display = 'inline-block';
                btn.disabled = true;
            } else {
                if (btnText) btnText.style.display = 'inline-block';
                if (loadingIcon) loadingIcon.style.display = 'none';
                btn.disabled = false;
            }
        },

        showError(message, responseId, errorId = null) {
            const response = document.getElementById(responseId);
            if (response) {
                response.className = 'form-response error';
                response.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
                response.style.display = 'block';
                setTimeout(() => {
                    if (response.style.display === 'block') {
                        response.style.display = 'none';
                    }
                }, 5000);
            }
        },

        showToast(message, type) {
            if (typeof showToast === 'function') {
                showToast(message, type);
            } else {
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                toast.textContent = message;
                document.body.appendChild(toast);
                setTimeout(() => toast.classList.add('show'), 10);
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }
        }
    };

    // Bind forgot password links
    document.querySelectorAll('.forgot-password, a[href="/reset-password"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            PasswordResetModal.resetAllModals(); // Reset before opening
            document.getElementById('passwordResetRequestModal').style.display = 'flex';
            document.body.style.overflow = 'hidden';
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

    // Function to reset register form
    function resetRegisterForm() {
        const registerForm = document.getElementById('registerForm');
        if (!registerForm) return;

        // Reset all form fields
        registerForm.reset();

        // Clear response message
        const formResponse = document.getElementById('registerResponse');
        if (formResponse) {
            formResponse.style.display = 'none';
            formResponse.textContent = '';
            formResponse.className = 'form-response';
        }

        // Remove all error messages
        const errorMessages = document.querySelectorAll('.error-message, .field-error-message');
        errorMessages.forEach(error => error.remove());

        // Remove input error classes
        const errorInputs = document.querySelectorAll('.input-error');
        errorInputs.forEach(input => input.classList.remove('input-error'));

        // Reset password requirements styling
        const requirements = document.querySelectorAll('.requirement');
        requirements.forEach(req => req.classList.remove('valid'));

        // Reset floating label states
        const formGroups = registerForm.querySelectorAll('.form-group');
        formGroups.forEach(group => {
            group.classList.remove('has-value', 'focused');
        });

        // Reset password visibility
        const passwordInput = document.getElementById('registerPassword');
        if (passwordInput) {
            passwordInput.type = 'password';
        }

        const confirmPasswordInput = document.getElementById('registerConfirmPassword');
        if (confirmPasswordInput) {
            confirmPasswordInput.type = 'password';
        }

        // Reset terms agreement
        const termsCheckbox = document.getElementById('termsAgreement');
        if (termsCheckbox) {
            termsCheckbox.checked = false;
        }
    }

    // Function to reset login form
    function resetLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) return;

        // Reset all form fields
        loginForm.reset();

        // Clear response message
        const responseDiv = document.getElementById('loginResponse');
        if (responseDiv) {
            responseDiv.style.display = 'none';
            responseDiv.textContent = '';
            responseDiv.className = 'form-response';
        }

        // Remove input error classes
        const errorInputs = document.querySelectorAll('#loginForm .input-error');
        errorInputs.forEach(input => input.classList.remove('input-error'));

        // Remove error messages
        const errorMessages = document.querySelectorAll('#loginForm .error-message, #loginForm .field-error-message');
        errorMessages.forEach(error => error.remove());

        // Reset floating label states
        const formGroups = loginForm.querySelectorAll('.form-group');
        formGroups.forEach(group => {
            group.classList.remove('has-value', 'focused');
        });

        // Reset password visibility
        const passwordInput = document.getElementById('loginPassword');
        if (passwordInput) {
            passwordInput.type = 'password';
            const toggleBtn = document.querySelector('#loginPassword + .password-toggle');
            if (toggleBtn) {
                toggleBtn.innerHTML = '<i class="far fa-eye-slash"></i>';
            }
        }
    }

    document.querySelectorAll('.login-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            resetLoginForm(); // Reset login form before opening
            loginModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            setTimeout(() => {
                const emailInput = document.getElementById('loginEmail');
                if (emailInput) emailInput.focus();
            }, 100);
        });
    });

    document.querySelectorAll('.register-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            resetRegisterForm(); // Reset register form before opening
            registerModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            setTimeout(() => {
                const usernameInput = document.getElementById('registerUsername');
                if (usernameInput) usernameInput.focus();
            }, 100);
        });
    });

    document.getElementById('showRegister')?.addEventListener('click', function(e) {
        e.preventDefault();
        resetLoginForm(); // Reset login form when switching
        loginModal.style.display = 'none';
        resetRegisterForm(); // Reset register form before showing
        registerModal.style.display = 'flex';

        setTimeout(() => {
            const usernameInput = document.getElementById('registerUsername');
            if (usernameInput) usernameInput.focus();
        }, 100);
    });

    document.getElementById('showLogin')?.addEventListener('click', function(e) {
        e.preventDefault();
        resetRegisterForm(); // Clean up register form when switching
        registerModal.style.display = 'none';
        resetLoginForm(); // Reset login form before showing
        loginModal.style.display = 'flex';

        setTimeout(() => {
            const emailInput = document.getElementById('loginEmail');
            if (emailInput) emailInput.focus();
        }, 100);
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            // Reset forms if their modals are closing
            if (loginModal && loginModal.style.display === 'flex') {
                resetLoginForm();
            }
            if (registerModal && registerModal.style.display === 'flex') {
                resetRegisterForm();
            }

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

            // Reset forms when clicking outside
            if (e.target === loginModal) {
                resetLoginForm();
            }
            if (e.target === registerModal) {
                resetRegisterForm();
            }

            e.target.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    // Reset forms on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (loginModal && loginModal.style.display === 'flex') {
                resetLoginForm();
            }
            if (registerModal && registerModal.style.display === 'flex') {
                resetRegisterForm();
            }
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

        // Get application link
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
                hideLoader();
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
                    resetLoginForm();
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
    // TESTIMONIAL SYSTEM
    // =============================================

    const testimonialSystem = {
        currentTestimonials: [],
        currentIndex: 0,
        autoSlideInterval: null,
        testimonialToDelete: null,
        testimonialToEdit: null,
        autoPlayDelay: 5000,
        isAutoPlay: true,
        isAnimating: false,
        track: null,
        currentUsername: null,
        currentUserEmail: null,
        starButtons: null,
        ratingInput: null,

        init() {
            this.track = document.getElementById('testimonialTrack');
            if (!this.track) return;

            // Cache elements
            this.starButtons = document.querySelectorAll('.star-btn');
            this.ratingInput = document.getElementById('ratingValue');

            // Add scroll event listener to update card classes while scrolling
            const container = this.track.parentElement;
            if (container) {
                let scrollTimeout;
                container.addEventListener('scroll', () => {
                    if (scrollTimeout) {
                        cancelAnimationFrame(scrollTimeout);
                    }
                    scrollTimeout = requestAnimationFrame(() => {
                        this.updateCardClasses();
                    });
                });
            }

            this.getCurrentUser();
            this.loadTestimonials();
            this.bindEvents();
            this.setupSwipeGestures();
        },

        preloadImages() {
            const avatars = document.querySelectorAll('.author-avatar');
            avatars.forEach(img => {
                if (img.src && !img.complete) {
                    const preloader = new Image();
                    preloader.src = img.src;
                }
            });
        },

        async getCurrentUser() {
            try {
                const response = await fetch('/api/check-session', {
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                });
                const data = await response.json();

                if (data.logged_in) {
                    this.currentUsername = data.username || data.name || 'User';
                    this.currentUserEmail = data.email;
                }
            } catch (error) {
                console.error('Error getting user:', error);
                this.currentUsername = null;
            }
        },

         setupSwipeGestures() {
            if (!this.track) return;

            let touchStartX = 0;
            let touchStartY = 0;
            let startTransform = 0;
            let isDragging = false;

            this.track.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                startTransform = this.getCurrentTranslateX();
                isDragging = true;
                this.pauseAutoSlide();

                // Disable transition during drag
                this.track.style.transition = 'none';
            });

            this.track.addEventListener('touchmove', (e) => {
                if (!isDragging) return;

                const touchCurrentX = e.touches[0].clientX;
                const deltaX = touchCurrentX - touchStartX;
                const deltaY = Math.abs(e.touches[0].clientY - touchStartY);

                // Only horizontal drag
                if (Math.abs(deltaX) > deltaY) {
                    e.preventDefault();
                    const newTransform = startTransform + deltaX;
                    this.track.style.transform = `translateX(${newTransform}px)`;
                }
            });

            this.track.addEventListener('touchend', (e) => {
                if (!isDragging) return;
                isDragging = false;

                const touchEndX = e.changedTouches[0].clientX;
                const deltaX = touchEndX - touchStartX;

                // Restore transition
                this.track.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

                // Determine if swipe was significant
                if (Math.abs(deltaX) > 50) {
                    if (deltaX < 0) {
                        this.nextSlide();
                    } else {
                        this.prevSlide();
                    }
                } else {
                    // Snap back to current card
                    this.updateCarousel();
                }

                if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                    setTimeout(() => this.startAutoSlide(), 3000);
                }
            });

            // Mouse events for desktop drag
            this.track.addEventListener('mousedown', (e) => {
                e.preventDefault();
                touchStartX = e.clientX;
                startTransform = this.getCurrentTranslateX();
                isDragging = true;
                this.pauseAutoSlide();
                this.track.style.transition = 'none';
                this.track.style.cursor = 'grabbing';
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const deltaX = e.clientX - touchStartX;
                const newTransform = startTransform + deltaX;
                this.track.style.transform = `translateX(${newTransform}px)`;
            });

            window.addEventListener('mouseup', (e) => {
                if (!isDragging) return;
                isDragging = false;

                const deltaX = e.clientX - touchStartX;

                this.track.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                this.track.style.cursor = 'grab';

                if (Math.abs(deltaX) > 50) {
                    if (deltaX < 0) {
                        this.nextSlide();
                    } else {
                        this.prevSlide();
                    }
                } else {
                    this.updateCarousel();
                }

                if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                    setTimeout(() => this.startAutoSlide(), 3000);
                }
            });

            // Wheel support
            const container = this.track.parentElement;
            container.addEventListener('wheel', (e) => {
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 30) {
                    e.preventDefault();
                    if (e.deltaX > 0) {
                        this.nextSlide();
                    } else {
                        this.prevSlide();
                    }
                    this.pauseAutoSlide();
                    if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                        setTimeout(() => this.startAutoSlide(), 3000);
                    }
                }
            }, { passive: false });
        },

        bindEvents() {
            const testimonialBtn = document.getElementById('testimonialBtn');
            if (testimonialBtn) {
                testimonialBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openTestimonialForm();
                });
            }

            const prevBtn = document.querySelector('.carousel-prev');
            const nextBtn = document.querySelector('.carousel-next');

            if (prevBtn) {
                prevBtn.addEventListener('click', () => this.prevSlide());
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', () => this.nextSlide());
            }

            const autoPlayIndicator = document.getElementById('autoPlayIndicator');
            if (autoPlayIndicator) {
                autoPlayIndicator.addEventListener('click', () => this.toggleAutoPlay());
            }

            this.setupModalEvents();
            this.setupGlobalEventDelegation();

            const carousel = document.querySelector('.testimonials-carousel');
            if (carousel && !('ontouchstart' in window)) {
                carousel.addEventListener('mouseenter', () => this.pauseAutoSlide());
                carousel.addEventListener('mouseleave', () => {
                    if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                        this.startAutoSlide();
                    }
                });
            }

            window.addEventListener('resize', () => {
                setTimeout(() => this.updateCarousel(), 100);
            });
        },

        setupGlobalEventDelegation() {
            document.addEventListener('click', async (e) => {
                const editBtn = e.target.closest('.btn-edit');
                if (editBtn) {
                    e.preventDefault();
                    const testimonialCard = editBtn.closest('.testimonial-card');
                    const testimonialId = testimonialCard?.dataset.testimonialId;
                    if (testimonialId) await this.handleEditClick(testimonialId);
                }

                const deleteBtn = e.target.closest('.btn-delete');
                if (deleteBtn) {
                    e.preventDefault();
                    const testimonialCard = deleteBtn.closest('.testimonial-card');
                    const testimonialId = testimonialCard?.dataset.testimonialId;
                    if (testimonialId) this.deleteTestimonial(testimonialId);
                }

                const readMoreLink = e.target.closest('.read-more-link');
                if (readMoreLink) {
                    e.preventDefault();
                    e.stopPropagation();
                    const testimonialId = readMoreLink.getAttribute('data-testimonial-id');
                    if (testimonialId) this.openTestimonialDetail(testimonialId);
                }
            });
        },

        setupModalEvents() {
            // Testimonial modal close button
            const testimonialModalClose = document.querySelector('#testimonialModal .close-btn');
            if (testimonialModalClose) {
                testimonialModalClose.addEventListener('click', () => this.closeModal());
            }

            // Delete modal close button - UPDATED for your new modal
            const deleteModalClose = document.querySelector('#deleteConfirmModal .close-btn');
            if (deleteModalClose) {
                // Remove old listener and add new one
                const newCloseBtn = deleteModalClose.cloneNode(true);
                deleteModalClose.parentNode.replaceChild(newCloseBtn, deleteModalClose);
                newCloseBtn.addEventListener('click', () => this.closeDeleteModal());
            }

            // Cancel button for delete modal - UPDATED
            const cancelDeleteBtn = document.querySelector('#deleteConfirmModal .btn-secondary');
            console.log('Cancel button found:', cancelDeleteBtn); // Debug line
            if (cancelDeleteBtn) {
                const newCancelBtn = cancelDeleteBtn.cloneNode(true);
                cancelDeleteBtn.parentNode.replaceChild(newCancelBtn, cancelDeleteBtn);
                newCancelBtn.addEventListener('click', () => {
                    this.closeDeleteModal();
                });
            }

            const detailModalClose = document.getElementById('detailModalClose');
            if (detailModalClose) {
                detailModalClose.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.closeDetailModal();
                });
            }

            // Cancel buttons for testimonial form
            const cancelBtns = document.querySelectorAll('#testimonialForm .btn-secondary');
            cancelBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.closeModal();
                });
            });

            const form = document.getElementById('testimonialForm');
            if (form) form.addEventListener('submit', (e) => this.handleSubmit(e));

            // Confirm delete button - UPDATED for your new modal
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            if (deleteBtn) {
                // Remove old listener and add new one
                const newDeleteBtn = deleteBtn.cloneNode(true);
                deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                newDeleteBtn.addEventListener('click', () => this.confirmDelete());
            }

            // Also handle overlay click for delete modal
            const deleteModal = document.getElementById('deleteConfirmModal');
            if (deleteModal) {
                const overlay = deleteModal.querySelector('.modal-overlay');
                if (overlay) {
                    const newOverlay = overlay.cloneNode(true);
                    overlay.parentNode.replaceChild(newOverlay, overlay);
                    newOverlay.addEventListener('click', () => this.closeDeleteModal());
                }
            }
        },

        async loadTestimonials() {
            if (!this.track) return;

            this.track.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-spinner fa-pulse"></i>
                    <p>Loading experiences...</p>
                </div>
            `;

            try {
                const response = await fetch('/api/testimonial/list', {
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                });

                if (!response.ok) throw new Error('Failed to load');

                const data = await response.json();
                this.currentTestimonials = (data.testimonials || []).filter(t => !t.is_deleted);

                if (this.currentTestimonials.length === 0) {
                    this.renderEmptyState();
                } else {
                    this.renderTestimonials();
                    this.updateDots();
                    this.updateNavigationState();

                    if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                        this.startAutoSlide();
                    }
                }
            } catch (error) {
                console.error('Load error:', error);
                this.track.innerHTML = `
                    <div class="empty-testimonials">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>Unable to Load</h4>
                        <p>Please try again later</p>
                    </div>`;
            }
        },

        renderTestimonials() {
            const activeTestimonials = this.currentTestimonials.filter(t => !t.is_deleted);
            if (activeTestimonials.length === 0) {
                this.renderEmptyState();
                return;
            }

            const cardsHTML = activeTestimonials.map((testimonial, index) => {
                const canEdit = testimonial.can_edit || false;
                const needsTruncation = testimonial.content.length > 280;
                const truncatedText = needsTruncation ?
                    testimonial.content.substring(0, 280) + '...' :
                    testimonial.content;

                return `
                <div class="testimonial-card" data-index="${index}" data-testimonial-id="${testimonial.id}">
                    <div class="testimonial-card-inner">
                        <div class="testimonial-quote">"</div>

                        ${canEdit ? `
                        <div class="testimonial-actions">
                            <button class="btn-edit" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-delete" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                        ` : ''}

                        <div class="testimonial-rating">
                            ${Array.from({length: 5}, (_, i) =>
                                `<span class="star ${i < testimonial.rating ? '' : 'empty'}">★</span>`
                            ).join('')}
                        </div>

                        <div class="testimonial-text-container">
                            <p class="testimonial-text">${this.escapeHtml(truncatedText)}</p>
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
                                 loading="lazy"
                                 onerror="this.src='https://ui-avatars.com/api/?name=' + encodeURIComponent('${testimonial.username}') + '&background=10b981&color=fff&bold=true'">
                            <div class="author-info">
                                <h4>${this.escapeHtml(testimonial.username)}</h4>
                                <p>CareerMaker User</p>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            this.track.innerHTML = cardsHTML;
            this.currentIndex = 0;

            setTimeout(() => {
                this.updateCarousel();
                this.updateDots();
            }, 100);
        },

        renderEmptyState() {
            if (this.track) {
                this.track.innerHTML = `
                    <div class="empty-testimonials">
                        <i class="fas fa-comments"></i>
                        <h4>No Experiences Yet</h4>
                        <p>Be the first to share your journey!</p>
                    </div>`;
            }
        },

        updateCarousel() {
            if (!this.track) return;

            const cards = this.track.querySelectorAll('.testimonial-card');
            const totalCards = cards.length;

            if (totalCards === 0) return;

            if (totalCards <= 3) {
                this.track.style.transform = 'translateX(0)';
                this.updateCardClasses();
                return;
            }

            // Get card dimensions
            const cardWidth = cards[0].offsetWidth;
            const gap = 24;
            const cardTotalWidth = cardWidth + gap;

            // Get container width
            const container = this.track.parentElement;
            const containerWidth = container ? container.offsetWidth : window.innerWidth - 40;

            // Calculate center offset
            const centerOffset = (containerWidth - cardWidth) / 2;

            // Calculate translateX to center the current card
            let translateX = centerOffset - (this.currentIndex * cardTotalWidth);

            // Calculate boundaries
            const maxTranslate = centerOffset;
            const minTranslate = centerOffset - ((totalCards - 1) * cardTotalWidth);

            // Clamp to boundaries
            translateX = Math.max(minTranslate, Math.min(maxTranslate, translateX));

            // Apply transform
            requestAnimationFrame(() => {
                this.track.style.transform = `translateX(${translateX}px)`;
                this.updateCardClasses();
            });
        },

        updateCardClasses() {
            const cards = this.track.querySelectorAll('.testimonial-card');
            const totalCards = cards.length;

            if (totalCards === 0) return;

            // Get container and calculate center
            const container = this.track.parentElement;
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.left + (containerRect.width / 2);

            // Find which card is closest to center
            let closestIndex = 0;
            let minDistance = Infinity;

            cards.forEach((card, i) => {
                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + (cardRect.width / 2);
                const distance = Math.abs(cardCenter - containerCenter);

                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = i;
                }
            });

            // Update currentIndex to the closest card
            if (closestIndex !== this.currentIndex) {
                this.currentIndex = closestIndex;
                this.updateDots();
            }

            // Apply classes to all cards
            cards.forEach((card, i) => {
                card.classList.remove('active', 'prev-card', 'next-card');

                if (i === this.currentIndex) {
                    card.classList.add('active');
                } else if (i === (this.currentIndex + 1) % totalCards) {
                    card.classList.add('next-card');
                } else if (i === (this.currentIndex - 1 + totalCards) % totalCards) {
                    card.classList.add('prev-card');
                }
            });
        },

        updateDots() {
            const dotsContainer = document.getElementById('carouselDots');
            if (!dotsContainer) return;

            if (this.currentTestimonials.length <= 3) {
                dotsContainer.style.display = 'none';
                return;
            }

            dotsContainer.style.display = 'flex';
            dotsContainer.innerHTML = '';

            for (let i = 0; i < this.currentTestimonials.length; i++) {
                const dot = document.createElement('button');
                dot.className = `carousel-dot ${i === this.currentIndex ? 'active' : ''}`;
                dot.setAttribute('data-index', i);
                dot.addEventListener('click', () => this.goToSlide(i));
                dotsContainer.appendChild(dot);
            }
        },

        updateNavigationState() {
            const navContainer = document.querySelector('.carousel-nav-container');
            const canScroll = this.currentTestimonials.length > 3;

            if (navContainer) {
                navContainer.style.display = canScroll ? 'flex' : 'none';
            }
        },

        nextSlide() {
            if (this.currentTestimonials.length <= 3 || this.isAnimating) return;

            this.isAnimating = true;
            this.pauseAutoSlide();

            // Continuous chain movement - always move forward
            this.currentIndex = (this.currentIndex + 1) % this.currentTestimonials.length;

            this.updateCarousel();
            this.updateDots();

            setTimeout(() => {
                this.isAnimating = false;
                if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                    this.startAutoSlide();
                }
            }, 500);
        },

        prevSlide() {
            if (this.currentTestimonials.length <= 3 || this.isAnimating) return;

            this.isAnimating = true;
            this.pauseAutoSlide();

            // For prev, we still move forward in chain?
            // Actually let's make prev move backward but still maintain chain
            this.currentIndex = (this.currentIndex - 1 + this.currentTestimonials.length) % this.currentTestimonials.length;

            this.updateCarousel();
            this.updateDots();

            setTimeout(() => {
                this.isAnimating = false;
                if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                    this.startAutoSlide();
                }
            }, 500);
        },

        scrollToCenterCard() {
            const cards = this.track.querySelectorAll('.testimonial-card');
            if (!cards.length) return;

            const container = this.track.parentElement;
            const activeCard = cards[this.currentIndex];

            if (container && activeCard) {
                const containerRect = container.getBoundingClientRect();
                const cardRect = activeCard.getBoundingClientRect();

                // Calculate scroll position to center the active card
                const scrollLeft = container.scrollLeft + (cardRect.left - containerRect.left) - (containerRect.width / 2) + (cardRect.width / 2);

                container.scrollTo({
                    left: Math.max(0, scrollLeft),
                    behavior: 'smooth'
                });

                // Update card classes for all cards (show multiple cards)
                this.updateCardClasses();
            }
        },

        goToSlide(index) {
            if (this.currentTestimonials.length <= 3 || this.isAnimating) return;

            this.isAnimating = true;
            this.pauseAutoSlide();

            this.currentIndex = Math.max(0, Math.min(index, this.currentTestimonials.length - 1));
            this.scrollToCard();
            this.updateDots();

            setTimeout(() => {
                this.isAnimating = false;
                if (this.isAutoPlay && this.currentTestimonials.length > 3) {
                    this.startAutoSlide();
                }
            }, 500);
        },

        startAutoSlide() {
            this.stopAutoSlide();
            if (this.currentTestimonials.length > 3 && this.isAutoPlay) {
                this.autoSlideInterval = setInterval(() => {
                    // Continuous chain movement - always move forward
                    this.currentIndex = (this.currentIndex + 1) % this.currentTestimonials.length;
                    this.updateCarousel();
                    this.updateDots();
                }, this.autoPlayDelay);
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

        toggleAutoPlay() {
            this.isAutoPlay = !this.isAutoPlay;
            const indicator = document.getElementById('autoPlayIndicator');
            if (indicator) {
                const icon = indicator.querySelector('i');
                const text = indicator.querySelector('span');
                if (this.isAutoPlay) {
                    icon.className = 'fas fa-play-circle';
                    text.textContent = 'Auto';
                    if (this.currentTestimonials.length > 3) this.startAutoSlide();
                } else {
                    icon.className = 'fas fa-pause-circle';
                    text.textContent = 'Paused';
                    this.stopAutoSlide();
                }
            }
        },

        async openTestimonialForm() {
            try {
                let authData;

                if (this.currentUsername) {
                    authData = { can_post: true, username: this.currentUsername };
                } else {
                    const response = await fetch('/api/testimonial/auth-check', {
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });
                    authData = await response.json();

                    if (authData.logged_in) {
                        this.currentUsername = authData.username;
                    }
                }

                if (authData.can_post) {
                    const displayName = this.currentUsername || authData.username || 'User';
                    this.showModal(displayName);
                } else {
                    this.showLoginPrompt();
                }
            } catch (error) {
                console.error('Auth check error:', error);
                this.showLoginPrompt();
            }
        },

        showModal(username, testimonial = null) {
            const modal = document.getElementById('testimonialModal');
            const modalTitle = document.getElementById('modalTitle');
            const userNameField = document.getElementById('userName');
            const testimonialText = document.getElementById('testimonialText');
            const ratingValue = document.getElementById('ratingValue');
            const submitBtn = document.querySelector('#testimonialForm .btn-text');

            if (!modal) return;

            this.testimonialToEdit = testimonial ? testimonial.id : null;

            modalTitle.textContent = testimonial ? 'Edit Your Experience' : 'Share Your Experience';

            if (userNameField) {
                userNameField.value = username;
                userNameField.readOnly = true;
            }

            if (testimonialText) {
                testimonialText.value = testimonial ? testimonial.content : '';
            }

            if (ratingValue) {
                ratingValue.value = testimonial ? testimonial.rating : 5;
            }

            if (submitBtn) {
                submitBtn.textContent = testimonial ? 'Update Experience' : 'Share Experience';
            }

            this.setupStarRating(testimonial ? testimonial.rating : 5);

            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            setTimeout(() => {
                this.initFloatingLabels();
            }, 10);
        },

        setupStarRating(initialRating = 5) {
            const stars = this.starButtons || document.querySelectorAll('.star-btn');
            const ratingInput = this.ratingInput || document.getElementById('ratingValue');

            if (!stars.length) return;

            for (let i = 0; i < stars.length; i++) {
                const star = stars[i];
                const isActive = i < initialRating;
                star.classList.toggle('active', isActive);
                star.innerHTML = isActive ? '★' : '☆';

                if (!star._hasListener) {
                    star._hasListener = true;
                    star.onclick = () => {
                        const rating = parseInt(star.dataset.rating);
                        if (ratingInput) ratingInput.value = rating;
                        for (let j = 0; j < stars.length; j++) {
                            const s = stars[j];
                            const active = j < rating;
                            s.classList.toggle('active', active);
                            s.innerHTML = active ? '★' : '☆';
                        }
                    };
                }
            }
        },

        initFloatingLabels() {
            const formGroups = document.querySelectorAll('#testimonialForm .floating-label-group');
            if (!formGroups.length) return;

            for (let i = 0; i < formGroups.length; i++) {
                const group = formGroups[i];
                const input = group.querySelector('input, textarea');
                if (!input) continue;

                if (input.value && input.value.trim() !== '') {
                    group.classList.add('has-value');
                } else {
                    group.classList.remove('has-value');
                }

                if (!input._hasFloatingListener) {
                    input._hasFloatingListener = true;

                    input.addEventListener('focus', () => {
                        group.classList.add('focused');
                    });

                    input.addEventListener('blur', () => {
                        group.classList.remove('focused');
                        if (input.value && input.value.trim() !== '') {
                            group.classList.add('has-value');
                        } else {
                            group.classList.remove('has-value');
                        }
                    });

                    input.addEventListener('input', () => {
                        if (input.value && input.value.trim() !== '') {
                            group.classList.add('has-value');
                        } else {
                            group.classList.remove('has-value');
                        }
                    });
                }
            }
        },

        async handleSubmit(event) {
            event.preventDefault();

            const content = document.getElementById('testimonialText').value.trim();
            const rating = parseInt(document.getElementById('ratingValue').value);
            const messageDiv = document.getElementById('formMessage');

            if (!content) {
                this.showMessage('Please share your experience', 'error', messageDiv);
                return;
            }

            const submitBtn = event.target.querySelector('button[type="submit"]');
            const btnText = submitBtn.querySelector('.btn-text');
            const spinner = submitBtn.querySelector('.loading-spinner');

            btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline-block';
            submitBtn.disabled = true;

            try {
                const isEdit = !!this.testimonialToEdit;
                const url = isEdit ? `/api/testimonial/update/${this.testimonialToEdit}` : '/api/testimonial/submit';
                const method = isEdit ? 'PUT' : 'POST';

                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ content, rating })
                });

                const data = await response.json();

                if (!response.ok) throw new Error(data.message || 'Operation failed');

                if (data.success) {
                    this.showMessage(data.message, 'success', messageDiv);
                    document.getElementById('testimonialText').value = '';
                    this.setupStarRating(5);

                    setTimeout(() => {
                        this.closeModal();
                        this.loadTestimonials();
                        if (typeof showToast === 'function') {
                            showToast(isEdit ? 'Experience updated!' : 'Thank you for sharing!', 'success');
                        }
                    }, 1500);
                } else {
                    throw new Error(data.message || 'Operation failed');
                }
            } catch (error) {
                this.showMessage(error.message, 'error', messageDiv);
            } finally {
                btnText.style.display = 'inline-block';
                if (spinner) spinner.style.display = 'none';
                submitBtn.disabled = false;
            }
        },

        async handleEditClick(testimonialId) {
            try {
                const authResponse = await fetch('/api/testimonial/auth-check', { credentials: 'include' });
                const authData = await authResponse.json();

                if (!authData.can_post) {
                    this.showLoginPrompt();
                    return;
                }

                const testimonial = this.currentTestimonials.find(t => t.id === testimonialId);
                if (!testimonial) throw new Error('Not found');
                if (!testimonial.can_edit) throw new Error('Cannot edit');
                if (testimonial.is_deleted) throw new Error('Already deleted');

                this.showModal(this.currentUsername || authData.username, testimonial);
            } catch (error) {
                if (typeof showToast === 'function') {
                    showToast(error.message, 'error');
                }
            }
        },

        deleteTestimonial(testimonialId) {
            this.testimonialToDelete = testimonialId;
            const modal = document.getElementById('deleteConfirmModal');
            if (modal) modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        },

        async confirmDelete() {
            if (!this.testimonialToDelete) return;

            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const btnText = deleteBtn.querySelector('.btn-text');
            const spinner = deleteBtn.querySelector('.loading-spinner');

            if (btnText) btnText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline-block';
            deleteBtn.disabled = true;

            try {
                const response = await fetch(`/api/testimonial/delete/${this.testimonialToDelete}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Delete failed');

                if (data.success) {
                    this.closeDeleteModal();
                    if (typeof showToast === 'function') {
                        showToast('Testimonial deleted successfully', 'success');
                    }
                    this.loadTestimonials(); // Refresh the list
                }
            } catch (error) {
                console.error('Delete error:', error);
                if (typeof showToast === 'function') {
                    showToast(error.message || 'Failed to delete testimonial', 'error');
                }
            } finally {
                if (btnText) btnText.style.display = 'inline-block';
                if (spinner) spinner.style.display = 'none';
                deleteBtn.disabled = false;
                this.testimonialToDelete = null;
            }
        },

        openTestimonialDetail(testimonialId) {
            const testimonial = this.currentTestimonials.find(t => t.id === testimonialId);
            if (!testimonial) return;

            const modal = document.getElementById('testimonialDetailModal');
            if (!modal) return;

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

            if (authorName) authorName.textContent = testimonial.username;

            if (rating) {
                rating.innerHTML = Array.from({length: 5}, (_, i) =>
                    `<span class="star ${i < testimonial.rating ? '' : 'empty'}">★</span>`
                ).join('');
            }

            if (fullText) fullText.textContent = testimonial.content;

            if (date && testimonial.created_at) {
                date.textContent = `Shared on ${new Date(testimonial.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                })}`;
            }

            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        },

        closeModal() {
            const modal = document.getElementById('testimonialModal');
            if (modal) {
                modal.style.display = 'none';
                this.clearForm();
            }
            document.body.style.overflow = 'auto';
            this.testimonialToEdit = null;
        },

        closeDeleteModal() {
            const modal = document.getElementById('deleteConfirmModal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
            this.testimonialToDelete = null;
        },

        closeDetailModal() {
            const modal = document.getElementById('testimonialDetailModal');
            if (modal) {
                modal.style.display = 'none';
            }
            document.body.style.overflow = 'auto';
        },

        clearForm() {
            const textarea = document.getElementById('testimonialText');
            const messageDiv = document.getElementById('formMessage');
            if (textarea) textarea.value = '';
            if (messageDiv) {
                messageDiv.style.display = 'none';
                messageDiv.textContent = '';
            }
            this.setupStarRating(5);
        },

        showMessage(message, type, element) {
            if (element) {
                element.textContent = message;
                element.className = `form-message ${type}`;
                element.style.display = 'block';

                setTimeout(() => {
                    if (element) element.style.display = 'none';
                }, 5000);
            }
        },

        showLoginPrompt() {
            if (typeof showToast === 'function') {
                showToast('Please login to share your experience', 'warning');
            }
            resetLoginForm();
            const loginModal = document.getElementById('loginModal');
            if (loginModal) loginModal.style.display = 'flex';
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    // =============================================
    // LIGHTWEIGHT BLOG
    // =============================================

    const LightweightBlog = {
        currentId: null,
        modal: null,
        blogDataCache: new Map(),

        init: function() {
            this.modal = document.getElementById('lightweightBlogModal');
            this.bindEvents();
            this.bindCardClicks();
            this.preloadBlogData();
        },

        preloadBlogData: function() {
            const cards = document.querySelectorAll('.lightweight-blog-card');
            cards.forEach(card => {
                const id = card.dataset.id;
                if (id && !this.blogDataCache.has(id)) {
                    fetch(`/api/blog/${id}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                this.blogDataCache.set(id, data.blog);
                            }
                        })
                        .catch(e => console.warn('Preload failed:', e));
                }
            });
        },

        bindEvents: function() {
            const closeBtn = document.getElementById('lightweightModalClose');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }

            if (this.modal) {
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) this.closeModal();
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal && this.modal.style.display === 'flex') {
                    this.closeModal();
                }
            });

            // Card button events via delegation
            const grid = document.getElementById('lightweightBlogGrid');
            if (grid) {
                grid.addEventListener('click', (e) => {
                    const likeBtn = e.target.closest('.lightweight-like-btn');
                    const bookmarkBtn = e.target.closest('.lightweight-bookmark-btn');
                    const readMore = e.target.closest('.lightweight-read-more');

                    if (likeBtn) {
                        e.stopPropagation();
                        const id = likeBtn.dataset.id;
                        if (id) this.handleLike(likeBtn, id);
                    } else if (bookmarkBtn) {
                        e.stopPropagation();
                        const id = bookmarkBtn.dataset.id;
                        if (id) this.handleBookmark(bookmarkBtn, id);
                    } else if (readMore) {
                        e.stopPropagation();
                        const id = readMore.dataset.id;
                        if (id) this.openModal(id);
                    }
                });
            }
        },

        bindCardClicks: function() {
            const cards = document.querySelectorAll('.lightweight-blog-card');
            cards.forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    const id = card.dataset.id;
                    if (id) this.openModal(id);
                });
            });
        },

        showMessage: function(message, type = 'success') {
            if (typeof showToast === 'function') {
                showToast(message, type);
            } else {
                alert(message);
            }
        },

        openModal: async function(blogId) {
            try {
                this.modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                this.currentId = blogId;

                document.getElementById('lightweightModalContent').innerHTML = '<div class="loading-spinner-mini" style="margin: 40px auto; display: block;"></div><p style="text-align:center;">Loading...</p>';

                let blog;

                if (this.blogDataCache.has(blogId)) {
                    blog = this.blogDataCache.get(blogId);
                } else {
                    const response = await fetch(`/api/blog/${blogId}`);
                    const data = await response.json();
                    if (!data.success) throw new Error(data.error || 'Failed to load');
                    blog = data.blog;
                    this.blogDataCache.set(blogId, blog);
                }

                this.populateModal(blog);

                // =============================================
                // FIX: Track view count when modal opens
                // =============================================
                try {
                    const viewResponse = await fetch(`/api/blog/${blogId}/view`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    const viewData = await viewResponse.json();

                    if (viewData.success) {
                        console.log(`👀 View tracked for blog ${blogId}, total views: ${viewData.views}`);

                        // Update the view count in the modal
                        const modalViewsElement = document.getElementById('lightweightModalViews');
                        if (modalViewsElement) {
                            modalViewsElement.innerText = viewData.views;
                        }

                        // Update the views count in the card
                        const cardViewBadge = document.querySelector(`.lightweight-blog-card[data-id="${blogId}"] .views-count`);
                        if (cardViewBadge) {
                            cardViewBadge.innerText = viewData.views;
                        }

                        // Update the view count in the left panel
                        const modalQuickInfoViews = document.querySelector('#lightweightModalViews');
                        if (modalQuickInfoViews) {
                            modalQuickInfoViews.innerText = viewData.views;
                        }

                        // Update cache
                        if (this.blogDataCache.has(blogId)) {
                            this.blogDataCache.get(blogId).views = viewData.views;
                        }
                    } else {
                        console.warn('View tracking response not successful:', viewData);
                    }
                } catch (viewError) {
                    console.error('Error tracking view:', viewError);
                }

            } catch (error) {
                console.error('Error opening blog:', error);
                this.closeModal();
                this.showMessage('Could not load article', 'error');
            }
        },

        populateModal: function(blog) {
            // Basic info
            document.getElementById('lightweightModalCategory').innerText = (blog.categories && blog.categories[0]) || 'Career';
            document.getElementById('lightweightModalTitle').innerText = blog.title;
            document.getElementById('lightweightModalAuthor').innerText = blog.author || 'CareerMaker';
            document.getElementById('lightweightModalAuthorName').innerText = blog.author || 'CareerMaker Team';
            document.getElementById('lightweightModalLikes').innerText = blog.like_count || 0;

            const date = new Date(blog.published_at || blog.created_at);
            document.getElementById('lightweightModalDate').innerText = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('lightweightModalReadTime').innerText = blog.read_time || '5 min read';
            document.getElementById('lightweightModalViews').innerText = blog.views || 0;

            // Images
            const modalImg = document.getElementById('lightweightModalImage');
            modalImg.src = blog.image || '/static/images/default-blog.jpg';

            const modalAvatar = document.getElementById('lightweightModalAvatar');
            modalAvatar.src = blog.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(blog.author || 'CM')}&background=0f172a&color=fff`;

            // Content
            document.getElementById('lightweightModalContent').innerHTML = (blog.content || blog.description || 'No content.').replace(/\n/g, '<br>');

            // Setup bookmark button
            const modalBookmark = document.getElementById('lightweightModalBookmarkBtn');
            const isBookmarked = blog.is_bookmarked || false;
            modalBookmark.classList.toggle('bookmarked', isBookmarked);
            modalBookmark.querySelector('i').className = isBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
            modalBookmark.querySelector('span').innerText = isBookmarked ? 'Bookmarked' : 'Bookmark';

            // Setup like button
            const modalLikeBtn = document.getElementById('lightweightModalLikeBtn');
            const isLiked = blog.is_liked || false;
            modalLikeBtn.classList.toggle('liked', isLiked);
            modalLikeBtn.querySelector('i').className = isLiked ? 'fas fa-heart' : 'far fa-heart';
            document.getElementById('lightweightModalLikeCount').innerText = blog.like_count || 0;

            // Remove old listeners and add new ones
            const newModalLikeBtn = modalLikeBtn.cloneNode(true);
            modalLikeBtn.parentNode.replaceChild(newModalLikeBtn, modalLikeBtn);
            newModalLikeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleModalLike(this.currentId);
            });

            const newModalBookmark = modalBookmark.cloneNode(true);
            modalBookmark.parentNode.replaceChild(newModalBookmark, modalBookmark);
            newModalBookmark.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleModalBookmark(this.currentId);
            });
        },

        closeModal: function() {
            if (this.modal) {
                this.modal.style.display = 'none';
                document.body.style.overflow = '';
                this.currentId = null;
            }
        },

        handleLike: async function(btn, blogId) {
            try {
                const sessionCheck = await fetch('/api/check-session', { credentials: 'include' });
                const session = await sessionCheck.json();

                if (!session.logged_in) {
                    this.showMessage('Please login to like articles', 'warning');
                    if (typeof openLoginModal === 'function') openLoginModal();
                    return;
                }

                const isCurrentlyLiked = btn.classList.contains('liked');
                const countSpan = btn.querySelector('.like-count');
                let currentCount = parseInt(countSpan.innerText) || 0;

                // Optimistic update
                if (!isCurrentlyLiked) {
                    btn.classList.add('liked');
                    btn.querySelector('i').className = 'fas fa-heart';
                    countSpan.innerText = currentCount + 1;
                } else {
                    btn.classList.remove('liked');
                    btn.querySelector('i').className = 'far fa-heart';
                    countSpan.innerText = Math.max(0, currentCount - 1);
                }

                const response = await fetch(`/api/blog/${blogId}/like`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();
                if (!response.ok || !data.success) throw new Error();

                // Sync with server
                countSpan.innerText = data.like_count;

                if (data.action === 'liked') {
                    btn.classList.add('liked');
                    btn.querySelector('i').className = 'fas fa-heart';
                    this.showMessage('You liked this article! ❤️', 'success');
                } else if (data.action === 'unliked') {
                    btn.classList.remove('liked');
                    btn.querySelector('i').className = 'far fa-heart';
                    this.showMessage('You unliked this article', 'info');
                }

                // Update modal if open
                if (this.currentId == blogId) {
                    document.getElementById('lightweightModalLikeCount').innerText = data.like_count;
                    document.getElementById('lightweightModalLikes').innerText = data.like_count;
                    const modalLikeBtn = document.getElementById('lightweightModalLikeBtn');
                    if (data.action === 'liked') {
                        modalLikeBtn.classList.add('liked');
                        modalLikeBtn.querySelector('i').className = 'fas fa-heart';
                    } else {
                        modalLikeBtn.classList.remove('liked');
                        modalLikeBtn.querySelector('i').className = 'far fa-heart';
                    }
                }

                // Update cache
                if (this.blogDataCache.has(blogId)) {
                    this.blogDataCache.get(blogId).like_count = data.like_count;
                    this.blogDataCache.get(blogId).is_liked = (data.action === 'liked');
                }

            } catch (error) {
                console.error('Like error:', error);
                this.showMessage('Like action failed', 'error');
            }
        },

        handleModalLike: async function(blogId) {
            const likeBtn = document.getElementById('lightweightModalLikeBtn');
            const countSpan = document.getElementById('lightweightModalLikeCount');
            const likesSpan = document.getElementById('lightweightModalLikes');

            const isCurrentlyLiked = likeBtn.classList.contains('liked');
            let currentCount = parseInt(countSpan.innerText) || 0;
            const previousState = {
                isLiked: isCurrentlyLiked,
                count: currentCount
            };

            // Optimistic update
            if (!isCurrentlyLiked) {
                likeBtn.classList.add('liked');
                likeBtn.querySelector('i').className = 'fas fa-heart';
                countSpan.innerText = currentCount + 1;
                if (likesSpan) likesSpan.innerText = currentCount + 1;
            } else {
                likeBtn.classList.remove('liked');
                likeBtn.querySelector('i').className = 'far fa-heart';
                countSpan.innerText = Math.max(0, currentCount - 1);
                if (likesSpan) likesSpan.innerText = Math.max(0, currentCount - 1);
            }

            // Also update card button optimistically
            const cardLikeBtn = document.querySelector(`.lightweight-like-btn[data-id="${blogId}"]`);
            if (cardLikeBtn) {
                const cardCountSpan = cardLikeBtn.querySelector('.like-count');
                if (!isCurrentlyLiked) {
                    cardLikeBtn.classList.add('liked');
                    cardLikeBtn.querySelector('i').className = 'fas fa-heart';
                    if (cardCountSpan) cardCountSpan.innerText = currentCount + 1;
                } else {
                    cardLikeBtn.classList.remove('liked');
                    cardLikeBtn.querySelector('i').className = 'far fa-heart';
                    if (cardCountSpan) cardCountSpan.innerText = Math.max(0, currentCount - 1);
                }
            }

            try {
                // First check if user is logged in
                const sessionCheck = await fetch('/api/check-session', { credentials: 'include' });
                const session = await sessionCheck.json();

                if (!session.logged_in) {
                    // Revert optimistic update
                    if (previousState.isLiked) {
                        likeBtn.classList.add('liked');
                        likeBtn.querySelector('i').className = 'fas fa-heart';
                        countSpan.innerText = previousState.count;
                        if (likesSpan) likesSpan.innerText = previousState.count;
                    } else {
                        likeBtn.classList.remove('liked');
                        likeBtn.querySelector('i').className = 'far fa-heart';
                        countSpan.innerText = previousState.count;
                        if (likesSpan) likesSpan.innerText = previousState.count;
                    }

                    // Revert card button
                    if (cardLikeBtn) {
                        const cardCountSpan = cardLikeBtn.querySelector('.like-count');
                        if (previousState.isLiked) {
                            cardLikeBtn.classList.add('liked');
                            cardLikeBtn.querySelector('i').className = 'fas fa-heart';
                            if (cardCountSpan) cardCountSpan.innerText = previousState.count;
                        } else {
                            cardLikeBtn.classList.remove('liked');
                            cardLikeBtn.querySelector('i').className = 'far fa-heart';
                            if (cardCountSpan) cardCountSpan.innerText = previousState.count;
                        }
                    }

                    // Close blog modal first
                    this.closeModal();

                    // Show login message
                    if (typeof showToast === 'function') {
                        showToast('Please login to like articles', 'warning');
                    }

                    // Open login modal after short delay
                    setTimeout(() => {
                        if (typeof openLoginModal === 'function') {
                            openLoginModal();
                        } else {
                            const loginModal = document.getElementById('loginModal');
                            if (loginModal) {
                                loginModal.style.display = 'flex';
                                document.body.style.overflow = 'hidden';
                            }
                        }
                    }, 200);
                    return;
                }

                // User is logged in, proceed with like
                const response = await fetch(`/api/blog/${blogId}/like`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'Like operation failed');

                // Sync with server
                countSpan.innerText = data.like_count;
                if (likesSpan) likesSpan.innerText = data.like_count;

                if (data.action === 'liked') {
                    likeBtn.classList.add('liked');
                    likeBtn.querySelector('i').className = 'fas fa-heart';
                    if (typeof showToast === 'function') {
                        showToast('You liked this article! ❤️', 'success');
                    }
                } else if (data.action === 'unliked') {
                    likeBtn.classList.remove('liked');
                    likeBtn.querySelector('i').className = 'far fa-heart';
                    if (typeof showToast === 'function') {
                        showToast('You unliked this article', 'info');
                    }
                }

                // Sync card button
                if (cardLikeBtn) {
                    const cardCountSpan = cardLikeBtn.querySelector('.like-count');
                    if (cardCountSpan) cardCountSpan.innerText = data.like_count;
                    if (data.action === 'liked') {
                        cardLikeBtn.classList.add('liked');
                        cardLikeBtn.querySelector('i').className = 'fas fa-heart';
                    } else {
                        cardLikeBtn.classList.remove('liked');
                        cardLikeBtn.querySelector('i').className = 'far fa-heart';
                    }
                }

                // Update cache
                if (this.blogDataCache.has(blogId)) {
                    this.blogDataCache.get(blogId).like_count = data.like_count;
                    this.blogDataCache.get(blogId).is_liked = (data.action === 'liked');
                }

            } catch (error) {
                console.error('Modal like error:', error);

                // Revert optimistic update
                if (previousState.isLiked) {
                    likeBtn.classList.add('liked');
                    likeBtn.querySelector('i').className = 'fas fa-heart';
                    countSpan.innerText = previousState.count;
                    if (likesSpan) likesSpan.innerText = previousState.count;
                } else {
                    likeBtn.classList.remove('liked');
                    likeBtn.querySelector('i').className = 'far fa-heart';
                    countSpan.innerText = previousState.count;
                    if (likesSpan) likesSpan.innerText = previousState.count;
                }

                // Revert card button
                if (cardLikeBtn) {
                    const cardCountSpan = cardLikeBtn.querySelector('.like-count');
                    if (previousState.isLiked) {
                        cardLikeBtn.classList.add('liked');
                        cardLikeBtn.querySelector('i').className = 'fas fa-heart';
                        if (cardCountSpan) cardCountSpan.innerText = previousState.count;
                    } else {
                        cardLikeBtn.classList.remove('liked');
                        cardLikeBtn.querySelector('i').className = 'far fa-heart';
                        if (cardCountSpan) cardCountSpan.innerText = previousState.count;
                    }
                }

                if (typeof showToast === 'function') {
                    showToast(error.message || 'Like action failed', 'error');
                }
            }
        },

        handleBookmark: async function(btn, blogId) {
            try {
                const sessionCheck = await fetch('/api/check-session', { credentials: 'include' });
                const session = await sessionCheck.json();

                if (!session.logged_in) {
                    this.showMessage('Please login to bookmark', 'warning');
                    if (typeof openLoginModal === 'function') openLoginModal();
                    return;
                }

                const isBookmarked = btn.classList.contains('bookmarked');
                const willBeBookmarked = !isBookmarked;

                btn.classList.toggle('bookmarked', willBeBookmarked);
                btn.querySelector('i').className = willBeBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';

                const response = await fetch(`/api/bookmark/blog/${blogId}`, {
                    method: 'POST',
                    credentials: 'include'
                });

                const data = await response.json();
                if (!response.ok || !data.success) throw new Error();

                if (data.status === 'added') {
                    this.showMessage('Article saved to bookmarks! 📌', 'success');
                } else if (data.status === 'removed') {
                    this.showMessage('Article removed from bookmarks', 'info');
                }

                // Update modal if open
                if (this.currentId == blogId) {
                    const modalBookmark = document.getElementById('lightweightModalBookmarkBtn');
                    modalBookmark.classList.toggle('bookmarked', willBeBookmarked);
                    modalBookmark.querySelector('i').className = willBeBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
                    modalBookmark.querySelector('span').innerText = willBeBookmarked ? 'Bookmarked' : 'Bookmark';
                }

                if (this.blogDataCache.has(blogId)) {
                    this.blogDataCache.get(blogId).is_bookmarked = willBeBookmarked;
                }

            } catch (error) {
                console.error('Bookmark error:', error);
                this.showMessage('Bookmark failed', 'error');
            }
        },

        handleModalBookmark: async function(blogId) {
            const modalBookmark = document.getElementById('lightweightModalBookmarkBtn');
            const isCurrentlyBookmarked = modalBookmark.classList.contains('bookmarked');
            const willBeBookmarked = !isCurrentlyBookmarked;
            const previousState = isCurrentlyBookmarked;

            // Optimistic update
            modalBookmark.classList.toggle('bookmarked', willBeBookmarked);
            modalBookmark.querySelector('i').className = willBeBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
            modalBookmark.querySelector('span').innerText = willBeBookmarked ? 'Bookmarked' : 'Bookmark';

            try {
                // First check if user is logged in
                const sessionCheck = await fetch('/api/check-session', { credentials: 'include' });
                const session = await sessionCheck.json();

                if (!session.logged_in) {
                    // Revert optimistic update
                    modalBookmark.classList.toggle('bookmarked', previousState);
                    modalBookmark.querySelector('i').className = previousState ? 'fas fa-bookmark' : 'far fa-bookmark';
                    modalBookmark.querySelector('span').innerText = previousState ? 'Bookmarked' : 'Bookmark';

                    // Close blog modal first
                    this.closeModal();

                    // Show login message and open login modal
                    if (typeof showToast === 'function') {
                        showToast('Please login to bookmark articles', 'warning');
                    }

                    // Open login modal after a short delay to ensure blog modal is closed
                    setTimeout(() => {
                        if (typeof openLoginModal === 'function') {
                            openLoginModal();
                        } else {
                            const loginModal = document.getElementById('loginModal');
                            if (loginModal) {
                                loginModal.style.display = 'flex';
                                document.body.style.overflow = 'hidden';
                            }
                        }
                    }, 200);
                    return;
                }

                // User is logged in, proceed with bookmark
                const response = await fetch(`/api/bookmark/blog/${blogId}`, {
                    method: 'POST',
                    credentials: 'include'
                });

                const data = await response.json();
                if (!response.ok || !data.success) throw new Error(data.error || 'Bookmark operation failed');

                if (data.status === 'added') {
                    if (typeof showToast === 'function') {
                        showToast('Article saved to bookmarks! 📌', 'success');
                    }
                } else if (data.status === 'removed') {
                    if (typeof showToast === 'function') {
                        showToast('Article removed from bookmarks', 'info');
                    }
                }

                // Update card bookmark
                const cardBtn = document.querySelector(`.lightweight-bookmark-btn[data-id="${blogId}"]`);
                if (cardBtn) {
                    cardBtn.classList.toggle('bookmarked', willBeBookmarked);
                    cardBtn.querySelector('i').className = willBeBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
                }

                // Update cache
                if (this.blogDataCache.has(blogId)) {
                    this.blogDataCache.get(blogId).is_bookmarked = willBeBookmarked;
                }

            } catch (error) {
                console.error('Modal bookmark error:', error);

                // Revert optimistic update
                modalBookmark.classList.toggle('bookmarked', previousState);
                modalBookmark.querySelector('i').className = previousState ? 'fas fa-bookmark' : 'far fa-bookmark';
                modalBookmark.querySelector('span').innerText = previousState ? 'Bookmarked' : 'Bookmark';

                if (typeof showToast === 'function') {
                    showToast(error.message || 'Bookmark failed', 'error');
                }
            }
        }

    };

    // =============================================
    // NEWSLETTER SUBSCRIPTION SYSTEM - FIXED FOR MOBILE
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
                // Add timeout for mobile networks
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                const response = await fetch('/api/subscribe', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // Check if response is okay
                if (!response.ok) {
                    // Try to get error message from response
                    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        // If can't parse JSON, try to get text
                        try {
                            const text = await response.text();
                            if (text && text.length < 100) { // Only use if it's short text
                                errorMessage = text;
                            }
                        } catch (textError) {
                            // Ignore text parsing errors
                        }
                    }
                    throw new Error(errorMessage);
                }

                // Try to parse JSON response
                let data;
                try {
                    data = await response.json();
                } catch (jsonError) {
                    console.error('JSON parsing error:', jsonError);
                    throw new Error('Server returned invalid response. Please try again.');
                }

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

                let userErrorMessage = 'Failed to subscribe. Please try again.';

                // Handle specific error types
                if (error.name === 'AbortError') {
                    userErrorMessage = 'Request timeout. Please check your connection and try again.';
                } else if (error.message.includes('Failed to fetch')) {
                    userErrorMessage = 'Network error. Please check your internet connection.';
                } else if (error.message.includes('HTTP')) {
                    userErrorMessage = error.message;
                } else {
                    userErrorMessage = error.message || userErrorMessage;
                }

                // Show error message
                if (responseDiv) {
                    responseDiv.className = 'form-response error';
                    responseDiv.textContent = userErrorMessage;
                    responseDiv.style.display = 'block';
                }

                showToast(userErrorMessage, 'error');

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
    // MOBILE DETECTION HELPER
    // =============================================

    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // =============================================
    // NETWORK STATUS MONITOR
    // =============================================

    function setupNetworkMonitor() {
        if (!navigator.onLine) {
            showToast('You are offline. Please check your connection.', 'warning');
        }

        window.addEventListener('online', () => {
            showToast('You are back online!', 'success');
        });

        window.addEventListener('offline', () => {
            showToast('You are offline. Some features may not work.', 'warning');
        });
    }


    // =============================================
    // UNSUBSCRIBE PAGE FUNCTIONALITY - DYNAMIC PAGE UPDATE
    // =============================================

    function initializeUnsubscribePage() {
        const unsubscribeForm = document.querySelector('.unsubscribe-form');
        if (!unsubscribeForm) return;

        unsubscribeForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const emailInput = this.querySelector('input[type="email"]');
            const submitBtn = this.querySelector('button[type="submit"]');
            const unsubscribeCard = document.querySelector('.unsubscribe-card');

            if (!emailInput || !submitBtn || !unsubscribeCard) return;

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

            try {
                // Submit to API
                const formData = new FormData();
                formData.append('email', email);

                const response = await fetch('/api/unsubscribe', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (data.status === 'success') {
                    // SUCCESS: Transform the page into success state
                    transformToSuccessPage(unsubscribeCard, data.message);
                    showToast(data.message, 'success');
                } else {
                    // ERROR: Show error message
                    throw new Error(data.message || 'Unsubscribe failed');
                }

            } catch (error) {
                console.error('Unsubscribe error:', error);

                // Re-enable button
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;

                // Show error
                showToast(error.message || 'Failed to unsubscribe. Please try again.', 'error');

                // Focus on email field
                emailInput.focus();
                emailInput.select();
            }
        });
    }

    // =============================================
    // PAGE TRANSFORMATION FUNCTION
    // =============================================

    function transformToSuccessPage(container, successMessage) {
        // Clear the container with fade out animation
        container.style.opacity = '0.5';
        container.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            // Replace entire content with success state
            container.innerHTML = `
                <div class="unsubscribe-success-state animated-fade-in">
                    <!-- Big Success Icon -->
                    <div class="success-icon-large">
                        <i class="fas fa-check-circle"></i>
                    </div>

                    <!-- Big Success Message -->
                    <h1 class="success-title-large">SUCCESSFULLY UNSUBSCRIBED</h1>

                    <!-- Confirmation Message -->
                    <div class="success-confirmation">
                        <p class="confirmation-text">${successMessage || 'You have been successfully unsubscribed from CareerMaker newsletter.'}</p>
                        <p class="goodbye-text">We're sorry to see you go!</p>
                    </div>

                    <!-- What You'll Miss Section -->
                    <div class="missed-section">
                        <h2><i class="fas fa-exclamation-triangle"></i> What You'll No Longer Receive</h2>
                        <div class="missed-grid">
                            <div class="missed-item-large">
                                <div class="missed-icon">
                                    <i class="fas fa-graduation-cap"></i>
                                </div>
                                <h3>Course Updates</h3>
                                <p>New learning opportunities</p>
                            </div>
                            <div class="missed-item-large">
                                <div class="missed-icon">
                                    <i class="fas fa-briefcase"></i>
                                </div>
                                <h3>Job Alerts</h3>
                                <p>Latest opportunities</p>
                            </div>
                            <div class="missed-item-large">
                                <div class="missed-icon">
                                    <i class="fas fa-blog"></i>
                                </div>
                                <h3>Tech Insights</h3>
                                <p>Industry news and tips</p>
                            </div>
                            <div class="missed-item-large">
                                <div class="missed-icon">
                                    <i class="fas fa-star"></i>
                                </div>
                                <h3>Exclusive Content</h3>
                                <p>Subscriber-only resources</p>
                            </div>
                        </div>
                    </div>

                    <!-- Confirmation Notice -->
                    <div class="final-notice">
                        <div class="notice-icon">
                            <i class="fas fa-info-circle"></i>
                        </div>
                        <p>This change takes effect immediately. You may receive one final confirmation email.</p>
                    </div>

                    <!-- Action Buttons -->
                    <div class="success-actions">
                        <a href="/" class="btn btn-primary btn-large">
                            <i class="fas fa-home"></i> Return to Homepage
                        </a>
                    </div>

                    <!-- Terms -->
                    <div class="success-terms">
                        <p><small>CareerMaker respects your privacy. Read our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a>.</small></p>
                    </div>
                </div>
            `;

            // Fade in new content
            container.style.opacity = '1';

            // Add confetti effect for celebration
            setTimeout(() => {
                triggerConfettiEffect();
            }, 500);

        }, 300);
    }

    // =============================================
    // CONFETTI EFFECT FOR SUCCESS
    // =============================================

    function triggerConfettiEffect() {
        // Create confetti elements
        const colors = ['#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0'];

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: 50%;
                top: -20px;
                left: ${Math.random() * 100}vw;
                opacity: 0.7;
                z-index: 9999;
                pointer-events: none;
            `;

            document.body.appendChild(confetti);

            // Animate confetti
            const animation = confetti.animate([
                {
                    transform: `translateY(0px) rotate(0deg)`,
                    opacity: 0.7
                },
                {
                    transform: `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 360}deg)`,
                    opacity: 0
                }
            ], {
                duration: 2000 + Math.random() * 1000,
                easing: 'cubic-bezier(0.215, 0.610, 0.355, 1)'
            });

            // Remove confetti after animation
            animation.onfinish = () => confetti.remove();
        }
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
    // Cache DOM elements for better performance
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a');

    // Throttled scroll handler
    let scrollTimeout;
    let lastScrollTime = 0;
    const SCROLL_THROTTLE = 100;

    function updateActiveNav() {
      let current = '';

      // Use for loop instead of forEach for better performance
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (window.pageYOffset >= (sectionTop - 200)) {
          current = section.getAttribute('id');
        }
      }

      // Update nav links
      for (let i = 0; i < navLinks.length; i++) {
        const link = navLinks[i];
        link.classList.remove('active-scroll');
        if (link.getAttribute('href').includes(current)) {
          link.classList.add('active-scroll');
        }
      }
    }

    // Throttled scroll event listener
    window.addEventListener('scroll', function() {
      const now = Date.now();
      if (now - lastScrollTime < SCROLL_THROTTLE) return;
      lastScrollTime = now;

      if (scrollTimeout) {
        cancelAnimationFrame(scrollTimeout);
      }

      scrollTimeout = requestAnimationFrame(function() {
        updateActiveNav();
      });
    });

    // Initial call
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

        // contact section card centered when single card present//
        let c = document.querySelector('.contact-container');
        let i = document.querySelector('.contact-info');
        let f = document.querySelector('.contact-form');

        if (c) {
            c.classList.remove('single-column-info', 'single-column-form');
            if (!i || i.children.length === 0) c.classList.add('single-column-info');
            else if (!f || f.children.length === 0) c.classList.add('single-column-form');
        }

        // Using existing withLoader function
        const viewAllBtn = document.getElementById('viewAllBlogsBtn');
        if (viewAllBtn) {
            const newBtn = viewAllBtn.cloneNode(true);
            viewAllBtn.parentNode.replaceChild(newBtn, viewAllBtn);

            newBtn.addEventListener('click', function(e) {
                e.preventDefault();

                if (typeof withLoader === 'function') {
                    withLoader(
                        new Promise((resolve) => {
                            setTimeout(() => {
                                window.location.href = '/blogs.html';
                                resolve();
                            }, 300);
                        }),
                        'Loading articles...'
                    );
                } else {
                    window.location.href = '/blogs.html';
                }
            });
        }

        // Initialize dark mode
        initDarkMode();

        // Initialize logo preview system
        setupLogoPreview();

        // Initialize content cards functionality
        initializeContentCards();

        // Initialize blog  system
        LightweightBlog.init();

        // ADD THIS LINE - Initialize password reset modal
        PasswordResetModal.init();

        // Initialize testimonial system
        if (typeof testimonialSystem !== 'undefined' && testimonialSystem.init) {
            testimonialSystem.init();
        }

        // Initialize newsletter subscription
        initializeNewsletter();

        // Setup network monitor
        setupNetworkMonitor();

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

        // Add retry logic for mobile devices
        if (isMobileDevice()) {
            console.log('Mobile device detected - enabling mobile optimizations');

            // Add a global error handler for fetch requests
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                try {
                    return await originalFetch.apply(this, args);
                } catch (error) {
                    console.error('Fetch error on mobile:', error);

                    // Only show toast for network errors
                    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                        showToast('Network error. Please check your connection.', 'error');
                    }

                    throw error;
                }
            };
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

        // Initialize animations if not already initialized
        if (typeof initializeAnimations === 'function') {
            initializeAnimations();
        }

        // Add animation styles
        addAnimationStyles();

        // Initialize course cards for modal
        setTimeout(() => {
            if (typeof initializeCourseCards === 'function') {
                initializeCourseCards();
            }
            if (typeof initializeContentCards === 'function') {
                initializeContentCards();
            }
        }, 500);

        // Modal bookmark button handler
        document.getElementById('horizontalModalBookmarkBtn')?.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const courseId = this.dataset.id;
            if (courseId) {
                handleModalBookmark(courseId);
            }
        });

        // Modal apply button handler
        document.getElementById('horizontalModalApplyBtn')?.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (this.disabled) return;

            const courseId = this.dataset.id;
            const contentType = this.dataset.type;

            console.log(`📊 Modal apply clicked: ${contentType} ID: ${courseId}`);

            // Track enrollment for courses
            if (contentType === 'course') {
                trackCourseEnrollment(courseId);
            }

            // Call the original apply function
            applyForContent(courseId, contentType, this);
        });

        // Close modal on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const modal = document.getElementById('horizontalCourseModal');
                if (modal && modal.style.display === 'flex') {
                    closeHorizontalCourseModal();
                }
            }
        });

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

    // ===========================================
    // ANIMATION FUNCTIONS
    // ===========================================

    /**
     * Initialize all scroll-triggered animations
     */
    function initializeAnimations() {
        console.log('Initializing animations...');

        // Get all elements that need scroll animation
        const animatedElements = document.querySelectorAll(
            '.scroll-animate, .scroll-animate-left, .scroll-animate-right, ' +
            '.scroll-animate-scale, .stagger-scroll, ' +
            '.section-title, .feature-grid, .preview-grid, ' +
            '.blog-grid-vertical, .testimonials-carousel, ' +
            '.view-all, .support-header, .contact-container, ' +
            '.contact-info, .contact-form, .filters'
        );

        // Use requestIdleCallback for non-critical animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');

                    // Handle staggered animations
                    if (entry.target.classList.contains('stagger-scroll')) {
                        const children = entry.target.children;
                        Array.from(children).forEach((child, index) => {
                            child.style.transitionDelay = `${(index + 1) * 100}ms`;
                        });
                    }

                    // Unobserve after animation triggers to reduce load
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '50px 0px 50px 0px' // Smaller margin
        });

        // Observe elements in batches using setTimeout to prevent blocking
        const batchSize = 20;
        let index = 0;

        function observeBatch() {
            const batch = Array.from(animatedElements).slice(index, index + batchSize);
            batch.forEach(element => observer.observe(element));
            index += batchSize;

            if (index < animatedElements.length) {
                setTimeout(observeBatch, 100);
            }
        }

        observeBatch();

        // Initialize card hover effects
        initializeCardHoverEffects();

        // Initialize button ripple effects
        initializeButtonRippleEffects();
    }

    /**
     * Initialize card hover effects
     */
    function initializeCardHoverEffects() {
        const cards = document.querySelectorAll('.preview-card, .feature-card, .blog-card-vertical, .course-card-layout');

        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.classList.add('hover-animate');
            });

            card.addEventListener('mouseleave', function() {
                this.classList.remove('hover-animate');
            });
        });
    }

    /**
     * Initialize button ripple effects
     */
    function initializeButtonRippleEffects() {
        const buttons = document.querySelectorAll('.btn:not(.bookmark-btn):not(.btn-icon), .apply-btn, .btn-primary, .btn-outline, .btn-success, .btn-danger');

        buttons.forEach(button => {
            button.addEventListener('click', function(e) {
                // Skip if button is disabled
                if (this.disabled || this.classList.contains('bookmark-btn')) return;

                createRippleEffect(this, e);
            });
        });
    }

    /**
     * Create ripple effect on button click
     */
    function createRippleEffect(button, e) {
        if (button.querySelector('.ripple-effect')) return;

        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.className = 'ripple-effect';
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.6);
            transform: scale(0);
            animation: ripple-animation 0.4s linear;
            width: ${size}px;
            height: ${size}px;
            top: ${y}px;
            left: ${x}px;
            pointer-events: none;
            z-index: 1;
        `;

        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);

        setTimeout(() => {
            if (ripple.parentNode === button) {
                button.removeChild(ripple);
            }
        }, 400);
    }

    /**
     * Add animation styles dynamically
     */
    function addAnimationStyles() {
        // Check if styles already exist
        if (document.getElementById('animation-styles')) return;

        const style = document.createElement('style');
        style.id = 'animation-styles';
        style.textContent = `
            /* Ripple animation */
            @keyframes ripple-animation {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }

            /* Card hover animations */
            .preview-card.hover-animate,
            .feature-card.hover-animate,
            .blog-card-vertical.hover-animate,
            .course-card-layout.hover-animate {
                transform: translateY(-10px) scale(1.02);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15) !important;
                z-index: 10;
            }

            /* Button hover effects */
            .btn:not(.bookmark-btn):hover {
                transform: translateY(-2px);
            }

            /* Mobile adjustments */
            @media (max-width: 768px) {
                .preview-card.hover-animate,
                .feature-card.hover-animate,
                .blog-card-vertical.hover-animate,
                .course-card-layout.hover-animate {
                    transform: translateY(-5px) scale(1.01);
                }

                .btn:hover {
                    transform: translateY(-1px);
                }
            }

            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .scroll-animate,
                .scroll-animate-left,
                .scroll-animate-right,
                .scroll-animate-scale,
                .stagger-scroll {
                    opacity: 1 !important;
                    transform: none !important;
                    transition: none !important;
                }

                .ripple-effect {
                    display: none !important;
                }

                .preview-card.hover-animate,
                .feature-card.hover-animate,
                .blog-card-vertical.hover-animate,
                .course-card-layout.hover-animate {
                    transform: none !important;
                }

                .btn:hover {
                    transform: none !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Reset animations for dynamic content (AJAX loaded)
     */
    function resetAnimations() {
        // Remove active class from all animated elements
        const animatedElements = document.querySelectorAll(
            '.scroll-animate, .scroll-animate-left, .scroll-animate-right, ' +
            '.scroll-animate-scale, .stagger-scroll'
        );

        animatedElements.forEach(element => {
            element.classList.remove('active');
        });

        // Reinitialize animations
        setTimeout(initializeAnimations, 100);
    }

    // Make functions available globally
    window.animationManager = {
        initialize: initializeAnimations,
        reset: resetAnimations,
        createRipple: createRippleEffect
    };

    // Auto-initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAnimations);
    } else {
        initializeAnimations();
    }

    // =============================================
    // Horizontal Course Modal Functions
    // =============================================

    // Initialize course cards for modal click
    function initializeCourseCards() {
        console.log('Initializing course cards for horizontal modal...');

        document.querySelectorAll('.course-card-layout').forEach(card => {
            card.removeEventListener('click', handleHorizontalCourseCardClick);
            card.addEventListener('click', handleHorizontalCourseCardClick);
            card.style.cursor = 'pointer';
        });

        console.log(`Initialized ${document.querySelectorAll('.course-card-layout').length} course cards`);
    }

    // Handle course card click
    function handleHorizontalCourseCardClick(e) {
        if (e.target.closest('.bookmark-btn') || e.target.closest('.apply-btn')) {
            return;
        }

        const courseId = this.dataset.id;
        console.log('Course card clicked, ID:', courseId);

        if (!courseId || courseId === 'undefined' || courseId === 'null') {
            showToast('Invalid course', 'error');
            return;
        }

        openHorizontalCourseModal(courseId);
    }

    // Refresh course cards after dynamic updates
    function refreshCourseCards() {
        console.log('Refreshing course cards...');
        setTimeout(() => {
            initializeCourseCards();
            initializeContentCards(); // Re-initialize apply buttons
        }, 100);
    }

    // Open horizontal course modal
    async function openHorizontalCourseModal(courseId) {
        try {
            showLoader('Loading course details...');

            const response = await fetch(`/api/course/${courseId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned invalid response');
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load course details');
            }

            const course = data.course;
            populateHorizontalCourseModal(course);

            const modal = document.getElementById('horizontalCourseModal');
            if (modal) {
                modal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }

        } catch (error) {
            console.error('Error loading course details:', error);
            showToast(error.message || 'Failed to load course details', 'error');
        } finally {
            hideLoader();
        }
    }

    // Close horizontal course modal
    function closeHorizontalCourseModal() {
        const modal = document.getElementById('horizontalCourseModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    // Populate horizontal course details modal with data
    function populateHorizontalCourseModal(course) {
        // Image
        const modalImage = document.getElementById('horizontalModalCourseImage');
        const imagePlaceholder = document.querySelector('.horizontal-image-placeholder');

        if (course.image || course.company_logo) {
            modalImage.src = course.image || course.company_logo;
            modalImage.style.display = 'block';
            if (imagePlaceholder) imagePlaceholder.style.display = 'none';
        } else {
            modalImage.style.display = 'none';
            if (imagePlaceholder) imagePlaceholder.style.display = 'flex';
        }

        // Category
        document.getElementById('horizontalModalCourseCategory').textContent = course.category || 'General';

        // Title
        document.getElementById('horizontalModalCourseTitle').textContent = course.title;

        // Provider
        document.getElementById('horizontalModalCourseProvider').textContent =
            course.company || course.instructor || 'Unknown Provider';

        // Description
        document.getElementById('horizontalModalCourseDescription').textContent =
            course.description || 'No description available';

        // Price
        const priceElement = document.getElementById('horizontalModalCoursePrice');
        priceElement.textContent = (course.price && course.price !== 'Free') ? `$${course.price}` : 'Free';

        // Also update mobile price if it exists
        const mobilePrice = document.getElementById('mobileCoursePrice');
        if (mobilePrice) {
            mobilePrice.textContent = (course.price && course.price !== 'Free') ? `$${course.price}` : 'Free';
        }

        // Level
        document.getElementById('horizontalModalCourseLevel').textContent = course.level || 'All Levels';
        const mobileLevel = document.getElementById('mobileCourseLevel');
        if (mobileLevel) mobileLevel.textContent = course.level || 'All Levels';

        // Duration
        document.getElementById('horizontalModalCourseDuration').textContent = course.duration || 'N/A';
        const mobileDuration = document.getElementById('mobileCourseDuration');
        if (mobileDuration) mobileDuration.textContent = course.duration || 'N/A';

        // Language
        document.getElementById('horizontalModalCourseLanguage').textContent = course.language || 'N/A';
        const mobileLanguage = document.getElementById('mobileCourseLanguage');
        if (mobileLanguage) mobileLanguage.textContent = course.language || 'N/A';

        // Views - KEEP THIS (not enrollment)
        document.getElementById('horizontalModalViews').textContent = course.views || 0;
        const mobileViews = document.getElementById('mobileViews');
        if (mobileViews) mobileViews.textContent = course.views || 0;

        // REMOVED: enrollment count references

        // Instructor
        const instructorSection = document.getElementById('horizontalInstructorSection');
        const instructorElement = document.getElementById('horizontalModalInstructor');

        if (course.instructor && course.instructor !== 'Not specified' && course.instructor !== 'Unknown Instructor') {
            instructorElement.textContent = course.instructor;
            instructorSection.style.display = 'block';
        } else {
            instructorSection.style.display = 'none';
        }

        // Curriculum
        const curriculumSection = document.getElementById('horizontalCurriculumSection');
        const curriculumList = document.getElementById('horizontalModalCurriculum');

        if (course.curriculum && course.curriculum.length > 0) {
            curriculumSection.style.display = 'block';
            curriculumList.innerHTML = course.curriculum.map(item =>
                `<li><i class="fas fa-check-circle"></i> ${escapeHtml(item)}</li>`
            ).join('');
        } else {
            curriculumSection.style.display = 'none';
        }

        // Bookmark button
        const bookmarkBtn = document.getElementById('horizontalModalBookmarkBtn');
        if (bookmarkBtn) {
            bookmarkBtn.dataset.id = course.id;
            bookmarkBtn.dataset.type = 'course';

            if (course.is_bookmarked) {
                bookmarkBtn.classList.add('bookmarked');
                const icon = bookmarkBtn.querySelector('i');
                const text = bookmarkBtn.querySelector('.bookmark-text');
                if (icon) icon.className = 'fas fa-bookmark';
                if (text) text.textContent = 'Bookmarked';
            } else {
                bookmarkBtn.classList.remove('bookmarked');
                const icon = bookmarkBtn.querySelector('i');
                const text = bookmarkBtn.querySelector('.bookmark-text');
                if (icon) icon.className = 'far fa-bookmark';
                if (text) text.textContent = 'Bookmark';
            }
        }

        // Apply button
        const applyBtn = document.getElementById('horizontalModalApplyBtn');
        if (applyBtn) {
            applyBtn.dataset.id = course.id;
            applyBtn.dataset.type = 'course';

            if (!course.application_link) {
                applyBtn.disabled = true;
                applyBtn.title = 'No application link available';
            } else {
                applyBtn.disabled = false;
                applyBtn.title = '';
            }
        }

        // Handle expiration in modal
        const expirationSection = document.getElementById('modalExpirationSection');
        const expirationInfo = document.getElementById('modalExpirationInfo');
        const modalExpirationItem = document.getElementById('modalExpirationItem');
        const modalExpirationText = document.getElementById('modalExpirationText');
        const mobileExpirationChip = document.getElementById('mobileExpirationChip');
        const mobileExpirationText = document.getElementById('mobileExpirationText');

        if (course.expiration_date) {
            const expDate = new Date(course.expiration_date);
            const now = new Date();
            const isExpired = expDate < now;
            const formattedDate = expDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            // Desktop expiration
            if (expirationSection) expirationSection.style.display = 'block';
            if (modalExpirationItem) modalExpirationItem.style.display = 'flex';

            if (expirationInfo) {
                if (isExpired) {
                    expirationInfo.innerHTML = `
                        <i class="fas fa-clock" style="color: #ef4444;"></i>
                        <span class="expired-text" style="color: #ef4444; font-weight: 600;">Expired</span>
                    `;
                } else {
                    expirationInfo.innerHTML = `
                        <i class="fas fa-clock" style="color: #10b981;"></i>
                        <span class="active-text" style="color: #10b981; font-weight: 600;">Expires: ${formattedDate}</span>
                    `;
                }
            }

            if (modalExpirationText) {
                modalExpirationText.textContent = isExpired ? 'Expired' : `Expires: ${formattedDate}`;
            }

            // Mobile expiration
            if (mobileExpirationChip) mobileExpirationChip.style.display = 'flex';
            if (mobileExpirationText) {
                mobileExpirationText.textContent = isExpired ? 'Expired' : `Expires: ${formattedDate}`;
            }
        } else {
            if (expirationSection) expirationSection.style.display = 'none';
            if (modalExpirationItem) modalExpirationItem.style.display = 'none';
            if (mobileExpirationChip) mobileExpirationChip.style.display = 'none';
        }
    }

    // Helper function for escaping HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =============================================
    // Enhanced Content Card Initialization
    // =============================================
    function initializeContentCards() {
        // Initialize bookmark buttons
        initializeBookmarkButtons();

        // Apply buttons - UPDATED with enrollment tracking
        document.querySelectorAll('.apply-btn').forEach(btn => {
            btn.removeEventListener('click', handleApplyClick);
            btn.addEventListener('click', handleApplyClick);
        });

        console.log('✅ Apply buttons initialized with enrollment tracking');
    }

    // Handle apply button click
    function handleApplyClick(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.disabled) return;

        const contentId = this.dataset.id;
        const contentType = this.dataset.type;

        console.log(`📊 Apply clicked: ${contentType} ID: ${contentId}`);

        // Open the application link
        openApplicationLink(contentId, contentType, this);
    }

    function openApplicationLink(contentId, contentType, button) {
        // Show loading state
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        fetch(`/get-application-link/${contentType}/${contentId}`, {
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
            showToast('Failed to open application link', 'error');
        })
        .finally(() => {
            button.innerHTML = originalHTML;
            button.disabled = false;
        });
    }