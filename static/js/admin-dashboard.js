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

    // Update the initDashboard function to include logo preview setup
    function initDashboard() {
        // Display time-based welcome message

        displayWelcomeMessage();
        setupNavigation();
        setupNotificationEvents();
        loadDashboardStats();
        loadNotifications();
        setupModals();
        setupForms();
        setupBulkActions();
        setupBulkActionButtons(); // Add this line
        setupSearchFilters();
        setupPagination();
        setupSelect2();
        setupLogoPreview();
        setupExpirationDates(); // Add this line
        setupExpirationDateFields(); // Add this
        loadExpiredContentStats(); // Add this line
        setupExpiredContentSection(); // Add this line



        // Load the last active section
        restoreCurrentSection();

        // Check session every 5 minutes
        setInterval(checkAdminSession, 5 * 60 * 1000);

        // Setup global AJAX error handling
        setupGlobalErrorHandling();
    }

    // Setup global AJAX error handling
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
                                showSessionExpiredMessage();
                                throw new Error('Session expired');
                            }
                            return response;
                        });
                    }
                    return response;
                })
                .catch(error => {
                    if (error.message.includes('Session expired')) {
                        // Already handled by showSessionExpiredMessage
                        throw error;
                    }
                    // For other errors, show a generic notification
                    showNotification('An error occurred. Please try again.', 'error');
                    throw error;
                });
        };
    }

    // FIXED: Properly restore current section on page refresh
    function restoreCurrentSection() {
        // First, remove active class from all menu items and sections
        document.querySelectorAll('.sidebar-menu a').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });

        // If we have a stored section and it's not dashboard, try to activate it
        if (currentSection && currentSection !== 'dashboard') {
            const menuItem = document.querySelector(`.sidebar-menu a[href="#${currentSection}"]`);
            const targetSection = document.getElementById(currentSection);

            if (menuItem && targetSection) {
                menuItem.classList.add('active');
                targetSection.classList.add('active');

                // Update page title
                const sectionName = menuItem.querySelector('span').textContent;
                document.getElementById('pageTitle').textContent = sectionName + ' Management';

                // Load section data
                loadSectionData(currentSection);
                return;
            }
        }

        // Default to dashboard if no valid section found
        const dashboardItem = document.querySelector('.sidebar-menu a[href="#dashboard"]');
        const dashboardSection = document.getElementById('dashboard');

        if (dashboardItem && dashboardSection) {
            dashboardItem.classList.add('active');
            dashboardSection.classList.add('active');
            document.getElementById('pageTitle').textContent = 'Admin Dashboard';
        }
    }

    // Initialize Select2 for multi-select dropdowns
    function setupSelect2() {
        if (typeof $ !== 'undefined' && $.fn.select2) {
            // Initialize Select2 for blog categories
            if ($('#blogCategories').length) {
                $('#blogCategories').select2({
                    placeholder: "Select categories",
                    allowClear: true,
                    width: '100%',
                    dropdownParent: $('#blogModal')
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

    function setupNavigation() {
        const menuItems = document.querySelectorAll('.sidebar-menu a');

        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                // Skip dark mode toggle (it's now handled separately)
                if (this.id === 'darkModeToggle' || this.closest('#darkModeToggle')) {
                    return;
                }

                if (this.getAttribute('href') === '/admin/logout') {
                    e.preventDefault();
                    showConfirmation('logout', 'Are you sure you want to logout?', () => {
                        // Clear any existing logout messages to prevent duplication
                        sessionStorage.removeItem('logoutMessage');

                        // Set a flag to indicate we're logging out programmatically
                        sessionStorage.setItem('logoutInitiated', 'true');

                        window.location.href = '/admin/logout';
                    });
                    return;
                }

                if (this.getAttribute('href').startsWith('#')) {
                    e.preventDefault();

                    menuItems.forEach(i => i.classList.remove('active'));
                    this.classList.add('active');

                    const targetSection = this.getAttribute('href').substring(1);

                    document.querySelectorAll('.admin-section').forEach(section => {
                        section.classList.remove('active');
                    });

                    const sectionElement = document.getElementById(targetSection);
                    if (sectionElement) {
                        sectionElement.classList.add('active');

                        const sectionName = this.querySelector('span').textContent;
                        document.getElementById('pageTitle').textContent = sectionName + ' Management';

                        currentSection = targetSection;
                        sessionStorage.setItem('currentSection', targetSection);

                        if (targetSection !== 'dashboard') {
                            loadSectionData(targetSection);
                        }
                    }
                }
            });
        });

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
            if (!response.ok) throw new Error('Failed to fetch dashboard stats');
            return response.json();
        })
        .then(data => {
            document.getElementById('usersCount').textContent = data.users || 0;
            document.getElementById('coursesCount').textContent = data.courses || 0;
            document.getElementById('jobsCount').textContent = data.jobs || 0;
            document.getElementById('internshipsCount').textContent = data.internships || 0;
            document.getElementById('messagesCount').textContent = data.unread_messages || 0;
            document.getElementById('subscribersCount').textContent = data.subscribers || 0;
        })
        .catch(error => {
            console.error('Error loading dashboard stats:', error);
            showNotification('Failed to load dashboard statistics', 'error');
        });
    }

    function loadSectionData(section, page = 1, search = '', filters = {}) {
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
            default:
                hideLoading();
                return;
        }

        fetch(`${endpoint}?${params.toString()}`, {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch ${section}`);
            return response.json();
        })
        .then(data => {
            renderTableData(section, data);
            updatePaginationInfo(section, data.count, page);
            hideLoading();
        })
        .catch(error => {
            console.error(`Error loading ${section}:`, error);
            showNotification(`Failed to load ${section}`, 'error');
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

        data.data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = generateTableRowHTML(section, item);
            tableBody.appendChild(row);

            addRowEventListeners(section, item.id, row);
        });

        selectedItems[section] = [];
        updateSelectAllCheckbox(section);
    }

    function generateTableRowHTML(section, item) {
        let html = `<td><input type="checkbox" class="row-checkbox" data-id="${item.id}"></td>`;

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
                        <button class="btn-icon edit-item" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
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
                        <button class="btn-icon edit-item" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
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
                        <button class="btn-icon edit-item" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
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
                        <button class="btn-icon edit-item" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
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
                        <button class="btn-icon edit-item" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
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
                        <button class="btn-icon view-message" data-id="${item.id}" title="View Message"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon reply-message" data-id="${item.id}" data-email="${escapeHTML(item.email)}" data-subject="${escapeHTML(item.subject)}" title="Reply"><i class="fas fa-reply"></i></button>
                        <button class="btn-icon delete-item" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
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
                        <button class="btn-icon delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                break;
        }

        return html;
    }

    function addRowEventListeners(section, id, row) {
        const editBtn = row.querySelector('.edit-item');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openEditModal(section, id);
            });
        }

        const deleteBtn = row.querySelector('.delete-item');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
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
            statusToggle.addEventListener('change', () => {
                toggleStatus(section, id, statusToggle.checked);
            });
        }

        const checkbox = row.querySelector('.row-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', () => {
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

    // Toggle status (active/inactive) - now handles both active and featured state
    function toggleStatus(section, id, isActive) {
        showLoading();

        // Fix section name for API endpoint
        let apiSection = section;
        if (section === 'blog') apiSection = 'blog_posts';
        if (section === 'newsletter') apiSection = 'newsletter_subscribers';

        // For courses, jobs, internships, and blog, active state also controls featured state
        const updateData = { is_active: isActive };
        if (['courses', 'jobs', 'internships', 'blog'].includes(section)) {
            updateData.is_featured = isActive;
        }

        fetch(`/api/admin/${apiSection}/${id}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to update ${section} status`);
            return response.json();
        })
        .then(result => {
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
            showNotification(`Failed to update ${section} status`, 'error');
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

    // Function to show confirmation card
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
                confirmText = 'Logout';
                confirmClass = 'logout';
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

        // Re-bind buttons
        setTimeout(() => {
            const cancelBtn = document.getElementById('cancelBtn');
            const confirmBtn = document.getElementById('confirmBtn');
            if (!cancelBtn || !confirmBtn) return;

            const newCancel = cancelBtn.cloneNode(true);
            const newConfirm = confirmBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
            confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

            newCancel.addEventListener('click', closeModal);
            newConfirm.addEventListener('click', () => {
                if (confirmCallback) confirmCallback();
                closeModal();
            });
        }, 10);
    }


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

        // Close modal buttons
        document.querySelectorAll('.close-modal').forEach(button => {
            button.addEventListener('click', closeModal);
        });

        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });
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

    // Update your openAddModal function to include expiration date setup
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

            // Set active to true by default for new items
            if (['course', 'job', 'internship', 'blog'].includes(type)) {
                const activeField = form.querySelector('[name="is_active"]');
                if (activeField) {
                    activeField.checked = true;
                }

                // Remove featured field since it's now controlled by active state
                const featuredField = form.querySelector('[name="is_featured"]');
                if (featuredField) {
                    featuredField.parentNode.style.display = 'none';
                }
            }

            // Setup expiration date field for relevant types
            if (['course', 'job', 'internship'].includes(type)) {
                const expirationField = form.querySelector('[name="expiration_date"]');
                if (expirationField) {
                    const today = new Date().toISOString().slice(0, 16);
                    expirationField.min = today;
                    expirationField.value = ''; // Clear for new items
                }
            }
        }

        modal.style.display = 'block';

        // Reinitialize Select2 for blog categories
        if (type === 'blog' && typeof $ !== 'undefined' && $.fn.select2) {
            setTimeout(() => {
                $('#blogCategories').select2({
                    placeholder: "Select categories",
                    allowClear: true,
                    width: '100%',
                    dropdownParent: $('#blogModal')
                });
            }, 100);
        }
    }

    // Update your openEditModal function to handle expiration dates for expired content
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
                            field.value = item[key].join(', ');
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

                // For expired content, show featured field and set it appropriately
                if (['course', 'job', 'internship', 'blog'].includes(section)) {
                    const featuredField = form.querySelector('[name="is_featured"]');
                    if (featuredField) {
                        featuredField.parentNode.style.display = 'block';
                        featuredField.checked = item.is_featured || false;
                    }
                }

                // Setup expiration date field
                if (['courses', 'jobs', 'internships'].includes(section)) {
                    const expirationField = form.querySelector('[name="expiration_date"]');
                    if (expirationField) {
                        const today = new Date().toISOString().slice(0, 16);
                        expirationField.min = today;
                    }
                }

                const titleElement = document.getElementById(`${section.slice(0, -1)}ModalTitle`);
                if (titleElement) {
                    titleElement.textContent = `Edit ${section.charAt(0).toUpperCase() + section.slice(1, -1)}`;
                }
            }

            modal.style.display = 'block';

            // Reinitialize Select2 for blog categories
            if (section === 'blog' && typeof $ !== 'undefined' && $.fn.select2) {
                setTimeout(() => {
                    $('#blogCategories').select2({
                        placeholder: "Select categories",
                        allowClear: true,
                        width: '100%',
                        dropdownParent: $('#blogModal')
                    });
                }, 100);
            }
        })
        .catch(error => {
            console.error(`Error loading ${section} item:`, error);
            showNotification(`Failed to load ${section} item`, 'error');
        });
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
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <i class="fas fa-check-circle" style="color: #28a745; font-size: 48px; margin-bottom: 15px;"></i>
                        <h3 style="color: #6c757d; margin: 0;">No Expired Content Found</h3>
                        <p style="color: #6c757d; margin: 10px 0 0 0;">All content is up to date and properly managed.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = expiredContent.map(item => {
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

                // Close modal after short delay
                setTimeout(() => {
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
                }, 1000);
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

    // Enhanced bulk status update function
    function performBulkStatusUpdate(section, ids, isActive) {
        if (!ids || ids.length === 0) {
            showNotification('No items selected', 'warning');
            return;
        }

        showLoading();

        // Fix section names for API endpoints
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

    function showNotification(message, type = 'info') {
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

        // Auto-hide after 5 seconds
        const timeout = setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 5000);

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

    // Add missing function for newsletter form submission
    function handleNewsletterSubmit(e) {
        e.preventDefault();
        showNotification('Newsletter functionality would be implemented here', 'info');
        closeModal();
    }
});