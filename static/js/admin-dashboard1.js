document.addEventListener('DOMContentLoaded', function() {
    // ===== DARK MODE FUNCTIONALITY =====
    class DarkMode {
        constructor() {
            this.isDarkMode = localStorage.getItem('adminDarkMode') === 'true';
            this.toggleButton = document.getElementById('darkModeToggle');
            this.checkbox = document.getElementById('darkModeCheckbox');
            this.init();
        }

        init() {
            this.applyDarkMode();
            this.bindEvents();
            this.updateCheckbox();
        }

        applyDarkMode() {
            const adminDashboard = document.querySelector('.admin-dashboard');
            if (!adminDashboard) return;

            if (this.isDarkMode) {
                adminDashboard.classList.add('dark-mode');
            } else {
                adminDashboard.classList.remove('dark-mode');
            }
        }

        bindEvents() {
            // Handle toggle button click
            if (this.toggleButton) {
                this.toggleButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggle();
                });
            }

            // Handle checkbox change
            if (this.checkbox) {
                this.checkbox.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the parent click
                });

                this.checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    this.toggle();
                });
            }

            // Keyboard shortcut (Ctrl+Shift+D)
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                    e.preventDefault();
                    this.toggle();
                }
            });
        }

        updateCheckbox() {
            if (this.checkbox) {
                this.checkbox.checked = this.isDarkMode;
            }
        }

        toggle() {
            this.isDarkMode = !this.isDarkMode;
            localStorage.setItem('adminDarkMode', this.isDarkMode);
            this.applyDarkMode();
            this.updateCheckbox();
            this.showToggleNotification();
        }

        showToggleNotification() {
            const message = this.isDarkMode ?
                'Dark mode enabled' : 'Light mode enabled';
            const type = this.isDarkMode ? 'info' : 'success';

            // Use your existing notification system
            if (typeof showNotification === 'function') {
                showNotification(message, type);
            } else {
                // Fallback notification
                console.log(message);
            }
        }

        getCurrentMode() {
            return this.isDarkMode ? 'dark' : 'light';
        }

        setMode(mode) {
            this.isDarkMode = mode === 'dark';
            localStorage.setItem('adminDarkMode', this.isDarkMode);
            this.applyDarkMode();
            this.updateCheckbox();
        }
    }

    // Initialize dark mode
    window.adminDarkMode = new DarkMode();

    // Form submission
    const replyForm = document.getElementById('messageReplyForm');
    if (replyForm) {
        replyForm.addEventListener('submit', handleMessageReplySubmit);
    }

    // Character count
    const replyMessage = document.getElementById('replyMessage');
    if (replyMessage) {
        replyMessage.addEventListener('input', updateCharCount);
    }

    // Reply button in view modal - FIXED
    const replyFromViewBtn = document.getElementById('replyFromView');
    if (replyFromViewBtn) {
        replyFromViewBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const viewModal = document.getElementById('messageViewModal');
            if (viewModal && viewModal._messageData) {
                const message = viewModal._messageData;
                closeModal();
                setTimeout(() => {
                    openReplyModal(message.id, message.email, message.subject);
                }, 300);
            } else {
                showNotification('Message data not available. Please close and reopen the message.', 'error');
            }
        });
    }

    // Global variables
    let currentPage = {
        courses: 1,
        jobs: 1,
        internships: 1,
        blog: 1,
        users: 1,
        messages: 1,
        newsletter: 1
    };
    let currentSection = sessionStorage.getItem('currentSection') || 'dashboard';
    const itemsPerPage = 10;
    let selectedItems = {
        courses: [],
        jobs: [],
        internships: [],
        blog: [],
        users: [],
        messages: [],
        newsletter: []
    };

    // Store notification timeouts for proper management
    let notificationTimeouts = new Map();
    let allNotifications = [];
    let showAllNotifications = false;

    // Initialize the dashboard
    initDashboard();
    setupTestimonialsGlobalIntegration();


    // Add this function to handle logo previews
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

    // Updated the initDashboard function
    function initDashboard() {
        // Display time-based welcome message
        displayWelcomeMessage();

        // Setup all navigation and UI components
        setupNavigation();
        setupNotificationEvents();
        setupModals();
        setupForms();
        setupBulkActions();
        setupBulkActionButtons();
        setupSearchFilters();
        setupPagination();
        setupSelect2();
        setupLogoPreview();
        setupExpirationDateFields();
        setupExpirationDates();
        setupTestimonialsGlobalIntegration();

        // Load data and content
        loadDashboardStats();
        loadNotifications();
        loadExpiredContentStats();
        setupExpiredContentSection();

        // Enhanced section restoration with history support
        restoreCurrentSection();
        initializeHistory();

        // Check session every 5 minutes (less intrusive)
        setInterval(checkAdminSession, 5 * 60 * 1000);

        // Setup global AJAX error handling
        setupGlobalErrorHandling();
    }

     function initializeHistory() {
        // Set initial history state if none exists
        if (!history.state) {
            const initialSection = currentSection || 'dashboard';
            const state = { section: initialSection };
            const title = document.title;
            const url = `#${initialSection}`;

            history.replaceState(state, title, url);
        }
    }

     // Enhanced section restoration
    function restoreCurrentSection() {
        // Check if this is a fresh login (no previous session)
        const isFreshLogin = !sessionStorage.getItem('adminSessionStarted');

        // If fresh login, always start with dashboard and set session flag
        if (isFreshLogin) {
            sessionStorage.setItem('adminSessionStarted', 'true');
            sessionStorage.setItem('currentSection', 'dashboard');
            currentSection = 'dashboard';

            // Initialize history for fresh login
            const initialState = {
                section: 'dashboard',
                timestamp: Date.now(),
                isInitial: true
            };
            history.replaceState(initialState, '', '#dashboard');
        }

        // First, remove active class from all menu items and sections
        document.querySelectorAll('.sidebar-menu a').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });

        // For fresh login, force dashboard regardless of URL/history
        if (isFreshLogin) {
            const dashboardItem = document.querySelector('.sidebar-menu a[href="#dashboard"]');
            const dashboardSection = document.getElementById('dashboard');

            if (dashboardItem && dashboardSection) {
                navigateToSection('dashboard', dashboardItem, true);
                return;
            }
        }

        // Priority 1: Check browser history state
        if (history.state && history.state.section) {
            const menuItem = document.querySelector(`.sidebar-menu a[href="#${history.state.section}"]`);
            const targetSection = document.getElementById(history.state.section);

            if (menuItem && targetSection) {
                navigateToSection(history.state.section, menuItem, true);
                return;
            }
        }

        // Priority 2: Check URL hash (user manually entered URL or bookmark)
        const hash = window.location.hash.substring(1);
        if (hash) {
            const menuItem = document.querySelector(`.sidebar-menu a[href="#${hash}"]`);
            const targetSection = document.getElementById(hash);

            if (menuItem && targetSection) {
                navigateToSection(hash, menuItem, true);
                return;
            }
        }

        // Priority 3: Check session storage
        if (currentSection && currentSection !== 'dashboard') {
            const menuItem = document.querySelector(`.sidebar-menu a[href="#${currentSection}"]`);
            const targetSection = document.getElementById(currentSection);

            if (menuItem && targetSection) {
                navigateToSection(currentSection, menuItem, true);
                return;
            }
        }

        // Default: Dashboard
        const dashboardItem = document.querySelector('.sidebar-menu a[href="#dashboard"]');
        const dashboardSection = document.getElementById('dashboard');

        if (dashboardItem && dashboardSection) {
            navigateToSection('dashboard', dashboardItem, true);
        }
    }

     // Navigate to specific section with history management
    function navigateToSection(targetSection, menuItem = null, fromPopState = false) {
        // Update menu active state
        const menuItems = document.querySelectorAll('.sidebar-menu a');
        menuItems.forEach(i => i.classList.remove('active'));

        if (menuItem) {
            menuItem.classList.add('active');
        } else {
            // Find the corresponding menu item for the section
            const correspondingMenuItem = document.querySelector(`.sidebar-menu a[href="#${targetSection}"]`);
            if (correspondingMenuItem) {
                correspondingMenuItem.classList.add('active');
            }
        }

        // Hide all sections and show target section
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });

        const sectionElement = document.getElementById(targetSection);
        if (sectionElement) {
            sectionElement.classList.add('active');

            // Update page title
            let sectionName = 'Dashboard';
            if (menuItem) {
                sectionName = menuItem.querySelector('span').textContent;
            } else {
                const correspondingMenuItem = document.querySelector(`.sidebar-menu a[href="#${targetSection}"]`);
                if (correspondingMenuItem) {
                    sectionName = correspondingMenuItem.querySelector('span').textContent;
                }
            }
            document.getElementById('pageTitle').textContent = sectionName + ' Management';

            // Update current section and session storage
            currentSection = targetSection;
            sessionStorage.setItem('currentSection', targetSection);

            // Load section data if not dashboard
            if (targetSection !== 'dashboard') {
                loadSectionData(targetSection);
            }

            // Update browser history if not from popstate event
            if (!fromPopState) {
                const state = {
                    section: targetSection,
                    timestamp: Date.now()
                };
                const title = `${sectionName} Management`;
                const url = `#${targetSection}`;

                history.pushState(state, title, url);
            }
        }
    }

    // Fixed Select2 initialization for blog categories
    function setupSelect2() {
        if (typeof $ !== 'undefined' && $.fn.select2) {
            console.log('Select2 library loaded');

            // Reinitialize Select2 when blog modal opens
            $(document).on('click', '#addBlogBtn', function() {
                setTimeout(initializeBlogSelect2, 300);
            });

            // Also initialize when editing blog posts
            $(document).on('click', '.edit-item', function() {
                const row = this.closest('tr');
                const section = row.closest('.admin-section').id;
                if (section === 'blog') {
                    setTimeout(initializeBlogSelect2, 300);
                }
            });
        }
    }

    function initializeBlogSelect2() {
        const $blogCategories = $('#blogCategories');

        if ($blogCategories.length) {
            // Check if Select2 is causing issues, fallback to native select
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (isMobile || $blogCategories.hasClass('select2-failed')) {
                // Use native multiple select
                $blogCategories.attr('multiple', 'multiple');
                $blogCategories.css({
                    'height': 'auto',
                    'min-height': '100px'
                });
                console.log('Using native multiple select for categories');
                return;
            }

            try {
                // Try Select2 with enhanced error handling
                if ($blogCategories.hasClass('select2-hidden-accessible')) {
                    $blogCategories.select2('destroy');
                }

                $blogCategories.select2({
                    placeholder: "Select categories",
                    allowClear: true,
                    width: '100%',
                    dropdownParent: $('#blogModal'),
                    closeOnSelect: false,
                    dropdownCss: {
                        'z-index': '99999',
                        'position': 'fixed',
                        'top': 'auto',
                        'left': 'auto'
                    }
                }).on('select2:open', function(e) {
                    // Force dropdown outside modal
                    setTimeout(() => {
                        const $dropdown = $('.select2-dropdown');
                        if ($dropdown.length) {
                            $dropdown.css({
                                'z-index': '99999',
                                'position': 'fixed'
                            });
                        }
                    }, 10);
                });

                console.log('✅ Select2 initialized successfully');

            } catch (error) {
                console.error('Select2 initialization failed, falling back to native select:', error);
                $blogCategories.addClass('select2-failed');
                $blogCategories.attr('multiple', 'multiple');
                $blogCategories.css({
                    'height': 'auto',
                    'min-height': '100px'
                });
            }
        }
    }

    // Enhanced session check with automatic redirect
    function checkAdminSession() {
        fetch('/api/admin/check-session', {
            credentials: 'include'
        })
        .then(response => {
            if (response.status === 401) {
                throw new Error('Session expired');
            }
            if (!response.ok) {
                throw new Error('Failed to check session');
            }
            return response.json();
        })
        .then(data => {
            if (!data.logged_in) {
                showSessionExpiredMessage();
            }
        })
        .catch(error => {
            console.error('Session check failed:', error);
            showSessionExpiredMessage();
        });
    }

    // Show session expired message and redirect to login
    function showSessionExpiredMessage() {
        // Create overlay for session expired message
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        `;

        // Create message card
        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
        `;

        // Add icon and message
        card.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f39c12; margin-bottom: 20px;"></i>
            <h2 style="margin: 0 0 15px 0; color: #333; font-weight: 600;">Session Expired</h2>
            <p style="margin: 0 0 25px 0; color: #666; line-height: 1.5;">Your admin session has expired. Please log in again to continue.</p>
            <button id="loginRedirectBtn" style="background: #4a6cf7; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background 0.3s;">Login Again</button>
            <div id="countdown" style="margin-top: 15px; font-size: 14px; color: #888;">Redirecting in 10 seconds...</div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Add button event listener
        document.getElementById('loginRedirectBtn').addEventListener('click', function() {
            window.location.href = '/admin/login?message=session_expired';
        });

        // Auto-redirect after 10 seconds
        let seconds = 10;
        const countdownInterval = setInterval(() => {
            seconds--;
            document.getElementById('countdown').textContent = `Redirecting in ${seconds} seconds...`;

            if (seconds <= 0) {
                clearInterval(countdownInterval);
                window.location.href = '/admin/login?message=session_expired';
            }
        }, 1000);
    }

    // Content expiration function
    // Handle expiration date in forms
    function setupExpirationDates() {
        // Set minimum date to today for expiration date fields
        const today = new Date().toISOString().slice(0, 16);
        document.querySelectorAll('input[type="datetime-local"][name="expiration_date"]').forEach(input => {
            input.min = today;
        });
    }
    // Add this to check for expired content every minute
    function startExpirationChecker() {
        setInterval(() => {
            // This would call your backend API to check expired content
            fetch('/api/admin/check-expired-content', {
                method: 'POST',
                credentials: 'include'
            }).catch(error => {
                console.error('Error checking expired content:', error);
            });
        }, 60000); // Check every minute
    }

    // Enhanced greeting function
    function displayWelcomeMessage() {
        const hour = new Date().getHours();
        let greeting;

        if (hour < 12) {
            greeting = "Good morning";
        } else if (hour < 17) {
            greeting = "Good afternoon";
        } else {
            greeting = "Good evening";
        }

        // Get the greeting element
        const greetingElement = document.getElementById('adminGreeting');
        const greetingText = document.getElementById('greetingText');

        if (greetingElement && greetingText) {
            // Update the greeting text
            greetingText.textContent = greeting + ',';

            // Show the greeting
            greetingElement.style.display = 'flex';
            greetingElement.classList.add('show');
            greetingElement.classList.remove('fade-out');

            // Auto-hide after 5 seconds
            setTimeout(() => {
                greetingElement.classList.add('fade-out');

                // Remove from DOM after fade out animation completes
                setTimeout(() => {
                    greetingElement.style.display = 'none';
                    greetingElement.classList.remove('show');
                }, 500); // Match this with CSS transition time
            }, 5000);
        }
    }

    // Enhanced navigation with back button handling - No logout on back button
    function setupNavigation() {
        const menuItems = document.querySelectorAll('.sidebar-menu a');

        // Initialize history state to prevent back button logout
        if (history.state === null) {
            const initialState = {
                section: 'dashboard',
                timestamp: Date.now(),
                isInitial: true
            };
            history.replaceState(initialState, '', '#dashboard');

            // Push another state to create a buffer
            const secondState = {
                section: 'dashboard',
                timestamp: Date.now(),
                isBuffer: true
            };
            history.pushState(secondState, '', '#dashboard');
        }

        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                // Skip dark mode toggle (it's now handled separately)
                if (this.id === 'darkModeToggle' || this.closest('#darkModeToggle')) {
                    return;
                }

                if (this.getAttribute('href') === '/admin/logout') {
                    e.preventDefault();
                    showConfirmation('logout', 'Are you sure you want to logout?', () => {
                        // Clear all session data
                        sessionStorage.removeItem('adminSessionStarted');
                        sessionStorage.removeItem('currentSection');

                        // Set a flag to indicate we're logging out programmatically
                        sessionStorage.setItem('logoutInitiated', 'true');

                        window.location.href = '/admin/logout';
                    });
                    return;
                }

                if (this.getAttribute('href').startsWith('#')) {
                    e.preventDefault();

                    // Use history API to update URL without page reload
                    const targetSection = this.getAttribute('href').substring(1);
                    navigateToSection(targetSection, this);
                }
            });
        });

        // Enhanced browser back/forward button handling - No logout allowed
        window.addEventListener('popstate', function(event) {
            // If we're at the initial state and user tries to go back further
            if (history.state && history.state.isInitial) {
                // We're at the beginning - prevent going back to login
                // Push current state again to stay in the dashboard
                const currentState = {
                    section: currentSection || 'dashboard',
                    timestamp: Date.now(),
                    isInitial: true
                };
                history.pushState(currentState, '', `#${currentSection || 'dashboard'}`);

                showNotification('You are already at the beginning of the dashboard navigation', 'info', 3000);
                return;
            }

            // If no state (shouldn't happen with our setup), go to dashboard
            if (!event.state) {
                navigateToSection('dashboard', null, true);
                return;
            }

            // Normal navigation between sections
            if (event.state.section) {
                navigateToSection(event.state.section, null, true);
            } else {
                navigateToSection('dashboard', null, true);
            }
        });

        // Remove beforeunload warning for internal navigation
        window.addEventListener('beforeunload', function(e) {
            // Only show warning if not logging out intentionally
            if (!sessionStorage.getItem('logoutInitiated')) {
                // Don't show warning for internal navigation
                return;
            }
        });

        // Handle stat card links
        document.querySelectorAll('.stat-card a').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetSection = this.getAttribute('href').substring(1);

                const menuItem = document.querySelector(`.sidebar-menu a[href="#${targetSection}"]`);
                if (menuItem) {
                    menuItem.click();
                }
            });
        });
    }

    // Enhanced notification functionality
    function setupNotificationEvents() {
        const notificationBell = document.querySelector('.notification-bell');
        const notificationList = document.getElementById('notificationList');
        const viewToggleBtn = document.getElementById('viewToggleBtn');
        const markAllReadBtn = document.querySelector('.mark-all-read');

        if (notificationBell && notificationList) {
            notificationBell.addEventListener('click', function(e) {
                e.stopPropagation();
                const isShowing = notificationList.classList.contains('show');

                if (!isShowing) {
                    // Reset to limited view when opening
                    showAllNotifications = false;
                    renderNotifications();
                }

                notificationList.classList.toggle('show');

                // Update toggle button state
                if (viewToggleBtn) {
                    viewToggleBtn.classList.toggle('expanded', showAllNotifications);
                }
            });

            // Close when clicking outside
            document.addEventListener('click', function(e) {
                if (!notificationBell.contains(e.target) && !notificationList.contains(e.target)) {
                    notificationList.classList.remove('show');
                    showAllNotifications = false;
                    renderNotifications();
                }
            });
        }

        if (viewToggleBtn) {
            viewToggleBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                showAllNotifications = !showAllNotifications;
                this.classList.toggle('expanded', showAllNotifications);
                renderNotifications();

                // Smooth scroll to show new items
                if (showAllNotifications) {
                    const notificationItems = document.querySelector('.notification-items');
                    if (notificationItems) {
                        notificationItems.scrollTop = notificationItems.scrollHeight;
                    }
                }
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                markAllNotificationsAsRead();
            });
        }
    }

    function loadNotifications() {
        fetch('/api/admin/notifications', {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch notifications');
            return response.json();
        })
        .then(notifications => {
            allNotifications = notifications;
            renderNotifications();
        })
        .catch(error => {
            console.error('Error loading notifications:', error);
        });
    }

    // Enhanced notification rendering
    function renderNotifications() {
        const notificationItems = document.querySelector('.notification-items');
        const notificationCount = document.getElementById('notificationCount');
        const viewToggleBtn = document.getElementById('viewToggleBtn');

        if (!notificationItems) return;

        notificationItems.innerHTML = '';

        // Determine which notifications to display
        const displayedNotifications = showAllNotifications ?
            allNotifications :
            allNotifications.slice(0, 4);

        // Update notification count
        const unreadCount = allNotifications.filter(n => !n.is_read).length;
        const displayCount = Math.min(unreadCount, 99);
        notificationCount.textContent = displayCount > 0 ? displayCount : '';
        notificationCount.style.display = displayCount > 0 ? 'flex' : 'none';

        // Update view toggle button visibility and text
        if (viewToggleBtn) {
            if (allNotifications.length <= 4) {
                viewToggleBtn.style.display = 'none';
            } else {
                viewToggleBtn.style.display = 'flex';
                viewToggleBtn.innerHTML = showAllNotifications ?
                    '<i class="fas fa-chevron-up"></i> Show Less' :
                    '<i class="fas fa-chevron-down"></i> View More (' + (allNotifications.length - 4) + ')';
            }
        }

        if (allNotifications.length === 0) {
            notificationItems.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <div>No notifications</div>
                    <small>You're all caught up!</small>
                </div>
            `;
            return;
        }

        displayedNotifications.forEach((notification, index) => {
            const notificationItem = document.createElement('div');
            notificationItem.className = `notification-item ${notification.is_read ? '' : 'unread'} ${index < 2 ? 'new' : ''}`;
            notificationItem.setAttribute('data-type', notification.type);
            notificationItem.setAttribute('data-id', notification.related_id);

            const formattedDate = formatDate(notification.created_at, true);

            notificationItem.innerHTML = `
                <div class="notification-icon">
                    <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <p>${notification.message}</p>
                    <small>${formattedDate}</small>
                </div>
                <span class="notification-type-badge">${notification.type}</span>
            `;

            // Add click event to navigate to relevant section
            notificationItem.addEventListener('click', function() {
                const type = this.getAttribute('data-type');
                const id = this.getAttribute('data-id');

                // Close notification dropdown
                document.getElementById('notificationList').classList.remove('show');

                // Navigate to appropriate section
                const sectionMap = {
                    'message': 'messages',
                    'user': 'users',
                    'course': 'courses',
                    'job': 'jobs',
                    'internship': 'internships',
                    'blog': 'blog'
                };

                if (sectionMap[type]) {
                    const menuItem = document.querySelector(`.sidebar-menu a[href="#${sectionMap[type]}"]`);
                    if (menuItem) {
                        menuItem.click();
                    }
                }
            });

            notificationItems.appendChild(notificationItem);
        });
    }

    function getNotificationIcon(type) {
        const icons = {
            'message': 'envelope',
            'user': 'user-plus',
            'course': 'book',
            'job': 'briefcase',
            'internship': 'user-graduate',
            'blog': 'blog',
            'default': 'bell'
        };
        return icons[type] || icons.default;
    }

    function markAllNotificationsAsRead() {
        fetch('/api/admin/notifications/mark-all-read', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to mark notifications as read');
            return response.json();
        })
        .then(data => {
            if (data.success) {
                loadNotifications();
                showNotification('All notifications marked as read', 'success');
            } else {
                showNotification(data.message || 'Failed to mark notifications as read', 'error');
            }
        })
        .catch(error => {
            console.error('Error marking notifications as read:', error);
            showNotification('Failed to mark notifications as read', 'error');
        });
    }

    function loadDashboardStats() {
        fetch('/api/admin/dashboard-stats', {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch dashboard stats`);
            }
            return response.json();
        })
        .then(data => {
            console.log('📊 Dashboard stats received:', data);

            // Update all stats with proper fallbacks
            const stats = {
                'usersCount': data.users || 0,
                'coursesCount': data.courses || 0,
                'jobsCount': data.jobs || 0,
                'internshipsCount': data.internships || 0,
                'messagesCount': data.unread_messages || 0,
                'subscribersCount': data.subscribers || 0,
                'testimonialsCount': data.testimonials || 0
            };

            // Update each stat element safely
            Object.keys(stats).forEach(statId => {
                const element = document.getElementById(statId);
                if (element) {
                    element.textContent = stats[statId];
                    console.log(`✅ Updated ${statId}: ${stats[statId]}`);
                } else {
                    console.warn(`❌ Element with id '${statId}' not found`);
                }
            });

        })
        .catch(error => {
            console.error('❌ Error loading dashboard stats:', error);

            // Set all stats to 0 on error
            const statIds = [
                'usersCount', 'coursesCount', 'jobsCount', 'internshipsCount',
                'messagesCount', 'subscribersCount', 'testimonialsCount'
            ];

            statIds.forEach(statId => {
                const element = document.getElementById(statId);
                if (element) {
                    element.textContent = '0';
                }
            });

            showNotification('Failed to load dashboard statistics', 'error');
        });
    }

    function loadSectionData(section, page = 1, search = '', filters = {}) {
        console.log(`🔄 Loading section: ${section}, page: ${page}, search: "${search}"`);

        // Handle testimonials section separately using the testimonial manager
        if (section === 'testimonials') {
            console.log('🎯 Using testimonial manager for testimonials section');

            if (window.testimonialManager) {
                if (!window.testimonialManager.isInitialized) {
                    console.log('🔧 Initializing testimonial manager...');
                    window.testimonialManager.init();
                } else {
                    console.log('📥 Loading testimonials data...');
                    window.testimonialManager.loadTestimonialsData(page);
                }
            } else {
                console.log('🚀 Creating new testimonial manager instance...');
                window.testimonialManager = new TestimonialManager();
                window.testimonialManager.init();
            }
            return;
        }

        showLoading();

        let endpoint = '';
        let params = new URLSearchParams();

        params.append('page', page);

        if (search) {
            params.append('search', search);
        }

        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, filters[key]);
            }
        });

        switch(section) {
            case 'courses':
                endpoint = '/api/admin/courses';
                break;
            case 'jobs':
                endpoint = '/api/admin/jobs';
                break;
            case 'internships':
                endpoint = '/api/admin/internships';
                break;
            case 'blog':
                endpoint = '/api/admin/blog';
                break;
            case 'users':
                endpoint = '/api/admin/users';
                break;
            case 'messages':
                endpoint = '/api/admin/messages';
                break;
            case 'newsletter':
                endpoint = '/api/admin/newsletter';
                break;
            case 'testimonials':
                // This case should not be reached due to early return above
                endpoint = '/api/admin/testimonials';
                break;
            default:
                console.warn(`❌ Unknown section: ${section}`);
                hideLoading();
                return;
        }

        console.log(`📡 Fetching from: ${endpoint}?${params.toString()}`);

        fetch(`${endpoint}?${params.toString()}`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch ${section}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`✅ Successfully loaded ${section} data:`, data);
            renderTableData(section, data);
            updatePaginationInfo(section, data.count, page);
            hideLoading();

            // Show success notification for non-dashboard sections
            if (section !== 'dashboard') {
                const itemCount = data.data ? data.data.length : 0;
                showNotification(`Loaded ${itemCount} ${section} items`, 'success');
            }
        })
        .catch(error => {
            console.error(`❌ Error loading ${section}:`, error);
            showNotification(`Failed to load ${section}: ${error.message}`, 'error');
            hideLoading();
        });
    }

    function renderTableData(section, data) {
        const tableBody = document.getElementById(`${section}TableBody`);
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (!data.data || data.data.length === 0) {
            const colSpan = document.querySelector(`#${section} thead tr`).cells.length;
            tableBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 20px;">No data found</td></tr>`;
            return;
        }

        data.data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = generateTableRowHTML(section, item, index);
            tableBody.appendChild(row);

            addRowEventListeners(section, item.id, row);
        });

        selectedItems[section] = [];
        updateSelectAllCheckbox(section);
    }

    function generateTableRowHTML(section, item, index) {
        // Calculate serial number based on current page and index
        const serialNo = ((currentPage[section] - 1) * itemsPerPage) + index + 1;

        let html = `
            <td><input type="checkbox" class="row-checkbox" data-id="${item.id}"></td>
            <td class="serial-no">${serialNo}</td>
        `;

        switch(section) {
            case 'courses':
                html += `
                    <td>${escapeHTML(item.title)}</td>
                    <td>${escapeHTML(item.category)}</td>
                    <td>${escapeHTML(item.instructor || 'N/A')}</td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>
                        <div class="status-toggle">
                            <label class="switch">
                                <input type="checkbox" class="status-toggle-checkbox" ${item.is_active ? 'checked' : ''} data-id="${item.id}">
                                <span class="slider round"></span>
                            </label>
                            <span class="status-text">${item.is_active ? 'Active & Featured' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-id="${item.id}" title="View Details"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon edit-item" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete-item" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                break;

            case 'jobs':
                html += `
                    <td>${escapeHTML(item.title)}</td>
                    <td>${escapeHTML(item.company)}</td>
                    <td>${escapeHTML(item.location)}</td>
                    <td>${escapeHTML(item.type)}</td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>
                        <div class="status-toggle">
                            <label class="switch">
                                <input type="checkbox" class="status-toggle-checkbox" ${item.is_active ? 'checked' : ''} data-id="${item.id}">
                                <span class="slider round"></span>
                            </label>
                            <span class="status-text">${item.is_active ? 'Active & Featured' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-id="${item.id}" title="View Details"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon edit-item" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete-item" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                break;

            case 'internships':
                html += `
                    <td>${escapeHTML(item.title)}</td>
                    <td>${escapeHTML(item.company)}</td>
                    <td>${escapeHTML(item.location)}</td>
                    <td>${escapeHTML(item.duration)}</td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>
                        <div class="status-toggle">
                            <label class="switch">
                                <input type="checkbox" class="status-toggle-checkbox" ${item.is_active ? 'checked' : ''} data-id="${item.id}">
                                <span class="slider round"></span>
                            </label>
                            <span class="status-text">${item.is_active ? 'Active & Featured' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-id="${item.id}" title="View Details"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon edit-item" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete-item" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                break;

            case 'blog':
                html += `
                    <td>${escapeHTML(item.title)}</td>
                    <td>${escapeHTML(item.author)}</td>
                    <td>${escapeHTML(Array.isArray(item.categories) ? item.categories.join(', ') : item.categories)}</td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>
                        <div class="status-toggle">
                            <label class="switch">
                                <input type="checkbox" class="status-toggle-checkbox" ${item.is_active ? 'checked' : ''} data-id="${item.id}">
                                <span class="slider round"></span>
                            </label>
                            <span class="status-text">${item.is_active ? 'Active & Featured' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-id="${item.id}" title="View Details"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon edit-item" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon delete-item" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                break;

            case 'users':
                html += `
                    <td>${escapeHTML(item.username)}</td>
                    <td>${escapeHTML(item.email)}</td>
                    <td>${escapeHTML(item.role)}</td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>
                        <div class="status-toggle">
                            <label class="switch">
                                <input type="checkbox" class="status-toggle-checkbox" ${item.is_active ? 'checked' : ''} data-id="${item.id}">
                                <span class="slider round"></span>
                            </label>
                            <span class="status-text">${item.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-id="${item.id}" title="View Details"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon delete-item" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                break;

            case 'messages':
                html += `
                    <td>${escapeHTML(item.name)}</td>
                    <td>${escapeHTML(item.email)}</td>
                    <td>${escapeHTML(item.subject)}</td>
                    <td>${formatDate(item.created_at)}</td>
                    <td><span class="status-badge ${item.status}">${item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span></td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-id="${item.id}" title="View Message"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon reply-message" data-id="${item.id}" data-email="${escapeHTML(item.email)}" data-subject="${escapeHTML(item.subject)}" title="Reply"><i class="fas fa-reply"></i></button>
                            <button class="btn-icon delete-item" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                break;

            case 'newsletter':
                html += `
                    <td>${escapeHTML(item.email)}</td>
                    <td>
                        <div class="status-toggle">
                            <label class="switch">
                                <input type="checkbox" class="status-toggle-checkbox" ${item.is_active ? 'checked' : ''} data-id="${item.id}">
                                <span class="slider round"></span>
                            </label>
                            <span class="status-text">${item.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>${formatDate(item.subscribed_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-id="${item.id}" title="View Details"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon delete-item" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                `;
                break;
        }

        return html;
    }

    // View modal function
    function openViewModal(section, id) {
        fetch(`/api/admin/${section}/${id}`, {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch ${section} item`);
            return response.json();
        })
        .then(item => {
            const modal = document.getElementById('contentViewModal');
            if (!modal) return;

            // Set modal title
            const modalTitle = modal.querySelector('.modal-title');
            if (modalTitle) {
                modalTitle.textContent = `${section.charAt(0).toUpperCase() + section.slice(1, -1)} Details`;
            }

            // Populate content based on section type
            const contentBody = modal.querySelector('#contentViewBody');
            if (contentBody) {
                contentBody.innerHTML = generateViewContentHTML(section, item);
            }

            modal.style.display = 'block';
        })
        .catch(error => {
            console.error(`Error loading ${section} item:`, error);
            showNotification(`Failed to load ${section} item`, 'error');
        });
    }

    function generateViewContentHTML(section, item) {
        let html = '';

        switch(section) {
            case 'courses':
                html = `
                    <div class="view-field">
                        <label>Title:</label>
                        <span>${escapeHTML(item.title)}</span>
                    </div>
                    <div class="view-field">
                        <label>Category:</label>
                        <span>${escapeHTML(item.category)}</span>
                    </div>
                    <div class="view-field">
                        <label>Instructor:</label>
                        <span>${escapeHTML(item.instructor || 'N/A')}</span>
                    </div>
                    <div class="view-field">
                        <label>Level:</label>
                        <span>${escapeHTML(item.level || 'N/A')}</span>
                    </div>
                    <div class="view-field">
                        <label>Price:</label>
                        <span>${escapeHTML(item.price || 'Free')}</span>
                    </div>
                    <div class="view-field">
                        <label>Duration:</label>
                        <span>${escapeHTML(item.duration || 'N/A')}</span>
                    </div>
                    <div class="view-field">
                        <label>Rating:</label>
                        <span>${item.rating || '0'}/5</span>
                    </div>
                    <div class="view-field">
                        <label>Application Link:</label>
                        <a href="${item.application_link}" target="_blank">${item.application_link}</a>
                    </div>
                    <div class="view-field">
                        <label>Expiration Date:</label>
                        <span>${item.expiration_date ? formatDate(item.expiration_date, true) : 'No expiration'}</span>
                    </div>
                    <div class="view-field full-width">
                        <label>Description:</label>
                        <div class="view-content">${escapeHTML(item.description || 'No description')}</div>
                    </div>
                    <div class="view-field">
                        <label>Status:</label>
                        <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                            ${item.is_active ? 'Active & Featured' : 'Inactive'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Created:</label>
                        <span>${formatDate(item.created_at, true)}</span>
                    </div>
                `;
                break;

            case 'jobs':
                html = `
                    <div class="view-field">
                        <label>Title:</label>
                        <span>${escapeHTML(item.title)}</span>
                    </div>
                    <div class="view-field">
                        <label>Company:</label>
                        <span>${escapeHTML(item.company)}</span>
                    </div>
                    <div class="view-field">
                        <label>Location:</label>
                        <span>${escapeHTML(item.location)}</span>
                    </div>
                    <div class="view-field">
                        <label>Type:</label>
                        <span>${escapeHTML(item.type)}</span>
                    </div>
                    <div class="view-field">
                        <label>Salary:</label>
                        <span>${escapeHTML(item.salary || 'Not specified')}</span>
                    </div>
                    <div class="view-field">
                        <label>Application Link:</label>
                        <a href="${item.application_link}" target="_blank">${item.application_link}</a>
                    </div>
                    <div class="view-field">
                        <label>Expiration Date:</label>
                        <span>${item.expiration_date ? formatDate(item.expiration_date, true) : 'No expiration'}</span>
                    </div>
                    <div class="view-field full-width">
                        <label>Description:</label>
                        <div class="view-content">${escapeHTML(item.description || 'No description')}</div>
                    </div>
                    <div class="view-field">
                        <label>Status:</label>
                        <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                            ${item.is_active ? 'Active & Featured' : 'Inactive'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Created:</label>
                        <span>${formatDate(item.created_at, true)}</span>
                    </div>
                `;
                break;

            case 'internships':
                html = `
                    <div class="view-field">
                        <label>Title:</label>
                        <span>${escapeHTML(item.title)}</span>
                    </div>
                    <div class="view-field">
                        <label>Company:</label>
                        <span>${escapeHTML(item.company)}</span>
                    </div>
                    <div class="view-field">
                        <label>Location:</label>
                        <span>${escapeHTML(item.location)}</span>
                    </div>
                    <div class="view-field">
                        <label>Type:</label>
                        <span>${escapeHTML(item.type)}</span>
                    </div>
                    <div class="view-field">
                        <label>Duration:</label>
                        <span>${escapeHTML(item.duration)}</span>
                    </div>
                    <div class="view-field">
                        <label>Application Link:</label>
                        <a href="${item.application_link}" target="_blank">${item.application_link}</a>
                    </div>
                    <div class="view-field">
                        <label>Expiration Date:</label>
                        <span>${item.expiration_date ? formatDate(item.expiration_date, true) : 'No expiration'}</span>
                    </div>
                    <div class="view-field full-width">
                        <label>Description:</label>
                        <div class="view-content">${escapeHTML(item.description || 'No description')}</div>
                    </div>
                    <div class="view-field">
                        <label>Status:</label>
                        <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                            ${item.is_active ? 'Active & Featured' : 'Inactive'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Created:</label>
                        <span>${formatDate(item.created_at, true)}</span>
                    </div>
                `;
                break;

            case 'blog':
                html = `
                    <div class="view-field">
                        <label>Title:</label>
                        <span>${escapeHTML(item.title)}</span>
                    </div>
                    <div class="view-field">
                        <label>Author:</label>
                        <span>${escapeHTML(item.author)}</span>
                    </div>
                    <div class="view-field">
                        <label>Categories:</label>
                        <span>${Array.isArray(item.categories) ? item.categories.join(', ') : item.categories}</span>
                    </div>
                    ${item.image ? `
                    <div class="view-field">
                        <label>Image:</label>
                        <img src="${item.image}" alt="${item.title}" style="max-width: 200px; max-height: 150px;">
                    </div>
                    ` : ''}
                    <div class="view-field full-width">
                        <label>Content:</label>
                        <div class="view-content">${escapeHTML(item.content || 'No content')}</div>
                    </div>
                    <div class="view-field">
                        <label>Featured:</label>
                        <span class="status-badge ${item.is_featured ? 'active' : 'inactive'}">
                            ${item.is_featured ? 'Yes' : 'No'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Published:</label>
                        <span class="status-badge ${item.is_published ? 'active' : 'inactive'}">
                            ${item.is_published ? 'Yes' : 'No'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Status:</label>
                        <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                            ${item.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Created:</label>
                        <span>${formatDate(item.created_at, true)}</span>
                    </div>
                `;
                break;

            case 'users':
                html = `
                    <div class="view-field">
                        <label>Username:</label>
                        <span>${escapeHTML(item.username)}</span>
                    </div>
                    <div class="view-field">
                        <label>Email:</label>
                        <span>${escapeHTML(item.email)}</span>
                    </div>
                    <div class="view-field">
                        <label>Role:</label>
                        <span class="role-badge ${item.role}">${escapeHTML(item.role)}</span>
                    </div>
                    <div class="view-field">
                        <label>Status:</label>
                        <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                            ${item.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Joined:</label>
                        <span>${formatDate(item.created_at, true)}</span>
                    </div>
                `;
                break;

            case 'messages':
                html = `
                    <div class="view-field">
                        <label>Name:</label>
                        <span>${escapeHTML(item.name || 'N/A')}</span>
                    </div>
                    <div class="view-field">
                        <label>Email:</label>
                        <span>${escapeHTML(item.email)}</span>
                    </div>
                    <div class="view-field">
                        <label>Subject:</label>
                        <span>${escapeHTML(item.subject || 'No subject')}</span>
                    </div>
                    <div class="view-field full-width">
                        <label>Message:</label>
                        <div class="view-content">${escapeHTML(item.message || 'No message content')}</div>
                    </div>
                    <div class="view-field">
                        <label>Status:</label>
                        <span class="status-badge ${item.status}">${item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Unknown'}</span>
                    </div>
                    <div class="view-field">
                        <label>Received:</label>
                        <span>${formatDate(item.created_at, true)}</span>
                    </div>
                    ${item.replied_at ? `
                    <div class="view-field">
                        <label>Replied:</label>
                        <span>${formatDate(item.replied_at, true)}</span>
                    </div>
                    ` : ''}
                `;
                break;

            case 'newsletter':
                html = `
                    <div class="view-field">
                        <label>Email:</label>
                        <span>${escapeHTML(item.email)}</span>
                    </div>
                    <div class="view-field">
                        <label>Status:</label>
                        <span class="status-badge ${item.is_active ? 'active' : 'inactive'}">
                            ${item.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Subscribed:</label>
                        <span>${formatDate(item.subscribed_at, true)}</span>
                    </div>
                    ${item.unsubscribed_at ? `
                    <div class="view-field">
                        <label>Unsubscribed:</label>
                        <span>${formatDate(item.unsubscribed_at, true)}</span>
                    </div>
                    ` : ''}
                    ${item.last_sent ? `
                    <div class="view-field">
                        <label>Last Newsletter Sent:</label>
                        <span>${formatDate(item.last_sent, true)}</span>
                    </div>
                    ` : ''}
                `;
                break;
        }

        return html;
    }

    function addRowEventListeners(section, id, row) {
        console.log(`Adding event listeners for ${section} row ${id}`);

        const editBtn = row.querySelector('.edit-item');
        if (editBtn && section !== 'users') { // Skip edit button for users section
            console.log(`Found edit button for ${section} ${id}`);
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Edit button clicked for ${section} ${id}`);
                openEditModal(section, id);
            });
        } else {
            console.log(`No edit button found for ${section} ${id} or section is users`);
        }

        const deleteBtn = row.querySelector('.delete-item');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showConfirmation('delete', `Are you sure you want to delete this ${section.slice(0, -1)}? This action cannot be undone.`, () => {
                    performDelete(section, id);
                });
            });
        }

        const viewMessageBtn = row.querySelector('.view-message');
        if (viewMessageBtn) {
            viewMessageBtn.addEventListener('click', () => {
                viewMessage(id);
            });
        }

        const viewBtn = row.querySelector('.view-item');
        if (viewBtn) {
            viewBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openViewModal(section, id);
            });
        }

        const replyMessageBtn = row.querySelector('.reply-message');
        if (replyMessageBtn) {
            replyMessageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = replyMessageBtn.getAttribute('data-id');
                const email = replyMessageBtn.getAttribute('data-email');
                const subject = replyMessageBtn.getAttribute('data-subject');
                console.log('Reply from table:', { id, email, subject });
                openReplyModal(id, email, subject);
            });
        }

        const statusToggle = row.querySelector('.status-toggle-checkbox');
        if (statusToggle) {
            statusToggle.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleStatus(section, id, statusToggle.checked);
            });
        }

        const checkbox = row.querySelector('.row-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (checkbox.checked) {
                    selectedItems[section].push(id);
                } else {
                    selectedItems[section] = selectedItems[section].filter(itemId => itemId !== id);
                }
                updateSelectAllCheckbox(section);
            });
        }

        // Make message rows clickable but exclude checkboxes
        if (section === 'messages') {
            row.style.cursor = 'pointer';
            row.addEventListener('click', (e) => {
                if (!e.target.closest('input[type="checkbox"]') && !e.target.closest('button')) {
                    viewMessage(id);
                }
            });
        }
    }

    // Toggle status (active/inactive) - FIXED for blog posts
    function toggleStatus(section, id, isActive) {
        showLoading();

        // Fix section name for API endpoint - IMPORTANT: blog becomes blog_posts
        let apiSection = section;
        if (section === 'blog') apiSection = 'blog_posts';
        if (section === 'newsletter') apiSection = 'newsletter_subscribers';

        console.log(`Toggling ${section} (API: ${apiSection}) ID: ${id} to: ${isActive}`);

        // Prepare the request data - ensure it's properly formatted
        const updateData = {
            is_active: Boolean(isActive)  // Ensure it's a boolean
        };

        // For courses, jobs, internships, and blog, active state also controls featured state
        if (['courses', 'jobs', 'internships', 'blog'].includes(section)) {
            updateData.is_featured = Boolean(isActive);
        }

        console.log('Sending update data:', updateData);

        fetch(`/api/admin/${apiSection}/${id}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        })
        .then(response => {
            console.log('Response status:', response.status);
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || `Failed to update ${section} status`);
                });
            }
            return response.json();
        })
        .then(result => {
            console.log('Response data:', result);
            if (result.success) {
                const statusText = isActive ? 'activated & featured' : 'deactivated';
                showNotification(`${section.charAt(0).toUpperCase() + section.slice(1)} ${statusText} successfully`, 'success');

                // Update the status text in the UI
                const statusTextElement = document.querySelector(`.status-toggle-checkbox[data-id="${id}"]`).closest('.status-toggle').querySelector('.status-text');
                if (statusTextElement) {
                    statusTextElement.textContent = isActive ? 'Active & Featured' : 'Inactive';
                }

                // Reload the section to reflect changes immediately
                loadSectionData(section, currentPage[section]);
            } else {
                showNotification(result.message || `Failed to update ${section} status`, 'error');
                // Revert the checkbox state
                const checkbox = document.querySelector(`.status-toggle-checkbox[data-id="${id}"]`);
                if (checkbox) {
                    checkbox.checked = !isActive;
                }
            }
        })
        .catch(error => {
            console.error(`Error updating ${section} status:`, error);
            showNotification(error.message || `Failed to update ${section} status`, 'error');
            // Revert the checkbox state
            const checkbox = document.querySelector(`.status-toggle-checkbox[data-id="${id}"]`);
            if (checkbox) {
                checkbox.checked = !isActive;
            }
        })
        .finally(() => {
            hideLoading();
        });
    }

    // Update the showConfirmation function to handle back button logout
    function showConfirmation(type, message, confirmCallback) {
        const modal = document.getElementById('confirmationModal');
        const confirmCard = document.getElementById('confirmCard');

        if (!modal || !confirmCard) {
            console.error('Confirmation modal elements not found');
            return;
        }

        // Define defaults
        let iconClass = 'fa-question-circle';
        let title = 'Confirm Action';
        let confirmText = 'Confirm';
        let confirmClass = 'default';

        // Customize by type
        switch (type) {
            case 'logout':
                iconClass = 'fa-sign-out-alt';
                title = 'Confirm Logout';
                confirmText = 'Yes, Logout';
                confirmClass = 'logout';
                message = 'Are you sure you want to logout? You will need to log in again to access the admin dashboard.';
                break;
            case 'back_button_logout':
                iconClass = 'fa-exclamation-triangle';
                title = 'Leave Admin Dashboard?';
                confirmText = 'Yes, Leave';
                confirmClass = 'warning';
                message = message || 'You are about to leave the admin dashboard. This will log you out. Do you want to continue?';
                break;
            case 'external_navigation':
                iconClass = 'fa-external-link-alt';
                title = 'Leave Admin Dashboard?';
                confirmText = 'Continue';
                confirmClass = 'warning';
                break;
            case 'delete':
            case 'bulk_delete':
                iconClass = 'fa-trash-alt';
                title = 'Confirm Deletion';
                confirmText = 'Delete';
                confirmClass = 'delete';
                break;
            case 'reactivate':
                iconClass = 'fa-undo';
                title = 'Confirm Reactivation';
                confirmText = 'Reactivate';
                confirmClass = 'reactivate';
                break;
            case 'bulk_action':
                iconClass = 'fa-tasks';
                title = 'Confirm Bulk Action';
                confirmText = 'Proceed';
                confirmClass = 'bulk';
                break;
            default:
                iconClass = 'fa-question-circle';
                title = 'Confirm Action';
                confirmText = 'Confirm';
                confirmClass = 'default';
        }

        // Update modal content
        confirmCard.className = `confirm-card ${confirmClass}`;
        confirmCard.innerHTML = `
            <i class="fas ${iconClass} confirm-icon"></i>
            <h3 class="confirm-title">${title}</h3>
            <p class="confirm-message">${message}</p>
            <div class="confirm-actions">
                <button class="confirm-btn cancel" id="cancelBtn">Cancel</button>
                <button class="confirm-btn confirm" id="confirmBtn">${confirmText}</button>
            </div>
        `;

        modal.style.display = 'block';

        // Re-bind buttons with enhanced logout handling
        setTimeout(() => {
            const cancelBtn = document.getElementById('cancelBtn');
            const confirmBtn = document.getElementById('confirmBtn');
            if (!cancelBtn || !confirmBtn) return;

            const newCancel = cancelBtn.cloneNode(true);
            const newConfirm = confirmBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

            newCancel.addEventListener('click', () => {
                closeModal();
            });

            newConfirm.addEventListener('click', () => {
                // Enhanced logout handling
                if (type === 'logout' || type === 'back_button_logout') {
                    // Clear all session data
                    sessionStorage.removeItem('adminSessionStarted');
                    sessionStorage.removeItem('currentSection');
                    sessionStorage.removeItem('logoutMessage');

                    // Set logout flag to prevent back button issues
                    sessionStorage.setItem('logoutInitiated', 'true');
                }

                if (confirmCallback) confirmCallback();
                closeModal();
            });

            // Focus on cancel button for accessibility
            newCancel.focus();
        }, 10);
    }

    // Function to close modal
    function closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });

        // Reset any active forms
        document.querySelectorAll('form').forEach(form => {
            if (form.id !== 'messageReplyForm') { // Don't reset reply form completely
                form.reset();
            }
        });
    }

    // Close modal when clicking on close button only
    document.addEventListener('DOMContentLoaded', function() {
        // Close modal only with close button
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('close-modal')) {
                closeModal();
            }
        });

        // Close modal with escape key (optional - remove if you don't want this either)
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
            }
        });

        // PREVENT outside click closing - remove any existing outside click handlers
        document.querySelectorAll('.modal').forEach(modal => {
            // Remove any existing click event listeners
            modal.replaceWith(modal.cloneNode(true));
        });
    });

    // Perform actual delete operation
    function performDelete(section, id) {
        showLoading();

        fetch(`/api/admin/${section}/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to delete ${section}`);
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${section.charAt(0).toUpperCase() + section.slice(1)} deleted successfully`, 'success');

                // Remove the item from the UI immediately
                const row = document.querySelector(`tr .row-checkbox[data-id="${id}"]`)?.closest('tr');
                if (row) {
                    row.remove();
                }

                // Check if table is empty and show message
                const tableBody = document.getElementById(`${section}TableBody`);
                if (tableBody && tableBody.children.length === 0) {
                    const colSpan = document.querySelector(`#${section} thead tr`).cells.length;
                    tableBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 20px;">No data found</td></tr>`;
                }
            } else {
                showNotification(result.message || `Failed to delete ${section}`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error deleting ${section}:`, error);
            showNotification(`Failed to delete ${section}`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function setupModals() {
        // Add event listeners for modal buttons
        document.getElementById('addCourseBtn')?.addEventListener('click', () => openAddModal('course'));
        document.getElementById('addJobBtn')?.addEventListener('click', () => openAddModal('job'));
        document.getElementById('addInternshipBtn')?.addEventListener('click', () => openAddModal('internship'));
        document.getElementById('addBlogBtn')?.addEventListener('click', () => openAddModal('blog'));
        document.getElementById('sendNewsletterBtn')?.addEventListener('click', () => openNewsletterModal());

        // Close modal buttons - FIXED: Proper event delegation
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('close-modal')) {
                closeModal();
            }
        });

        // Form submissions
        document.getElementById('courseForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'courses'));
        document.getElementById('jobForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'jobs'));
        document.getElementById('internshipForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'internships'));
        document.getElementById('blogForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'blog'));
        document.getElementById('userForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'users'));
        document.getElementById('newsletterForm')?.addEventListener('submit', (e) => handleNewsletterSubmit(e));
        document.getElementById('messageReplyForm')?.addEventListener('submit', (e) => handleMessageReplySubmit(e));

        // Fix reply button in view modal
        document.addEventListener('click', function(e) {
            if (e.target.id === 'replyFromView' || e.target.closest('#replyFromView')) {
                const email = document.getElementById('viewMessageEmail').textContent;
                const messageId = document.getElementById('messageViewModal').getAttribute('data-id');
                const subject = document.getElementById('viewMessageSubject').textContent;

                closeModal();
                setTimeout(() => openReplyModal(messageId, email, subject), 300);
            }
        });
    }

    // Enhanced form handling with expiration dates
    function setupExpirationDateFields() {
        // Set up expiration date fields in modals
        const modals = ['courseModal', 'jobModal', 'internshipModal'];

        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                const form = modal.querySelector('form');
                const expirationField = form.querySelector('[name="expiration_date"]');

                if (expirationField) {
                    // Set minimum date to today
                    const today = new Date().toISOString().slice(0, 16);
                    expirationField.min = today;

                    // Format existing expiration date for display
                    const existingExpiration = expirationField.value;
                    if (existingExpiration) {
                        try {
                            const date = new Date(existingExpiration);
                            if (!isNaN(date.getTime())) {
                                expirationField.value = date.toISOString().slice(0, 16);
                            }
                        } catch (e) {
                            console.error('Error formatting expiration date:', e);
                        }
                    }
                }
            }
        });
    }

    function openAddModal(type) {
        const modalId = `${type}Modal`;
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const form = document.getElementById(`${type}Form`);
        if (form) {
            form.reset();
            const idField = form.querySelector('input[type="hidden"]');
            if (idField) idField.value = '';

            const titleElement = document.getElementById(`${type}ModalTitle`);
            if (titleElement) {
                titleElement.textContent = `Add New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            }

            // Special handling for blog form
            if (type === 'blog') {
                const categoriesSelect = document.getElementById('blogCategories');
                if (categoriesSelect) {
                    categoriesSelect.style.height = '100px';
                    categoriesSelect.style.minHeight = '100px';
                    categoriesSelect.size = 4; // Show 4 options at once
                }
            }
        }

        modal.style.display = 'block';

        // Initialize Select2 for blog after modal is displayed
        if (type === 'blog') {
            setTimeout(() => {
                initializeBlogSelect2();
            }, 100);
        }
    }

    function openEditModal(section, id) {
        fetch(`/api/admin/${section}/${id}`, {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch ${section} item`);
            return response.json();
        })
        .then(item => {
            const modalId = `${section.slice(0, -1)}Modal`;
            const modal = document.getElementById(modalId);
            if (!modal) return;

            const form = document.getElementById(`${section.slice(0, -1)}Form`);
            if (form) {
                const idField = form.querySelector('input[type="hidden"]');
                if (idField) idField.value = item.id;

                Object.keys(item).forEach(key => {
                    const field = form.querySelector(`[name="${key}"]`);
                    if (field) {
                        if (field.type === 'checkbox') {
                            field.checked = item[key];
                        } else if (key === 'categories' && Array.isArray(item[key])) {
                            // Handle categories array for blog posts
                            if (section === 'blog') {
                                // Set the value but don't trigger Select2 yet
                                field.value = item[key].join(',');
                            } else {
                                field.value = item[key].join(', ');
                            }
                        } else if (key === 'expiration_date' && item[key]) {
                            // Format expiration date for datetime-local input
                            try {
                                const date = new Date(item[key]);
                                if (!isNaN(date.getTime())) {
                                    field.value = date.toISOString().slice(0, 16);
                                } else {
                                    field.value = '';
                                }
                            } catch (e) {
                                field.value = '';
                            }
                        } else {
                            field.value = item[key] || '';
                        }
                    }
                });

                const titleElement = document.getElementById(`${section.slice(0, -1)}ModalTitle`);
                if (titleElement) {
                    titleElement.textContent = `Edit ${section.charAt(0).toUpperCase() + section.slice(1, -1)}`;
                }
            }

            modal.style.display = 'block';

            // Initialize Select2 for blog after modal is displayed and data is set
            if (type === 'blog') {
                const categoriesSelect = document.getElementById('blogCategories');
                if (categoriesSelect) {
                    categoriesSelect.style.height = '100px';
                    categoriesSelect.style.minHeight = '100px';
                    categoriesSelect.size = 4; // Show 4 options at once
                }
            }
        })
        .catch(error => {
            console.error(`Error loading ${section} item:`, error);
            showNotification(`Failed to load ${section} item`, 'error');
        });
    }



    // ===== TESTIMONIAL MANAGER - COMPLETE FIXED IMPLEMENTATION =====
    class TestimonialManager {
        constructor() {
            this.currentPage = 1;
            this.perPage = 10;
            this.selectedIds = [];
            this.isInitialized = false;
            this.sectionId = 'testimonials';
            this.isLoading = false; // ADD THIS LINE
            this.hasLoaded = false; // ADD THIS LINE to prevent duplicate loads
        }

        init() {
            if (this.isInitialized) return;

            console.log('🔄 Initializing testimonial management...');
            this.setupEventListeners();
            this.isInitialized = true;

            // Load testimonials if section is active
            if (this.isSectionActive()) {
                console.log('✅ Testimonials section active, loading data...');
                this.loadTestimonialsData(1);
            }

            // Set up section observer
            this.setupSectionObserver();
        }

        setupSectionObserver() {
            const testimonialsSection = document.getElementById(this.sectionId);
            if (testimonialsSection) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            if (testimonialsSection.classList.contains('active')) {
                                console.log('🎯 Testimonials section activated - loading data');
                                this.loadTestimonialsData(1);
                            }
                        }
                    });
                });
                observer.observe(testimonialsSection, { attributes: true });
            }
        }

        isSectionActive() {
            const section = document.getElementById(this.sectionId);
            return section && section.classList.contains('active');
        }

        setupEventListeners() {
            console.log('🔧 Setting up testimonial event listeners...');

            // Refresh button
            this.setupElementListener('refreshTestimonialsBtn', 'click', () => {
                this.loadTestimonialsData(1);
            });

            // Search functionality
            this.setupSearchListener('testimonialSearch', () => {
                this.currentPage = 1;
                this.loadTestimonialsData(1);
            });

            // Status filter
            this.setupElementListener('testimonialStatusFilter', 'change', () => {
                this.currentPage = 1;
                this.loadTestimonialsData(1);
            });

            // Bulk actions
            this.setupElementListener('applyTestimonialBulkAction', 'click', () => {
                this.performBulkAction();
            });

            // Pagination
            this.setupElementListener('prevTestimonialPage', 'click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.loadTestimonialsData(this.currentPage);
                }
            });

            this.setupElementListener('nextTestimonialPage', 'click', () => {
                this.currentPage++;
                this.loadTestimonialsData(this.currentPage);
            });

            // Select all checkbox
            this.setupElementListener('selectAllTestimonials', 'change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });

            // Add to global navigation
            this.setupNavigation();
        }

        setupElementListener(id, event, handler) {
            const element = document.getElementById(id);
            if (element) {
                // Remove any existing listeners
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);

                newElement.addEventListener(event, handler);
                console.log(`✅ Added ${event} listener to ${id}`);
            } else {
                console.warn(`❌ Element with id '${id}' not found`);
            }
        }

        setupSearchListener(id, handler) {
            const element = document.getElementById(id);
            if (element) {
                let timeout;
                element.addEventListener('input', (e) => {
                    clearTimeout(timeout);
                    timeout = setTimeout(() => handler(e), 500);
                });
                console.log(`✅ Added search listener to ${id}`);
            }
        }

        setupNavigation() {
            // Add testimonials to the global navigation system
            const testimonialsLink = document.querySelector('a[href="#testimonials"]');
            if (testimonialsLink) {
                // Remove existing click listeners by cloning
                const newLink = testimonialsLink.cloneNode(true);
                testimonialsLink.parentNode.replaceChild(newLink, testimonialsLink);

                newLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Use the global navigateToSection function
                    if (typeof navigateToSection === 'function') {
                        navigateToSection('testimonials', newLink);
                    }

                    // Ensure testimonial manager is initialized
                    setTimeout(() => {
                        if (!this.isInitialized) {
                            this.init();
                        }
                        this.loadTestimonialsData(1);
                    }, 100);
                });
                console.log('✅ Testimonials navigation setup complete');
            }
        }

        async loadTestimonialsData(page = 1) {
            // Prevent multiple simultaneous loads
            if (this.isLoading) {
                console.log('⏳ Testimonials load already in progress, skipping...');
                return;
            }

            this.isLoading = true;
            console.log(`📥 Loading testimonials page ${page}...`);
            showLoading();

            try {
                const search = document.getElementById('testimonialSearch')?.value || '';
                const status = document.getElementById('testimonialStatusFilter')?.value || '';

                const params = new URLSearchParams({
                    page: page.toString(),
                    ...(search && { search }),
                    ...(status && { status })
                });

                const response = await fetch(`/api/admin/testimonials?${params}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data = await response.json();

                if (data.success) {
                    console.log('✅ Testimonials data received:', data);
                    this.renderTestimonialsTable(data.testimonials || []);
                    this.updatePaginationInfo(data.total_count || 0, page, data.per_page || this.perPage);
                    this.currentPage = page;

                    // Update bulk action states
                    this.selectedIds = [];
                    this.updateBulkActionButton();

                    showNotification(`Loaded ${data.testimonials?.length || 0} testimonials`, 'success');
                } else {
                    throw new Error(data.error || 'Failed to load testimonials');
                }

            } catch (error) {
                console.error('❌ Error loading testimonials:', error);

                let errorMessage = 'Failed to load testimonials';
                if (error.message.includes('500')) {
                    errorMessage = 'Server error while loading testimonials. Please try again.';
                } else if (error.message.includes('401')) {
                    errorMessage = 'Authentication required. Please log in again.';
                } else if (error.message.includes('403')) {
                    errorMessage = 'You do not have permission to access testimonials.';
                } else {
                    errorMessage = `Failed to load testimonials: ${error.message}`;
                }

                showNotification(errorMessage, 'error');
                this.renderTestimonialsTable([]);
            } finally {
                this.isLoading = false;
                hideLoading();
            }
        }

        renderTestimonialsTable(testimonials) {
            const tableBody = document.getElementById('testimonialsTableBody');
            if (!tableBody) {
                console.error('❌ Testimonials table body not found');
                return;
            }

            if (!testimonials || testimonials.length === 0) {
                tableBody.innerHTML = this.getEmptyStateHTML();
                return;
            }

            tableBody.innerHTML = testimonials.map((testimonial, index) =>
                this.getTestimonialRowHTML(testimonial, index)
            ).join('');

            this.addRowEventListeners();
            this.updateBulkActionButton();

            console.log(`✅ Rendered ${testimonials.length} testimonials`);
        }

        getEmptyStateHTML() {
            return `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <i class="fas fa-comment-slash" style="color: #6c757d; font-size: 48px; margin-bottom: 15px;"></i>
                        <h3 style="color: #6c757d; margin: 0;">No Testimonials Found</h3>
                        <p style="color: #6c757d; margin: 10px 0 0 0;">No testimonials match your search criteria.</p>
                    </td>
                </tr>
            `;
        }

        getTestimonialRowHTML(testimonial, index) {
            const serialNo = ((this.currentPage - 1) * this.perPage) + index + 1;
            const postedDate = formatDate(testimonial.created_at, true);
            const rating = testimonial.rating || 5;
            const content = testimonial.content || '';
            const truncatedContent = content.length > 100 ? content.substring(0, 100) + '...' : content;

            return `
                <tr>
                    <td style="vertical-align: middle;">
                        <input type="checkbox" class="testimonial-checkbox" data-id="${testimonial.id}">
                    </td>
                    <td class="serial-no" style="vertical-align: middle;">${serialNo}</td>
                    <td style="vertical-align: middle;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <img src="${testimonial.profile_pic_url || '/static/images/default-avatar.png'}"
                                 alt="${testimonial.username}"
                                 style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid #e9ecef;">
                            <div>
                                <strong style="font-size: 14px;">${escapeHTML(testimonial.username)}</strong>
                                ${testimonial.user_email ? `<br><small style="color: #6c757d; font-size: 12px;">${escapeHTML(testimonial.user_email)}</small>` : ''}
                            </div>
                        </div>
                    </td>
                    <td style="vertical-align: middle;">
                        <div title="${escapeHTML(content)}" style="max-width: 300px; line-height: 1.4;">
                            ${escapeHTML(truncatedContent)}
                        </div>
                    </td>
                    <td style="vertical-align: middle;">
                        <div style="text-align: center;">
                            <span style="color: #ffc107; font-size: 14px;">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span>
                            <br><small style="color: #6c757d;">${rating}/5</small>
                        </div>
                    </td>
                    <td style="vertical-align: middle;">
                        <small>${postedDate}</small>
                    </td>
                    <td style="vertical-align: middle;">
                        <div class="status-toggle">
                            <label class="switch">
                                <input type="checkbox" class="status-toggle-checkbox"
                                       ${testimonial.is_active ? 'checked' : ''}
                                       data-id="${testimonial.id}">
                                <span class="slider round"></span>
                            </label>
                            <span class="status-text ${testimonial.is_active ? 'active' : 'inactive'}">
                                ${testimonial.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </td>
                    <td style="vertical-align: middle;">
                        <div class="action-buttons">
                            <button class="btn-icon view-testimonial" data-id="${testimonial.id}" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon delete-testimonial" data-id="${testimonial.id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }

        addRowEventListeners() {
            // Status toggle
            document.querySelectorAll('.status-toggle-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const testimonialId = e.target.getAttribute('data-id');
                    const isActive = e.target.checked;
                    this.toggleTestimonialStatus(testimonialId, isActive);
                });
            });

            // Delete buttons
            document.querySelectorAll('.delete-testimonial').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const testimonialId = e.target.closest('button').getAttribute('data-id');
                    this.deleteTestimonial(testimonialId);
                });
            });

            // View buttons
            document.querySelectorAll('.view-testimonial').forEach(button => {
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const testimonialId = e.target.closest('button').getAttribute('data-id');
                    this.viewTestimonial(testimonialId);
                });
            });

            // Checkboxes
            document.querySelectorAll('.testimonial-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const testimonialId = e.target.getAttribute('data-id');
                    if (e.target.checked) {
                        if (!this.selectedIds.includes(testimonialId)) {
                            this.selectedIds.push(testimonialId);
                        }
                    } else {
                        this.selectedIds = this.selectedIds.filter(id => id !== testimonialId);
                    }
                    this.updateBulkActionButton();
                });
            });

            console.log('✅ Added row event listeners');
        }

        toggleSelectAll(checked) {
            this.selectedIds = [];
            const checkboxes = document.querySelectorAll('.testimonial-checkbox');

            checkboxes.forEach(checkbox => {
                checkbox.checked = checked;
                if (checked) {
                    this.selectedIds.push(checkbox.getAttribute('data-id'));
                }
            });

            this.updateBulkActionButton();
            console.log(`✅ ${checked ? 'Selected' : 'Deselected'} all ${checkboxes.length} testimonials`);
        }

        async toggleTestimonialStatus(testimonialId, isActive) {
            try {
                showLoading();

                const response = await fetch(`/api/admin/testimonials/${testimonialId}/status`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ is_active: isActive })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();

                if (result.success) {
                    showNotification(`Testimonial ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
                    // Reload data to reflect changes
                    this.loadTestimonialsData(this.currentPage);
                } else {
                    throw new Error(result.error || 'Failed to update status');
                }
            } catch (error) {
                console.error('❌ Error updating testimonial status:', error);
                showNotification('Failed to update testimonial status', 'error');
                // Revert checkbox
                const checkbox = document.querySelector(`.status-toggle-checkbox[data-id="${testimonialId}"]`);
                if (checkbox) {
                    checkbox.checked = !isActive;
                }
            } finally {
                hideLoading();
            }
        }

        deleteTestimonial(testimonialId) {
            showConfirmation('delete', 'Are you sure you want to delete this testimonial? This action cannot be undone.', async () => {
                try {
                    showLoading();

                    const response = await fetch(`/api/admin/testimonials/${testimonialId}`, {
                        method: 'DELETE',
                        credentials: 'include'
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const result = await response.json();

                    if (result.success) {
                        showNotification('Testimonial deleted successfully', 'success');
                        this.loadTestimonialsData(this.currentPage);
                    } else {
                        throw new Error(result.error || 'Failed to delete testimonial');
                    }
                } catch (error) {
                    console.error('❌ Error deleting testimonial:', error);
                    showNotification('Failed to delete testimonial', 'error');
                } finally {
                    hideLoading();
                }
            });
        }

        async viewTestimonial(testimonialId) {
            try {
                showLoading();

                const response = await fetch(`/api/admin/testimonials/${testimonialId}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();

                if (result.success) {
                    this.showTestimonialModal(result.testimonial);
                } else {
                    throw new Error(result.error || 'Failed to load testimonial');
                }
            } catch (error) {
                console.error('❌ Error loading testimonial:', error);
                showNotification('Failed to load testimonial details', 'error');
            } finally {
                hideLoading();
            }
        }

        showTestimonialModal(testimonial) {
            const modal = document.getElementById('contentViewModal');
            if (modal) {
                const title = modal.querySelector('.modal-title');
                const body = modal.querySelector('#contentViewBody');

                if (title) title.textContent = 'Testimonial Details';
                if (body) {
                    body.innerHTML = `
                        <div class="view-field">
                            <label>User:</label>
                            <span>${escapeHTML(testimonial.username)}</span>
                        </div>
                        <div class="view-field">
                            <label>Email:</label>
                            <span>${escapeHTML(testimonial.user_email || testimonial.email || 'N/A')}</span>
                        </div>
                        <div class="view-field">
                            <label>Rating:</label>
                            <span>${testimonial.rating || 5}/5</span>
                        </div>
                        <div class="view-field">
                            <label>Status:</label>
                            <span class="status-badge ${testimonial.is_active ? 'active' : 'inactive'}">
                                ${testimonial.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div class="view-field">
                            <label>Posted:</label>
                            <span>${formatDate(testimonial.created_at, true)}</span>
                        </div>
                        <div class="view-field full-width">
                            <label>Content:</label>
                            <div class="view-content" style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #4a6cf7;">
                                ${escapeHTML(testimonial.content || 'No content')}
                            </div>
                        </div>
                    `;
                }
                modal.style.display = 'block';
                console.log('✅ Testimonial modal displayed');
            }
        }

        performBulkAction() {
            const actionSelect = document.getElementById('testimonialBulkAction');
            if (!actionSelect || !actionSelect.value) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }

            if (this.selectedIds.length === 0) {
                showNotification('Please select at least one testimonial', 'warning');
                return;
            }

            const action = actionSelect.value;

            if (action === 'delete') {
                showConfirmation('delete',
                    `Are you sure you want to delete ${this.selectedIds.length} testimonial(s)? This action cannot be undone.`,
                    () => this.bulkDeleteTestimonials()
                );
            } else if (action === 'activate' || action === 'deactivate') {
                const isActive = action === 'activate';
                const actionText = isActive ? 'activate' : 'deactivate';
                showConfirmation('bulk_action',
                    `Are you sure you want to ${actionText} ${this.selectedIds.length} testimonial(s)?`,
                    () => this.bulkUpdateTestimonialStatus(isActive)
                );
            }
        }

        async bulkDeleteTestimonials() {
            try {
                showLoading();

                const response = await fetch('/api/admin/testimonials/bulk-delete', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ ids: this.selectedIds })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();

                if (result.success) {
                    showNotification(`Deleted ${result.deleted_count || this.selectedIds.length} testimonial(s) successfully`, 'success');
                    this.selectedIds = [];
                    this.loadTestimonialsData(this.currentPage);
                } else {
                    throw new Error(result.error || 'Failed to delete testimonials');
                }
            } catch (error) {
                console.error('❌ Error bulk deleting testimonials:', error);
                showNotification('Failed to delete testimonials', 'error');
            } finally {
                hideLoading();
            }
        }

        async bulkUpdateTestimonialStatus(isActive) {
            try {
                showLoading();

                const response = await fetch('/api/admin/testimonials/bulk-status', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ids: this.selectedIds,
                        is_active: isActive
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const result = await response.json();

                if (result.success) {
                    const action = isActive ? 'activated' : 'deactivated';
                    showNotification(`${result.updated_count || this.selectedIds.length} testimonial(s) ${action} successfully`, 'success');
                    this.selectedIds = [];
                    this.loadTestimonialsData(this.currentPage);
                } else {
                    throw new Error(result.error || 'Failed to update testimonials');
                }
            } catch (error) {
                console.error('❌ Error bulk updating testimonial status:', error);
                showNotification('Failed to update testimonials', 'error');
            } finally {
                hideLoading();
            }
        }

        updatePaginationInfo(totalItems, currentPage, perPage) {
            const pageInfo = document.getElementById('testimonialPageInfo');
            const prevBtn = document.getElementById('prevTestimonialPage');
            const nextBtn = document.getElementById('nextTestimonialPage');

            if (pageInfo) {
                const totalPages = Math.ceil(totalItems / perPage);
                pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            }

            if (prevBtn) {
                prevBtn.disabled = currentPage === 1;
                prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
            }

            if (nextBtn) {
                const totalPages = Math.ceil(totalItems / perPage);
                nextBtn.disabled = currentPage === totalPages || totalPages === 0;
                nextBtn.style.opacity = (currentPage === totalPages || totalPages === 0) ? '0.5' : '1';
            }
        }

        updateBulkActionButton() {
            const button = document.getElementById('applyTestimonialBulkAction');
            const selectAll = document.getElementById('selectAllTestimonials');

            if (button) {
                button.disabled = this.selectedIds.length === 0;
                if (this.selectedIds.length > 0) {
                    button.title = `Apply action to ${this.selectedIds.length} selected testimonials`;
                } else {
                    button.title = 'Select testimonials to enable bulk actions';
                }
            }

            if (selectAll) {
                const totalCheckboxes = document.querySelectorAll('.testimonial-checkbox').length;
                selectAll.checked = this.selectedIds.length > 0 && this.selectedIds.length === totalCheckboxes;
                selectAll.indeterminate = this.selectedIds.length > 0 && this.selectedIds.length < totalCheckboxes;
            }
        }
    }

    // ===== TESTIMONIAL INTEGRATION WITH DASHBOARD =====

    // Initialize testimonial manager when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 Initializing testimonial manager...');
        window.testimonialManager = new TestimonialManager();

        // Initialize immediately if testimonials section is active
        setTimeout(() => {
            if (window.testimonialManager.isSectionActive()) {
                window.testimonialManager.init();
            }
        }, 100);
    });

    // Add testimonials to global section loading system
    function setupTestimonialsGlobalIntegration() {
        // Add to section navigation
        const testimonialsLink = document.querySelector('a[href="#testimonials"]');
        if (testimonialsLink) {
            testimonialsLink.addEventListener('click', function(e) {
                e.preventDefault();

                // Use global navigation function
                if (typeof navigateToSection === 'function') {
                    navigateToSection('testimonials', this);
                }

                // Ensure testimonial manager is initialized
                setTimeout(() => {
                    if (window.testimonialManager && !window.testimonialManager.isInitialized) {
                        window.testimonialManager.init();
                    } else if (window.testimonialManager) {
                        window.testimonialManager.loadTestimonialsData(1);
                    }
                }, 200);
            });
        }

        // Add to global section loaders
        if (typeof window.sectionLoaders === 'undefined') {
            window.sectionLoaders = {};
        }
        window.sectionLoaders.testimonials = function() {
            if (window.testimonialManager) {
                if (!window.testimonialManager.isInitialized) {
                    window.testimonialManager.init();
                } else {
                    window.testimonialManager.loadTestimonialsData(1);
                }
            }
        };

        console.log('✅ Testimonials global integration complete');
    }

    // Expired Content Management
    let currentExpiredPage = 1;
    const expiredItemsPerPage = 10;
    let selectedExpiredItems = [];

    // Initialize expired content section
    function setupExpiredContentSection() {
        // Load expired content when section is activated
        const expiredContentSection = document.getElementById('expired-content');
        if (expiredContentSection) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (expiredContentSection.classList.contains('active')) {
                            loadExpiredContentData(currentExpiredPage);
                        }
                    }
                });
            });

            observer.observe(expiredContentSection, { attributes: true });
        }

        // Navigation
        const expiredContentLink = document.querySelector('a[href="#expired-content"]');
        if (expiredContentLink) {
            expiredContentLink.addEventListener('click', function(e) {
                e.preventDefault();
                loadExpiredContentSection();
            });
        }

        // Setup event listeners
        setupExpiredContentEvents();

        // Load stats
        loadExpiredContentStats();
    }

    function setupExpiredContentEvents() {
        // Refresh button
        document.getElementById('refreshExpiredContentBtn')?.addEventListener('click', function() {
            loadExpiredContentData(currentExpiredPage);
        });

        // Reactivate all button
        document.getElementById('reactivateAllExpiredBtn')?.addEventListener('click', function() {
            reactivateAllExpiredContent();
        });

        // Search functionality
        const searchInput = document.getElementById('expiredContentSearch');
        let searchTimeout;
        searchInput?.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadExpiredContentData(1, this.value);
            }, 500);
        });

        // Filter functionality
        document.getElementById('expiredContentTypeFilter')?.addEventListener('change', function() {
            loadExpiredContentData(1);
        });

        // Bulk actions
        document.getElementById('applyExpiredContentBulkAction')?.addEventListener('click', function() {
            const action = document.getElementById('expiredContentBulkAction').value;
            if (!action) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }
            performExpiredBulkAction(action);
        });

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllExpired');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', function() {
                const checkboxes = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                });
                updateExpiredBulkActionButton();
                updateSelectedExpiredItems();
            });
        }

        // Pagination
        document.getElementById('prevExpiredContentPage')?.addEventListener('click', function() {
            if (currentExpiredPage > 1) {
                currentExpiredPage--;
                loadExpiredContentData(currentExpiredPage);
            }
        });

        document.getElementById('nextExpiredContentPage')?.addEventListener('click', function() {
            currentExpiredPage++;
            loadExpiredContentData(currentExpiredPage);
        });

        // Manual expiration check button
        setupExpiredContentCheckButton();

        // View Expired Content Button
        document.getElementById('viewExpiredContentBtn')?.addEventListener('click', function() {
            loadExpiredContentSection();
        });
        // Add this to your setupExpiredContentEvents function or similar
        document.getElementById('viewExpiredLink')?.addEventListener('click', function(e) {
            e.preventDefault();
            loadExpiredContentSection();
        });
    }

    function setupExpiredContentCheckButton() {
        const button = document.getElementById('checkExpiredContentBtn');
        if (!button) return;

        // Remove any existing event listeners by cloning the element
        button.replaceWith(button.cloneNode(true));
        const freshButton = document.getElementById('checkExpiredContentBtn');

        freshButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent event bubbling

            // Check if already processing
            if (this.disabled) return;

            const button = this;
            const originalText = button.innerHTML;

            // Disable button immediately with visual feedback
            button.disabled = true;
            button.style.opacity = '0.7';
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

            fetch('/api/admin/check-expired-content', {
                method: 'POST',
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(result => {
                if (result.success) {
                    // Show specific success message with count
                    const count = result.deactivated_count || 0;
                    const message = count > 0
                        ? `Expired content check completed. ${count} items were deactivated.`
                        : 'Expired content check completed. No items needed deactivation.';

                    showNotification(message, 'success');

                    // Update stats and refresh data
                    loadExpiredContentStats();
                    loadDashboardStats();

                    // Reload the expired content data if we're in the expired content section
                    if (document.getElementById('expired-content')?.classList.contains('active')) {
                        loadExpiredContentData(currentExpiredPage);
                    }
                } else {
                    showNotification(result.message || 'Failed to check expired content', 'error');
                }
            })
            .catch(error => {
                console.error('Error checking expired content:', error);
                showNotification('Failed to check expired content. Please try again.', 'error');
            })
            .finally(() => {
                // Re-enable button after a short delay to prevent rapid successive clicks
                setTimeout(() => {
                    button.disabled = false;
                    button.style.opacity = '1';
                    button.innerHTML = originalText;
                }, 1000);
            });
        });
    }

    // Load expired content stats
    // Load expired content stats - Always show View All link
    function loadExpiredContentStats() {
        fetch('/api/admin/expired-content-stats', {
            credentials: 'include'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const expiredCount = data.total_expired || 0;
                const expiredCountElement = document.getElementById('expiredContentCount');
                const viewLink = document.getElementById('viewExpiredLink');
                const expiredCard = document.getElementById('expiredContentCard');

                if (expiredCountElement) {
                    expiredCountElement.textContent = expiredCount;
                }

                // ALWAYS show the view link, regardless of count
                if (viewLink) {
                    viewLink.style.display = 'block';
                    viewLink.style.pointerEvents = 'auto';
                    viewLink.style.opacity = '1';

                    // Make it more prominent when there are expired items
                    if (expiredCount > 0) {
                        viewLink.style.fontWeight = 'bold';
                        viewLink.style.color = '#dc3545'; // Red color for urgency
                    } else {
                        viewLink.style.fontWeight = 'normal';
                        viewLink.style.color = ''; // Reset to default
                    }
                }

                // Update card appearance based on count
                if (expiredCard) {
                    if (expiredCount > 0) {
                        expiredCard.classList.remove('stat-card', 'info');
                        expiredCard.classList.add('stat-card', 'warning');
                    } else {
                        expiredCard.classList.remove('stat-card', 'warning');
                        expiredCard.classList.add('stat-card', 'info');
                    }
                }
            } else {
                console.error('Failed to load expired content stats:', data.error);
                // Still show the view link even on error
                const viewLink = document.getElementById('viewExpiredLink');
                if (viewLink) {
                    viewLink.style.display = 'block';
                }
            }
        })
        .catch(error => {
            console.error('Error loading expired content stats:', error);
            const expiredCountElement = document.getElementById('expiredContentCount');
            const viewLink = document.getElementById('viewExpiredLink');

            if (expiredCountElement) {
                expiredCountElement.textContent = '0';
            }
            // Still show the view link even on error
            if (viewLink) {
                viewLink.style.display = 'block';
            }
        });
    }

    // Load expired content section
    function loadExpiredContentSection() {
        // Update active states
        document.querySelectorAll('.sidebar-menu a').forEach(item => item.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));

        document.querySelector('a[href="#expired-content"]').classList.add('active');
        document.getElementById('expired-content').classList.add('active');
        document.getElementById('pageTitle').textContent = 'Expired Content Management';

        // Load data
        loadExpiredContentData(1);
    }

    // Load expired content data
    function loadExpiredContentData(page = 1, search = '') {
        showLoading();

        const searchValue = search || document.getElementById('expiredContentSearch')?.value || '';
        const typeFilter = document.getElementById('expiredContentTypeFilter')?.value || '';

        let url = `/api/admin/expired-content?page=${page}`;
        if (searchValue) url += `&search=${encodeURIComponent(searchValue)}`;
        if (typeFilter) url += `&type=${encodeURIComponent(typeFilter)}`;

        fetch(url, {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch expired content');
            return response.json();
        })
        .then(data => {
            hideLoading();
            if (data.success) {
                renderExpiredContentTable(data.data || data.expired_content);
                updateExpiredPaginationInfo(data.count, page, data.per_page);
                updateExpiredContentStats(data.count);
            } else {
                showNotification('Failed to load expired content', 'error');
                document.getElementById('expiredContentTableBody').innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Error loading expired content</td></tr>';
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Error loading expired content:', error);
            showNotification('Failed to load expired content', 'error');
            document.getElementById('expiredContentTableBody').innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Error loading expired content</td></tr>';
        });
    }

    // Render expired content table
    function renderExpiredContentTable(expiredContent) {
        const tableBody = document.getElementById('expiredContentTableBody');
        if (!tableBody) return;

        if (!expiredContent || expiredContent.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px;">
                        <i class="fas fa-check-circle" style="color: #28a745; font-size: 48px; margin-bottom: 15px;"></i>
                        <h3 style="color: #6c757d; margin: 0;">No Expired Content Found</h3>
                        <p style="color: #6c757d; margin: 10px 0 0 0;">All content is up to date and properly managed.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = expiredContent.map((item, index) => {
            // Calculate serial number
            const serialNo = ((currentExpiredPage - 1) * expiredItemsPerPage) + index + 1;

            // Determine status based on both expiration and active state
            let statusBadge = '';
            let statusText = '';

            if (item.is_active) {
                statusBadge = 'warning';
                statusText = 'Expired but Active';
            } else {
                statusBadge = 'danger';
                statusText = 'Expired & Inactive';
            }

            return `
                <tr>
                    <td><input type="checkbox" class="expired-item-checkbox" data-type="${item.content_type}" data-id="${item.id}"></td>
                    <td class="serial-no">${serialNo}</td>
                    <td>
                        <span class="content-type-badge ${item.content_type}">
                            <i class="fas ${getContentTypeIcon(item.content_type)}"></i>
                            ${item.content_type.replace('s', '').toUpperCase()}
                        </span>
                    </td>
                    <td>${escapeHTML(item.title || 'No Title')}</td>
                    <td>${escapeHTML(item.company || 'N/A')}</td>
                    <td>
                        <span class="text-danger">
                            <i class="fas fa-clock"></i> ${formatDate(item.expiration_date, true)}
                        </span>
                    </td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>
                        <span class="status-badge ${statusBadge}">${statusText}</span>
                        ${item.is_featured ? '<br><small class="text-success"><i class="fas fa-star"></i> Featured</small>' : ''}
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-type="${item.content_type}" data-id="${item.id}" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon edit-expired-item" data-type="${item.content_type}" data-id="${item.id}" title="Edit & Update Date">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${!item.is_active ? `
                            <button class="btn-icon reactivate-single-item" data-type="${item.content_type}" data-id="${item.id}" title="Reactivate as Featured">
                                <i class="fas fa-play"></i>
                            </button>
                            ` : `
                            <button class="btn-icon" style="opacity: 0.5;" title="Already Active" disabled>
                                <i class="fas fa-check"></i>
                            </button>
                            `}
                            <button class="btn-icon delete-expired-item" data-type="${item.content_type}" data-id="${item.id}" title="Delete Permanently">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Add event listeners to action buttons
        addExpiredContentRowEventListeners();

        // Update bulk action button state
        updateExpiredBulkActionButton();
        updateSelectAllExpiredCheckbox();
    }

    function addExpiredContentRowEventListeners() {
        // Individual checkbox events
        document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                updateSelectedExpiredItems();
                updateExpiredBulkActionButton();
                updateSelectAllExpiredCheckbox();
            });
        });

        // View buttons
        document.querySelectorAll('.view-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const contentType = this.getAttribute('data-type');
                const contentId = this.getAttribute('data-id');
                openViewModal(contentType, contentId);
            });
        });

        // Edit buttons
        document.querySelectorAll('.edit-expired-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const contentType = this.getAttribute('data-type');
                const contentId = this.getAttribute('data-id');
                openEditModal(contentType, contentId);
            });
        });

        // Reactivate single item buttons
        document.querySelectorAll('.reactivate-single-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const contentType = this.getAttribute('data-type');
                const contentId = this.getAttribute('data-id');
                reactivateSingleExpiredContent(contentType, contentId);
            });
        });

        // Delete single item buttons
        document.querySelectorAll('.delete-expired-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const contentType = this.getAttribute('data-type');
                const contentId = this.getAttribute('data-id');
                deleteSingleExpiredContent(contentType, contentId);
            });
        });
    }

    // Helper function to get content type icon
    function getContentTypeIcon(contentType) {
        const icons = {
            'courses': 'fa-book',
            'jobs': 'fa-briefcase',
            'internships': 'fa-user-graduate'
        };
        return icons[contentType] || 'fa-file';
    }

    // Update selected items array
    function updateSelectedExpiredItems() {
        selectedExpiredItems = [];
        document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox:checked').forEach(checkbox => {
            selectedExpiredItems.push({
                content_type: checkbox.getAttribute('data-type'),
                content_id: checkbox.getAttribute('data-id')
            });
        });
    }

    // Update pagination info
    function updateExpiredPaginationInfo(totalItems, currentPage, perPage = expiredItemsPerPage) {
        const pageInfo = document.getElementById('expiredContentPageInfo');
        const prevBtn = document.getElementById('prevExpiredContentPage');
        const nextBtn = document.getElementById('nextExpiredContentPage');

        if (!pageInfo) return;

        const totalPages = Math.ceil(totalItems / perPage);
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // Update expired content stats in the UI
    function updateExpiredContentStats(totalCount) {
        // Update the dashboard expired content count
        const expiredCountElement = document.getElementById('expiredContentCount');
        if (expiredCountElement) {
            expiredCountElement.textContent = totalCount;
        }
    }

    // Update bulk action button state
    function updateExpiredBulkActionButton() {
        const selectedCount = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox:checked').length;
        const bulkActionBtn = document.getElementById('applyExpiredContentBulkAction');

        if (bulkActionBtn) {
            bulkActionBtn.disabled = selectedCount === 0;
        }
    }

    // Update select all checkbox
    function updateSelectAllExpiredCheckbox() {
        const selectAll = document.getElementById('selectAllExpired');
        const checkboxes = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox');
        const checkedCount = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox:checked').length;

        if (selectAll && checkboxes.length > 0) {
            selectAll.checked = checkedCount === checkboxes.length;
            selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        }
    }

    // Perform bulk actions
    function performExpiredBulkAction(action) {
        const selectedItems = getSelectedExpiredItems();

        if (selectedItems.length === 0) {
            showNotification('Please select at least one item to perform bulk action', 'warning');
            return;
        }

        if (action === 'reactivate') {
            showConfirmation('bulk_reactivate',
                `Are you sure you want to reactivate ${selectedItems.length} item(s)? This will set them as active and featured.`,
                () => {
                    bulkReactivateExpiredContent(selectedItems);
                }
            );
        } else if (action === 'delete') {
            showConfirmation('bulk_delete',
                `Are you sure you want to permanently delete ${selectedItems.length} expired item(s)? This action cannot be undone.`,
                () => {
                    bulkDeleteExpiredContent(selectedItems);
                }
            );
        }
    }

    function getSelectedExpiredItems() {
        const selectedItems = [];
        document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox:checked').forEach(checkbox => {
            selectedItems.push({
                content_type: checkbox.getAttribute('data-type'),
                content_id: checkbox.getAttribute('data-id')
            });
        });
        return selectedItems;
    }

    function bulkReactivateExpiredContent(items) {
        showLoading();

        fetch('/api/admin/expired-content/bulk-reactivate', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items: items })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success || result.results?.successful?.length > 0) {
                const successCount = result.results?.successful?.length || result.reactivated_count || 0;
                const failCount = result.results?.failed?.length || 0;

                let message = `Successfully reactivated ${successCount} item(s) as featured`;
                if (failCount > 0) {
                    message += `. ${failCount} item(s) failed - they still have past expiration dates.`;
                    showNotification(message, 'warning');

                    // Show detailed errors for failed items
                    if (failCount > 0) {
                        setTimeout(() => {
                            showNotification('Some items failed to reactivate. Please update their expiration dates first.', 'error', 8000);
                        }, 2000);
                    }
                } else {
                    showNotification(message, 'success');
                }

                // Refresh the expired content list
                loadExpiredContentData(currentExpiredPage);
                loadDashboardStats();
                loadExpiredContentStats();

            } else {
                showNotification('Failed to reactivate any items. Please check expiration dates.', 'error');
            }
        })
        .catch(error => {
            console.error('Error in bulk reactivate:', error);
            showNotification('Failed to reactivate items', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function bulkDeleteExpiredContent(items) {
        showLoading();

        fetch('/api/admin/expired-content/bulk-delete', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items: items })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification(`Permanently deleted ${result.deleted_count} expired item(s)`, 'success');
                loadExpiredContentData(currentExpiredPage);
                loadDashboardStats();
                loadExpiredContentStats();
            } else {
                showNotification(result.message || 'Failed to delete some items', 'error');
            }
        })
        .catch(error => {
            console.error('Error in bulk delete:', error);
            showNotification('Failed to delete items', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function reactivateAllExpiredContent() {
        showConfirmation('reactivate_all',
            'Are you sure you want to reactivate ALL expired content? This will set all items as active and featured (only those with future expiration dates will succeed).',
            () => {
                showLoading();

                // Get all expired content first
                fetch('/api/admin/expired-content?per_page=1000', {
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.data.length > 0) {
                        const allItems = data.data.map(item => ({
                            content_type: item.content_type,
                            content_id: item.id
                        }));

                        bulkReactivateExpiredContent(allItems);
                    } else {
                        showNotification('No expired content found to reactivate', 'info');
                        hideLoading();
                    }
                })
                .catch(error => {
                    console.error('Error getting all expired content:', error);
                    showNotification('Failed to load expired content', 'error');
                    hideLoading();
                });
            }
        );
    }

    function reactivateSingleExpiredContent(contentType, contentId) {
        showConfirmation('reactivate_single',
            `Reactivate this ${contentType.replace('s', '')}? This will set it as active and featured.`,
            () => {
                showLoading();

                fetch(`/api/admin/${contentType}/${contentId}/reactivate`, {
                    method: 'PUT',
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        showNotification(result.message || 'Content reactivated successfully as featured', 'success');
                        loadExpiredContentData(currentExpiredPage);
                        loadDashboardStats();
                        loadExpiredContentStats();
                    } else {
                        if (result.requires_date_update) {
                            showNotification(result.message, 'error');
                            // Optionally open edit modal after a delay
                            setTimeout(() => {
                                openEditModal(contentType, contentId);
                            }, 2000);
                        } else {
                            showNotification(result.message || 'Failed to reactivate', 'error');
                        }
                    }
                })
                .catch(error => {
                    console.error('Error reactivating content:', error);
                    showNotification('Failed to reactivate content', 'error');
                })
                .finally(() => {
                    hideLoading();
                });
            }
        );
    }

    function deleteSingleExpiredContent(contentType, contentId) {
        showConfirmation('delete_single',
            `Permanently delete this expired ${contentType.replace('s', '')}? This action cannot be undone.`,
            () => {
                showLoading();

                const items = [{ content_type: contentType, content_id: contentId }];

                fetch('/api/admin/expired-content/bulk-delete', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ items: items })
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {
                        showNotification('Expired content permanently deleted', 'success');
                        loadExpiredContentData(currentExpiredPage);
                        loadDashboardStats();
                        loadExpiredContentStats();
                    } else {
                        showNotification(result.message || 'Failed to delete content', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error deleting content:', error);
                    showNotification('Failed to delete content', 'error');
                })
                .finally(() => {
                    hideLoading();
                });
            }
        );
    }

    // Add manual expiration check button
    document.getElementById('checkExpiredContentBtn')?.addEventListener('click', function() {
        const button = this;
        const originalText = button.innerHTML;

        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

        fetch('/api/admin/check-expired-content', {
            method: 'POST',
            credentials: 'include'
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification('Expired content check completed', 'success');
                loadExpiredContentStats();
                loadDashboardStats();
            } else {
                showNotification(result.message || 'Failed to check expired content', 'error');
            }
        })
        .catch(error => {
            console.error('Error checking expired content:', error);
            showNotification('Failed to check expired content', 'error');
        })
        .finally(() => {
            button.disabled = false;
            button.innerHTML = originalText;
        });
    });

    function openNewsletterModal() {
        const modal = document.getElementById('newsletterModal');
        if (!modal) return;

        const form = document.getElementById('newsletterForm');
        if (form) form.reset();

        modal.style.display = 'block';
    }

    function openReplyModal(id, email, subject = '') {
        console.log('Opening reply modal for:', { id, email, subject });

        const modal = document.getElementById('messageReplyModal');
        if (!modal) {
            console.error('Reply modal not found');
            return;
        }

        // Reset and set basic form values
        document.getElementById('messageId').value = id;
        document.getElementById('recipientEmail').value = email;

        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
        document.getElementById('replySubject').value = replySubject;

        // Update display fields
        document.getElementById('recipientEmailDisplay').querySelector('.field-value').textContent = email;
        document.getElementById('replySubjectDisplay').querySelector('.field-value').textContent = replySubject;

        // Clear reply message area
        document.getElementById('replyMessage').value = '';
        updateCharCount();

        // Set loading state
        document.getElementById('originalSender').textContent = 'Loading...';
        document.getElementById('originalSubject').textContent = 'Loading...';
        document.getElementById('originalDate').textContent = 'Loading...';
        document.getElementById('originalMessageContent').innerHTML = '<div class="message-content-loading">Loading message content...</div>';

        // Always fetch fresh message data to ensure we have the complete message
        fetch(`/api/admin/messages/${id}`, {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch message details');
            return response.json();
        })
        .then(message => {
            console.log('Message data loaded:', message);

            // Update all fields with the message data
            document.getElementById('originalSender').textContent = `${message.name} <${message.email}>`;
            document.getElementById('originalSubject').textContent = message.subject || 'No subject';
            document.getElementById('originalDate').textContent = formatDate(message.created_at, true);

            // Update message content
            const messageContent = document.getElementById('originalMessageContent');
            if (message.message) {
                // Preserve line breaks and basic formatting
                const formattedMessage = message.message
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\n/g, '<br>')
                    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
                messageContent.innerHTML = formattedMessage;
            } else {
                messageContent.innerHTML = '<em>No message content available</em>';
            }
        })
        .catch(error => {
            console.error('Error loading message details:', error);
            // Fallback values
            document.getElementById('originalSender').textContent = 'Unknown sender';
            document.getElementById('originalSubject').textContent = subject || 'No subject';
            document.getElementById('originalDate').textContent = 'Unknown date';
            document.getElementById('originalMessageContent').innerHTML = '<em>Failed to load message content</em>';
        });

        // Show modal
        modal.style.display = 'block';

        // Focus on message area
        setTimeout(() => {
            document.getElementById('replyMessage').focus();
        }, 100);
    }

    function updateCharCount() {
        const textarea = document.getElementById('replyMessage');
        const charCount = document.querySelector('#messageReplyModal .char-count');

        if (textarea && charCount) {
            const count = textarea.value.length;
            charCount.textContent = `${count} characters`;

            // Remove all classes first
            charCount.classList.remove('warning', 'error');

            // Add appropriate class based on length
            if (count > 2000) {
                charCount.classList.add('error');
            } else if (count > 1000) {
                charCount.classList.add('warning');
            }
        }
    }

    // Make sure the form submission is properly bound
    document.addEventListener('DOMContentLoaded', function() {
        const replyForm = document.getElementById('messageReplyForm');
        if (replyForm) {
            replyForm.addEventListener('submit', handleMessageReplySubmit);
        }

        // Add input event listener for character count
        const replyMessage = document.getElementById('replyMessage');
        if (replyMessage) {
            replyMessage.addEventListener('input', updateCharCount);
        }

    });

    function viewMessage(id) {
        fetch(`/api/admin/messages/${id}`, {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch message');
            return response.json();
        })
        .then(message => {
            const modal = document.getElementById('messageViewModal');
            if (!modal) return;

            // Store the complete message data for reply functionality
            modal._messageData = {
                id: message.id,
                name: message.name,
                email: message.email,
                subject: message.subject,
                message: message.message,
                created_at: message.created_at,
                status: message.status
            };

            console.log('Message data stored for reply:', modal._messageData);

            // Update message details in view modal
            document.getElementById('viewMessageName').textContent = message.name || 'Unknown';
            document.getElementById('viewMessageEmail').textContent = message.email || 'No email';
            document.getElementById('viewMessageSubject').textContent = message.subject || 'No subject';
            document.getElementById('viewMessageDate').textContent = formatDate(message.created_at, true);

            // Status with proper styling
            const statusElement = document.getElementById('viewMessageStatus');
            statusElement.textContent = message.status ?
                message.status.charAt(0).toUpperCase() + message.status.slice(1) : 'Unknown';
            statusElement.className = 'message-value status-badge ' + (message.status || 'unknown');

            // Message content
            document.getElementById('viewMessageContent').textContent = message.message || 'No message content available';

            // Show modal
            modal.style.display = 'block';

            // Mark as read if unread
            if (message.status === 'unread') {
                fetch(`/api/admin/messages/${id}/status`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'read' })
                }).then(() => {
                    if (currentSection === 'messages') {
                        loadSectionData('messages', currentPage.messages);
                    }
                });
            }
        })
        .catch(error => {
            console.error('Error loading message:', error);
            showNotification('Failed to load message', 'error');
        });
    }

    // FIXED: Search and filter functionality
    function setupForms() {
        // Search functionality - FIXED: Proper event delegation
        document.addEventListener('click', function(e) {
            // Handle search icon clicks
            if (e.target.classList.contains('fa-search') || e.target.closest('.fa-search')) {
                const searchIcon = e.target.classList.contains('fa-search') ? e.target : e.target.closest('.fa-search');
                const searchBox = searchIcon.closest('.search-box');
                if (searchBox) {
                    const input = searchBox.querySelector('input');
                    const section = searchBox.closest('.admin-section').id;
                    const searchTerm = input.value.trim();
                    loadSectionData(section, 1, searchTerm);
                }
            }

            // Handle clear search button clicks
            if (e.target.classList.contains('fa-times') || e.target.closest('.fa-times')) {
                const clearBtn = e.target.classList.contains('fa-times') ? e.target : e.target.closest('.fa-times');
                const searchBox = clearBtn.closest('.search-box');
                if (searchBox) {
                    const input = searchBox.querySelector('input');
                    input.value = '';
                    const section = searchBox.closest('.admin-section').id;
                    loadSectionData(section, 1);
                }
            }
        });

        // Enter key in search inputs
        document.querySelectorAll('.search-box input').forEach(input => {
            input.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    const section = this.closest('.admin-section').id;
                    const searchTerm = this.value.trim();
                    loadSectionData(section, 1, searchTerm);
                }
            });
        });

        // Filter functionality - FIXED: Proper event delegation
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('filter-select')) {
                const select = e.target;
                const section = select.closest('.admin-section').id;
                const filterValue = select.value;
                const filterName = select.id.replace('Filter', '').toLowerCase();

                const filters = {};
                if (filterValue) {
                    filters[filterName] = filterValue;
                }

                loadSectionData(section, 1, '', filters);
            }
        });
    }

    function handleFormSubmit(e, type) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;

        // Convert checkbox values to boolean
        Object.keys(data).forEach(key => {
            if (data[key] === 'on') {
                data[key] = true;
            } else if (data[key] === 'off') {
                data[key] = false;
            } else if (data[key] === '') {
                // Remove empty fields except for text areas and certain fields
                if (!['description', 'content', 'image', 'salary'].includes(key)) {
                    delete data[key];
                }
            }

            // Convert numeric fields
            if (['rating', 'enrollments', 'duration_hours'].includes(key) && data[key]) {
                data[key] = parseFloat(data[key]) || 0;
            }
        });

        // Handle categories array for blog posts
        if (type === 'blog' && data.categories) {
            if (typeof data.categories === 'string') {
                data.categories = data.categories.split(',').map(cat => cat.trim()).filter(cat => cat);
            }
        }

        // IMPORTANT: When updating from expired section, DO NOT automatically reactivate
        // Keep is_active as false until manual reactivation
        if (id && currentSection === 'expired-content') {
            // If we're editing from expired section, preserve the inactive state
            // unless explicitly changing it
            if (typeof data.is_active === 'undefined') {
                data.is_active = false;
            }
        } else {
            // For normal edits, sync featured state with active state for new items
            if (['courses', 'jobs', 'internships', 'blog'].includes(type) && !id) {
                data.is_featured = data.is_active;
            }
        }

        // For new items, remove the ID field completely
        if (!id || id === '') {
            delete data.id;
        }

        // Validate required fields
        const required_fields = {
            'course': ['title', 'category', 'instructor', 'application_link'],
            'job': ['title', 'company', 'location', 'application_link'],
            'internship': ['title', 'company', 'location', 'application_link'],
            'blog': ['title', 'author', 'content', 'categories']
        };

        if (type in required_fields) {
            for (const field of required_fields[type]) {
                if (!data[field]) {
                    showNotification(`${field.replace('_', ' ')} is required`, 'error');
                    return;
                }
            }
        }

        const url = id ? `/api/admin/${type}/${id}` : `/api/admin/${type}`;
        const method = id ? 'PUT' : 'POST';

        // Show loading state
        showLoading();

        fetch(url, {
            method: method,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || `Failed to ${id ? 'update' : 'create'} ${type}`);
                });
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} ${id ? 'updated' : 'created'} successfully`, 'success');

                // Close modal and reset form
                closeModal();
                form.reset();

                // Reload the appropriate section
                if (currentSection === 'expired-content') {
                    // If we're in expired section, reload expired content
                    loadExpiredContentData(currentExpiredPage);
                } else {
                    // Otherwise reload the current section
                    loadSectionData(type, currentPage[type]);
                }
            } else {
                showNotification(result.message || `Failed to ${id ? 'update' : 'create'} ${type}`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error ${id ? 'updating' : 'creating'} ${type}:`, error);
            showNotification(error.message || `Failed to ${id ? 'update' : 'create'} ${type}`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

   // Enhanced form submission
    function handleMessageReplySubmit(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Validate required fields
        if (!data.message || data.message.trim() === '') {
            showNotification('Please enter a reply message before sending', 'error');
            document.getElementById('replyMessage').focus();
            return;
        }

        if (data.message.trim().length < 10) {
            showNotification('Please write a more detailed reply (minimum 10 characters)', 'warning');
            document.getElementById('replyMessage').focus();
            return;
        }

        const submitButton = document.getElementById('sendReplyBtn');
        const originalText = submitButton.innerHTML;

        // Show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        fetch('/api/admin/messages/reply', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || 'Failed to send reply');
                });
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification('✅ Reply sent successfully!', 'success');

                // Close modal and reset form
                closeModal();
                form.reset();

                // Update message status to replied and reload messages
                fetch(`/api/admin/messages/${data.message_id}/status`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'replied' })
                }).then(() => {
                    if (currentSection === 'messages') {
                        loadSectionData('messages', currentPage.messages);
                    }
                });
            } else {
                showNotification(result.message || 'Failed to send reply', 'error');
            }
        })
        .catch(error => {
            console.error('Error sending reply:', error);
            showNotification('Failed to send reply. Please check your connection and try again.', 'error');
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reply';
        });
    }

    function setupBulkActions() {
        // Select All functionality for each section
        document.querySelectorAll('thead input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const sectionId = this.id.replace('selectAll', '');
                if (!sectionId) return;

                const sectionKey = sectionId.charAt(0).toLowerCase() + sectionId.slice(1);
                const tableBody = document.getElementById(`${sectionKey}TableBody`);

                if (!tableBody) return;

                const rowCheckboxes = tableBody.querySelectorAll('.row-checkbox');

                rowCheckboxes.forEach(cb => {
                    cb.checked = this.checked;
                    const id = cb.getAttribute('data-id');

                    if (this.checked) {
                        if (!selectedItems[sectionKey].includes(id)) {
                            selectedItems[sectionKey].push(id);
                        }
                    } else {
                        selectedItems[sectionKey] = selectedItems[sectionKey].filter(itemId => itemId !== id);
                    }
                });

                updateSelectAllCheckbox(sectionKey);
                updateBulkActionButton(sectionKey);
            });
        });

        // Individual row checkbox functionality
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('row-checkbox')) {
                const checkbox = e.target;
                const row = checkbox.closest('tr');
                const section = row.closest('.admin-section').id;
                const id = checkbox.getAttribute('data-id');

                if (checkbox.checked) {
                    if (!selectedItems[section].includes(id)) {
                        selectedItems[section].push(id);
                    }
                } else {
                    selectedItems[section] = selectedItems[section].filter(itemId => itemId !== id);
                }

                updateSelectAllCheckbox(section);
                updateBulkActionButton(section);
            }
        });

        // Apply Bulk Actions
        document.querySelectorAll('[id^="apply"][id$="BulkAction"]').forEach(button => {
            button.addEventListener('click', function() {
                const buttonId = this.id;
                const section = buttonId.replace('apply', '').replace('BulkAction', '').toLowerCase();
                const actionSelect = document.getElementById(`${section}BulkAction`);

                if (!actionSelect) {
                    console.error(`Bulk action select not found for section: ${section}`);
                    return;
                }

                const action = actionSelect.value;

                if (!action) {
                    showNotification('Please select a bulk action first', 'warning');
                    return;
                }

                if (selectedItems[section].length === 0) {
                    showNotification('Please select at least one item', 'warning');
                    return;
                }

                // Perform the bulk action based on type
                switch(action) {
                    case 'delete':
                        showConfirmation('delete', `Are you sure you want to delete ${selectedItems[section].length} item(s)? This action cannot be undone.`, () => {
                            performBulkDelete(section, selectedItems[section]);
                        });
                        break;
                    case 'activate':
                        performBulkStatusUpdate(section, selectedItems[section], true);
                        break;
                    case 'deactivate':
                        performBulkStatusUpdate(section, selectedItems[section], false);
                        break;
                    case 'mark_read':
                        performBulkMessageStatusUpdate(section, selectedItems[section], 'read');
                        break;
                    case 'mark_unread':
                        performBulkMessageStatusUpdate(section, selectedItems[section], 'unread');
                        break;
                    case 'mark_replied':
                        performBulkMessageStatusUpdate(section, selectedItems[section], 'replied');
                        break;
                    default:
                        showNotification('Unknown bulk action', 'error');
                }
            });
        });
    }

    // Add this function to fix bulk actions
    function setupBulkActionButtons() {
        // Course bulk actions
        document.getElementById('applyCourseBulkAction')?.addEventListener('click', function() {
            const action = document.getElementById('courseBulkAction').value;
            if (!action) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }
            performBulkAction('courses', action);
        });

        // Job bulk actions
        document.getElementById('applyJobBulkAction')?.addEventListener('click', function() {
            const action = document.getElementById('jobBulkAction').value;
            if (!action) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }
            performBulkAction('jobs', action);
        });

        // Internship bulk actions
        document.getElementById('applyInternshipBulkAction')?.addEventListener('click', function() {
            const action = document.getElementById('internshipBulkAction').value;
            if (!action) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }
            performBulkAction('internships', action);
        });

        // Blog bulk actions
        document.getElementById('applyBlogBulkAction')?.addEventListener('click', function() {
            const action = document.getElementById('blogBulkAction').value;
            if (!action) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }
            performBulkAction('blog', action);
        });

        // User bulk actions
        document.getElementById('applyUserBulkAction')?.addEventListener('click', function() {
            const action = document.getElementById('userBulkAction').value;
            if (!action) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }
            performBulkAction('users', action);
        });

        // Message bulk actions
        document.getElementById('applyMessageBulkAction')?.addEventListener('click', function() {
            const action = document.getElementById('messageBulkAction').value;
            if (!action) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }
            performBulkAction('messages', action);
        });

        // Newsletter bulk actions
        document.getElementById('applyNewsletterBulkAction')?.addEventListener('click', function() {
            const action = document.getElementById('newsletterBulkAction').value;
            if (!action) {
                showNotification('Please select a bulk action first', 'warning');
                return;
            }
            performBulkAction('newsletter', action);
        });
    }

    // Enhanced bulk action function
    function performBulkAction(section, action) {
        const selectedIds = selectedItems[section];

        if (selectedIds.length === 0) {
            showNotification('Please select at least one item', 'warning');
            return;
        }

        const actionMessages = {
            'activate': `activate ${selectedIds.length} ${section}`,
            'deactivate': `deactivate ${selectedIds.length} ${section}`,
            'delete': `delete ${selectedIds.length} ${section}`,
            'mark_read': `mark ${selectedIds.length} messages as read`,
            'mark_unread': `mark ${selectedIds.length} messages as unread`,
            'mark_replied': `mark ${selectedIds.length} messages as replied`
        };

        const message = `Are you sure you want to ${actionMessages[action]}?`;

        showConfirmation('bulk_action', message, () => {
            showLoading();

            let endpoint = '';
            let method = 'POST';
            let body = { ids: selectedIds };

            switch(action) {
                case 'activate':
                case 'deactivate':
                    endpoint = `/api/admin/${section}/bulk-status`;
                    body.is_active = action === 'activate';
                    break;
                case 'delete':
                    endpoint = `/api/admin/${section}/bulk-delete`;
                    break;
                case 'mark_read':
                case 'mark_unread':
                case 'mark_replied':
                    endpoint = `/api/admin/messages/bulk-status`;
                    body.status = action.replace('mark_', '');
                    break;
            }

            fetch(endpoint, {
                method: method,
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to perform bulk action');
                return response.json();
            })
            .then(result => {
                if (result.success) {
                    showNotification(result.message || 'Bulk action completed successfully', 'success');
                    // Clear selection and reload data
                    selectedItems[section] = [];
                    loadSectionData(section, currentPage[section]);
                } else {
                    showNotification(result.message || 'Failed to perform bulk action', 'error');
                }
            })
            .catch(error => {
                console.error('Bulk action error:', error);
                showNotification('Failed to perform bulk action', 'error');
            })
            .finally(() => {
                hideLoading();
            });
        });
    }

    // Update the select all checkbox state
    function updateSelectAllCheckbox(section) {
        const sectionId = section.charAt(0).toUpperCase() + section.slice(1);
        const selectAll = document.getElementById(`selectAll${sectionId}`);
        if (!selectAll) return;

        const tableBody = document.getElementById(`${section}TableBody`);
        if (!tableBody) return;

        const rowCheckboxes = tableBody.querySelectorAll('.row-checkbox');
        const checkedCount = selectedItems[section].length;

        selectAll.checked = rowCheckboxes.length > 0 && checkedCount === rowCheckboxes.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
    }

    // Update bulk action button state
    function updateBulkActionButton(section) {
        const button = document.getElementById(`apply${section.charAt(0).toUpperCase() + section.slice(1)}BulkAction`);
        if (button) {
            button.disabled = selectedItems[section].length === 0;
        }
    }

    // Enhanced bulk delete function
    function performBulkDelete(section, ids) {
        if (!ids || ids.length === 0) {
            showNotification('No items selected for deletion', 'warning');
            return;
        }

        showLoading();

        // Fix section names for API endpoints
        let apiSection = section;
        if (section === 'blog') apiSection = 'blog_posts';
        if (section === 'newsletter') apiSection = 'newsletter_subscribers';

        fetch(`/api/admin/${apiSection}/bulk-delete`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: ids })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${ids.length} ${section} deleted successfully`, 'success');
                // Clear selection and reload data
                selectedItems[section] = [];
                loadSectionData(section, currentPage[section]);
            } else {
                showNotification(result.message || `Failed to delete ${section}`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error bulk deleting ${section}:`, error);
            showNotification(`Failed to delete ${section}. Please try again.`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    // Enhanced bulk status update function - FIXED for blog posts
    function performBulkStatusUpdate(section, ids, isActive) {
        if (!ids || ids.length === 0) {
            showNotification('No items selected', 'warning');
            return;
        }

        showLoading();

        // Fix section names for API endpoints - IMPORTANT: blog becomes blog_posts
        let apiSection = section;
        if (section === 'blog') apiSection = 'blog_posts';
        if (section === 'newsletter') apiSection = 'newsletter_subscribers';

        // Prepare update data
        const updateData = { ids: ids, is_active: isActive };
        if (['courses', 'jobs', 'internships', 'blog'].includes(section)) {
            updateData.is_featured = isActive;
        }

        fetch(`/api/admin/${apiSection}/bulk-status`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                const statusText = isActive ? 'activated' : 'deactivated';
                showNotification(`${ids.length} ${section} ${statusText} successfully`, 'success');
                // Clear selection and reload data
                selectedItems[section] = [];
                loadSectionData(section, currentPage[section]);
            } else {
                showNotification(result.message || `Failed to update ${section} status`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error bulk updating ${section} status:`, error);
            showNotification(`Failed to update ${section} status. Please try again.`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    // Enhanced bulk message status update function
    function performBulkMessageStatusUpdate(section, ids, status) {
        if (!ids || ids.length === 0) {
            showNotification('No items selected', 'warning');
            return;
        }

        showLoading();

        fetch(`/api/admin/${section}/bulk-status`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: ids, status: status })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${ids.length} ${section} status updated to ${status} successfully`, 'success');
                // Clear selection and reload data
                selectedItems[section] = [];
                loadSectionData(section, currentPage[section]);
            } else {
                showNotification(result.message || `Failed to update ${section} status`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error bulk updating ${section} status:`, error);
            showNotification(`Failed to update ${section} status. Please try again.`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    // Enhanced filter setup
    function setupSearchFilters() {
        // Search functionality
        document.querySelectorAll('.search-box input').forEach(input => {
            let searchTimeout;

            input.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                const section = this.closest('.admin-section').id;
                const searchTerm = this.value.trim();

                searchTimeout = setTimeout(() => {
                    loadSectionDataWithFilters(section, 1, searchTerm);
                }, 500);
            });
        });

        // Filter functionality
        document.querySelectorAll('.filter-select').forEach(select => {
            select.addEventListener('change', function() {
                const section = this.closest('.admin-section').id;
                loadSectionDataWithFilters(section, 1);
            });
        });
    }

    // Enhanced data loading with filters
    function loadSectionDataWithFilters(section, page = 1, search = '') {
        const filters = getCurrentFilters(section);
        loadSectionData(section, page, search, filters);
    }

    function getCurrentFilters(section) {
        const filters = {};

        switch(section) {
            case 'courses':
                const categoryFilter = document.getElementById('courseCategoryFilter');
                if (categoryFilter && categoryFilter.value) {
                    filters.category = categoryFilter.value;
                }
                break;

            case 'jobs':
                const jobTypeFilter = document.getElementById('jobTypeFilter');
                if (jobTypeFilter && jobTypeFilter.value) {
                    filters.type = jobTypeFilter.value;
                }
                break;

            case 'internships':
                const internshipTypeFilter = document.getElementById('internshipTypeFilter');
                if (internshipTypeFilter && internshipTypeFilter.value) {
                    filters.type = internshipTypeFilter.value;
                }
                break;

            case 'blog':
                const blogCategoryFilter = document.getElementById('blogCategoryFilter');
                if (blogCategoryFilter && blogCategoryFilter.value) {
                    filters.category = blogCategoryFilter.value;
                }
                break;

            case 'users':
                const userRoleFilter = document.getElementById('userRoleFilter');
                if (userRoleFilter && userRoleFilter.value) {
                    filters.role = userRoleFilter.value;
                }
                break;

            case 'messages':
                const messageStatusFilter = document.getElementById('messageStatusFilter');
                if (messageStatusFilter && messageStatusFilter.value) {
                    filters.status = messageStatusFilter.value;
                }
                break;

            case 'newsletter':
                const newsletterStatusFilter = document.getElementById('newsletterStatusFilter');
                if (newsletterStatusFilter && newsletterStatusFilter.value) {
                    filters.status = newsletterStatusFilter.value;
                }
                break;
        }

        return filters;
    }

    function setupPagination() {
        document.querySelectorAll('.pagination button').forEach(button => {
            button.addEventListener('click', function() {
                const section = this.closest('.admin-section').id;
                const action = this.getAttribute('data-action');

                if (action === 'prev' && currentPage[section] > 1) {
                    currentPage[section]--;
                    loadSectionData(section, currentPage[section]);
                } else if (action === 'next') {
                    currentPage[section]++;
                    loadSectionData(section, currentPage[section]);
                } else if (action === 'page') {
                    const page = parseInt(this.getAttribute('data-page'));
                    currentPage[section] = page;
                    loadSectionData(section, currentPage[section]);
                }
            });
        });
    }

    function updatePaginationInfo(section, totalItems, currentPageNum) {
        const paginationInfo = document.getElementById(`${section}PageInfo`);
        if (!paginationInfo) return;

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startItem = (currentPageNum - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPageNum * itemsPerPage, totalItems);

        paginationInfo.textContent = `Page ${currentPageNum} of ${totalPages}`;

        const prevBtn = document.getElementById(`prev${section.charAt(0).toUpperCase() + section.slice(1)}Page`);
        const nextBtn = document.getElementById(`next${section.charAt(0).toUpperCase() + section.slice(1)}Page`);

        if (prevBtn) prevBtn.disabled = currentPageNum === 1;
        if (nextBtn) nextBtn.disabled = currentPageNum === totalPages || totalPages === 0;
    }

    function showNotification(message, type = 'info', duration = 5000) {
        const notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const icons = {
            'success': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        };

        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${icons[type] || icons.info}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        notificationContainer.appendChild(notification);

        // Auto-hide after duration (except for warnings which stay longer)
        if (type !== 'warning' || duration > 0) {
            const timeout = setTimeout(() => {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            }, duration);

            // Add click to dismiss
            notification.querySelector('.notification-close').addEventListener('click', () => {
                clearTimeout(timeout);
                notification.classList.add('fade-out');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            });
        } else {
            // For warnings with duration 0 (persistent), only add click dismiss
            notification.querySelector('.notification-close').addEventListener('click', () => {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 500);
            });
        }
    }

    function showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    function hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function formatDate(dateString, includeTime = false) {
        if (!dateString) return 'N/A';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };

        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        return date.toLocaleDateString('en-US', options);
    }

    function setupGlobalErrorHandling() {
        // Store original fetch function
        const originalFetch = window.fetch;

        // Override fetch to handle session errors globally
        window.fetch = function(...args) {
            return originalFetch.apply(this, args)
                .then(response => {
                    if (response.status === 401) {
                        return response.json().then(data => {
                            if (data.requires_login) {
                                // Don't redirect immediately, just return the response
                                return response;
                            }
                            return response;
                        });
                    }
                    return response;
                })
                .catch(error => {
                    if (error.message.includes('Failed to fetch')) {
                        showNotification('Network error. Please check your connection.', 'error');
                    }
                    throw error;
                });
        };
    }

    // Newsletter form handling
    function handleNewsletterSubmit(e) {
        e.preventDefault();

        // Show loading state
        showLoading();

        // Simulate API call - replace with actual implementation
        setTimeout(() => {
            showNotification('Newsletter sent successfully!', 'success');
            closeModal();
            hideLoading();
        }, 1000);

        // Actual implementation would look like:
        fetch('/api/admin/newsletter/send', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification('Newsletter sent successfully!', 'success');
                closeModal();
            } else {
                showNotification(result.message || 'Failed to send newsletter', 'error');
            }
        })
        .catch(error => {
            console.error('Error sending newsletter:', error);
            showNotification('Failed to send newsletter', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }
});