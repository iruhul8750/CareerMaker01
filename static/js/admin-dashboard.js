document.addEventListener('DOMContentLoaded', function() {
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
        loadDashboardStats();
        loadNotifications();
        setupModals();
        setupForms();
        setupBulkActions();
        setupSearchFilters();
        setupPagination();
        setupSelect2();
        setupLogoPreview(); // Add this line

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

    // Display time-based welcome message
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

        const adminName = document.querySelector('.admin-name');
        if (adminName) {
            const welcomeElement = document.createElement('div');
            welcomeElement.className = 'welcome-message';
            welcomeElement.innerHTML = `<span>${greeting}, ${adminName.textContent}!</span>`;
            adminName.parentNode.insertBefore(welcomeElement, adminName.nextSibling);

            // Auto-hide after 5 seconds
            setTimeout(() => {
                welcomeElement.style.opacity = '0';
                setTimeout(() => welcomeElement.remove(), 500);
            }, 5000);
        }
    }

    function setupNavigation() {
        const menuItems = document.querySelectorAll('.sidebar-menu a');

        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
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

        const notificationBell = document.querySelector('.notification-bell');
        const notificationList = document.getElementById('notificationList');

        if (notificationBell && notificationList) {
            notificationBell.addEventListener('click', function(e) {
                e.stopPropagation();
                notificationList.classList.toggle('show');

                if (notificationList.classList.contains('show')) {
                    showAllNotifications = !showAllNotifications;
                    renderNotifications();
                }
            });

            document.addEventListener('click', function(e) {
                if (!notificationBell.contains(e.target) && !notificationList.contains(e.target)) {
                    notificationList.classList.remove('show');
                    showAllNotifications = false;
                    renderNotifications();
                }
            });

            const markAllReadBtn = document.querySelector('.mark-all-read');
            if (markAllReadBtn) {
                markAllReadBtn.addEventListener('click', function() {
                    markAllNotificationsAsRead();
                });
            }

            // Add view all toggle button
            const viewAllBtn = document.createElement('button');
            viewAllBtn.className = 'view-all-notifications';
            viewAllBtn.innerHTML = '<i class="fas fa-chevron-down"></i> View All';
            viewAllBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                showAllNotifications = !showAllNotifications;
                renderNotifications();
            });

            const notificationFooter = notificationList.querySelector('.notification-footer');
            if (notificationFooter) {
                notificationFooter.appendChild(viewAllBtn);
            }
        }
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

    function renderNotifications() {
        const notificationItems = document.querySelector('.notification-items');
        const notificationCount = document.getElementById('notificationCount');

        if (!notificationItems) return;

        notificationItems.innerHTML = '';

        // Limit displayed notifications based on showAllNotifications flag
        const displayedNotifications = showAllNotifications ? allNotifications : allNotifications.slice(0, 4);

        // Update notification count
        const unreadCount = allNotifications.filter(n => !n.is_read).length;
        const displayCount = Math.min(unreadCount, 4);
        notificationCount.textContent = displayCount > 0 ? displayCount : '';
        notificationCount.style.display = displayCount > 0 ? 'flex' : 'none';

        if (allNotifications.length === 0) {
            notificationItems.innerHTML = '<div class="no-notifications">No notifications</div>';
            return;
        }

        displayedNotifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = `notification-item ${notification.is_read ? '' : 'unread'}`;
            notificationItem.setAttribute('data-type', notification.type);
            notificationItem.setAttribute('data-id', notification.related_id);
            notificationItem.style.cursor = 'pointer';

            const formattedDate = formatDate(notification.created_at, true);

            notificationItem.innerHTML = `
                <div class="notification-icon">
                    <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <p>${notification.message}</p>
                    <small>${formattedDate}</small>
                </div>
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

        // Update view all button text
        const viewAllBtn = document.querySelector('.view-all-notifications');
        if (viewAllBtn) {
            viewAllBtn.innerHTML = showAllNotifications ?
                '<i class="fas fa-chevron-up"></i> Show Less' :
                '<i class="fas fa-chevron-down"></i> View All';
        }
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
                    <td>${escapeHTML(item.salary || 'N/A')}</td>
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
                e.stopPropagation(); // Prevent row click event
                const id = replyMessageBtn.getAttribute('data-id');
                const email = replyMessageBtn.getAttribute('data-email');
                const subject = replyMessageBtn.getAttribute('data-subject');
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
        const overlay = document.createElement('div');
        overlay.className = 'confirm-overlay';

        const card = document.createElement('div');
        card.className = `confirm-card ${type} enhanced`;

        let iconClass, title, defaultMessage;

        if (type === 'logout') {
            iconClass = 'fa-sign-out-alt';
            title = 'Confirm Logout';
            defaultMessage = 'Are you sure you want to logout? Any unsaved changes will be lost.';
        } else {
            iconClass = 'fa-trash-alt';
            title = 'Confirm Deletion';
            defaultMessage = 'Are you sure you want to delete this item? This action cannot be undone.';
        }

        card.innerHTML = `
            <i class="fas ${iconClass} confirm-icon"></i>
            <h3 class="confirm-title">${title}</h3>
            <p class="confirm-message">${message || defaultMessage}</p>
            <div class="confirm-actions">
                <button class="confirm-btn cancel">Cancel</button>
                <button class="confirm-btn confirm">${type === 'logout' ? 'Logout' : 'Delete'}</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Add event listeners
        overlay.querySelector('.confirm-btn.cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        overlay.querySelector('.confirm-btn.confirm').addEventListener('click', () => {
            if (confirmCallback) confirmCallback();
            document.body.removeChild(overlay);
        });

        // Close when clicking outside the card
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });
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
                        } else {
                            field.value = item[key] || '';
                        }
                    }
                });

                // Hide featured field since it's now controlled by active state
                if (['course', 'job', 'internship', 'blog'].includes(section)) {
                    const featuredField = form.querySelector('[name="is_featured"]');
                    if (featuredField) {
                        featuredField.parentNode.style.display = 'none';
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

    function openNewsletterModal() {
        const modal = document.getElementById('newsletterModal');
        if (!modal) return;

        const form = document.getElementById('newsletterForm');
        if (form) form.reset();

        modal.style.display = 'block';
    }

    function openReplyModal(id, email, subject = '') {
        const modal = document.getElementById('messageReplyModal');
        if (!modal) return;

        // Show loading state
        modal.classList.add('loading');

        // First, fetch the full message details to get original subject and date
        fetch(`/api/admin/messages/${id}`, {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch message details');
            return response.json();
        })
        .then(message => {
            // Remove loading state
            modal.classList.remove('loading');

            // Set the hidden fields
            document.getElementById('recipientEmail').value = email;
            document.getElementById('messageId').value = id;

            // Use original subject with "Re:" prefix
            const originalSubject = message.subject;
            const replySubject = `Re: ${originalSubject}`;
            document.getElementById('replySubject').value = replySubject;

            // Display header information
            document.getElementById('originalSender').textContent = `${message.name} <${message.email}>`;
            document.getElementById('originalSubject').textContent = originalSubject;
            document.getElementById('originalDate').textContent = formatDate(message.created_at, true);

            // Display static fields with clear labels
            document.getElementById('recipientEmailDisplay').querySelector('.field-value').textContent = email;
            document.getElementById('replySubjectDisplay').querySelector('.field-value').textContent = replySubject;

            // Clear and focus on message textarea
            const messageTextarea = document.getElementById('replyMessage');
            messageTextarea.value = '';

            // Add character counter
            messageTextarea.addEventListener('input', updateCharCount);

            modal.style.display = 'block';

            // Focus on the message textarea with slight delay
            setTimeout(() => {
                messageTextarea.focus();
                updateCharCount(); // Initial character count
            }, 100);

        })
        .catch(error => {
            console.error('Error loading message details:', error);
            modal.classList.remove('loading');

            // Fallback: use provided data if fetch fails
            document.getElementById('recipientEmail').value = email;
            document.getElementById('messageId').value = id;

            const replySubject = subject ? `Re: ${subject}` : 'Re: Your message';
            document.getElementById('replySubject').value = replySubject;

            document.getElementById('recipientEmailDisplay').querySelector('.field-value').textContent = email;
            document.getElementById('replySubjectDisplay').querySelector('.field-value').textContent = replySubject;

            document.getElementById('originalSender').textContent = 'Unknown sender';
            document.getElementById('originalSubject').textContent = subject || 'No subject';
            document.getElementById('originalDate').textContent = 'Unknown date';

            modal.style.display = 'block';
            setTimeout(() => document.getElementById('replyMessage').focus(), 100);
        });
    }

    // Enhanced character counter
    function updateCharCount() {
        const textarea = document.getElementById('replyMessage');
        const charCount = document.querySelector('.char-count');
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

            document.getElementById('viewMessageName').textContent = message.name;
            document.getElementById('viewMessageEmail').textContent = message.email;
            document.getElementById('viewMessageSubject').textContent = message.subject;
            document.getElementById('viewMessageDate').textContent = formatDate(message.created_at, true);
            document.getElementById('viewMessageStatus').textContent = message.status.charAt(0).toUpperCase() + message.status.slice(1);
            document.getElementById('viewMessageContent').textContent = message.message;

            // Fix: Set data-id attribute properly
            modal.setAttribute('data-id', message.id);

            modal.style.display = 'block';

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

    function closeModal() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
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

        // For courses, jobs, internships, and blog, sync featured state with active state
        if (['courses', 'jobs', 'internships', 'blog'].includes(type)) {
            data.is_featured = data.is_active;
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
                // Reload the current section to show the new item immediately
                loadSectionData(type, currentPage[type]);
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
        // If it's a content type with company field, ensure logo data is handled
        if (['job', 'internship', 'course'].includes(type) && data.company) {
            // The logo will be automatically fetched by the backend
            // based on the company name
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
            if (!response.ok) throw new Error('Failed to send reply');
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
        document.querySelectorAll('thead input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const section = this.id.replace('selectAll', '');
                if (!section) return;

                const sectionKey = section.toLowerCase();
                const rowCheckboxes = document.querySelectorAll(`#${sectionKey}TableBody .row-checkbox`);

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
            });
        });

        document.querySelectorAll('[id^="apply"][id$="BulkAction"]').forEach(button => {
            button.addEventListener('click', function() {
                const section = this.id.replace('apply', '').replace('BulkAction', '').toLowerCase();
                const action = document.getElementById(`${section}BulkAction`).value;

                if (selectedItems[section].length === 0) {
                    showNotification('Please select at least one item', 'warning');
                    return;
                }

                if (action === 'delete') {
                    showConfirmation('delete', `Are you sure you want to delete ${selectedItems[section].length} items? This action cannot be undone.`, () => {
                        performBulkDelete(section, selectedItems[section]);
                    });
                } else if (action === 'activate') {
                    performBulkStatusUpdate(section, selectedItems[section], true);
                } else if (action === 'deactivate') {
                    performBulkStatusUpdate(section, selectedItems[section], false);
                } else if (action === 'mark_read') {
                    performBulkMessageStatusUpdate(section, selectedItems[section], 'read');
                } else if (action === 'mark_unread') {
                    performBulkMessageStatusUpdate(section, selectedItems[section], 'unread');
                } else if (action === 'mark_replied') {
                    performBulkMessageStatusUpdate(section, selectedItems[section], 'replied');
                }
            });
        });
    }

    function performBulkDelete(section, ids) {
        showLoading();

        fetch(`/api/admin/${section}/bulk-delete`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: ids })
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to bulk delete ${section}`);
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${ids.length} ${section} deleted successfully`, 'success');
                selectedItems[section] = [];
                loadSectionData(section, currentPage[section]);
            } else {
                showNotification(result.message || `Failed to delete ${section}`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error bulk deleting ${section}:`, error);
            showNotification(`Failed to delete ${section}`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function performBulkStatusUpdate(section, ids, isActive) {
        showLoading();

        // For courses, jobs, internships, and blog, active state also controls featured state
        const updateData = { ids: ids, is_active: isActive };
        if (['courses', 'jobs', 'internships', 'blog'].includes(section)) {
            updateData.is_featured = isActive;
        }

        fetch(`/api/admin/${section}/bulk-status`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to bulk update ${section} status`);
            return response.json();
        })
        .then(result => {
            if (result.success) {
                const statusText = isActive ? 'activated & featured' : 'deactivated';
                showNotification(`${ids.length} ${section} ${statusText} successfully`, 'success');
                selectedItems[section] = [];
                loadSectionData(section, currentPage[section]);
            } else {
                showNotification(result.message || `Failed to update ${section} status`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error bulk updating ${section} status:`, error);
            showNotification(`Failed to update ${section} status`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function performBulkMessageStatusUpdate(section, ids, status) {
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
            if (!response.ok) throw new Error(`Failed to bulk update ${section} status`);
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${ids.length} ${section} status updated successfully`, 'success');
                selectedItems[section] = [];
                loadSectionData(section, currentPage[section]);
            } else {
                showNotification(result.message || `Failed to update ${section} status`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error bulk updating ${section} status:`, error);
            showNotification(`Failed to update ${section} status`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    function updateSelectAllCheckbox(section) {
        const selectAll = document.getElementById(`selectAll${section.charAt(0).toUpperCase() + section.slice(1)}`);
        if (!selectAll) return;

        const rowCheckboxes = document.querySelectorAll(`#${section}TableBody .row-checkbox`);
        selectAll.checked = rowCheckboxes.length > 0 && selectedItems[section].length === rowCheckboxes.length;
        selectAll.indeterminate = selectedItems[section].length > 0 && selectedItems[section].length < rowCheckboxes.length;
    }

    // FIXED: Search and filter setup with proper event delegation
    function setupSearchFilters() {
        // Add clear buttons to search boxes
        document.querySelectorAll('.search-box').forEach(box => {
            // Check if clear button already exists
            if (!box.querySelector('.search-clear')) {
                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.className = 'search-clear';
                clearBtn.innerHTML = '<i class="fas fa-times"></i>';
                clearBtn.style.cssText = 'position: absolute; right: 35px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6c757d; display: none;';

                box.appendChild(clearBtn);

                const input = box.querySelector('input');

                // Show/hide clear button based on input value
                input.addEventListener('input', function() {
                    clearBtn.style.display = this.value ? 'block' : 'none';
                });

                // Clear input when clear button is clicked
                clearBtn.addEventListener('click', function() {
                    input.value = '';
                    this.style.display = 'none';
                    const section = input.closest('.admin-section').id;
                    loadSectionData(section, 1);
                });
            }
        });
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
});