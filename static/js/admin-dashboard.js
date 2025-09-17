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
    let currentSection = 'dashboard';
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

    // Initialize the dashboard
    initDashboard();

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

        if (currentSection !== 'dashboard') {
            loadSectionData(currentSection);
        }
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

                    document.getElementById(targetSection).classList.add('active');

                    const sectionName = document.querySelector(`.sidebar-menu a[href="#${targetSection}"] span`).textContent;
                    document.getElementById('pageTitle').textContent = sectionName + ' Management';

                    currentSection = targetSection;

                    if (targetSection !== 'dashboard') {
                        loadSectionData(targetSection);
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
            });

            document.addEventListener('click', function(e) {
                if (!notificationBell.contains(e.target) && !notificationList.contains(e.target)) {
                    notificationList.classList.remove('show');
                }
            });

            const markAllReadBtn = document.querySelector('.mark-all-read');
            if (markAllReadBtn) {
                markAllReadBtn.addEventListener('click', function() {
                    markAllNotificationsAsRead();
                });
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
            const notificationItems = document.querySelector('.notification-items');
            const notificationCount = document.getElementById('notificationCount');

            if (!notificationItems) return;

            notificationItems.innerHTML = '';

            const unreadCount = notifications.filter(n => !n.is_read).length;
            notificationCount.textContent = unreadCount;
            notificationCount.style.display = unreadCount > 0 ? 'flex' : 'none';

            if (notifications.length === 0) {
                notificationItems.innerHTML = '<div class="no-notifications">No notifications</div>';
                return;
            }

            notifications.forEach(notification => {
                const notificationItem = document.createElement('div');
                notificationItem.className = `notification-item ${notification.is_read ? '' : 'unread'}`;

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

                notificationItems.appendChild(notificationItem);
            });
        })
        .catch(error => {
            console.error('Error loading notifications:', error);
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
                            <span class="status-text">${item.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <button class="btn-icon toggle-featured" data-id="${item.id}" data-featured="${item.is_featured || false}">
                            <i class="fas ${item.is_featured ? 'fa-star featured' : 'fa-star'}"></i>
                        </button>
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
                            <span class="status-text">${item.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <button class="btn-icon toggle-featured" data-id="${item.id}" data-featured="${item.is_featured || false}">
                            <i class="fas ${item.is_featured ? 'fa-star featured' : 'fa-star'}"></i>
                        </button>
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
                            <span class="status-text">${item.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <button class="btn-icon toggle-featured" data-id="${item.id}" data-featured="${item.is_featured || false}">
                            <i class="fas ${item.is_featured ? 'fa-star featured' : 'fa-star'}"></i>
                        </button>
                        <button class="btn-icon edit-item" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                break;

            case 'blog':
                html += `
                    <td>${escapeHTML(item.title)}</td>
                    <td>${escapeHTML(item.author)}</td>
                    <td>${escapeHTML(item.categories)}</td>
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
                        <button class="btn-icon toggle-featured" data-id="${item.id}" data-featured="${item.is_featured || false}">
                            <i class="fas ${item.is_featured ? 'fa-star featured' : 'fa-star'}"></i>
                        </button>
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
                        <button class="btn-icon view-message" data-id="${item.id}"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon reply-message" data-id="${item.id}" data-email="${item.email}"><i class="fas fa-reply"></i></button>
                        <button class="btn-icon delete-item" data-id="${item.id}"><i class="fas fa-trash"></i></button>
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
            replyMessageBtn.addEventListener('click', () => {
                const email = replyMessageBtn.getAttribute('data-email');
                openReplyModal(id, email);
            });
        }

        const statusToggle = row.querySelector('.status-toggle-checkbox');
        if (statusToggle) {
            statusToggle.addEventListener('change', () => {
                toggleStatus(section, id, statusToggle.checked);
            });
        }

        const featuredToggle = row.querySelector('.toggle-featured');
        if (featuredToggle) {
            featuredToggle.addEventListener('click', () => {
                const isFeatured = featuredToggle.getAttribute('data-featured') === 'true';
                toggleFeatured(section, id, !isFeatured);
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
    }

    // Toggle status (active/inactive)
    function toggleStatus(section, id, isActive) {
        showLoading();

        fetch(`/api/admin/${section}/${id}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: isActive })
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to update ${section} status`);
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${section.charAt(0).toUpperCase() + section.slice(1)} ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');

                // Update the status text in the UI
                const statusText = document.querySelector(`.status-toggle-checkbox[data-id="${id}"]`).closest('.status-toggle').querySelector('.status-text');
                if (statusText) {
                    statusText.textContent = isActive ? 'Active' : 'Inactive';
                }
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

    // Toggle featured status
    function toggleFeatured(section, id, isFeatured) {
        showLoading();

        fetch(`/api/admin/${section}/${id}/featured`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_featured: isFeatured })
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to update ${section} featured status`);
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${section.charAt(0).toUpperCase() + section.slice(1)} ${isFeatured ? 'added to' : 'removed from'} featured successfully`, 'success');

                // Update the featured icon in the UI
                const featuredBtn = document.querySelector(`.toggle-featured[data-id="${id}"]`);
                if (featuredBtn) {
                    featuredBtn.setAttribute('data-featured', isFeatured);
                    const icon = featuredBtn.querySelector('i');
                    if (icon) {
                        if (isFeatured) {
                            icon.classList.add('featured');
                        } else {
                            icon.classList.remove('featured');
                        }
                    }
                }
            } else {
                showNotification(result.message || `Failed to update ${section} featured status`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error updating ${section} featured status:`, error);
            showNotification(`Failed to update ${section} featured status`, 'error');
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
        document.getElementById('addCourseBtn')?.addEventListener('click', () => openAddModal('course'));
        document.getElementById('addJobBtn')?.addEventListener('click', () => openAddModal('job'));
        document.getElementById('addInternshipBtn')?.addEventListener('click', () => openAddModal('internship'));
        document.getElementById('addBlogBtn')?.addEventListener('click', () => openAddModal('blog'));
        document.getElementById('sendNewsletterBtn')?.addEventListener('click', () => openNewsletterModal());

        document.querySelectorAll('.close-modal').forEach(button => {
            button.addEventListener('click', closeModal);
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });
        });

        document.getElementById('courseForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'courses'));
        document.getElementById('jobForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'jobs'));
        document.getElementById('internshipForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'internships'));
        document.getElementById('blogForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'blog'));
        document.getElementById('userForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'users'));
        document.getElementById('newsletterForm')?.addEventListener('submit', (e) => handleNewsletterSubmit(e));
        document.getElementById('messageReplyForm')?.addEventListener('submit', (e) => handleMessageReplySubmit(e));

        document.getElementById('replyFromView')?.addEventListener('click', () => {
            const email = document.getElementById('viewMessageEmail').textContent;
            const messageId = document.getElementById('viewMessage').getAttribute('data-id');
            closeModal();
            openReplyModal(messageId, email);
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

            if (['course', 'job', 'internship', 'blog'].includes(type)) {
                const featuredField = form.querySelector('[name="is_featured"]');
                if (featuredField) {
                    featuredField.checked = true;
                }
            }
        }

        modal.style.display = 'block';
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

    function openReplyModal(id, email) {
        const modal = document.getElementById('messageReplyModal');
        if (!modal) return;

        document.getElementById('recipientEmail').value = email;
        document.getElementById('messageId').value = id;

        document.getElementById('replySubject').value = `Re: Your message`;

        modal.style.display = 'block';
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

    function setupForms() {
        document.querySelectorAll('.search-box input').forEach(input => {
            input.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') {
                    const section = this.closest('.admin-section').id;
                    const searchTerm = this.value.trim();
                    loadSectionData(section, 1, searchTerm);
                }
            });

            const searchBox = this.closest('.search-box');
            if (searchBox) {
                const clearBtn = document.createElement('button');
                clearBtn.innerHTML = '<i class="fas fa-times"></i>';
                clearBtn.style.cssText = 'position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6c757d;';
                clearBtn.addEventListener('click', () => {
                    input.value = '';
                    const section = input.closest('.admin-section').id;
                    loadSectionData(section, 1);
                });
                searchBox.appendChild(clearBtn);
            }
        });

        document.querySelectorAll('.filter-options select').forEach(select => {
            select.addEventListener('change', function() {
                const section = this.closest('.admin-section').id;
                const filterValue = this.value;
                const filterName = this.id.replace('Filter', '').toLowerCase();

                const filters = {};
                if (filterValue) {
                    filters[filterName] = filterValue;
                }

                loadSectionData(section, 1, '', filters);
            });
        });
    }

    function handleFormSubmit(e, type) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;

        Object.keys(data).forEach(key => {
            if (data[key] === 'on') {
                data[key] = true;
            } else if (data[key] === 'off') {
                data[key] = false;
            }
        });

        if (type === 'blog') {
            if (!data.hasOwnProperty('is_published')) {
                data.is_published = false;
            }

            if (data.is_published && !id) {
                data.published_at = new Date().toISOString();
            }
        }

        if (!id && ['courses', 'jobs', 'internships', 'blog'].includes(type)) {
            if (!data.hasOwnProperty('is_featured')) {
                data.is_featured = true;
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
            if (!response.ok) throw new Error(`Failed to ${id ? 'update' : 'create'} ${type}`);
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} ${id ? 'updated' : 'created'} successfully`, 'success');
                closeModal();
                form.reset();
                loadSectionData(type);
            } else {
                showNotification(result.message || `Failed to ${id ? 'update' : 'create'} ${type}`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error ${id ? 'updating' : 'creating'} ${type}:`, error);
            showNotification(`Failed to ${id ? 'update' : 'create'} ${type}`, 'error');
        });
    }

    function handleNewsletterSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        fetch('/api/admin/newsletter/send', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (!response.ok) throw new Error('Failed to send newsletter');
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification('Newsletter sent successfully', 'success');
                closeModal();
                form.reset();
            } else {
                showNotification(result.message || 'Failed to send newsletter', 'error');
            }
        })
        .catch(error => {
            console.error('Error sending newsletter:', error);
            showNotification('Failed to send newsletter', 'error');
        });
    }

    function handleMessageReplySubmit(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

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
                showNotification('Reply sent successfully', 'success');
                closeModal();
                form.reset();

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
            showNotification('Failed to send reply', 'error');
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

        fetch(`/api/admin/${section}/bulk-status`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: ids, is_active: isActive })
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to bulk update ${section} status`);
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showNotification(`${ids.length} ${section} ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
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

    function setupSearchFilters() {
        document.querySelectorAll('.search-box input').forEach(input => {
            const searchBtn = input.nextElementSibling;
            if (searchBtn && searchBtn.classList.contains('search-btn')) {
                searchBtn.addEventListener('click', () => {
                    const section = input.closest('.admin-section').id;
                    const searchTerm = input.value.trim();
                    loadSectionData(section, 1, searchTerm);
                });
            }
        });

        document.querySelectorAll('.filter-options select').forEach(select => {
            select.addEventListener('change', function() {
                const section = this.closest('.admin-section').id;
                const filterValue = this.value;
                const filterName = this.id.replace('Filter', '').toLowerCase();

                const filters = {};
                if (filterValue) {
                    filters[filterName] = filterValue;
                }

                loadSectionData(section, 1, '', filters);
            });
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

    function updatePaginationInfo(section, totalItems, currentPage) {
        const paginationInfo = document.getElementById(`${section}PageInfo`);
        if (!paginationInfo) return;

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);

        paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;

        const prevBtn = document.getElementById(`prev${section.charAt(0).toUpperCase() + section.slice(1)}Page`);
        const nextBtn = document.getElementById(`next${section.charAt(0).toUpperCase() + section.slice(1)}Page`);

        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
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
        const loading = document.querySelector('.loading-overlay');
        if (loading) loading.style.display = 'flex';
    }

    function hideLoading() {
        const loading = document.querySelector('.loading-overlay');
        if (loading) loading.style.display = 'none';
    }

    function formatDate(dateString, includeTime = false) {
        if (!dateString) return 'N/A';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }

        return date.toLocaleDateString('en-US', options);
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
});