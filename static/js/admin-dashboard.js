// admin-dashboard.js - Complete Production Ready Version with All Fixes
document.addEventListener('DOMContentLoaded', function() {
    // Constants
    const TOAST_DURATION = 5000;
    const DEBOUNCE_DELAY = 300;
    const MANAGED_SECTIONS = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter'];

    // DOM Elements
    const loadingOverlay = document.querySelector('.loading-overlay');
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmModalMessage');
    const confirmActionBtn = document.getElementById('confirmAction');
    const cancelConfirmBtn = document.getElementById('cancelConfirm');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const notificationCenter = document.createElement('div');
    const notificationCount = document.getElementById('notificationCount');

    // Current state
    let currentPage = {};
    let currentSection = 'dashboard';
    let pendingAction = null;
    let currentFilters = {};

    // Initialize the dashboard
    function initDashboard() {
        console.log('Initializing admin dashboard...');

        // Setup notification center
        notificationCenter.className = 'notification-center';
        document.body.appendChild(notificationCenter);

        // Initialize state
        MANAGED_SECTIONS.forEach(section => {
            currentPage[section] = 1;
            currentFilters[section] = {
                search: '',
                filter: ''
            };
        });

        // Setup components
        initSelect2();
        setupEventListeners();
        setupSidebar();
        addFormFieldFixes();

        // Load initial data
        loadInitialData();
        showWelcomeMessage();

        // Set default filters
        setDefaultFilters();

        console.log('Admin dashboard initialized successfully');
    }

    // Initialize Select2
    function initSelect2() {
        if (typeof $ !== 'undefined' && $.fn.select2) {
            try {
                $('select').select2({
                    minimumResultsForSearch: 10,
                    width: '100%'
                });

                $('#blogCategories').select2({
                    tags: true,
                    placeholder: 'Select categories',
                    allowClear: true
                });

                console.log('Select2 initialized successfully');
            } catch (error) {
                console.error('Select2 initialization error:', error);
            }
        } else {
            console.warn('Select2 not available, using native select elements');
        }
    }

    // Setup sidebar toggle
    function setupSidebar() {
        if (sidebarToggle && sidebar && mainContent) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                mainContent.classList.toggle('expanded');
                localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
            });

            // Restore sidebar state
            if (localStorage.getItem('sidebar-collapsed') === 'true') {
                sidebar.classList.add('collapsed');
                mainContent.classList.add('expanded');
            }
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        console.log('Setting up event listeners...');

        // Sidebar navigation
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const target = href.substring(1);
                    showSection(target);

                    // Load data for the section if not dashboard
                    if (target !== 'dashboard') {
                        fetchSectionData(target);
                    }
                }
            });
        });

        // View All links in dashboard stats
        document.querySelectorAll('.stat-card a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('href')?.substring(1);
                if (target) {
                    showSection(target);
                    fetchSectionData(target);
                }
            });
        });

        // Add buttons
        setupButtonListener('addCourseBtn', () => showModal('course'));
        setupButtonListener('addJobBtn', () => showModal('job'));
        setupButtonListener('addInternshipBtn', () => showModal('internship'));
        setupButtonListener('addBlogBtn', () => showModal('blog'));
        setupButtonListener('sendNewsletterBtn', () => showModal('newsletter'));

        // Search inputs
        setupSearchListener('courseSearch', () => filterTable('courses'));
        setupSearchListener('jobSearch', () => filterTable('jobs'));
        setupSearchListener('internshipSearch', () => filterTable('internships'));
        setupSearchListener('blogSearch', () => filterTable('blog'));
        setupSearchListener('userSearch', () => filterTable('users'));
        setupSearchListener('messageSearch', () => filterTable('messages'));
        setupSearchListener('subscriberSearch', () => filterTable('newsletter'));

        // Filter selects
        setupFilterListener('courseCategoryFilter', () => filterTable('courses'));
        setupFilterListener('jobTypeFilter', () => filterTable('jobs'));
        setupFilterListener('internshipTypeFilter', () => filterTable('internships'));
        setupFilterListener('blogCategoryFilter', () => filterTable('blog'));
        setupFilterListener('userRoleFilter', () => filterTable('users'));
        setupFilterListener('messageStatusFilter', () => filterTable('messages'));
        setupFilterListener('subscriberStatusFilter', () => filterTable('newsletter'));

        // Pagination
        MANAGED_SECTIONS.forEach(section => {
            setupButtonListener(`prev${capitalize(section)}Page`, () => navigatePage(section, -1));
            setupButtonListener(`next${capitalize(section)}Page`, () => navigatePage(section, 1));
        });

        // Bulk actions
        MANAGED_SECTIONS.forEach(section => {
            setupButtonListener(`apply${capitalize(section)}BulkAction`, () => applyBulkAction(section));
        });

        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => closeAllModals());
        });

        // Form submissions
        setupFormListener('courseForm', (e) => handleFormSubmit(e, 'courses'));
        setupFormListener('jobForm', (e) => handleFormSubmit(e, 'jobs'));
        setupFormListener('internshipForm', (e) => handleFormSubmit(e, 'internships'));
        setupFormListener('blogForm', (e) => handleFormSubmit(e, 'blog'));
        setupFormListener('userForm', (e) => handleFormSubmit(e, 'users'));
        setupFormListener('newsletterForm', (e) => handleFormSubmit(e, 'newsletter'));
        setupFormListener('messageReplyForm', (e) => handleFormSubmit(e, 'message_reply'));

        // Logout button
        const logoutLink = document.querySelector('.sidebar-menu a[href="/admin/logout"]');
        if (logoutLink) {
            logoutLink.addEventListener('click', function(e) {
                e.preventDefault();
                showConfirm('Are you sure you want to logout?', () => {
                    window.location.href = this.getAttribute('href');
                });
            });
        }

        // Notification bell
        const notificationBell = document.querySelector('.notification-bell');
        if (notificationBell) {
            notificationBell.addEventListener('click', () => {
                showSection('messages');
                fetchSectionData('messages');
            });
        }

        // Select all checkboxes
        MANAGED_SECTIONS.forEach(section => {
            const selectAll = document.getElementById(`selectAll${capitalize(section)}`);
            if (selectAll) {
                selectAll.addEventListener('change', function() {
                    const checkboxes = document.querySelectorAll(`#${section}TableBody .row-checkbox`);
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = this.checked;
                    });
                });
            }
        });

        // Confirm modal buttons
        if (cancelConfirmBtn) {
            cancelConfirmBtn.addEventListener('click', () => {
                confirmModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                pendingAction = null;
            });
        }

        if (confirmActionBtn) {
            confirmActionBtn.addEventListener('click', () => {
                if (pendingAction) {
                    pendingAction();
                }
                confirmModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                pendingAction = null;
            });
        }

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeAllModals();
                }
            });
        });

        console.log('Event listeners setup completed');
    }

    // Helper function to setup button listeners
    function setupButtonListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', callback);
        } else {
            console.warn(`Button with ID ${id} not found`);
        }
    }

    // Helper function to setup form listeners
    function setupFormListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('submit', callback);
        } else {
            console.warn(`Form with ID ${id} not found`);
        }
    }

    // Helper function to setup search listeners
    function setupSearchListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', debounce(callback, DEBOUNCE_DELAY));
        } else {
            console.warn(`Search input with ID ${id} not found`);
        }
    }

    // Helper function to setup filter listeners
    function setupFilterListener(id, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', callback);
        } else {
            console.warn(`Filter with ID ${id} not found`);
        }
    }

    // Load initial data
    function loadInitialData() {
        console.log('Loading initial data...');
        fetchDashboardStats();

        // Preload the first section (courses)
        fetchSectionData('courses');
    }

    // Fetch dashboard statistics
    async function fetchDashboardStats() {
        try {
            showLoading(true);
            const response = await fetch('/api/admin/dashboard-stats', {
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/admin/login';
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            updateStatsCards(data);

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            showNotification(`Error loading dashboard: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }

    // Update stats cards
    function updateStatsCards(stats) {
        if (!stats) return;

        const statCards = {
            'usersCount': stats.users,
            'coursesCount': stats.courses,
            'jobsCount': stats.jobs,
            'internshipsCount': stats.internships,
            'messagesCount': stats.unread_messages,
            'subscribersCount': stats.subscribers
        };

        for (const [id, value] of Object.entries(statCards)) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.parentElement.classList.add('updated');
                setTimeout(() => element.parentElement.classList.remove('updated'), 500);
            }
        }
    }

    // Show notification
    function showNotification(message, type = 'info') {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };

        const notification = document.createElement('div');
        notification.className = `notification notification-${type} show`;
        notification.innerHTML = `
            <i class="fas fa-${icons[type] || 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        `;

        notificationCenter.appendChild(notification);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });

        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, TOAST_DURATION);
    }

    // Loading Indicator
    function showLoading(show) {
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.style.display = 'flex';
                setTimeout(() => loadingOverlay.classList.add('active'), 10);
            } else {
                loadingOverlay.classList.remove('active');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300);
            }
        }
    }

    // Confirmation Dialog
    function showConfirm(message, callback) {
        if (!confirmModal || !confirmMessage || !confirmActionBtn) {
            console.error('Confirm modal elements not found');
            return;
        }

        confirmMessage.textContent = message;
        confirmModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        pendingAction = callback;
    }

    // Get CSRF Token
    function getCSRFToken() {
        return document.querySelector('meta[name="csrf-token"]')?.content || '';
    }

    // Format Date
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (e) {
            return dateString;
        }
    }

    // Debounce function for search inputs
    function debounce(func, timeout = DEBOUNCE_DELAY) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }

    // Capitalize first letter
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Show specific section
    function showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('active');
            currentSection = sectionId;

            // Update page title
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) {
                pageTitle.textContent = section.querySelector('h2').textContent;
            }
        }

        // Update active menu item
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            }
        });

        // Load data for the section if not dashboard
        if (sectionId !== 'dashboard') {
            fetchSectionData(sectionId);
        }
    }

    // Fetch Section Data
    async function fetchSectionData(section, page = 1, search = '', filters = {}) {
        showLoading(true);
        try {
            let url = `/api/admin/${section}?page=${page}`;

            if (search) {
                url += `&search=${encodeURIComponent(search)}`;
            }

            // Add filters
            for (const [key, value] of Object.entries(filters)) {
                if (value) {
                    url += `&${key}=${encodeURIComponent(value)}`;
                }
            }

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    window.location.href = '/admin/login';
                    return;
                }
                throw new Error(`Failed to load ${section}: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Ensure data is properly formatted
            if (!data || !Array.isArray(data.data)) {
                throw new Error('Invalid data format received from server');
            }

            renderTable(section, data.data);
            updatePagination(section, data.count, page, data.per_page || 10);

        } catch (error) {
            console.error(`Error loading ${section}:`, error);
            showNotification(`Error loading ${section}: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }

    // Filter table data
    function filterTable(section) {
        const searchInput = document.getElementById(`${section}Search`);
        const search = searchInput ? searchInput.value : '';

        let filter = '';
        let filterKey = 'filter';

        switch (section) {
            case 'courses':
                filter = document.getElementById('courseCategoryFilter').value;
                filterKey = 'category';
                break;
            case 'jobs':
                filter = document.getElementById('jobTypeFilter').value;
                filterKey = 'type';
                break;
            case 'internships':
                filter = document.getElementById('internshipTypeFilter').value;
                filterKey = 'type';
                break;
            case 'blog':
                filter = document.getElementById('blogCategoryFilter').value;
                filterKey = 'category';
                break;
            case 'users':
                filter = document.getElementById('userRoleFilter').value;
                filterKey = 'role';
                break;
            case 'messages':
                filter = document.getElementById('messageStatusFilter').value;
                filterKey = 'status';
                break;
            case 'newsletter':
                filter = document.getElementById('subscriberStatusFilter').value;
                filterKey = 'status';
                break;
        }

        // Update current filters
        currentFilters[section] = {
            search: search,
            filter: filter,
            filterKey: filterKey
        };

        currentPage[section] = 1;
        fetchSectionData(section, currentPage[section], search, { [filterKey]: filter });
    }

    // Navigate between pages
    function navigatePage(section, direction) {
        currentPage[section] += direction;
        if (currentPage[section] < 1) currentPage[section] = 1;

        const filters = currentFilters[section];
        fetchSectionData(section, currentPage[section], filters.search, { [filters.filterKey]: filters.filter });
    }

    // Update pagination info
    function updatePagination(section, totalItems, currentPage, perPage) {
        const totalPages = Math.ceil(totalItems / perPage) || 1;
        const pageInfo = document.querySelector(`#${section} .page-info`);

        if (pageInfo) {
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        }

        // Disable/enable prev/next buttons
        const prevBtn = document.getElementById(`prev${capitalize(section)}Page`);
        const nextBtn = document.getElementById(`next${capitalize(section)}Page`);

        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    }

    // Render Table Data
    function renderTable(section, items) {
        const tableBody = document.querySelector(`#${section}TableBody`);
        if (!tableBody) {
            console.error(`Table body for ${section} not found`);
            return;
        }

        if (items.length === 0) {
            const colSpan = section === 'messages' ? 8 : section === 'newsletter' ? 5 : 7;
            tableBody.innerHTML = `<tr><td colspan="${colSpan}" class="no-data">No data available</td></tr>`;
            return;
        }

        tableBody.innerHTML = items.map(item => generateTableRow(section, item)).join('');

        // Attach event listeners to dynamic elements
        attachTableEventListeners(section);
    }

    // Attach event listeners to table elements
    function attachTableEventListeners(section) {
        // Status toggles
        document.querySelectorAll(`#${section}TableBody .status-toggle`).forEach(toggle => {
            toggle.addEventListener('change', handleStatusToggle);
        });

        // Edit buttons
        document.querySelectorAll(`#${section}TableBody .edit-btn`).forEach(btn => {
            btn.addEventListener('click', handleEdit);
        });

        // Delete buttons
        document.querySelectorAll(`#${section}TableBody .delete-btn`).forEach(btn => {
            btn.addEventListener('click', handleDelete);
        });

        // Message-specific actions
        if (section === 'messages') {
            document.querySelectorAll(`#messagesTableBody .reply-btn`).forEach(btn => {
                btn.addEventListener('click', handleMessageReply);
            });

            document.querySelectorAll(`#messagesTableBody .view-btn`).forEach(btn => {
                btn.addEventListener('click', handleMessageView);
            });
        }
    }

    // Generate Table Row
    function generateTableRow(section, item) {
        let details = '';
        let extraColumns = '';

        if (section === 'courses') {
            details = `${item.category} | $${item.price}`;
            extraColumns = `<td>${item.duration || 'N/A'}</td>`;
        } else if (section === 'jobs') {
            details = `${item.company}`;
            extraColumns = `<td>${item.location}</td><td>${item.type}</td>`;
        } else if (section === 'internships') {
            details = `${item.company}`;
            extraColumns = `<td>${item.duration}</td><td>${item.stipend || 'N/A'}</td>`;
        } else if (section === 'blog') {
            details = item.author;
            extraColumns = `<td>${Array.isArray(item.categories) ? item.categories.join(', ') : item.categories || 'N/A'}</td><td>${formatDate(item.published_at)}</td>`;
        } else if (section === 'users') {
            details = item.email;
            extraColumns = `<td>${item.role}</td><td>${formatDate(item.created_at)}</td>`;
        } else if (section === 'messages') {
            details = item.email;
            extraColumns = `
                <td>${item.subject}</td>
                <td>${item.message.length > 50 ? item.message.substring(0, 50) + '...' : item.message}</td>
                <td><span class="status-badge ${item.status}">${item.status}</span></td>
                <td>${formatDate(item.created_at)}</td>
            `;
        } else if (section === 'newsletter') {
            details = item.email;
            extraColumns = `
                <td><span class="status-badge ${item.is_active ? 'active' : 'inactive'}">${item.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${formatDate(item.subscribed_at)}</td>
            `;
        }

        const statusToggle = section !== 'messages' && section !== 'newsletter' ? `
            <label class="switch">
                <input type="checkbox" class="status-toggle" data-id="${item.id}" ${item.is_active ? 'checked' : ''}>
                <span class="slider round"></span>
            </label>
        ` : '';

        const actions = section === 'messages' ? `
            <button class="btn-icon view-btn" data-id="${item.id}" title="View Message"><i class="fas fa-eye"></i></button>
            <button class="btn-icon reply-btn" data-id="${item.id}" data-email="${item.email}" title="Reply"><i class="fas fa-reply"></i></button>
            <button class="btn-icon delete-btn" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
        ` : section === 'newsletter' ? `
            <button class="btn-icon delete-btn" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
        ` : `
            <button class="btn-icon edit-btn" data-id="${item.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn-icon delete-btn" data-id="${item.id}" title="Delete"><i class="fas fa-trash"></i></button>
        `;

        return `
            <tr>
                <td><input type="checkbox" class="row-checkbox" value="${item.id}"></td>
                <td>${item.title || item.name || item.username || item.email || 'N/A'}</td>
                <td>${details}</td>
                ${extraColumns}
                <td>${statusToggle}</td>
                <td class="actions">
                    ${actions}
                </td>
            </tr>
        `;
    }

    // Handle Status Toggle
    async function handleStatusToggle(e) {
        const id = e.target.getAttribute('data-id');
        const isActive = e.target.checked;
        const section = e.target.closest('.admin-section').id;

        try {
            const response = await fetch(`/api/admin/${section}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCSRFToken()
                },
                body: JSON.stringify({ is_active: isActive })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update status');
            }

            showNotification('Status updated successfully', 'success');

            // Refresh dashboard stats if needed
            if (['messages', 'newsletter'].includes(section)) {
                fetchDashboardStats();
            }

        } catch (error) {
            console.error('Error updating status:', error);
            showNotification(`Error updating status: ${error.message}`, 'error');
            e.target.checked = !isActive; // Revert the toggle
        }
    }

    // Handle Edit
    function handleEdit(e) {
        const id = e.currentTarget.getAttribute('data-id');
        const section = e.currentTarget.closest('.admin-section').id;
        showModal(section, id);
    }

    // Handle Delete
    function handleDelete(e) {
        const id = e.currentTarget.getAttribute('data-id');
        const section = e.currentTarget.closest('.admin-section').id;

        showConfirm('Are you sure you want to delete this item?', async () => {
            try {
                const response = await fetch(`/api/admin/${section}/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-Token': getCSRFToken()
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'Failed to delete item');
                }

                showNotification('Item deleted successfully', 'success');

                // Refresh the table
                const filters = currentFilters[section];
                fetchSectionData(section, currentPage[section], filters.search, { [filters.filterKey]: filters.filter });

                // Refresh dashboard stats
                fetchDashboardStats();

            } catch (error) {
                console.error('Error deleting item:', error);
                showNotification(`Error deleting item: ${error.message}`, 'error');
            }
        });
    }

    // Handle Message Reply
    function handleMessageReply(e) {
        const id = e.currentTarget.getAttribute('data-id');
        const email = e.currentTarget.getAttribute('data-email');

        document.getElementById('messageId').value = id;
        document.getElementById('recipientEmail').value = email;
        document.getElementById('replySubject').value = 'Re: Your inquiry';

        showModal('message_reply');
    }

    // Handle Message View
    function handleMessageView(e) {
        const id = e.currentTarget.getAttribute('data-id');

        // In a real implementation, you would fetch and display the full message
        showNotification('View message functionality would show full message details here', 'info');
    }

    // Apply Bulk Action
    function applyBulkAction(section) {
        const selectedIds = Array.from(document.querySelectorAll(`#${section}TableBody .row-checkbox:checked`))
            .map(checkbox => checkbox.value);

        if (selectedIds.length === 0) {
            showNotification('Please select at least one item', 'warning');
            return;
        }

        const bulkActionSelect = document.getElementById(`${section}BulkAction`);
        const action = bulkActionSelect.value;

        if (!action) {
            showNotification('Please select an action', 'warning');
            return;
        }

        let message = '';
        let actionCallback = null;

        if (section === 'messages') {
            switch (action) {
                case 'mark_read':
                    message = 'Are you sure you want to mark the selected messages as read?';
                    actionCallback = () => performBulkAction(section, 'mark_read', selectedIds);
                    break;
                case 'mark_unread':
                    message = 'Are you sure you want to mark the selected messages as unread?';
                    actionCallback = () => performBulkAction(section, 'mark_unread', selectedIds);
                    break;
                case 'mark_replied':
                    message = 'Are you sure you want to mark the selected messages as replied?';
                    actionCallback = () => performBulkAction(section, 'mark_replied', selectedIds);
                    break;
                case 'delete':
                    message = 'Are you sure you want to delete the selected messages?';
                    actionCallback = () => performBulkAction(section, 'delete', selectedIds);
                    break;
            }
        } else if (section === 'newsletter') {
            switch (action) {
                case 'activate':
                    message = 'Are you sure you want to activate the selected subscribers?';
                    actionCallback = () => performBulkAction(section, 'activate', selectedIds);
                    break;
                case 'deactivate':
                    message = 'Are you sure you want to deactivate the selected subscribers?';
                    actionCallback = () => performBulkAction(section, 'deactivate', selectedIds);
                    break;
                case 'delete':
                    message = 'Are you sure you want to delete the selected subscribers?';
                    actionCallback = () => performBulkAction(section, 'delete', selectedIds);
                    break;
            }
        } else {
            // For other sections (courses, jobs, internships, blog, users)
            switch (action) {
                case 'activate':
                    message = 'Are you sure you want to activate the selected items?';
                    actionCallback = () => performBulkAction(section, 'activate', selectedIds);
                    break;
                case 'deactivate':
                    message = 'Are you sure you want to deactivate the selected items?';
                    actionCallback = () => performBulkAction(section, 'deactivate', selectedIds);
                    break;
                case 'delete':
                    message = 'Are you sure you want to delete the selected items?';
                    actionCallback = () => performBulkAction(section, 'delete', selectedIds);
                    break;
            }
        }

        if (actionCallback) {
            showConfirm(message, actionCallback);
        }
    }

    // Perform Bulk Action
    async function performBulkAction(section, action, ids) {
        try {
            let url = `/api/admin/${section}/bulk`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCSRFToken()
                },
                body: JSON.stringify({ action, ids })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to perform bulk action');
            }

            showNotification('Bulk action completed successfully', 'success');

            // Refresh the table
            const filters = currentFilters[section];
            fetchSectionData(section, currentPage[section], filters.search, { [filters.filterKey]: filters.filter });

            // Refresh dashboard stats if needed
            if (['messages', 'newsletter'].includes(section)) {
                fetchDashboardStats();
            }

        } catch (error) {
            console.error('Error performing bulk action:', error);
            showNotification(`Error performing bulk action: ${error.message}`, 'error');
        }
    }

    // Show Modal
    function showModal(type, id = null) {
        const modal = document.getElementById(`${type}Modal`);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';

            if (id) {
                // Load data for editing
                loadModalData(type, id);
            } else {
                // Clear form for new item
                const form = modal.querySelector('form');
                if (form) {
                    form.reset();
                    // Reset Select2 if available
                    if (typeof $ !== 'undefined' && $.fn.select2) {
                        $(form).find('select').trigger('change');
                    }
                }

                // Set modal title for new item
                const title = modal.querySelector('h2');
                if (title) {
                    title.textContent = title.textContent.replace('Edit', 'Add New');
                }
            }
        }
    }

    // Close All Modals
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
        pendingAction = null;
    }

    // Load Modal Data
    async function loadModalData(type, id) {
        try {
            showLoading(true);
            const response = await fetch(`/api/admin/${type}/${id}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to load data');
            }

            const data = await response.json();
            populateForm(type, data);

            // Set modal title for editing
            const modal = document.getElementById(`${type}Modal`);
            const title = modal.querySelector('h2');
            if (title) {
                title.textContent = title.textContent.replace('Add New', 'Edit');
            }

        } catch (error) {
            console.error('Error loading modal data:', error);
            showNotification(`Error loading data: ${error.message}`, 'error');
            closeAllModals();
        } finally {
            showLoading(false);
        }
    }

    // Populate Form
    function populateForm(type, data) {
        const form = document.getElementById(`${type}Form`);
        if (!form) return;

        Object.keys(data).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = data[key];
                } else if (input.type === 'select-multiple') {
                    // Handle multiple select
                    const values = Array.isArray(data[key]) ? data[key] : [data[key]];
                    Array.from(input.options).forEach(option => {
                        option.selected = values.includes(option.value);
                    });
                } else {
                    input.value = data[key] || '';
                }
            }
        });

        // Update Select2 if available
        if (typeof $ !== 'undefined' && $.fn.select2) {
            $(form).find('select').trigger('change');
        }
    }

    // Handle Form Submit
    async function handleFormSubmit(e, type) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Handle checkbox values
            form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                data[checkbox.name] = checkbox.checked;
            });

            // Handle multiple select values
            form.querySelectorAll('select[multiple]').forEach(select => {
                data[select.name] = Array.from(select.selectedOptions).map(option => option.value);
            });

            // Determine if this is an update or create
            const id = form.querySelector('[name="id"]')?.value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/admin/${type}/${id}` : `/api/admin/${type}`;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCSRFToken()
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to save data');
            }

            showNotification('Data saved successfully', 'success');
            closeAllModals();

            // Refresh the table
            const filters = currentFilters[type];
            fetchSectionData(type, currentPage[type], filters.search, { [filters.filterKey]: filters.filter });

            // Refresh dashboard stats if needed
            if (['messages', 'newsletter'].includes(type)) {
                fetchDashboardStats();
            }

        } catch (error) {
            console.error('Error saving data:', error);
            showNotification(`Error saving data: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }

    // Add form field fixes
    function addFormFieldFixes() {
        // Add character counters to textareas with maxlength
        document.querySelectorAll('textarea[maxlength]').forEach(textarea => {
            const maxLength = parseInt(textarea.getAttribute('maxlength'));
            const counter = document.createElement('div');
            counter.className = 'char-counter';
            counter.textContent = `0/${maxLength}`;
            textarea.parentNode.appendChild(counter);

            textarea.addEventListener('input', () => {
                const length = textarea.value.length;
                counter.textContent = `${length}/${maxLength}`;
                if (length > maxLength * 0.9) {
                    counter.classList.add('warning');
                } else {
                    counter.classList.remove('warning');
                }
            });
        });

        // Add file preview for image uploads
        document.querySelectorAll('input[type="file"][accept*="image"]').forEach(input => {
            input.addEventListener('change', function() {
                const preview = this.parentNode.querySelector('.image-preview');
                if (this.files && this.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        if (!preview) {
                            const newPreview = document.createElement('div');
                            newPreview.className = 'image-preview';
                            newPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                            input.parentNode.appendChild(newPreview);
                        } else {
                            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                        }
                    };
                    reader.readAsDataURL(this.files[0]);
                }
            });
        });
    }

    // Set default filters
    function setDefaultFilters() {
        // Set default date filters to current month
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        document.querySelectorAll('input[type="date"]').forEach(input => {
            if (input.id.includes('From')) {
                input.valueAsDate = firstDay;
            } else if (input.id.includes('To')) {
                input.valueAsDate = lastDay;
            }
        });
    }

    // Show welcome message
    function showWelcomeMessage() {
        const now = new Date();
        const hour = now.getHours();
        let greeting = 'Welcome back';

        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        showNotification(`${greeting}! Dashboard is ready.`, 'success');
    }

    // Initialize the dashboard
    initDashboard();
});