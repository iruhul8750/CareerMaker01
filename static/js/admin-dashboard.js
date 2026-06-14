    // ============================================
    // ========== 1. UTILITY & HELPER FUNCTIONS ==========
    // ============================================

    // Global variables
    let currentPage = {
        courses: 1,
        jobs: 1,
        internships: 1,
        blog: 1,
        users: 1,
        messages: 1,
        newsletter: 1,
        testimonials: 1,
        'expired-content': 1,
        trash: 1,
        admins: 1
    };

    let selectedItems = {
        courses: [],
        jobs: [],
        internships: [],
        blog: [],
        users: [],
        messages: [],
        newsletter: [],
        admins: []
    };

    let currentSection = sessionStorage.getItem('currentSection') || 'dashboard';
    const itemsPerPage = 10;

    // Expired content page
    let isLoadingExpiredContent = false;
    let expiredContentTotalCount = 0;

    // Helper function for escaping HTML
    function escapeHTML(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

    // Helper function to get days ago text
    function getDaysAgo(dateString) {
        if (!dateString) return '';

        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            const diffMinutes = Math.floor(diffTime / (1000 * 60));

            if (diffMinutes < 1) return 'Just now';
            if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
            if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
            return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
        } catch (error) {
            console.warn('Error calculating days ago:', error);
            return '';
        }
    }

    // Format date time (if needed)
    function formatDateTime(timestamp) {
        if (!timestamp) return 'N/A';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return timestamp;
        }
    }

    // Get time ago string
    function getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown';

        try {
            const now = new Date();
            const past = new Date(timestamp);
            const diffMs = now - past;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;

            return past.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (e) {
            return formatDateTime(timestamp);
        }
    }

    // Helper function: Get icon for activity type
    function getActivityIcon(type) {
        const icons = {
            'user': 'user-plus',
            'job': 'briefcase',
            'course': 'book',
            'internship': 'user-graduate',
            'message': 'envelope',
            'blog': 'blog',
            'newsletter': 'newspaper',
            'testimonial': 'comment',
            'default': 'info-circle'
        };
        return icons[type] || icons.default;
    }

    // Helper function: Format activity time
    function formatActivityTime(timestamp) {
        if (!timestamp) return 'Recently';

        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return 'Recently';
            }

            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} min ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

            // For older dates, show formatted date
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: diffDays > 365 ? 'numeric' : undefined
            });
        } catch (error) {
            console.warn('Error formatting activity time:', error);
            return 'Recently';
        }
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

    // Helper function to get display name
    function getDisplayName(contentType) {
        const names = {
            'course': 'Course',
            'job': 'Job',
            'internship': 'Internship',
            'blog': 'Blog Post',
            'testimonial': 'Testimonial',
            'user': 'User',
            'message': 'Message',
            'newsletter': 'Newsletter Subscriber',
            'admin': 'Admin'
        };
        return names[contentType] || contentType;
    }

    // Helper function to get state description
    function getStateDescription(contentType) {
        const hasFeatured = ['course', 'job', 'internship', 'blog'].includes(contentType);
        if (hasFeatured) {
            return 'inactive state (featured status will be removed)';
        }
        return 'inactive state';
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

    // ===== FORM FIELD VALIDATION HELPER FUNCTIONS =====

    /**
     * Shows error message below a form field and scrolls to it
     * @param {string} inputId - The ID of the input element
     * @param {string} message - The error message to display
     * @param {boolean} scrollToField - Whether to scroll to the field (default: true)
     */
    function showFieldError(inputId, message, scrollToField = true) {
        const input = document.getElementById(inputId);
        if (!input) return;

        // Add error class and styling
        input.classList.add('input-error');

        // Add error icon
        if (!input.parentElement.querySelector('.input-error-icon')) {
            const errorIcon = document.createElement('i');
            errorIcon.className = 'fas fa-exclamation-circle input-error-icon';
            errorIcon.style.cssText = 'position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--danger); font-size: 14px;';
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(errorIcon);
        }

        // Check if error span already exists
        let errorSpan = input.parentElement.querySelector('.field-error');
        if (!errorSpan) {
            errorSpan = document.createElement('small');
            errorSpan.className = 'field-error';
            errorSpan.style.cssText = 'display: block; color: var(--danger); font-size: 12px; margin-top: 5px;';
            input.parentElement.appendChild(errorSpan);
        }

        errorSpan.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        errorSpan.style.display = 'block';

        // Add error class to parent form-group
        const formGroup = input.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('error-group');
        }

        // Scroll to the error field within modal
        if (scrollToField) {
            scrollToErrorFieldInModal(input);
        }
    }

    /**
     * Scroll to error field with smooth animation
     * @param {HTMLElement} element - The element to scroll to
     */
    function scrollToErrorFieldInModal(element) {
        if (!element) return;

        // Find the modal body container
        const modalBody = element.closest('.modal-body');
        if (modalBody) {
            // Calculate position within modal body
            const elementPosition = element.getBoundingClientRect().top;
            const modalBodyPosition = modalBody.getBoundingClientRect().top;
            const offset = elementPosition - modalBodyPosition - 80;

            modalBody.scrollTo({
                top: modalBody.scrollTop + offset,
                behavior: 'smooth'
            });

            // Add highlight animation after scroll
            setTimeout(() => {
                element.style.transition = 'all 0.3s ease';
                element.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.4)';
                setTimeout(() => {
                    element.style.boxShadow = '';
                }, 1500);
            }, 300);
        } else {
            // Fallback: scroll to element
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }

    /**
     * Clears error message from a form field
     * @param {string} inputId - The ID of the input element
     */
    function clearFieldError(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        input.classList.remove('input-error');

        // Remove error icon
        const errorIcon = input.parentElement.querySelector('.input-error-icon');
        if (errorIcon) {
            errorIcon.remove();
        }

        const errorSpan = input.parentElement.querySelector('.field-error');
        if (errorSpan) {
            errorSpan.remove();
        }

        // Remove error class from parent form-group
        const formGroup = input.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('error-group');
        }
    }

    /**
     * Clears all field errors in a form
     * @param {Array} fieldIds - Array of input IDs to clear errors from
     */
    function clearAllFieldErrors(fieldIds) {
        if (fieldIds && Array.isArray(fieldIds)) {
            fieldIds.forEach(fieldId => clearFieldError(fieldId));
        }
    }

    // ============================================
    // ========== 2. LOADING & NOTIFICATION FUNCTIONS ==========
    // ============================================

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

    // Store notification timeouts for proper management
    let notificationTimeouts = new Map();
    let allNotifications = [];
    let showAllNotifications = false;

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

    // Micro loading functions
    function showCardLoading(cardId) {
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.add('loading');

            // Add micro loader to the stat number
            const statNumber = card.querySelector('.stat-number');
            if (statNumber) {
                // Store original value
                if (!statNumber.dataset.originalValue) {
                    statNumber.dataset.originalValue = statNumber.textContent;
                }

                // Create micro loader
                const loader = document.createElement('div');
                loader.className = 'micro-loader';
                loader.innerHTML = `
                    <div class="micro-loader-dots">
                        <div class="micro-loader-dot"></div>
                        <div class="micro-loader-dot"></div>
                        <div class="micro-loader-dot"></div>
                    </div>
                `;

                // Replace content with loader
                statNumber.innerHTML = '';
                statNumber.appendChild(loader);
            }
        }
    }

    function hideCardLoading(cardId, newValue = null) {
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.remove('loading');

            // Restore or update value
            const statNumber = card.querySelector('.stat-number');
            if (statNumber) {
                const value = newValue !== null ? newValue : (statNumber.dataset.originalValue || '0');
                statNumber.textContent = value;

                // Clear stored value
                if (statNumber.dataset.originalValue) {
                    delete statNumber.dataset.originalValue;
                }
            }
        }
    }

    // Show loading on all dashboard cards
    function showDashboardCardsLoading() {
        const cardIds = [
            'usersCard', 'coursesCard', 'jobsCard', 'internshipsCard',
            'blogPostsCard', 'messagesCard', 'subscribersCard',
            'testimonialsCard', 'expiredContentCard'
        ];

        cardIds.forEach(cardId => {
            showCardLoading(cardId);
        });
    }

    // Hide loading from all dashboard cards
    function hideDashboardCardsLoading() {
        const cardIds = [
            'usersCard', 'coursesCard', 'jobsCard', 'internshipsCard',
            'blogPostsCard', 'messagesCard', 'subscribersCard',
            'testimonialsCard', 'expiredContentCard'
        ];

        cardIds.forEach(cardId => {
            hideCardLoading(cardId);
        });
    }

    // Helper function: Show loading on stats
    function showStatsLoading() {
        const statIds = [
            'usersCount', 'coursesCount', 'jobsCount', 'internshipsCount',
            'blogPostsCount', 'messagesCount', 'subscribersCount',
            'testimonialsCount', 'expiredContentCount'
        ];

        statIds.forEach(statId => {
            const element = document.getElementById(statId);
            if (element) {
                // Store original value before showing loader
                if (!element.dataset.originalValue) {
                    element.dataset.originalValue = element.textContent;
                }
                element.textContent = '...';
                element.classList.add('loading');
            }
        });
    }

    // Helper function: Hide loading on stats
    function hideStatsLoading() {
        const statIds = [
            'usersCount', 'coursesCount', 'jobsCount', 'internshipsCount',
            'blogPostsCount', 'messagesCount', 'subscribersCount',
            'testimonialsCount', 'expiredContentCount'
        ];

        statIds.forEach(statId => {
            const element = document.getElementById(statId);
            if (element) {
                element.classList.remove('loading');
            }
        });
    }

    // Helper function: Set stats to 0 on error
    function setStatsToZero() {
        const statIds = [
            'usersCount', 'coursesCount', 'jobsCount', 'internshipsCount',
            'blogPostsCount', 'messagesCount', 'subscribersCount',
            'testimonialsCount', 'expiredContentCount'
        ];

        statIds.forEach(statId => {
            const element = document.getElementById(statId);
            if (element) {
                element.textContent = '0';
                if (element.dataset.originalValue) {
                    delete element.dataset.originalValue;
                }
            }
        });
    }

    // Helper function: Show loading in activities area
     function showActivitiesLoadingState() {
        const activityList = document.querySelector('.activity-list');
        if (!activityList) return;

        activityList.innerHTML = `
            <div class="activity-item loading">
                <div class="activity-icon">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="activity-content">
                    <p>Loading activities...</p>
                    <small>Fetching recent updates</small>
                </div>
            </div>
            <div class="activity-item loading">
                <div class="activity-icon">
                    <div class="pulse-dot"></div>
                </div>
                <div class="activity-content">
                    <p class="placeholder-text"></p>
                    <small class="placeholder-text"></small>
                </div>
            </div>
            <div class="activity-item loading">
                <div class="activity-icon">
                    <div class="pulse-dot"></div>
                </div>
                <div class="activity-content">
                    <p class="placeholder-text"></p>
                    <small class="placeholder-text"></small>
                </div>
            </div>
        `;
     }

    // Helper function: Show no activities message
    function showNoActivitiesMessage() {
        const activityList = document.querySelector('.activity-list');
        const activityCount = document.getElementById('activityCount');

        if (activityList) {
            activityList.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="activity-content">
                        <p>No recent activities</p>
                        <small>Activities will appear here automatically</small>
                    </div>
                </div>
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-envelope"></i>
                    </div>
                    <div class="activity-content">
                        <p>Check Messages</p>
                        <small>View and reply to user messages</small>
                    </div>
                </div>
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="activity-content">
                        <p>Manage Users</p>
                        <small>View recent user registrations</small>
                    </div>
                </div>
            `;
        }

        if (activityCount) {
            activityCount.textContent = '0';
        }
    }

    // Helper function: Show error in activities
    function showActivitiesErrorState() {
        const activityList = document.querySelector('.activity-list');
        if (!activityList) return;

        activityList.innerHTML = `
            <div class="activity-item error">
                <div class="activity-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="activity-content">
                    <p>Failed to load activities</p>
                    <small>Please try refreshing</small>
                </div>
            </div>
        `;
    }

    // Show analytics loading state
    function showAnalyticsLoading() {
        const statIds = ['totalVisitors', 'totalViews', 'weeklyVisitors', 'todayVisitors'];
        statIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                if (!element.dataset.originalValue) {
                    element.dataset.originalValue = element.textContent;
                }
                element.classList.add('loading');
                element.textContent = '...';
            }
        });
    }

    // Hide analytics loading state
    function hideAnalyticsLoading() {
        const statIds = ['totalVisitors', 'totalViews', 'weeklyVisitors', 'todayVisitors'];
        statIds.forEach(id => {
            const element = document.getElementById(id);
            if (element && element.classList.contains('loading')) {
                element.classList.remove('loading');
                if (element.dataset.originalValue && element.dataset.originalValue !== '...') {
                    element.textContent = element.dataset.originalValue;
                } else {
                    element.textContent = '0';
                }
                delete element.dataset.originalValue;
            }
        });
    }

    // ============================================
    // ========== 3. PAGINATION FUNCTIONS ==========
    // ============================================

    // Helper function to update pagination UI for any section
    function updatePaginationUI(section, currentPageNum, totalItems, itemsPerPageNum = 10) {
        const totalPages = Math.ceil(totalItems / itemsPerPageNum);
        const paginationContainer = document.querySelector(`#${section} .pagination`);
        if (!paginationContainer) return;

        // Clear container
        paginationContainer.innerHTML = '';

        // Check if mobile
        const isMobile = window.innerWidth <= 768;

        // Items count info - Show on BOTH desktop and mobile now
        const currentPageItems = Math.min(itemsPerPageNum, totalItems - (currentPageNum - 1) * itemsPerPageNum);
        const itemsInfo = document.createElement('span');
        itemsInfo.className = 'items-info';
        itemsInfo.textContent = totalItems === 0 ? '0/0' : `${currentPageItems}/${totalItems}`;
        paginationContainer.appendChild(itemsInfo);

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-outline prev-btn';
        if (isMobile) {
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prevBtn.title = 'Previous';
        } else {
            prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i><span>Prev</span>';
        }
        prevBtn.disabled = currentPageNum === 1 || totalPages === 0;
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPageNum > 1) {
                if (section === 'trash') {
                    currentTrashPage = currentPageNum - 1;
                    currentPage.trash = currentPageNum - 1;
                    loadTrashItems(currentPageNum - 1);
                } else {
                    loadPageForSection(section, currentPageNum - 1);
                }
            }
        });
        paginationContainer.appendChild(prevBtn);

        if (isMobile) {
            // MOBILE: Show ACTIVE PAGE NUMBER as a button
            const activePageBtn = document.createElement('button');
            activePageBtn.className = 'btn btn-primary active-page-number';
            activePageBtn.textContent = currentPageNum;
            activePageBtn.disabled = true;
            activePageBtn.title = `Page ${currentPageNum}`;
            paginationContainer.appendChild(activePageBtn);
        } else {
            // DESKTOP: Show full pagination with page numbers
            const paginationWrapper = document.createElement('div');
            paginationWrapper.className = 'pagination-wrapper';
            paginationWrapper.style.display = 'flex';
            paginationWrapper.style.alignItems = 'center';
            paginationWrapper.style.gap = '6px';

            // Generate page numbers for desktop
            let pages = [];

            if (totalPages === 0) {
                pages = [1];
            } else if (totalPages <= 5) {
                // Show all pages if 5 or fewer
                for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // Show pages with ellipsis
                pages.push(1);

                if (currentPageNum > 3) {
                    pages.push('...');
                }

                // Show pages around current page
                let startPage = Math.max(2, currentPageNum - 1);
                let endPage = Math.min(totalPages - 1, currentPageNum + 1);

                for (let i = startPage; i <= endPage; i++) {
                    if (i !== 1 && i !== totalPages) {
                        pages.push(i);
                    }
                }

                if (currentPageNum < totalPages - 2) {
                    pages.push('...');
                }

                pages.push(totalPages);
            }

            // Add page number buttons
            pages.forEach(page => {
                if (page === '...') {
                    const dots = document.createElement('span');
                    dots.className = 'page-ellipsis';
                    dots.textContent = '...';
                    dots.style.padding = '0 4px';
                    paginationWrapper.appendChild(dots);
                } else {
                    const pageBtn = document.createElement('button');
                    const isActive = (page === currentPageNum);
                    pageBtn.className = `btn ${isActive ? 'btn-primary' : 'btn-outline'} page-number`;
                    pageBtn.textContent = page;
                    pageBtn.style.minWidth = '36px';
                    pageBtn.style.padding = '6px 12px';

                    if (totalPages === 0) {
                        pageBtn.disabled = true;
                    }

                    pageBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (page !== currentPageNum && totalPages > 0) {
                            if (section === 'trash') {
                                currentTrashPage = page;
                                currentPage.trash = page;
                                loadTrashItems(page);
                            } else {
                                loadPageForSection(section, page);
                            }
                        }
                    });
                    paginationWrapper.appendChild(pageBtn);
                }
            });

            paginationContainer.appendChild(paginationWrapper);
        }

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-outline next-btn';
        if (isMobile) {
            nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            nextBtn.title = 'Next';
        } else {
            nextBtn.innerHTML = '<span>Next</span><i class="fas fa-chevron-right"></i>';
        }
        nextBtn.disabled = currentPageNum === totalPages || totalPages === 0;
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPageNum < totalPages) {
                if (section === 'trash') {
                    currentTrashPage = currentPageNum + 1;
                    currentPage.trash = currentPageNum + 1;
                    loadTrashItems(currentPageNum + 1);
                } else {
                    loadPageForSection(section, currentPageNum + 1);
                }
            }
        });
        paginationContainer.appendChild(nextBtn);
    }

    // Helper to create page button
    function createPageButtonForSection(section, pageNum, isActive = false) {
        const btn = document.createElement('button');
        btn.className = isActive ? 'btn btn-primary' : 'btn btn-outline';
        btn.textContent = pageNum;
        btn.style.minWidth = '36px';
        btn.style.padding = '6px 12px';
        if (isActive) {
            btn.style.backgroundColor = '#4a6cf7';
            btn.style.borderColor = '#4a6cf7';
            btn.style.color = 'white';
        }
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            loadPageForSection(section, pageNum);
        });
        return btn;
    }

    // Helper to load page for different sections
    function loadPageForSection(section, pageNum) {
        console.log(`Loading ${section} page ${pageNum}`);

        // Show loading indicator for all sections
        showLoading();

        if (section === 'testimonials') {
            if (window.testimonialManager) {
                window.testimonialManager.currentPage = pageNum;
                window.testimonialManager.loadTestimonialsData(pageNum);
            }
            return;
        }

        if (section === 'admins') {
            if (window.adminManager) {
                window.adminManager.currentPage = pageNum;
                window.adminManager.loadAdmins();
            }
            return;
        }

        if (section === 'expired-content') {
            currentExpiredPage = pageNum;
            loadExpiredContentData(pageNum);
            return;
        }

        if (section === 'trash') {
            currentTrashPage = pageNum;
            loadTrashItems(pageNum);
            return;
        }

        // Regular sections
        currentPage[section] = pageNum;
        const searchInput = document.querySelector(`#${section} .search-input`);
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        const filters = getCurrentFilters(section);
        loadSectionData(section, pageNum, searchTerm, filters);
    }

    function setupPagination() {
        console.log('🔄 Setting up pagination...');

        // For regular sections, ensure updatePaginationInfo calls the global UI
        window.updatePaginationInfo = function(section, totalItems, currentPageNum) {
            if (typeof updatePaginationUI === 'function') {
                updatePaginationUI(section, currentPageNum, totalItems, itemsPerPage);
            }
        };

        // For testimonial manager - override its pagination method
        if (window.testimonialManager) {
            window.testimonialManager.updatePaginationInfo = function(totalItems, currentPage, perPage) {
                if (typeof updatePaginationUI === 'function') {
                    updatePaginationUI('testimonials', currentPage, totalItems, perPage);
                }
            };
        }

        // For admin manager - override its pagination method
        if (window.adminManager) {
            const originalUpdatePagination = window.adminManager.updatePagination;
            window.adminManager.updatePagination = function(totalCount) {
                if (originalUpdatePagination) {
                    originalUpdatePagination.call(this, totalCount);
                }
                if (typeof updatePaginationUI === 'function') {
                    updatePaginationUI('admins', this.currentPage, totalCount, this.perPage);
                }
            };
        }

        // For expired content - override its pagination function
        if (typeof updateExpiredPaginationInfo === 'function') {
            window.updateExpiredPaginationInfo = function(totalItems, currentPage, perPage) {
                if (typeof updatePaginationUI === 'function') {
                    updatePaginationUI('expired-content', currentPage, totalItems, perPage || expiredItemsPerPage);
                }
            };
        }

        // For trash - override its pagination function
        if (typeof updateTrashPaginationInfo === 'function') {
            window.updateTrashPaginationInfo = function(totalItems, currentPage, perPage) {
                if (typeof updatePaginationUI === 'function') {
                    updatePaginationUI('trash', currentPage, totalItems, perPage || trashItemsPerPage);
                }
            };
        }

        console.log('✅ Pagination setup complete');
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

    // ============================================
    // ========== 4. BULK ACTIONS FUNCTIONS ==========
    // ============================================

    // Helper function to update header selected count display
    function updateHeaderSelectedCount(section, count) {
        const selectedCountId = {
            'courses': 'courseSelectedCountHeader',
            'jobs': 'jobSelectedCountHeader',
            'internships': 'internshipSelectedCountHeader',
            'blog': 'blogSelectedCountHeader',
            'testimonials': 'testimonialSelectedCountHeader',
            'newsletter': 'newsletterSelectedCountHeader',
            'expired-content': 'expiredSelectedCountHeader',
            'users': 'userSelectedCountHeader',
            'messages': 'messageSelectedCountHeader',
            'admins': 'adminSelectedCountHeader',
            'trash': 'trashSelectedCountHeader'
        }[section];

        const countElement = document.getElementById(selectedCountId);
        if (countElement) {
            if (count === 0) {
                countElement.textContent = '0 selected';
                countElement.style.color = '#666';
                countElement.style.fontWeight = 'normal';
            } else {
                countElement.textContent = `${count} selected`;
                countElement.style.color = '#4a6cf7';
                countElement.style.fontWeight = '600';
            }
        }
    }

    // Helper function to enable/disable bulk action button
    function setBulkActionButtonState(section, selectedCount) {
        const buttonMap = {
            'courses': 'applyCourseBulkActionHeader',
            'jobs': 'applyJobBulkActionHeader',
            'internships': 'applyInternshipBulkActionHeader',
            'blog': 'applyBlogBulkActionHeader',
            'users': 'applyUserBulkActionHeader',
            'messages': 'applyMessageBulkActionHeader',
            'newsletter': 'applyNewsletterBulkActionHeader',
            'testimonials': 'applyTestimonialBulkActionHeader',
            'admins': 'applyAdminBulkActionHeader',
            'expired-content': 'applyExpiredContentBulkActionHeader',
            'trash': 'applyTrashBulkActionHeader'
        };

        const buttonId = buttonMap[section];
        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = selectedCount === 0;
            if (selectedCount > 0) {
                button.style.opacity = '1';
            } else {
                button.style.opacity = '0.6';
            }
        }
    }

    // ===== HEADER BULK ACTIONS HANDLER =====
    function setupBulkActions() {
        console.log('🔄 Setting up header bulk actions...');

        // Helper function to get selected IDs for any section
        function getSelectedIds(section) {
            if (section === 'testimonials') {
                return window.testimonialManager ? window.testimonialManager.selectedIds : [];
            }
            if (section === 'admins') {
                return window.adminManager ? window.adminManager.selectedAdmins : [];
            }
            if (section === 'expired-content') {
                const selected = [];
                document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox:checked').forEach(cb => {
                    selected.push({
                        content_type: cb.getAttribute('data-type'),
                        content_id: cb.getAttribute('data-id')
                    });
                });
                return selected;
            }
            if (section === 'trash') {
                const selected = [];
                document.querySelectorAll('#trashTableBody .trash-item-checkbox:checked').forEach(cb => {
                    selected.push({
                        content_type: cb.getAttribute('data-type'),
                        content_id: cb.getAttribute('data-id'),
                        table_name: cb.getAttribute('data-table')
                    });
                });
                return selected;
            }
            return selectedItems[section] || [];
        }

        // Helper function to update header selected count display
        function updateHeaderSelectedCount(section, count) {
            const selectedCountId = {
                'courses': 'courseSelectedCountHeader',
                'jobs': 'jobSelectedCountHeader',
                'internships': 'internshipSelectedCountHeader',
                'blog': 'blogSelectedCountHeader',
                'testimonials': 'testimonialSelectedCountHeader',
                'newsletter': 'newsletterSelectedCountHeader',
                'expired-content': 'expiredSelectedCountHeader',
                'users': 'userSelectedCountHeader',
                'messages': 'messageSelectedCountHeader',
                'admins': 'adminSelectedCountHeader',
                'trash': 'trashSelectedCountHeader'
            }[section];

            const countElement = document.getElementById(selectedCountId);
            if (countElement) {
                if (count === 0) {
                    countElement.textContent = '0 selected';
                    countElement.style.color = '#666';
                    countElement.style.fontWeight = 'normal';
                } else {
                    countElement.textContent = `${count} selected`;
                    countElement.style.color = '#4a6cf7';
                    countElement.style.fontWeight = '600';
                }
            }
        }

        // ===== FUNCTION TO ATTACH ROW CHECKBOX LISTENERS =====
        function attachRowCheckboxListeners(section) {
            const tableBody = document.getElementById(`${section}TableBody`);
            if (!tableBody) return;

            const checkboxes = tableBody.querySelectorAll('.row-checkbox');

            checkboxes.forEach(checkbox => {
                // Remove existing listener by cloning
                const newCheckbox = checkbox.cloneNode(true);
                checkbox.parentNode.replaceChild(newCheckbox, checkbox);

                newCheckbox.addEventListener('change', function(e) {
                    e.stopPropagation();
                    const id = this.getAttribute('data-id');

                    if (!selectedItems[section]) selectedItems[section] = [];

                    if (this.checked) {
                        if (!selectedItems[section].includes(id)) {
                            selectedItems[section].push(id);
                        }
                    } else {
                        selectedItems[section] = selectedItems[section].filter(itemId => itemId !== id);
                    }

                    const selectedCount = selectedItems[section].length;
                    setBulkActionButtonState(section, selectedCount);
                    updateHeaderSelectedCount(section, selectedCount);
                    updateSelectAllState(section);
                });
            });
        }

        // ===== FUNCTION TO UPDATE SELECT ALL CHECKBOX STATE =====
        function updateSelectAllState(section) {
            const selectAllId = `selectAll${section.charAt(0).toUpperCase() + section.slice(1)}`;
            const selectAllCheckbox = document.getElementById(selectAllId);
            if (!selectAllCheckbox) return;

            const tableBody = document.getElementById(`${section}TableBody`);
            if (!tableBody) return;

            const totalCheckboxes = tableBody.querySelectorAll('.row-checkbox').length;
            const selectedCount = selectedItems[section] ? selectedItems[section].length : 0;

            selectAllCheckbox.checked = totalCheckboxes > 0 && selectedCount === totalCheckboxes;
            selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCheckboxes;
        }

        // ===== OVERRIDE THE EXISTING renderTableData TO ATTACH LISTENERS AFTER DATA LOAD =====
        // Save original renderTableData function
        const originalRenderTableData = window.renderTableData;

        // Override renderTableData
        window.renderTableData = function(section, data) {
            // Call original function first
            if (originalRenderTableData) {
                originalRenderTableData(section, data);
            }

            // After data is rendered, attach checkbox listeners for this section
            const regularSections = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter'];
            if (regularSections.includes(section)) {
                setTimeout(() => {
                    attachRowCheckboxListeners(section);
                    // Reset selected items for this section when new data loads
                    if (selectedItems[section]) {
                        selectedItems[section] = [];
                        updateHeaderSelectedCount(section, 0);
                        setBulkActionButtonState(section, 0);
                        updateSelectAllState(section);
                    }
                }, 100);
            }
        };

        // ===== SELECT ALL CHECKBOX HANDLERS FOR REGULAR SECTIONS =====
        const regularSections = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter'];

        regularSections.forEach(section => {
            const selectAllId = `selectAll${section.charAt(0).toUpperCase() + section.slice(1)}`;
            const selectAllCheckbox = document.getElementById(selectAllId);
            if (!selectAllCheckbox) return;

            const newSelectAll = selectAllCheckbox.cloneNode(true);
            selectAllCheckbox.parentNode.replaceChild(newSelectAll, selectAllCheckbox);

            newSelectAll.addEventListener('change', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const isChecked = this.checked;
                const tableBody = document.getElementById(`${section}TableBody`);
                if (!tableBody) return;

                const rowCheckboxes = tableBody.querySelectorAll('.row-checkbox');

                if (!selectedItems[section]) selectedItems[section] = [];

                if (isChecked) {
                    selectedItems[section] = [];
                    rowCheckboxes.forEach(checkbox => {
                        checkbox.checked = true;
                        const id = checkbox.getAttribute('data-id');
                        if (id && !selectedItems[section].includes(id)) {
                            selectedItems[section].push(id);
                        }
                    });
                } else {
                    rowCheckboxes.forEach(checkbox => {
                        checkbox.checked = false;
                    });
                    selectedItems[section] = [];
                }

                const selectedCount = selectedItems[section].length;
                setBulkActionButtonState(section, selectedCount);
                updateHeaderSelectedCount(section, selectedCount);
                updateSelectAllState(section);
            });
        });

        // ===== TESTIMONIALS SECTION HANDLING =====
        if (window.testimonialManager) {
            const originalUpdateBulkActionButton = window.testimonialManager.updateBulkActionButton;
            window.testimonialManager.updateBulkActionButton = function() {
                originalUpdateBulkActionButton.call(this);
                updateHeaderSelectedCount('testimonials', this.selectedIds.length);
                setBulkActionButtonState('testimonials', this.selectedIds.length);
            };
        }

        // ===== ADMINS SECTION HANDLING =====
        if (window.adminManager) {
            const originalUpdateBulkActionButton = window.adminManager.updateBulkActionButton;
            window.adminManager.updateBulkActionButton = function() {
                originalUpdateBulkActionButton.call(this);
                updateHeaderSelectedCount('admins', this.selectedAdmins.length);
                setBulkActionButtonState('admins', this.selectedAdmins.length);
            };
        }

        // ===== EXPIRED CONTENT SECTION HANDLING =====
        if (typeof updateSelectedExpiredItems === 'function') {
            const originalUpdateSelectedExpiredItems = updateSelectedExpiredItems;
            window.updateSelectedExpiredItems = function() {
                originalUpdateSelectedExpiredItems();
                updateHeaderSelectedCount('expired-content', selectedExpiredItems.length);
                setBulkActionButtonState('expired-content', selectedExpiredItems.length);
            };
        }

        // ===== TRASH SECTION HANDLING =====
        if (typeof updateSelectedTrashItems === 'function') {
            const originalUpdateSelectedTrashItems = updateSelectedTrashItems;
            window.updateSelectedTrashItems = function() {
                originalUpdateSelectedTrashItems();
                updateHeaderSelectedCount('trash', selectedTrashItems.length);
                setBulkActionButtonState('trash', selectedTrashItems.length);
            };
        }

        // ===== HEADER BULK ACTION BUTTON HANDLERS =====
        const headerBulkActions = [
            { btnId: 'applyCourseBulkActionHeader', section: 'courses', actionSelectId: 'courseBulkActionHeader' },
            { btnId: 'applyJobBulkActionHeader', section: 'jobs', actionSelectId: 'jobBulkActionHeader' },
            { btnId: 'applyInternshipBulkActionHeader', section: 'internships', actionSelectId: 'internshipBulkActionHeader' },
            { btnId: 'applyBlogBulkActionHeader', section: 'blog', actionSelectId: 'blogBulkActionHeader' },
            { btnId: 'applyTestimonialBulkActionHeader', section: 'testimonials', actionSelectId: 'testimonialBulkActionHeader' },
            { btnId: 'applyNewsletterBulkActionHeader', section: 'newsletter', actionSelectId: 'newsletterBulkActionHeader' },
            { btnId: 'applyExpiredContentBulkActionHeader', section: 'expired-content', actionSelectId: 'expiredContentBulkActionHeader' },
            { btnId: 'applyUserBulkActionHeader', section: 'users', actionSelectId: 'userBulkActionHeader' },
            { btnId: 'applyMessageBulkActionHeader', section: 'messages', actionSelectId: 'messageBulkActionHeader' },
            { btnId: 'applyAdminBulkActionHeader', section: 'admins', actionSelectId: 'adminBulkActionHeader' },
            { btnId: 'applyTrashBulkActionHeader', section: 'trash', actionSelectId: 'trashBulkActionHeader' }
        ];

        headerBulkActions.forEach(({ btnId, section, actionSelectId }) => {
            const button = document.getElementById(btnId);
            if (!button) return;

            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const actionSelect = document.getElementById(actionSelectId);
                const action = actionSelect ? actionSelect.value : '';

                if (!action) {
                    showNotification('Please select a bulk action first', 'warning');
                    return;
                }

                let selectedIds = getSelectedIds(section);

                if (selectedIds.length === 0) {
                    showNotification(`Please select at least one ${section} item`, 'warning');
                    return;
                }

                // Handle actions based on section
                if (section === 'testimonials') {
                    if (action === 'delete') {
                        showConfirmation('delete', `Delete ${selectedIds.length} testimonial(s)?`, () => {
                            window.testimonialManager.bulkDeleteTestimonials();
                        });
                    } else if (action === 'activate' || action === 'deactivate') {
                        const isActive = action === 'activate';
                        showConfirmation('bulk_action', `${action} ${selectedIds.length} testimonial(s)?`, () => {
                            window.testimonialManager.bulkUpdateTestimonialStatus(isActive);
                        });
                    }
                    return;
                }

                if (section === 'admins') {
                    if (action === 'delete') {
                        showConfirmation('delete', `Delete ${selectedIds.length} admin(s)?`, () => {
                            window.adminManager.bulkDelete(selectedIds);
                        });
                    } else if (action === 'activate' || action === 'deactivate') {
                        const isActive = action === 'activate';
                        showConfirmation('bulk_action', `${action} ${selectedIds.length} admin(s)?`, () => {
                            window.adminManager.bulkUpdateStatus(selectedIds, isActive);
                        });
                    }
                    return;
                }

                if (section === 'expired-content') {
                    if (action === 'reactivate') {
                        showConfirmation('bulk_reactivate', `Reactivate ${selectedIds.length} item(s)?`, () => {
                            bulkReactivateExpiredContent(selectedIds);
                        });
                    } else if (action === 'delete') {
                        showConfirmation('delete', `Delete ${selectedIds.length} item(s)?`, () => {
                            bulkDeleteExpiredContent(selectedIds);
                        });
                    }
                    return;
                }

                if (section === 'trash') {
                    if (action === 'restore') {
                        showConfirmation('bulk_action', `Restore ${selectedIds.length} item(s) from trash?`, () => {
                            bulkRestoreTrashItems(selectedIds);
                        });
                    } else if (action === 'delete') {
                        showConfirmation('delete', `Permanently delete ${selectedIds.length} item(s)?`, () => {
                            bulkPermanentlyDeleteTrashItems(selectedIds);
                        });
                    }
                    return;
                }

                // Regular sections
                if (action === 'delete') {
                    showConfirmation('delete', `Delete ${selectedIds.length} ${section}?`, () => {
                        performBulkDelete(section, selectedIds);
                    });
                } else if (action === 'activate' || action === 'deactivate') {
                    const isActive = action === 'activate';
                    showConfirmation('bulk_action', `${action} ${selectedIds.length} ${section}?`, () => {
                        performBulkStatusUpdate(section, selectedIds, isActive);
                    });
                } else if (action === 'mark_read' || action === 'mark_unread' || action === 'mark_replied') {
                    const status = action.replace('mark_', '');
                    showConfirmation('bulk_action', `Mark ${selectedIds.length} message(s) as ${status}?`, () => {
                        performBulkMessageStatusUpdate(section, selectedIds, status);
                    });
                }
            });
        });

        console.log('✅ Header bulk actions setup complete');
    }

    // ===== HELPER FUNCTION FOR BUTTON STATE - SINGLE SOURCE OF TRUTH =====
    function updateBulkButtonState(section, selectedCount) {
        // Map section to button ID
        const buttonMap = {
            'courses': 'applyCourseBulkAction',
            'jobs': 'applyJobBulkAction',
            'internships': 'applyInternshipBulkAction',
            'blog': 'applyBlogBulkAction',
            'users': 'applyUserBulkAction',
            'messages': 'applyMessageBulkAction',
            'newsletter': 'applyNewsletterBulkAction',
            'testimonials': 'applyTestimonialBulkAction',
            'admins': 'applyAdminBulkAction',
            'expired-content': 'applyExpiredContentBulkAction',
            'trash': 'applyTrashBulkAction'
        };

        const buttonId = buttonMap[section];
        if (!buttonId) return;

        const button = document.getElementById(buttonId);
        if (button) {
            button.disabled = selectedCount === 0;
            // Optional: Add visual feedback
            if (selectedCount > 0) {
                button.style.opacity = '1';
            } else {
                button.style.opacity = '0.6';
            }
        }
    }

    // Update the select all checkbox state
    function updateSelectAllCheckbox(section) {
        // Handle testimonial section separately
        if (section === 'testimonials') {
            const selectAll = document.getElementById('selectAllTestimonials');
            if (!selectAll) return;

            if (window.testimonialManager) {
                const totalCheckboxes = document.querySelectorAll('#testimonialsTableBody .testimonial-checkbox').length;
                const checkedCount = window.testimonialManager.selectedIds.length;

                selectAll.checked = totalCheckboxes > 0 && checkedCount === totalCheckboxes;
                selectAll.indeterminate = checkedCount > 0 && checkedCount < totalCheckboxes;
            }
            return;
        }

        // Handle admin section separately
        if (section === 'admins') {
            const selectAll = document.getElementById('selectAllAdmins');
            if (!selectAll) return;

            if (window.adminManager) {
                const totalCheckboxes = document.querySelectorAll('#adminsTableBody .admin-checkbox:not([disabled])').length;
                const checkedCount = window.adminManager.selectedAdmins.length;

                selectAll.checked = totalCheckboxes > 0 && checkedCount === totalCheckboxes;
                selectAll.indeterminate = checkedCount > 0 && checkedCount < totalCheckboxes;
            }
            return;
        }

        // Handle expired content section
        if (section === 'expired-content') {
            const selectAll = document.getElementById('selectAllExpired');
            if (!selectAll) return;

            const checkboxes = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox');
            const checkedCount = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox:checked').length;

            if (checkboxes.length > 0) {
                selectAll.checked = checkedCount === checkboxes.length;
                selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
            } else {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
            return;
        }

        // Handle trash section
        if (section === 'trash') {
            const selectAll = document.getElementById('selectAllTrash');
            if (!selectAll) return;

            const checkboxes = document.querySelectorAll('#trashTableBody .trash-item-checkbox');
            const checkedCount = document.querySelectorAll('#trashTableBody .trash-item-checkbox:checked').length;

            if (checkboxes.length > 0) {
                selectAll.checked = checkedCount === checkboxes.length;
                selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
            } else {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
            return;
        }

        // Handle regular sections
        const sectionId = section.charAt(0).toUpperCase() + section.slice(1);
        const selectAll = document.getElementById(`selectAll${sectionId}`);
        if (!selectAll) return;

        const tableBody = document.getElementById(`${section}TableBody`);
        if (!tableBody) return;

        const rowCheckboxes = tableBody.querySelectorAll('.row-checkbox');
        const checkedCount = selectedItems[section] ? selectedItems[section].length : 0;

        selectAll.checked = rowCheckboxes.length > 0 && checkedCount === rowCheckboxes.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < rowCheckboxes.length;
    }

    // Soft bulk delete function
    function performBulkDelete(section, ids) {
        if (!ids || ids.length === 0) {
            showNotification('No items selected for deletion', 'warning');
            return;
        }

        showLoading();

        // Map section to API endpoint - using correct backend endpoints
        let apiSection = section;
        let endpoint = `/api/admin/${apiSection}/bulk-delete`;

        // Special handling for different resource types
        if (section === 'blog') {
            apiSection = 'blog';
            endpoint = '/api/admin/blog/bulk-delete';
        } else if (section === 'newsletter') {
            apiSection = 'newsletter';
            endpoint = '/api/admin/newsletter/bulk-delete';
        } else if (section === 'users') {
            apiSection = 'users';
            endpoint = '/api/admin/users/bulk-delete';
        } else if (section === 'messages') {
            apiSection = 'messages';
            endpoint = '/api/admin/messages/bulk-delete';
        } else if (section === 'testimonials') {
            apiSection = 'testimonials';
            endpoint = '/api/admin/testimonials/bulk-delete';
        }

        console.log(`Bulk deleting ${section} with IDs: ${ids} using endpoint: ${endpoint}`);

        fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ ids: ids })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || `Failed to delete ${section}`);
                });
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                const message = result.moved_to_trash !== false ?
                    `${ids.length} ${section} moved to trash` :
                    `${ids.length} ${section} deleted successfully`;
                showNotification(message, 'success');

                // Clear selection
                if (selectedItems[section]) {
                    selectedItems[section] = [];
                }
                updateSelectAllCheckbox(section);
                updateBulkButtonState(section, 0);

                // Reload the current section to reflect changes
                if (section === 'testimonials') {
                    if (window.testimonialManager) {
                        window.testimonialManager.loadTestimonialsData(1);
                    }
                } else if (section === 'admins') {
                    if (window.adminManager) {
                        window.adminManager.loadAdmins();
                    }
                } else {
                    loadSectionData(section, currentPage[section]);
                }

                // Update dashboard stats (including trash count)
                loadDashboardStats();
                loadTrashStats(true);

                // If we're in the trash section, refresh it
                if (currentSection === 'trash') {
                    loadTrashItems(currentTrashPage);
                }
            } else {
                showNotification(result.message || `Failed to delete ${section}`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error bulk deleting ${section}:`, error);
            showNotification(error.message || `Failed to delete ${section}. Please try again.`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    // bulk status update function
    function performBulkStatusUpdate(section, ids, isActive) {
        if (!ids || ids.length === 0) {
            showNotification('No items selected', 'warning');
            return;
        }

        showLoading();

        // Fix section names for API endpoints - matches backend
        let apiSection = section;
        let endpoint = `/api/admin/${apiSection}/bulk-status`;

        // Special handling for blog posts (uses blog_posts table)
        if (section === 'blog') {
            apiSection = 'blog_posts';
            endpoint = '/api/admin/blog_posts/bulk-status';
        }
        // Special handling for newsletter subscribers
        else if (section === 'newsletter') {
            apiSection = 'newsletter_subscribers';
            endpoint = '/api/admin/newsletter_subscribers/bulk-status';
        }
        // Special handling for users
        else if (section === 'users') {
            apiSection = 'users';
            endpoint = '/api/admin/users/bulk-status';
        }

        console.log(`Bulk status update: ${section} -> ${apiSection}, isActive: ${isActive}`);

        fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ ids: ids, is_active: isActive })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                const statusText = isActive ? 'activated' : 'deactivated';
                showNotification(`${ids.length} ${section} ${statusText} successfully`, 'success');

                // Clear selection
                if (selectedItems[section]) {
                    selectedItems[section] = [];
                }
                updateSelectAllCheckbox(section);
                updateBulkButtonState(section, 0);

                // Reload the section data
                if (section === 'testimonials') {
                    if (window.testimonialManager) {
                        window.testimonialManager.loadTestimonialsData(1);
                    }
                } else if (section === 'admins') {
                    if (window.adminManager) {
                        window.adminManager.loadAdmins();
                    }
                } else {
                    loadSectionData(section, currentPage[section]);
                }
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

    // bulk message status update function
    function performBulkMessageStatusUpdate(section, ids, status) {
        if (!ids || ids.length === 0) {
            showNotification('No items selected', 'warning');
            return;
        }

        showLoading();

        console.log(`Bulk updating ${section} status to ${status} for IDs:`, ids);

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
                if (selectedItems[section]) {
                    selectedItems[section] = [];
                }
                updateBulkButtonState(section, 0);
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

    // ============================================
    // ========== 5. DASHBOARD STATS & DATA LOADING ==========
    // ============================================

    // loadDashboardStats
    function loadDashboardStats() {
        console.log('📊 Loading dashboard stats and activities...');

        // Show loading state on stats
        showStatsLoading();

        // Show loading in activities area
        showActivitiesLoadingState();

        return fetch('/api/admin/dashboard-stats', {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                console.error(`❌ HTTP ${response.status}: Failed to fetch dashboard stats`);
                throw new Error(`HTTP ${response.status}: Failed to fetch dashboard stats`);
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ Dashboard stats received');

            // Update all dashboard stats
            updateDashboardStats(data);

            // Update messages menu badge with unread count
            updateMessagesMenuBadge(data.unread_messages || 0);

            // Update activities if available
            if (data.activities && Array.isArray(data.activities)) {
                console.log(`📝 Found ${data.activities.length} activities`);
                updateActivitiesDisplay(data.activities);
            } else {
                console.log('📝 No activities data in response');
                showNoActivitiesMessage();
            }

            return data;
        })
        .catch(error => {
            console.error('❌ Error in loadDashboardStats:', error);

            // Show error state in activities
            showActivitiesErrorState();

            // Set stats to 0 on error
            setStatsToZero();

            throw error;
        })
        .finally(() => {
            // Hide loading states
            hideStatsLoading();

            // Always load trash stats separately (with micro loader)
            loadTrashStats(true);
        });
    }

    // Helper function: Update dashboard stats
    function updateDashboardStats(data) {
        const stats = {
            'usersCount': data.users || 0,
            'coursesCount': data.courses || 0,
            'jobsCount': data.jobs || 0,
            'internshipsCount': data.internships || 0,
            'blogPostsCount': data.blog_posts || 0,
            'messagesCount': data.unread_messages || 0,
            'subscribersCount': data.subscribers || 0,
            'testimonialsCount': data.testimonials || 0,
            'expiredContentCount': data.total_expired || 0
        };

        Object.keys(stats).forEach(statId => {
            const element = document.getElementById(statId);
            if (element) {
                element.textContent = stats[statId];
                // Clear stored value
                if (element.dataset.originalValue) {
                    delete element.dataset.originalValue;
                }
            }
        });
    }

    function loadSectionData(section, page = 1, search = '', filters = {}) {
        console.log(`🔄 Loading section: ${section}, page: ${page}, search: "${search}", filters:`, filters);

        // Handle testimonials section separately
        if (section === 'testimonials') {
            console.log('🎯 Using testimonial manager for testimonials section');
            if (window.testimonialManager) {
                if (!window.testimonialManager.isInitialized) {
                    window.testimonialManager.init();
                } else {
                    window.testimonialManager.loadTestimonialsData(page);
                }
            }
            return Promise.resolve();
        }

        if (section === 'messages') {
            // After loading messages, update the badge
            fetch('/api/admin/dashboard-stats', { credentials: 'include' })
                .then(response => response.json())
                .then(data => {
                    updateMessagesMenuBadge(data.unread_messages || 0);
                })
                .catch(error => console.error('Error updating messages badge:', error));
        }

        // Handle expired-content section separately
        if (section === 'expired-content') {
            console.log('⏰ Loading expired content section');
            currentExpiredPage = page;
            return loadExpiredContentData(page, search);
        }

        // Handle trash section separately
        if (section === 'trash') {
            console.log('🗑️ Loading trash section');
            currentTrashPage = page;
            return loadTrashItems(page, search);
        }

        showLoading();

        let endpoint = '';
        let params = new URLSearchParams();

        params.append('page', page);
        params.append('per_page', itemsPerPage);

        // Add search parameter if provided
        if (search && search.trim() !== '') {
            params.append('search', search.trim());
        }

        // Add all filters to params
        Object.keys(filters).forEach(key => {
            if (filters[key] && filters[key] !== '') {
                params.append(key, filters[key]);
                console.log(`📌 Adding filter: ${key}=${filters[key]}`);
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
            case 'admins':
                endpoint = '/api/admin/admins/list';
                break;
            default:
                console.warn(`❌ Unknown section: ${section}`);
                hideLoading();
                return Promise.reject(`Unknown section: ${section}`);
        }

        console.log(`📡 Fetching from: ${endpoint}?${params.toString()}`);

        return fetch(`${endpoint}?${params.toString()}`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.message || `HTTP ${response.status}: Failed to fetch ${section}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log(`✅ Successfully loaded ${section} data:`, data);
            renderTableData(section, data);
            if (typeof updatePaginationInfo === 'function') {
                updatePaginationInfo(section, data.count, page);
            }

            // Show success notification (optional - can be removed for silent loads)
            const itemCount = data.data ? data.data.length : 0;
            showNotification(`Loaded ${itemCount} ${section} items`, 'success');
        })
        .catch(error => {
            console.error(`❌ Error loading ${section}:`, error);
            showNotification(`Failed to load ${section}: ${error.message}`, 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    // Enhanced data loading with filters
    function loadSectionDataWithFilters(section, page = 1, search = '') {
        const filters = getCurrentFilters(section);
        loadSectionData(section, page, search, filters);
    }

    function renderTableData(section, data) {
        const tableBody = document.getElementById(`${section}TableBody`);
        if (!tableBody) return;

        tableBody.innerHTML = '';

        if (!data.data || data.data.length === 0) {
            const colSpan = document.querySelector(`#${section} thead tr`)?.cells.length || 8;
            tableBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 20px;">No data found</td></tr>`;
            return;
        }

        data.data.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = generateTableRowHTML(section, item, index);
            tableBody.appendChild(row);
            addRowEventListeners(section, item.id, row); // This ensures event listeners are added for EVERY row including search results
        });

        selectedItems[section] = [];
        updateSelectAllCheckbox(section);
        updateBulkButtonState(section, 0);
        updateHeaderSelectedCount(section, 0);
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

            case 'admins':
                const roleText = item.is_superadmin ? 'Super Admin' : 'Admin';
                const roleIcon = item.is_superadmin ? '<i class="fas fa-crown"></i>' : '<i class="fas fa-user-shield"></i>';
                const roleClass = item.is_superadmin ? 'superadmin-role' : 'admin-role';
                const fullName = item.full_name || item.username || 'N/A';

                html += `
                    <td><strong>${escapeHTML(fullName)}</strong></td>
                    <td>${escapeHTML(item.username || 'N/A')}</td>
                    <td style="word-break: break-all;">${escapeHTML(item.email || 'N/A')}</td>
                    <td><span class="role-badge ${roleClass}">${roleIcon} ${roleText}</span></td>
                    <td>${formatDate(item.created_at)}</td>
                    <td>${item.last_login ? formatDate(item.last_login, true) : 'Never'}</td>
                    <td>
                        <div class="status-toggle">
                            <label class="switch">
                                <input type="checkbox" class="status-toggle-checkbox"
                                       ${item.is_active ? 'checked' : ''}
                                       data-id="${item.id}">
                                <span class="slider round"></span>
                            </label>
                            <span class="status-text">${item.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon view-item" data-id="${item.id}" title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon edit-item" data-id="${item.id}" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon delete-item" data-id="${item.id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
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
                console.log(`View button clicked for ${section} ${id}`);
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
                    if (!selectedItems[section].includes(id)) {
                        selectedItems[section].push(id);
                    }
                } else {
                    selectedItems[section] = selectedItems[section].filter(itemId => itemId !== id);
                }
                updateSelectAllCheckbox(section);
                updateBulkButtonState(section, selectedItems[section].length);
                updateHeaderSelectedCount(section, selectedItems[section].length);
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

    // Silent dashboard refresh function (no blur, only micro loaders)
    function refreshDashboard() {
        const button = document.getElementById('refreshDashboardBtn');
        if (!button) {
            console.error('❌ Refresh button not found');
            return;
        }

        const originalHTML = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        button.disabled = true;

        console.log('🔄 Refreshing dashboard data...');

        loadDashboardStats()
            .then(() => {
                showNotification('Dashboard refreshed successfully', 'success');
            })
            .catch(error => {
                console.error('Dashboard refresh error:', error);
                showNotification('Failed to refresh dashboard', 'error');
            })
            .finally(() => {
                button.innerHTML = originalHTML;
                button.disabled = false;
            });
    }

    // ============================================
    // ========== 6. SEARCH & FILTER FUNCTIONS ==========
    // ============================================

    // Filter setup with AUTO-SEARCH
    function setupSearchFilters() {
        // Search functionality - WITH AUTO-SEARCH (debounced)
        document.querySelectorAll('.search-box').forEach(searchBox => {
            const searchInput = searchBox.querySelector('input');
            const searchBtn = searchBox.querySelector('.search-btn');

            if (!searchInput) return;

            // Store debounce timeout
            let debounceTimeout = null;
            let isSearching = false;

            // Function to perform search
            const performSearch = (shouldShowLoading = true) => {
                if (isSearching) return;

                const section = searchBox.closest('.admin-section');
                if (!section) return;

                const sectionId = section.id;
                const searchTerm = searchInput.value.trim();

                console.log(`🔍 Auto-search in ${sectionId}: "${searchTerm}"`);

                // Get current filters
                const filters = getCurrentFilters(sectionId);

                // Show loading state on search button if available
                if (searchBtn && shouldShowLoading) {
                    const originalHTML = searchBtn.innerHTML;
                    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    searchBtn.disabled = true;

                    // Restore button after delay
                    setTimeout(() => {
                        if (searchBtn) {
                            searchBtn.innerHTML = originalHTML;
                            searchBtn.disabled = false;
                        }
                    }, 500);
                }

                // Reset to page 1 and load data with search and filters
                if (sectionId === 'testimonials') {
                    if (window.testimonialManager) {
                        window.testimonialManager.currentPage = 1;
                        window.testimonialManager.loadTestimonialsData(1);
                    }
                } else if (sectionId === 'expired-content') {
                    currentExpiredPage = 1;
                    loadExpiredContentData(1, searchTerm);
                } else if (sectionId === 'trash') {
                    currentTrashPage = 1;
                    loadTrashItems(1, searchTerm);
                } else {
                    // For courses, jobs, internships, blog, users, messages, newsletter
                    if (currentPage[sectionId] !== undefined) {
                        currentPage[sectionId] = 1;
                    }
                    loadSectionData(sectionId, 1, searchTerm, filters);
                }
            };

            // AUTO-SEARCH: Input event with debouncing
            searchInput.addEventListener('input', function(e) {
                e.preventDefault();

                // Clear previous timeout
                if (debounceTimeout) {
                    clearTimeout(debounceTimeout);
                }

                // Set new timeout (300ms delay for better UX)
                debounceTimeout = setTimeout(() => {
                    performSearch(true);
                }, 300);
            });

            // Keep the search button functionality (for manual search)
            if (searchBtn) {
                // Remove any existing listeners by cloning
                const newSearchBtn = searchBtn.cloneNode(true);
                searchBtn.parentNode.replaceChild(newSearchBtn, searchBtn);

                // Search button click handler (manual search - immediate)
                newSearchBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    // Clear any pending auto-search
                    if (debounceTimeout) {
                        clearTimeout(debounceTimeout);
                    }

                    performSearch(true);
                });
            }

            // Keep Enter key support
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();

                    // Clear any pending auto-search
                    if (debounceTimeout) {
                        clearTimeout(debounceTimeout);
                    }

                    performSearch(true);
                }
            });

            // Optional: Add clear button when search has content
            const clearBtn = document.createElement('button');
            clearBtn.className = 'search-clear-btn';
            clearBtn.innerHTML = '<i class="fas fa-times"></i>';
            clearBtn.style.cssText = `
                position: absolute;
                right: 40px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                display: none;
                padding: 5px;
                font-size: 12px;
            `;

            // Add clear button to search box
            if (!searchBox.querySelector('.search-clear-btn')) {
                searchBox.style.position = 'relative';
                searchBox.appendChild(clearBtn);

                // Show/hide clear button based on input value
                searchInput.addEventListener('input', function() {
                    if (this.value.trim()) {
                        clearBtn.style.display = 'block';
                    } else {
                        clearBtn.style.display = 'none';
                    }
                });

                // Clear search on button click
                clearBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
                    performSearch(true);
                });
            }
        });

        // DROP DOWN FILTER FUNCTIONALITY (unchanged)
        document.querySelectorAll('.filter-select').forEach(select => {
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);

            newSelect.addEventListener('change', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const section = this.closest('.admin-section');
                if (!section) return;

                const sectionId = section.id;

                // Get current search term
                const searchInput = section.querySelector('.search-box input');
                const searchTerm = searchInput ? searchInput.value.trim() : '';

                // Get all filters from this section
                const filters = getCurrentFilters(sectionId);

                console.log(`🎯 Filter changed in ${sectionId}:`, filters);

                // Reset to page 1 and load data with filters
                if (sectionId === 'testimonials') {
                    if (window.testimonialManager) {
                        window.testimonialManager.currentPage = 1;
                        window.testimonialManager.loadTestimonialsData(1);
                    }
                } else if (sectionId === 'expired-content') {
                    currentExpiredPage = 1;
                    loadExpiredContentData(1, searchTerm);
                } else if (sectionId === 'trash') {
                    currentTrashPage = 1;
                    loadTrashItems(1, searchTerm);
                } else {
                    if (currentPage[sectionId] !== undefined) {
                        currentPage[sectionId] = 1;
                    }
                    loadSectionData(sectionId, 1, searchTerm, filters);
                }
            });
        });
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
                // Updated: Use status filter instead of role filter
                const userStatusFilter = document.getElementById('userStatusFilter');
                if (userStatusFilter && userStatusFilter.value) {
                    filters.status = userStatusFilter.value;
                }
                break;

            case 'admins':  // ADDED: Admin status filter
                const adminStatusFilter = document.getElementById('adminStatusFilter');
                if (adminStatusFilter && adminStatusFilter.value) {
                    filters.status = adminStatusFilter.value;
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

            case 'testimonials':
                const testimonialStatusFilter = document.getElementById('testimonialStatusFilter');
                if (testimonialStatusFilter && testimonialStatusFilter.value) {
                    filters.status = testimonialStatusFilter.value;
                }
                break;

            case 'expired-content':
                const expiredTypeFilter = document.getElementById('expiredContentTypeFilter');
                if (expiredTypeFilter && expiredTypeFilter.value) {
                    filters.type = expiredTypeFilter.value;
                }
                break;

            case 'trash':
                const trashTypeFilter = document.getElementById('trashTypeFilter');
                if (trashTypeFilter && trashTypeFilter.value && trashTypeFilter.value !== 'all') {
                    filters.type = trashTypeFilter.value;
                }
                break;
        }

        return filters;
    }

    // ============================================
    // ========== 7. MODAL & FORM FUNCTIONS ==========
    // ============================================

    // Function to close modal
    function closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';

            // Reset all forms inside the modal
            const forms = modal.querySelectorAll('form');
            forms.forEach(form => {
                form.reset();
                // Clear the ID field to reset add/edit mode
                const idField = form.querySelector('input[name="id"]');
                if (idField) idField.value = '';
            });

            // Clear ALL error indicators from the modal
            const errorSpans = modal.querySelectorAll('.field-error');
            errorSpans.forEach(span => span.remove());

            const errorInputs = modal.querySelectorAll('.input-error');
            errorInputs.forEach(input => input.classList.remove('input-error'));

            const errorGroups = modal.querySelectorAll('.error-group');
            errorGroups.forEach(group => group.classList.remove('error-group'));

            const errorIcons = modal.querySelectorAll('.input-error-icon');
            errorIcons.forEach(icon => icon.remove());

            const errorSummary = modal.querySelector('.error-summary');
            if (errorSummary) errorSummary.remove();

            // CLEAR ALL LOGO PREVIEWS - This is critical
            const logoPreviews = modal.querySelectorAll('.logo-preview');
            logoPreviews.forEach(preview => preview.remove());

            // Also clear any logo preview containers that might be attached to company inputs
            const companyInputs = modal.querySelectorAll('input[name="company"]');
            companyInputs.forEach(input => {
                // Remove next sibling if it's a logo preview
                const nextSibling = input.nextElementSibling;
                if (nextSibling && nextSibling.classList && nextSibling.classList.contains('logo-preview')) {
                    nextSibling.remove();
                }
                // Also check parent's children
                const parent = input.parentElement;
                if (parent) {
                    const previews = parent.querySelectorAll('.logo-preview');
                    previews.forEach(preview => preview.remove());
                }
            });

            // Reset image preview if exists
            const imagePreview = modal.querySelector('#courseImagePreviewContainer');
            if (imagePreview) {
                imagePreview.style.display = 'none';
                const imageUrlInput = modal.querySelector('#courseImageUrl');
                if (imageUrlInput) imageUrlInput.value = '';
            }

            // Reset password fields for admin modal
            const passwordStrength = modal.querySelector('#passwordStrength');
            if (passwordStrength) passwordStrength.innerHTML = '';

            const confirmPassword = modal.querySelector('#adminConfirmPassword');
            if (confirmPassword) confirmPassword.value = '';

            const passwordField = modal.querySelector('#adminPassword');
            if (passwordField) passwordField.value = '';
        });

        // Reset global form submission flag
        isSubmitting = false;

        // Reset blog categories if exists
        if (blogCategoriesManager && typeof blogCategoriesManager.clearSelections === 'function') {
            blogCategoriesManager.clearSelections();
        }

        console.log('Modal closed and all logo previews cleared');
    }

    // Update the openAddModal function to handle course modal specifically
    function openAddModal(type) {
        const modalId = `${type}Modal`;
        const modal = document.getElementById(modalId);

        if (modal) {
            // CLEAR ALL ERRORS BEFORE OPENING MODAL
            const errorSpans = modal.querySelectorAll('.field-error');
            errorSpans.forEach(span => span.remove());

            const errorInputs = modal.querySelectorAll('.input-error');
            errorInputs.forEach(input => input.classList.remove('input-error'));

            const errorGroups = modal.querySelectorAll('.error-group');
            errorGroups.forEach(group => group.classList.remove('error-group'));

            const errorIcons = modal.querySelectorAll('.input-error-icon');
            errorIcons.forEach(icon => icon.remove());

            const errorSummary = modal.querySelector('.error-summary');
            if (errorSummary) errorSummary.remove();

            // CLEAR ALL LOGO PREVIEWS - Critical for new form
            const logoPreviews = modal.querySelectorAll('.logo-preview');
            logoPreviews.forEach(preview => preview.remove());

            // Also clear company input next siblings
            const companyInputs = modal.querySelectorAll('input[name="company"]');
            companyInputs.forEach(input => {
                const nextSibling = input.nextElementSibling;
                if (nextSibling && nextSibling.classList && nextSibling.classList.contains('logo-preview')) {
                    nextSibling.remove();
                }
                // Clear the input value
                input.value = '';
            });

            // Reset form
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
                const idField = form.querySelector('input[name="id"]');
                if (idField) idField.value = '';
            }

            // Reset image preview for course modal
            if (type === 'course') {
                hideCourseImagePreview();
                const imageUrlInput = document.getElementById('courseImageUrl');
                if (imageUrlInput) imageUrlInput.value = '';
                setTimeout(initCourseImageUpload, 100);
            }

            // Reset password fields for admin modal
            if (type === 'admin') {
                const passwordStrength = modal.querySelector('#passwordStrength');
                if (passwordStrength) passwordStrength.innerHTML = '';
                const confirmPassword = modal.querySelector('#adminConfirmPassword');
                if (confirmPassword) confirmPassword.value = '';
                const passwordField = modal.querySelector('#adminPassword');
                if (passwordField) passwordField.value = '';
            }

            // Set modal title
            const titleElement = modal.querySelector('h2 span') || modal.querySelector('h2');
            if (titleElement) {
                titleElement.textContent = `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`;
            }

            modal.style.display = 'block';
        }
    }

    // Enhanced edit modal function
    function openEditModal(section, id) {
        console.log(`Opening edit modal for ${section} with ID: ${id}`);

        const modalId = section === 'blog' ? 'blogModal' : `${section.slice(0, -1)}Modal`;
        const modal = document.getElementById(modalId);

        if (!modal) {
            console.error(`Modal not found: ${modalId}`);
            showNotification(`Could not find edit modal`, 'error');
            return;
        }

        // CLEAR ALL ERRORS BEFORE OPENING MODAL
        const errorSpans = modal.querySelectorAll('.field-error');
        errorSpans.forEach(span => span.remove());

        const errorInputs = modal.querySelectorAll('.input-error');
        errorInputs.forEach(input => input.classList.remove('input-error'));

        const errorGroups = modal.querySelectorAll('.error-group');
        errorGroups.forEach(group => group.classList.remove('error-group'));

        const errorIcons = modal.querySelectorAll('.input-error-icon');
        errorIcons.forEach(icon => icon.remove());

        const errorSummary = modal.querySelector('.error-summary');
        if (errorSummary) errorSummary.remove();

        // CLEAR ALL LOGO PREVIEWS FIRST
        const logoPreviews = modal.querySelectorAll('.logo-preview');
        logoPreviews.forEach(preview => preview.remove());

        const formId = section === 'blog' ? 'blogForm' : `${section.slice(0, -1)}Form`;
        const form = document.getElementById(formId);

        if (!form) {
            console.error(`Form not found: ${formId}`);
            return;
        }

        // Reset form before populating
        form.reset();

        showLoading();

        fetch(`/api/admin/${section}/${id}`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch ${section} item`);
            }
            return response.json();
        })
        .then(item => {
            console.log(`Received ${section} data:`, item);

            const idField = form.querySelector('input[name="id"]');
            if (idField) {
                idField.value = item.id;
            }

            if (section === 'blog') {
                // Populate blog form
                const titleField = document.getElementById('blogTitle');
                if (titleField) titleField.value = item.title || '';

                const authorField = document.getElementById('blogAuthor');
                if (authorField) authorField.value = item.author || '';

                const contentField = document.getElementById('blogContent');
                if (contentField) contentField.value = item.content || '';

                const imageField = document.getElementById('blogImage');
                if (imageField) imageField.value = item.image || '';

                const isFeaturedCheckbox = form.querySelector('input[name="is_featured"]');
                if (isFeaturedCheckbox) isFeaturedCheckbox.checked = item.is_featured === true;

                const isPublishedCheckbox = form.querySelector('input[name="is_published"]');
                if (isPublishedCheckbox) isPublishedCheckbox.checked = item.is_published === true;

                const isActiveCheckbox = form.querySelector('input[name="is_active"]');
                if (isActiveCheckbox) isActiveCheckbox.checked = item.is_active === true;

                if (item.categories) {
                    let categoryValue = '';
                    if (Array.isArray(item.categories) && item.categories.length > 0) {
                        categoryValue = item.categories[0];
                    } else if (typeof item.categories === 'string') {
                        try {
                            const parsed = JSON.parse(item.categories);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                categoryValue = parsed[0];
                            } else {
                                categoryValue = item.categories;
                            }
                        } catch (e) {
                            categoryValue = item.categories;
                        }
                    }

                    const categorySelect = document.getElementById('blogCategory');
                    if (categorySelect && categoryValue) {
                        categorySelect.value = categoryValue;
                    }

                    const hiddenInput = document.getElementById('blogCategoriesHidden');
                    if (hiddenInput) {
                        hiddenInput.value = JSON.stringify([categoryValue]);
                    }
                }

                const titleElement = document.getElementById('blogModalTitle');
                if (titleElement) {
                    titleElement.textContent = 'Edit Blog Post';
                }
            } else {
                // For other sections, populate form fields
                Array.from(form.elements).forEach(element => {
                    if (element.name && element.name !== 'id') {
                        const value = item[element.name];

                        if (element.type === 'checkbox') {
                            element.checked = value === true || value === 'true' || value === 1;
                        } else if (element.type === 'datetime-local' && value) {
                            try {
                                const date = new Date(value);
                                if (!isNaN(date.getTime())) {
                                    const year = date.getFullYear();
                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                    const day = String(date.getDate()).padStart(2, '0');
                                    const hours = String(date.getHours()).padStart(2, '0');
                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                    element.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                                } else {
                                    element.value = '';
                                }
                            } catch (e) {
                                element.value = '';
                            }
                        } else {
                            element.value = value !== null && value !== undefined ? value : '';
                        }
                    }
                });

                // AFTER populating form, show logo preview for existing company
                const companyInput = form.querySelector('input[name="company"]');
                if (companyInput && companyInput.value && companyInput.value.trim().length > 2) {
                    // Small delay to ensure DOM is ready
                    setTimeout(() => {
                        previewCompanyLogo(companyInput.value.trim(), companyInput);
                    }, 200);
                }
            }

            modal.style.display = 'block';
            hideLoading();

            // Reset any remaining error states after population
            setTimeout(() => {
                const remainingErrors = modal.querySelectorAll('.input-error, .field-error, .error-group');
                remainingErrors.forEach(el => {
                    if (el.classList) {
                        el.classList.remove('input-error', 'error-group');
                    }
                    if (el.tagName === 'SMALL' && el.classList.contains('field-error')) {
                        el.remove();
                    }
                });
            }, 100);

            console.log(`✅ Edit modal opened for ${section} ID: ${id}`);
        })
        .catch(error => {
            console.error(`Error loading ${section} item:`, error);
            showNotification(`Failed to load ${section} item`, 'error');
            hideLoading();
        });
    }

    // Update the edit item function to handle course image
    function editItem(type, id) {
        fetch(`/api/admin/${type}/${id}`)
            .then(response => response.json())
            .then(data => {
                const modalId = `${type}Modal`;
                const modal = document.getElementById(modalId);

                if (modal) {
                    const form = modal.querySelector('form');
                    if (form) {
                        // Fill form with existing data
                        Object.keys(data).forEach(key => {
                            const input = form.querySelector(`[name="${key}"]`);
                            if (input) {
                                if (input.type === 'checkbox') {
                                    input.checked = Boolean(data[key]);
                                } else {
                                    input.value = data[key] || '';
                                }
                            }
                        });

                        // Special handling for course image
                        if (type === 'courses' && data.image) {
                            const imageUrlInput = document.getElementById('courseImageUrl');
                            if (imageUrlInput) {
                                imageUrlInput.value = data.image;
                                updateCourseImagePreview(data.image);
                            }
                        }

                        // Set modal title
                        const titleElement = modal.querySelector('h2');
                        if (titleElement) {
                            titleElement.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1).slice(0, -1)}`;
                        }

                        modal.style.display = 'block';

                        // Initialize course image upload for edit mode
                        if (type === 'courses') {
                            setTimeout(initCourseImageUpload, 100);
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching item:', error);
                showNotification('Error loading item data', 'error');
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

        // Initialize course image upload when course modal is opened
        document.addEventListener('click', function(e) {
            if (e.target.id === 'addCourseBtn' || e.target.closest('#addCourseBtn')) {
                // Initialize course image upload functionality after modal opens
                setTimeout(initCourseImageUpload, 100);
            }
        });

    }

    // Search and filter functionality
    function setupForms() {
        // Handle form submissions only
        document.getElementById('courseForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'courses'));
        document.getElementById('jobForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'jobs'));
        document.getElementById('internshipForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'internships'));
        document.getElementById('blogForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'blog'));
        document.getElementById('userForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'users'));
        document.getElementById('newsletterForm')?.addEventListener('submit', (e) => handleNewsletterSubmit(e));
        document.getElementById('messageReplyForm')?.addEventListener('submit', (e) => handleMessageReplySubmit(e));
    }

    // Form submission
    // Add a flag to prevent duplicate submissions
    let isSubmitting = false;

    function handleFormSubmit(e, type) {
        e.preventDefault();

        // Prevent duplicate submissions
        if (isSubmitting) {
            console.log('Form submission already in progress, ignoring...');
            return;
        }

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;

        console.log('Form data before processing:', data);
        console.log('Type:', type);
        console.log('ID:', id);

        // Clear all previous field errors for this form type
        const fieldIdsMap = {
            'courses': ['courseTitle', 'courseCategory', 'courseInstructor', 'courseLink'],
            'jobs': ['jobTitle', 'jobCompany', 'jobLocation', 'jobLink'],
            'internships': ['internshipTitle', 'internshipCompany', 'internshipLocation', 'internshipLink'],
            'blog': ['blogTitle', 'blogAuthor', 'blogContent', 'blogCategory']
        };

        if (fieldIdsMap[type]) {
            fieldIdsMap[type].forEach(fieldId => {
                clearFieldError(fieldId);
            });
        }

        // ===== FIELD-LEVEL VALIDATION FOR EACH SECTION =====

        // Courses Validation
        if (type === 'courses') {
            let isValid = true;
            if (!data.title) {
                showFieldError('courseTitle', 'Title is required');
                isValid = false;
            }
            if (!data.category) {
                showFieldError('courseCategory', 'Category is required');
                isValid = false;
            }
            if (!data.instructor) {
                showFieldError('courseInstructor', 'Instructor is required');
                isValid = false;
            }
            if (!data.application_link) {
                showFieldError('courseLink', 'Application link is required');
                isValid = false;
            }
            if (!isValid) return;
        }

        // Jobs Validation
        if (type === 'jobs') {
            let isValid = true;
            if (!data.title) {
                showFieldError('jobTitle', 'Title is required');
                isValid = false;
            }
            if (!data.company) {
                showFieldError('jobCompany', 'Company is required');
                isValid = false;
            }
            if (!data.location) {
                showFieldError('jobLocation', 'Location is required');
                isValid = false;
            }
            if (!data.application_link) {
                showFieldError('jobLink', 'Application link is required');
                isValid = false;
            }
            if (!isValid) return;
        }

        // Internships Validation
        if (type === 'internships') {
            let isValid = true;
            if (!data.title) {
                showFieldError('internshipTitle', 'Title is required');
                isValid = false;
            }
            if (!data.company) {
                showFieldError('internshipCompany', 'Company is required');
                isValid = false;
            }
            if (!data.location) {
                showFieldError('internshipLocation', 'Location is required');
                isValid = false;
            }
            if (!data.application_link) {
                showFieldError('internshipLink', 'Application link is required');
                isValid = false;
            }
            if (!isValid) return;
        }

        // Blog Validation
        if (type === 'blog') {
            let isValid = true;
            if (!data.title) {
                showFieldError('blogTitle', 'Title is required');
                isValid = false;
            }
            if (!data.author) {
                showFieldError('blogAuthor', 'Author is required');
                isValid = false;
            }
            if (!data.content) {
                showFieldError('blogContent', 'Content is required');
                isValid = false;
            }
            // Handle categories (stored as JSON string)
            let categories = [];
            try {
                categories = data.categories ? JSON.parse(data.categories) : [];
            } catch(e) {
                categories = [];
            }
            if (categories.length === 0) {
                showFieldError('blogCategory', 'Category is required');
                isValid = false;
            }
            if (!isValid) return;
        }

        // Convert checkbox values to boolean for ALL types first (like old file)
        Object.keys(data).forEach(key => {
            if (data[key] === 'on') {
                data[key] = true;
            } else if (data[key] === 'off') {
                data[key] = false;
            } else if (data[key] === '') {
                // Remove empty fields except for text areas and certain fields
                if (!['description', 'content', 'image', 'salary', 'expiration_date'].includes(key)) {
                    delete data[key];
                }
            }

            // Convert numeric fields
            if (['rating', 'enrollments', 'duration_hours'].includes(key) && data[key]) {
                data[key] = parseFloat(data[key]) || 0;
            }
        });

        // Handle categories array for blog posts - THIS IS THE KEY PART from old file
        if (type === 'blog' && data.categories) {
            try {
                // The hidden input stores JSON string, parse it to array
                data.categories = JSON.parse(data.categories);
                console.log('Parsed categories:', data.categories);
            } catch (e) {
                console.log('Error parsing categories, setting empty array:', e);
                data.categories = [];
            }
        }

        // IMPORTANT: When updating from expired section, DO NOT automatically reactivate
        // Keep is_active as false until manual reactivation
        if (id && currentSection === 'expired-content') {
            if (typeof data.is_active === 'undefined') {
                data.is_active = false;
            }
        } else {
            if (['courses', 'jobs', 'internships', 'blog'].includes(type) && !id) {
                data.is_featured = data.is_active;
            }
        }

        // For new items, remove the ID field completely
        if (!id || id === '' || id === 'null') {
            delete data.id;
        }

        // Determine the correct endpoint and method
        const url = id && id !== '' && id !== 'null' ? `/api/admin/${type}/${id}` : `/api/admin/${type}`;
        const method = id && id !== '' && id !== 'null' ? 'PUT' : 'POST';

        console.log(`Sending ${method} request to ${url} with data:`, data);

        isSubmitting = true;
        showLoading();

        fetch(url, {
            method: method,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(async response => {
            console.log('Response status:', response.status);

            // Try to parse response body
            let errorData = null;
            let responseText = '';

            try {
                responseText = await response.text();
                if (responseText) {
                    errorData = JSON.parse(responseText);
                }
            } catch (e) {
                console.log('Response is not JSON or empty');
            }

            if (!response.ok) {
                // Create error object with details
                const error = new Error(errorData?.message || `HTTP ${response.status}`);
                error.status = response.status;
                error.data = errorData;
                error.responseText = responseText;
                throw error;
            }

            return errorData;
        })
        .then(result => {
            console.log('Success response:', result);
            if (result && result.success) {
                showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} ${id ? 'updated' : 'created'} successfully`, 'success');

                closeModal();
                form.reset();

                if (fieldIdsMap[type]) {
                    fieldIdsMap[type].forEach(fieldId => {
                        clearFieldError(fieldId);
                    });
                }

                if (type === 'blog' && blogCategoriesManager) {
                    blogCategoriesManager.clearSelections();
                }

                if (!id) {
                    const expirationDateInput = form.querySelector('input[name="expiration_date"]');
                    if (expirationDateInput) {
                        expirationDateInput.value = '';
                    }
                }

                if (currentSection === 'expired-content') {
                    loadExpiredContentData(currentExpiredPage);
                } else {
                    loadSectionData(type, currentPage[type]);
                }
            } else if (result && !result.success) {
                showNotification(result.message || result.error || `Failed to ${id ? 'update' : 'create'} ${type}`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error ${id ? 'updating' : 'creating'} ${type}:`, error);

            // Check for duplicate key error in error message or response text
            const errorMessage = error.message || '';
            const responseText = error.responseText || '';
            const errorData = error.data || {};

            // Check for duplicate slug error (PostgreSQL error code 23505)
            if (error.status === 500 || errorMessage.includes('duplicate') || responseText.includes('23505') || responseText.includes('duplicate key')) {
                let fieldName = 'title';
                let errorText = 'A record with this title already exists. Please use a different title.';

                if (responseText.includes('slug') || errorData?.details?.includes('slug')) {
                    errorText = 'A blog post with this title already exists. Please use a different title.';
                } else if (responseText.includes('email') || errorData?.details?.includes('email')) {
                    fieldName = 'email';
                    errorText = 'This email is already registered. Please use a different email.';
                } else if (responseText.includes('username') || errorData?.details?.includes('username')) {
                    fieldName = 'username';
                    errorText = 'This username is already taken. Please choose a different username.';
                }

                // Show field-specific error
                if (type === 'blog') {
                    showFieldError('blogTitle', errorText);
                } else if (type === 'courses') {
                    showFieldError('courseTitle', errorText);
                } else if (type === 'jobs') {
                    showFieldError('jobTitle', errorText);
                } else if (type === 'internships') {
                    showFieldError('internshipTitle', errorText);
                } else if (type === 'admins' && fieldName === 'email') {
                    showFieldError('adminEmail', errorText);
                } else if (type === 'admins' && fieldName === 'username') {
                    showFieldError('adminUsername', errorText);
                }

                // Show toast notification
                showNotification(errorText, 'warning', 6000);
            }
            // Handle validation errors from server
            else if (errorData?.field_errors) {
                Object.keys(errorData.field_errors).forEach(field => {
                    let fieldId = field;
                    if (type === 'blog') {
                        fieldId = `blog${field.charAt(0).toUpperCase() + field.slice(1)}`;
                    } else if (type === 'courses') {
                        fieldId = `course${field.charAt(0).toUpperCase() + field.slice(1)}`;
                    } else if (type === 'jobs') {
                        fieldId = `job${field.charAt(0).toUpperCase() + field.slice(1)}`;
                    } else if (type === 'internships') {
                        fieldId = `internship${field.charAt(0).toUpperCase() + field.slice(1)}`;
                    }
                    showFieldError(fieldId, errorData.field_errors[field]);
                });
                showNotification('Please fix the errors in the form', 'warning');
            }
            else {
                const userMessage = error.data?.message || error.message || `Failed to ${id ? 'update' : 'create'} ${type}`;
                showNotification(userMessage, 'error');
            }
        })
        .finally(() => {
            setTimeout(() => {
                isSubmitting = false;
            }, 1000);
            hideLoading();
        });
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

    // Update messages menu badge with unread count
    function updateMessagesMenuBadge(count) {
        const menuBadge = document.getElementById('messagesMenuBadge');
        if (menuBadge) {
            if (count > 0) {
                menuBadge.textContent = count > 99 ? '99+' : count;
                menuBadge.style.display = 'inline-block';
                menuBadge.className = 'menu-badge danger';
            } else {
                menuBadge.style.display = 'none';
            }
        }
    }

    // ============================================
    // ========== 8. COURSE IMAGE UPLOAD FUNCTIONS ==========
    // ============================================

    // Initialize course image upload functionality
    function initCourseImageUpload() {
        const uploadBtn = document.getElementById('uploadCourseImageBtn');
        const fileInput = document.getElementById('courseImageUpload');
        const imageUrlInput = document.getElementById('courseImageUrl');
        const imagePreview = document.getElementById('courseImagePreview');
        const previewContainer = document.getElementById('courseImagePreviewContainer');
        const removeImageBtn = document.getElementById('removeCourseImage');

        if (!uploadBtn || !fileInput) return;

        // Remove existing event listeners to prevent duplicates
        uploadBtn.replaceWith(uploadBtn.cloneNode(true));
        fileInput.replaceWith(fileInput.cloneNode(true));

        // Get fresh references after cloning
        const newUploadBtn = document.getElementById('uploadCourseImageBtn');
        const newFileInput = document.getElementById('courseImageUpload');

        // Handle upload button click
        newUploadBtn.addEventListener('click', () => {
            newFileInput.click();
        });

        // Handle file selection
        newFileInput.addEventListener('change', handleCourseImageUpload);

        // Handle URL input changes
        if (imageUrlInput) {
            imageUrlInput.addEventListener('input', function() {
                const url = this.value.trim();
                if (url) {
                    updateCourseImagePreview(url);
                } else {
                    hideCourseImagePreview();
                }
            });
        }

        // Handle remove image button
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', function() {
                hideCourseImagePreview();
                if (imageUrlInput) imageUrlInput.value = '';
                if (newFileInput) newFileInput.value = '';
            });
        }

        // Handle drag and drop
        const uploadContainer = document.querySelector('.image-upload-container');
        if (uploadContainer) {
            uploadContainer.addEventListener('dragover', handleDragOver);
            uploadContainer.addEventListener('drop', handleCourseImageDrop);
        }

        // Initialize image preview if URL already exists
        if (imageUrlInput && imageUrlInput.value) {
            updateCourseImagePreview(imageUrlInput.value);
        }
    }

    function handleCourseImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            showNotification('Please select a valid image file (JPEG, PNG, GIF)', 'error');
            return;
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification('Image size should be less than 5MB', 'error');
            return;
        }

        uploadCourseImage(file);
    }

    function handleCourseImageDrop(event) {
        event.preventDefault();
        event.stopPropagation();

        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            uploadCourseImage(file);
        }
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy';
    }

    function uploadCourseImage(file) {
        const formData = new FormData();
        formData.append('file', file);

        showLoading();

        fetch('/api/admin/courses/upload-image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                const imageUrlInput = document.getElementById('courseImageUrl');
                if (imageUrlInput) {
                    imageUrlInput.value = data.image_url;
                    updateCourseImagePreview(data.image_url);
                }
                showNotification('Image uploaded successfully!', 'success');
            } else {
                showNotification(data.error || 'Failed to upload image', 'error');
            }
        })
        .catch(error => {
            hideLoading();
            console.error('Error uploading image:', error);
            showNotification('Error uploading image', 'error');
        });
    }

    function updateCourseImagePreview(imageUrl) {
        const imagePreview = document.getElementById('courseImagePreview');
        const previewContainer = document.getElementById('courseImagePreviewContainer');

        if (imagePreview && previewContainer) {
            imagePreview.src = imageUrl;
            previewContainer.style.display = 'block';

            // Add error handling for broken images
            imagePreview.onerror = function() {
                showNotification('Failed to load image from URL', 'error');
                hideCourseImagePreview();
            };
        }
    }

    function hideCourseImagePreview() {
        const previewContainer = document.getElementById('courseImagePreviewContainer');
        if (previewContainer) {
            previewContainer.style.display = 'none';
        }
    }

    // ============================================
    // ========== 9. STATUS & DELETE FUNCTIONS ==========
    // ============================================

    // Toggle status (active/inactive) - For all contents
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
            body: JSON.stringify({
                is_active: Boolean(isActive)
            })
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

    // Perform soft delete operation
    function performDelete(section, id) {
        showLoading();

        // Map section to API endpoint
        let apiSection = section;
        if (section === 'blog') apiSection = 'blog';
        if (section === 'testimonials') apiSection = 'testimonials';
        if (section === 'courses') apiSection = 'courses';
        if (section === 'jobs') apiSection = 'jobs';
        if (section === 'internships') apiSection = 'internships';
        if (section === 'users') apiSection = 'users';
        if (section === 'messages') apiSection = 'messages';
        if (section === 'newsletter') apiSection = 'newsletter';

        console.log(`Deleting ${section} with ID: ${id} using endpoint: ${apiSection}`);

        fetch(`/api/admin/${apiSection}/${id}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || `Failed to delete ${section}`);
                });
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                const itemName = section.charAt(0).toUpperCase() + section.slice(1);
                showNotification(`${itemName} moved to trash`, 'success');

                // Remove the item from the UI immediately
                const tableBody = document.getElementById(`${section}TableBody`);
                if (tableBody) {
                    const row = tableBody.querySelector(`tr .row-checkbox[data-id="${id}"]`)?.closest('tr');
                    if (row) {
                        row.remove();
                    }

                    // Check if table is empty and show message
                    if (tableBody.children.length === 0) {
                        const colSpan = document.querySelector(`#${section} thead tr`)?.cells.length || 8;
                        tableBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 20px;">No data found</td></tr>`;
                    }
                }

                // Update dashboard stats (including trash count)
                loadDashboardStats();
                loadTrashStats(true);

                // If we're in the trash section, refresh it
                if (currentSection === 'trash') {
                    loadTrashItems(currentTrashPage);
                }

                // Clear from selected items
                if (selectedItems[section]) {
                    selectedItems[section] = selectedItems[section].filter(itemId => itemId !== id);
                    updateSelectAllCheckbox(section);
                    updateBulkButtonState(section, selectedItems[section].length);
                }
            } else {
                showNotification(result.message || `Failed to delete ${section}`, 'error');
            }
        })
        .catch(error => {
            console.error(`Error deleting ${section}:`, error);
            showNotification(error.message || `Failed to delete ${section}`, 'error');
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

    // ============================================
    // ========== 10. VIEW MODAL FUNCTIONS ==========
    // ============================================

    // View modal function
    function openViewModal(section, id) {
        console.log(`Opening view modal for ${section} with ID: ${id}`);

        // Handle testimonial separately
        if (section === 'testimonials') {
            viewTestimonialFromTrash(id);
            return;
        }

        // Handle admin section - Added without breaking existing functionality
        if (section === 'admins') {
            showLoading();

            fetch(`/api/admin/admins/${id}`, {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch admin details`);
                }
                return response.json();
            })
            .then(data => {
                hideLoading();

                if (data.success && data.admin) {
                    const modal = document.getElementById('contentViewModal');
                    if (!modal) return;

                    const modalTitle = modal.querySelector('.modal-title');
                    if (modalTitle) {
                        modalTitle.textContent = 'Admin Details';
                    }

                    const contentBody = modal.querySelector('#contentViewBody');
                    if (contentBody) {
                        const roleText = data.admin.is_superadmin ? 'Super Admin' : 'Admin';
                        const roleIcon = data.admin.is_superadmin ? '<i class="fas fa-crown"></i>' : '<i class="fas fa-user-shield"></i>';
                        const roleClass = data.admin.is_superadmin ? 'superadmin-role' : 'admin-role';

                        contentBody.innerHTML = `
                            <div class="view-field">
                                <label>Full Name:</label>
                                <span>${escapeHTML(data.admin.full_name || data.admin.username)}</span>
                            </div>
                            <div class="view-field">
                                <label>Username:</label>
                                <span>${escapeHTML(data.admin.username)}</span>
                            </div>
                            <div class="view-field">
                                <label>Email:</label>
                                <span>${escapeHTML(data.admin.email)}</span>
                            </div>
                            <div class="view-field">
                                <label>Role:</label>
                                <span class="role-badge ${roleClass}">${roleIcon} ${roleText}</span>
                            </div>
                            <div class="view-field">
                                <label>Status:</label>
                                <span class="status-badge ${data.admin.is_active ? 'active' : 'inactive'}">
                                    ${data.admin.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div class="view-field">
                                <label>Joined:</label>
                                <span>${formatDate(data.admin.created_at, true)}</span>
                            </div>
                            <div class="view-field">
                                <label>Last Login:</label>
                                <span>${data.admin.last_login ? formatDate(data.admin.last_login, true) : 'Never'}</span>
                            </div>
                        `;
                    }

                    modal.style.display = 'block';
                } else {
                    showNotification('Failed to load admin details', 'error');
                }
            })
            .catch(error => {
                console.error(`Error loading admin item:`, error);
                showNotification(`Failed to load admin details`, 'error');
                hideLoading();
            });
            return;
        }

        // Map section to API endpoint for OTHER sections (existing functionality unchanged)
        let apiSection = section;
        if (section === 'blog') apiSection = 'blog';
        if (section === 'users') apiSection = 'users';
        if (section === 'messages') apiSection = 'messages';
        if (section === 'newsletter') apiSection = 'newsletter';

        fetch(`/api/admin/${apiSection}/${id}`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch ${section} item`);
            }
            return response.json();
        })
        .then(item => {
            const modal = document.getElementById('contentViewModal');
            if (!modal) return;

            // Set modal title
            const modalTitle = modal.querySelector('.modal-title');
            if (modalTitle) {
                const sectionName = section === 'blog' ? 'Blog Post' :
                                   section === 'users' ? 'User' :
                                   section === 'messages' ? 'Message' :
                                   section === 'newsletter' ? 'Newsletter Subscriber' :
                                   section.charAt(0).toUpperCase() + section.slice(1, -1);
                modalTitle.textContent = `${sectionName} Details`;
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

    // ============================================
    // ========== 11. EXPIRED CONTENT FUNCTIONS ==========
    // ============================================

    // Expired Content Management
    let currentExpiredPage = 1;
    const expiredItemsPerPage = 10;
    let selectedExpiredItems = [];

    // Initialize expired content section
    function setupExpiredContentSection() {
        console.log('🔄 Setting up expired content section...');

        const expiredContentSection = document.getElementById('expired-content');
        if (expiredContentSection) {
            console.log('✅ Found expired content section, setting up observer');

            // Remove existing observer if any
            if (window.expiredContentObserver) {
                window.expiredContentObserver.disconnect();
            }

            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (expiredContentSection.classList.contains('active')) {
                            console.log('🎯 Expired content section activated - loading data');
                            currentExpiredPage = 1;
                            // Load data and stats
                            loadExpiredContentData(1);
                            loadExpiredContentStats();
                        }
                    }
                });
            });

            observer.observe(expiredContentSection, { attributes: true });
            window.expiredContentObserver = observer;

            // Check if section is already active on page load (for direct refresh)
            if (expiredContentSection.classList.contains('active')) {
                console.log('📊 Expired content section already active, loading data...');
                currentExpiredPage = 1;
                // Load data and stats
                loadExpiredContentData(1);
                loadExpiredContentStats();
            }
        }

        // Setup navigation link
        const expiredContentLink = document.querySelector('a[href="#expired-content"]');
        if (expiredContentLink) {
            console.log('✅ Found expired content navigation link');
            const newLink = expiredContentLink.cloneNode(true);
            expiredContentLink.parentNode.replaceChild(newLink, expiredContentLink);

            newLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔗 Expired content link clicked');
                if (typeof navigateToSection === 'function') {
                    navigateToSection('expired-content', this);
                }
            });
        }

        // Setup event listeners
        setupExpiredContentEvents();

        // Setup tabs
        setupExpiredTabs();

        // Always load stats (non-blocking)
        loadExpiredContentStats();

        console.log('✅ Expired content section setup complete');
    }


    function setupExpiredContentEvents() {
        console.log('🔄 Setting up expired content events...');

        // Refresh button - FIXED
        const refreshBtn = document.getElementById('refreshExpiredContentBtn');
        if (refreshBtn) {
            console.log('✅ Setting up expired content refresh button');
            const newBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔄 Manual refresh of expired content');
                loadExpiredContentData(currentExpiredPage);
            });
        }

        // Reactivate all button
        const reactivateAllBtn = document.getElementById('reactivateAllExpiredBtn');
        if (reactivateAllBtn) {
            const newBtn = reactivateAllBtn.cloneNode(true);
            reactivateAllBtn.parentNode.replaceChild(newBtn, reactivateAllBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                reactivateAllExpiredContent();
            });
        }

        // Search functionality - WITH BUTTON CLICK ONLY
        const expiredSearchInput = document.getElementById('expiredContentSearch');
        if (expiredSearchInput) {
            const searchBox = expiredSearchInput.closest('.search-box');
            const searchBtn = searchBox ? searchBox.querySelector('.search-btn') : null;

            if (searchBtn) {
                const newBtn = searchBtn.cloneNode(true);
                searchBtn.parentNode.replaceChild(newBtn, searchBtn);

                let isSearching = false;

                // Search button click handler
                newBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    if (isSearching) return;
                    isSearching = true;

                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    this.disabled = true;

                    const searchTerm = expiredSearchInput.value.trim();
                    console.log(`🔍 Searching expired content: "${searchTerm}"`);
                    currentExpiredPage = 1;

                    loadExpiredContentData(1, searchTerm)
                        .finally(() => {
                            setTimeout(() => {
                                this.innerHTML = originalHTML;
                                this.disabled = false;
                                isSearching = false;
                            }, 500);
                        });
                });

                // Enter key support - FIXED
                expiredSearchInput.addEventListener('keypress', function(e) {
                    console.log('Enter key pressed on expired content search'); // Debug log
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        newBtn.click();
                    }
                });

                console.log('✅ Expired content search with Enter key support enabled');
            }
        }

        // Filter functionality - UPDATED to clear active tab when 'All Types' selected
        const filterSelect = document.getElementById('expiredContentTypeFilter');
        if (filterSelect) {
            console.log('✅ Setting up expired content filter');
            const newSelect = filterSelect.cloneNode(true);
            filterSelect.parentNode.replaceChild(newSelect, filterSelect);

            newSelect.addEventListener('change', function() {
                const filterValue = this.value;
                console.log(`🎯 Filtering expired content by: ${filterValue}`);
                currentExpiredPage = 1;
                loadExpiredContentData(1, '', filterValue);

                // Update active tab based on selected filter
                updateActiveExpiredTab();
            });
        }

        // SELECT ALL CHECKBOX
        const selectAllCheckbox = document.getElementById('selectAllExpired');
        if (selectAllCheckbox) {
            console.log('✅ Setting up expired content select all');
            const newSelectAll = selectAllCheckbox.cloneNode(true);
            selectAllCheckbox.parentNode.replaceChild(newSelectAll, selectAllCheckbox);

            newSelectAll.addEventListener('change', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const isChecked = this.checked;
                const checkboxes = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox');

                selectedExpiredItems = [];

                checkboxes.forEach(checkbox => {
                    checkbox.checked = isChecked;
                    if (isChecked) {
                        selectedExpiredItems.push({
                            content_type: checkbox.getAttribute('data-type'),
                            content_id: checkbox.getAttribute('data-id')
                        });
                    }
                });

                updateExpiredBulkActionButton();
                updateSelectAllExpiredCheckbox();
                // Update header count
                updateHeaderSelectedCount('expired-content', selectedExpiredItems.length);
                console.log(`Expired select all: ${isChecked ? 'Selected' : 'Deselected'} ${checkboxes.length} items`);
            });
        }

        // Individual checkbox listener - using event delegation
        document.addEventListener('change', function(e) {
            if (e.target.classList.contains('expired-item-checkbox')) {
                const checkbox = e.target;
                updateSelectedExpiredItems();
                updateExpiredBulkActionButton();
                updateSelectAllExpiredCheckbox();
            }
        });

        // Bulk actions
        const bulkActionBtn = document.getElementById('applyExpiredContentBulkAction');
        if (bulkActionBtn) {
            const newBtn = bulkActionBtn.cloneNode(true);
            bulkActionBtn.parentNode.replaceChild(newBtn, bulkActionBtn);

            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const action = document.getElementById('expiredContentBulkAction').value;
                if (!action) {
                    showNotification('Please select a bulk action first', 'warning');
                    return;
                }

                // Show confirmation based on action
                const selectedItems = getSelectedExpiredItems();
                if (selectedItems.length === 0) {
                    showNotification('Please select at least one item', 'warning');
                    return;
                }

                if (action === 'reactivate') {
                    showConfirmation('bulk_reactivate',
                        `Are you sure you want to reactivate ${selectedItems.length} item(s)? This will set them as active and featured.`,
                        () => bulkReactivateExpiredContent(selectedItems)
                    );
                } else if (action === 'delete') {
                    showConfirmation('bulk_delete',
                        `Are you sure you want to permanently delete ${selectedItems.length} expired item(s)? This action cannot be undone.`,
                        () => bulkDeleteExpiredContent(selectedItems)
                    );
                }
            });
        }

        // Pagination - FIXED
        const prevBtn = document.getElementById('prevExpiredContentPage');
        if (prevBtn) {
            const newBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newBtn, prevBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (currentExpiredPage > 1) {
                    currentExpiredPage--;
                    loadExpiredContentData(currentExpiredPage);
                }
            });
        }

        const nextBtn = document.getElementById('nextExpiredContentPage');
        if (nextBtn) {
            const newBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newBtn, nextBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                currentExpiredPage++;
                loadExpiredContentData(currentExpiredPage);
            });
        }

        console.log('✅ Expired content events setup complete');
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

    // Load expired content stats - Get counts from the expired content API
    function loadExpiredContentStats() {
        console.log('📊 Loading expired content stats...');

        const courseCountEl = document.getElementById('expiredCoursesCount');
        const jobCountEl = document.getElementById('expiredJobsCount');
        const internshipCountEl = document.getElementById('expiredInternshipsCount');

        // Show loading state
        if (courseCountEl) courseCountEl.classList.add('loading');
        if (jobCountEl) jobCountEl.classList.add('loading');
        if (internshipCountEl) internshipCountEl.classList.add('loading');

        // Fetch the actual expired content data to get correct counts
        return fetch('/api/admin/expired-content?per_page=1000', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.data) {
                let coursesCount = 0;
                let jobsCount = 0;
                let internshipsCount = 0;

                data.data.forEach(item => {
                    if (item.content_type === 'courses') coursesCount++;
                    else if (item.content_type === 'jobs') jobsCount++;
                    else if (item.content_type === 'internships') internshipsCount++;
                });

                if (courseCountEl) {
                    courseCountEl.textContent = coursesCount;
                    courseCountEl.classList.remove('loading');
                }
                if (jobCountEl) {
                    jobCountEl.textContent = jobsCount;
                    jobCountEl.classList.remove('loading');
                }
                if (internshipCountEl) {
                    internshipCountEl.textContent = internshipsCount;
                    internshipCountEl.classList.remove('loading');
                }

                // Update dashboard expired count
                const dashboardExpiredCount = document.getElementById('expiredContentCount');
                if (dashboardExpiredCount) {
                    dashboardExpiredCount.textContent = coursesCount + jobsCount + internshipsCount;
                }

                console.log(`✅ Expired stats - Courses: ${coursesCount}, Jobs: ${jobsCount}, Internships: ${internshipsCount}`);
            }
            return data;
        })
        .catch(error => {
            console.error('Error loading expired stats:', error);
            if (courseCountEl) courseCountEl.textContent = '0';
            if (jobCountEl) jobCountEl.textContent = '0';
            if (internshipCountEl) internshipCountEl.textContent = '0';
            if (courseCountEl) courseCountEl.classList.remove('loading');
            if (jobCountEl) jobCountEl.classList.remove('loading');
            if (internshipCountEl) internshipCountEl.classList.remove('loading');
        });
    }

    // Setup click handlers for expired stat tabs
    function setupExpiredTabs() {
        const tabs = document.querySelectorAll('.expired-stat-tab');

        tabs.forEach(tab => {
            // Remove existing listeners by cloning
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);

            newTab.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const contentType = this.getAttribute('data-type');
                const filterSelect = document.getElementById('expiredContentTypeFilter');

                if (filterSelect) {
                    // Set the filter value
                    filterSelect.value = contentType;
                    // Trigger change event to reload data
                    filterSelect.dispatchEvent(new Event('change'));
                }

                // Update active tab styling
                updateActiveExpiredTab();
            });
        });
    }

    // Update active tab based on current filter
    function updateActiveExpiredTab() {
        const filterSelect = document.getElementById('expiredContentTypeFilter');
        const currentFilter = filterSelect ? filterSelect.value : '';

        const tabs = document.querySelectorAll('.expired-stat-tab');
        tabs.forEach(tab => {
            const tabType = tab.getAttribute('data-type');
            if (currentFilter === tabType) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Also update the dropdown to match (in case tab click changed it)
        if (filterSelect && currentFilter === '') {
            // If no filter, ensure no tab is active (this is already handled above)
            console.log('All Types selected - no active tab');
        }
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
    function loadExpiredContentData(page = 1, search = '', typeFilter = '') {
        console.log(`📋 Loading expired content data: page=${page}, search="${search}", type="${typeFilter}"`);

        // Prevent multiple simultaneous loads
        if (isLoadingExpiredContent) {
            console.log('⚠️ Expired content already loading, skipping...');
            return Promise.resolve();
        }

        isLoadingExpiredContent = true;
        showLoading();

        const searchValue = search || document.getElementById('expiredContentSearch')?.value || '';
        const filterValue = typeFilter || document.getElementById('expiredContentTypeFilter')?.value || '';

        let url = `/api/admin/expired-content?page=${page}&per_page=${expiredItemsPerPage}`;
        if (searchValue) url += `&search=${encodeURIComponent(searchValue)}`;
        if (filterValue) url += `&type=${encodeURIComponent(filterValue)}`;

        console.log(`📡 Fetching from: ${url}`);

        return fetch(url, {
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch expired content`);
            }
            return response.json();
        })
        .then(data => {
            console.log('📋 Expired content data received:', data);

            if (data.success) {
                renderExpiredContentTable(data.data || []);

                const totalCount = data.count || 0;

                // Update pagination UI
                if (typeof updatePaginationUI === 'function') {
                    updatePaginationUI('expired-content', page, totalCount, expiredItemsPerPage);
                }

                // Update current page
                currentExpiredPage = page;

                // Update URL hash with page info if needed
                const currentHash = window.location.hash.substring(1);
                if (currentHash === 'expired-content') {
                    const state = {
                        section: 'expired-content',
                        page: page,
                        timestamp: Date.now()
                    };
                    history.replaceState(state, '', '#expired-content');
                }
                // ✅ ADD THIS NOTIFICATION
                if (typeof showNotification === 'function') {
                    const loadedCount = data.data?.length || 0;
                    showNotification(`Loaded ${loadedCount} expired items`, 'success', 2000);
                }
            } else {
                throw new Error(data.error || 'Failed to load expired content');
            }

            // Sync UI: update active tab based on current filter
           updateActiveExpiredTab();

            return data;
        })
        .catch(error => {
            console.error('❌ Error loading expired content:', error);
            showNotification('Failed to load expired content', 'error');
            // Render empty table on error
            const tableBody = document.getElementById('expiredContentTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 40px;">
                            <i class="fas fa-exclamation-triangle" style="color: var(--danger); font-size: 48px; margin-bottom: 15px;"></i>
                            <h3 style="color: var(--text-primary); margin: 0;">Failed to Load Data</h3>
                            <p style="color: var(--text-secondary); margin: 10px 0 0 0;">${error.message}</p>
                            <button onclick="retryLoadExpiredContent()" class="btn btn-primary" style="margin-top: 20px;">
                                <i class="fas fa-redo"></i> Try Again
                            </button>
                        </td>
                    </tr>
                `;
            }
            throw error;
        })
        .finally(() => {
            isLoadingExpiredContent = false;
            hideLoading();
        });
    }

    // Retry function for expired content
    function retryLoadExpiredContent() {
        console.log('🔄 Retrying expired content load...');
        loadExpiredContentData(currentExpiredPage || 1);
        loadExpiredContentStats();
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

            // Disable select all when no items
            const selectAll = document.getElementById('selectAllExpired');
            if (selectAll) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
                selectAll.disabled = true;
            }
            return;
        }

        // Enable select all
        const selectAll = document.getElementById('selectAllExpired');
        if (selectAll) {
            selectAll.disabled = false;
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
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);

            newCheckbox.addEventListener('change', function() {
                updateSelectedExpiredItems();
                updateExpiredBulkActionButton();
                updateSelectAllExpiredCheckbox();
                // Update header count
                updateHeaderSelectedCount('expired-content', selectedExpiredItems.length);
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

    // Update selected items array
    function updateSelectedExpiredItems() {
        selectedExpiredItems = [];
        document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox:checked').forEach(checkbox => {
            selectedExpiredItems.push({
                content_type: checkbox.getAttribute('data-type'),
                content_id: checkbox.getAttribute('data-id')
            });
        });
        // Update header count
        updateHeaderSelectedCount('expired-content', selectedExpiredItems.length);
    }

    // Update pagination info
    function updateExpiredPaginationInfo(totalItems, currentPage, perPage = expiredItemsPerPage) {
        // This is now handled by the global updatePaginationUI function
        // Keep this for backward compatibility
        if (typeof updatePaginationUI === 'function') {
            updatePaginationUI('expired-content', currentPage, totalItems, perPage);
        } else {
            // Fallback original implementation
            const pageInfo = document.getElementById('expiredContentPageInfo');
            const prevBtn = document.getElementById('prevExpiredContentPage');
            const nextBtn = document.getElementById('nextExpiredContentPage');

            if (!pageInfo) return;

            const totalPages = Math.ceil(totalItems / perPage);
            pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

            if (prevBtn) prevBtn.disabled = currentPage === 1;
            if (nextBtn) nextBtn.disabled = currentPage === totalPages || totalPages === 0;
        }
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
        const button = document.getElementById('applyExpiredContentBulkAction');
        if (button) {
            button.disabled = selectedCount === 0;
        }
    }

    // Update select all checkbox
    function updateSelectAllExpiredCheckbox() {
        const selectAll = document.getElementById('selectAllExpired');
        if (!selectAll) return;

        const checkboxes = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox');
        const checkedCount = document.querySelectorAll('#expiredContentTableBody .expired-item-checkbox:checked').length;

        if (checkboxes.length > 0) {
            selectAll.checked = checkedCount === checkboxes.length;
            selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        } else {
            selectAll.checked = false;
            selectAll.indeterminate = false;
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

    // ============================================
    // ========== 12. TRASH FUNCTIONS ==========
    // ============================================

    // ===== TRASH MANAGEMENT =====

    // Global variables for trash
    let currentTrashPage = 1;
    const trashItemsPerPage = 10;
    let selectedTrashItems = [];
    let isLoadingTrash = false;
    let hasInitializedTrash = false;

    // Load trash stats and update dashboard card with micro loader
    function loadTrashStats(showMicroLoader = true) {
        // Show micro loader on trash card if requested
        if (showMicroLoader) {
            const trashCard = document.getElementById('trashCard');
            const trashCount = document.getElementById('trashCount');
            if (trashCard && trashCount) {
                // Store original value
                if (!trashCount.dataset.originalValue) {
                    trashCount.dataset.originalValue = trashCount.textContent;
                }

                // Add micro loader
                trashCard.classList.add('loading');
                trashCount.innerHTML = `
                    <div class="micro-loader">
                        <div class="micro-loader-dots">
                            <div class="micro-loader-dot"></div>
                            <div class="micro-loader-dot"></div>
                            <div class="micro-loader-dot"></div>
                        </div>
                    </div>
                `;
            }
        }

        return fetch('/api/admin/trash/stats', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch trash stats');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const totalTrash = data.stats.total || 0;
                const trashCountElement = document.getElementById('trashCount');
                const trashCard = document.getElementById('trashCard');

                if (trashCountElement) {
                    // Remove micro loader and update value
                    trashCountElement.innerHTML = totalTrash;
                    if (trashCountElement.dataset.originalValue) {
                        delete trashCountElement.dataset.originalValue;
                    }
                }

                if (trashCard) {
                    trashCard.classList.remove('loading');
                }

                // Update menu badge
                updateTrashMenuBadge(totalTrash);

                // Update card appearance
                if (trashCard) {
                    if (totalTrash > 0) {
                        trashCard.classList.remove('info');
                        trashCard.classList.add('warning');
                    } else {
                        trashCard.classList.remove('warning');
                        trashCard.classList.add('info');
                    }
                }

                // Update view link
                const viewLink = document.getElementById('viewTrashLink');
                if (viewLink) {
                    viewLink.style.display = 'block';
                    viewLink.style.pointerEvents = 'auto';
                    viewLink.style.opacity = '1';

                    if (totalTrash > 0) {
                        viewLink.innerHTML = `<i class="fas fa-trash"></i> View Trash (${totalTrash})`;
                    } else {
                        viewLink.innerHTML = '<i class="fas fa-trash"></i> Trash is Empty';
                    }
                }
            }
            return data;
        })
        .catch(error => {
            console.error('Error loading trash stats:', error);

            // Remove micro loader on error
            const trashCountElement = document.getElementById('trashCount');
            const trashCard = document.getElementById('trashCard');

            if (trashCountElement) {
                trashCountElement.innerHTML = '0';
                if (trashCountElement.dataset.originalValue) {
                    delete trashCountElement.dataset.originalValue;
                }
            }

            if (trashCard) {
                trashCard.classList.remove('loading');
            }
        });
    }

    // Update trash menu badge
    function updateTrashMenuBadge(count) {
        const menuBadge = document.getElementById('trashMenuBadge');
        if (menuBadge) {
            if (count > 0) {
                menuBadge.textContent = count > 99 ? '99+' : count;
                menuBadge.style.display = 'inline-block';
            } else {
                menuBadge.style.display = 'none';
            }
        }
    }

    // Load trash items
    function loadTrashItems(page = 1, search = '', typeFilter = '') {
        // Prevent multiple simultaneous loads
        if (isLoadingTrash) {
            console.log('⏳ Trash load already in progress, skipping...');
            return Promise.reject('Already loading');
        }

        isLoadingTrash = true;
        console.log(`📋 Loading trash items: page=${page}, search="${search}", type="${typeFilter}"`);

        const searchValue = search || document.getElementById('trashSearch')?.value || '';
        const filterValue = typeFilter || document.getElementById('trashTypeFilter')?.value || 'all';

        let url = `/api/admin/trash?page=${page}&per_page=${trashItemsPerPage}`;
        if (searchValue) url += `&search=${encodeURIComponent(searchValue)}`;
        if (filterValue && filterValue !== 'all') url += `&type=${encodeURIComponent(filterValue)}`;

        console.log(`📡 Fetching from: ${url}`);

        showLoading();

        return fetch(url, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Trash data received:', data);

            if (data.success) {
                renderTrashTable(data.data || []);

                const totalCount = data.count || 0;
                const currentPageNum = page;

                // CRITICAL: Update current page variables
                currentTrashPage = currentPageNum;
                currentPage.trash = currentPageNum;

                // CRITICAL: Call updatePaginationUI for trash section with correct parameters
                if (typeof updatePaginationUI === 'function') {
                    console.log(`Calling updatePaginationUI for trash with page: ${currentPageNum}, total: ${totalCount}`);
                    updatePaginationUI('trash', currentPageNum, totalCount, trashItemsPerPage);
                }

                // Update trash menu badge
                updateTrashMenuBadge(totalCount);

                // ✅ ADD THIS NOTIFICATION
                if (typeof showNotification === 'function') {
                    const loadedCount = data.data?.length || 0;
                    showNotification(`Loaded ${loadedCount} trash items`, 'success', 2000);
                }
                if (data.data && data.data.length > 0) {
                    console.log(`Loaded ${data.data.length} trash items, total: ${totalCount}, page: ${currentPageNum}`);
                }
            } else {
                throw new Error(data.error || 'Failed to load trash items');
            }
        })
        .catch(error => {
            console.error('Error loading trash items:', error);
            const tableBody = document.getElementById('trashTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 40px;">
                            <i class="fas fa-exclamation-triangle" style="color: var(--danger); font-size: 48px; margin-bottom: 15px;"></i>
                            <h3 style="color: var(--text-primary); margin: 0;">Failed to Load Trash</h3>
                            <p style="color: var(--text-secondary); margin: 10px 0 0 0;">${error.message}</p>
                            <button onclick="retryLoadTrash()" class="btn btn-primary" style="margin-top: 20px;">
                                <i class="fas fa-redo"></i> Try Again
                            </button>
                        </td>
                    </tr>
                `;
            }
            showNotification('Failed to load trash items', 'error');
            return Promise.reject(error);
        })
        .finally(() => {
            isLoadingTrash = false;
            hideLoading();
        });
    }

    // Update trash pagination info
    function updateTrashPaginationInfo(totalItems, currentPage, perPage) {
        // Call the global pagination UI update
        if (typeof updatePaginationUI === 'function') {
            updatePaginationUI('trash', currentPage, totalItems, perPage || trashItemsPerPage);
        }

        // Ensure loader is hidden after pagination update
        hideLoading();
    }

    // Render trash table
    function renderTrashTable(items) {
        const tableBody = document.getElementById('trashTableBody');
        if (!tableBody) return;

        // Reset selected items
        selectedTrashItems = [];

        if (!items || items.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <i class="fas fa-trash-alt" style="color: var(--text-light); font-size: 48px; margin-bottom: 15px;"></i>
                        <h3 style="color: var(--text-primary); margin: 0;">Trash is Empty</h3>
                        <p style="color: var(--text-secondary); margin: 10px 0 0 0;">No items in the trash. Deleted items will appear here.</p>
                    </td>
                </tr>
            `;

            // Disable select all checkbox
            const selectAll = document.getElementById('selectAllTrash');
            if (selectAll) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
                selectAll.disabled = true;
            }

            // Update selected count display
            const selectedCountEl = document.getElementById('selectedTrashCount');
            if (selectedCountEl) {
                selectedCountEl.textContent = '0 selected';
            }

            // Disable bulk action buttons
            const bulkActionBtn = document.getElementById('applyTrashBulkAction');
            if (bulkActionBtn) {
                bulkActionBtn.disabled = true;
            }

            const headerBulkBtn = document.getElementById('applyTrashBulkActionHeader');
            if (headerBulkBtn) {
                headerBulkBtn.disabled = true;
            }

            // Update header count
            updateHeaderSelectedCount('trash', 0);

            return;
        }

        // Enable select all checkbox
        const selectAll = document.getElementById('selectAllTrash');
        if (selectAll) {
            selectAll.disabled = false;
        }

        // Icon mapping for different content types
        const iconMap = {
            'courses': 'fa-book',
            'jobs': 'fa-briefcase',
            'internships': 'fa-user-graduate',
            'blog': 'fa-blog',
            'testimonials': 'fa-comment',
            'users': 'fa-user',
            'messages': 'fa-envelope',
            'newsletter': 'fa-newspaper',
            'admins': 'fa-user-shield'
        };

        // Display name mapping
        const displayNameMap = {
            'courses': 'Course',
            'jobs': 'Job',
            'internships': 'Internship',
            'blog': 'Blog Post',
            'testimonials': 'Testimonial',
            'users': 'User',
            'messages': 'Message',
            'newsletter': 'Newsletter',
            'admins': 'Admin'
        };

        // Calculate serial number based on current page
        const startSerial = (currentTrashPage - 1) * trashItemsPerPage;

        tableBody.innerHTML = items.map((item, index) => {
            const serialNo = startSerial + index + 1;
            const icon = iconMap[item.content_type] || 'fa-file';
            const displayName = displayNameMap[item.content_type] || item.content_type.charAt(0).toUpperCase() + item.content_type.slice(1);

            const deletedDate = item.deleted_at ? formatDate(item.deleted_at, true) : 'Unknown';
            const createdDate = item.created_at ? formatDate(item.created_at) : 'Unknown';

            // Get days ago text
            let daysAgoText = '';
            if (item.deleted_at) {
                try {
                    daysAgoText = getDaysAgo(item.deleted_at);
                } catch (e) {
                    console.warn('Error formatting days ago:', e);
                    daysAgoText = '';
                }
            }

            return `
                <tr data-item-id="${item.id}" data-item-type="${item.content_type}">
                    <td style="text-align: center; width: 40px;">
                        <input type="checkbox" class="trash-item-checkbox"
                               data-type="${item.content_type}"
                               data-id="${item.id}"
                               data-table="${item.table_name}">
                    </td>
                    <td class="serial-no" style="text-align: center; width: 60px;">${serialNo}</td>
                    <td style="width: 120px;">
                        <span class="content-type-badge ${item.content_type}">
                            <i class="fas ${icon}"></i>
                            ${displayName}
                        </span>
                    </td>
                    <td><strong>${escapeHTML(item.title || 'Untitled')}</strong></td>
                    <td>${escapeHTML(item.subtitle || item.email || 'N/A')}</td>
                    <td style="color: var(--danger);" title="${deletedDate}">
                        <i class="fas fa-clock"></i> ${daysAgoText || deletedDate}
                    </td>
                    <td>${createdDate}</td>
                    <td style="text-align: center;">
                        <div class="action-buttons">
                            <button class="btn-icon restore-item"
                                    data-type="${item.content_type}"
                                    data-id="${item.id}"
                                    data-table="${item.table_name}"
                                    title="Restore Item">
                                <i class="fas fa-undo-alt"></i>
                            </button>
                            <button class="btn-icon view-item"
                                    data-type="${item.content_type}"
                                    data-id="${item.id}"
                                    title="View Details">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon permanent-delete-item"
                                    data-type="${item.content_type}"
                                    data-id="${item.id}"
                                    data-table="${item.table_name}"
                                    title="Delete Permanently">
                                <i class="fas fa-trash-alt" style="color: var(--danger);"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Add event listeners to the newly created buttons
        addTrashRowEventListeners();

        // Update selected items and UI
        updateSelectedTrashItems();
        updateTrashBulkActionButton();
        updateSelectAllTrashCheckbox();

        // Update header count
        updateHeaderSelectedCount('trash', selectedTrashItems.length);
    }

    // event listeners to trash table rows
    function addTrashRowEventListeners() {
        // Individual checkboxes
        document.querySelectorAll('#trashTableBody .trash-item-checkbox').forEach(checkbox => {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);

            newCheckbox.addEventListener('change', function(e) {
                e.stopPropagation();
                updateSelectedTrashItems();
                updateTrashBulkActionButton();
                updateSelectAllTrashCheckbox();
                // Update header count
                updateHeaderSelectedCount('trash', selectedTrashItems.length);
            });
        });

        // Restore buttons
        document.querySelectorAll('#trashTableBody .restore-item').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const contentType = this.getAttribute('data-type');
                const contentId = this.getAttribute('data-id');
                const tableName = this.getAttribute('data-table');
                restoreSingleTrashItem(contentType, contentId, tableName);
            });
        });

        // View buttons - FIXED to handle testimonials and blog properly
        document.querySelectorAll('#trashTableBody .view-item').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const contentType = this.getAttribute('data-type');
                const contentId = this.getAttribute('data-id');

                console.log(`View button clicked - Type: ${contentType}, ID: ${contentId}`);

                // Handle different content types
                if (contentType === 'testimonial') {
                    // Use testimonial view modal
                    viewTestimonialFromTrash(contentId);
                } else if (contentType === 'blog') {
                    // Use blog view modal
                    openViewModal('blog', contentId);
                } else if (contentType === 'user') {
                    openViewModal('users', contentId);
                } else if (contentType === 'message') {
                    viewMessage(contentId);
                } else if (contentType === 'newsletter') {
                    openViewModal('newsletter', contentId);
                } else {
                    // For courses, jobs, internships - add 's' for plural
                    const tableName = contentType === 'course' ? 'courses' :
                                     contentType === 'job' ? 'jobs' :
                                     contentType === 'internship' ? 'internships' :
                                     contentType + 's';
                    openViewModal(tableName, contentId);
                }
            });
        });

        // Permanent delete buttons
        document.querySelectorAll('#trashTableBody .permanent-delete-item').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const contentType = this.getAttribute('data-type');
                const contentId = this.getAttribute('data-id');
                const tableName = this.getAttribute('data-table');
                console.log('Delete button clicked:', { contentType, contentId, tableName });
                permanentlyDeleteSingleItem(contentType, contentId, tableName);
            });
        });
    }

    // Handle testimonial view from trash
    function viewTestimonialFromTrash(testimonialId) {
        console.log(`Viewing testimonial from trash: ${testimonialId}`);

        showLoading();

        fetch(`/api/admin/testimonials/${testimonialId}`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: Failed to fetch testimonial`);
            }
            return response.json();
        })
        .then(result => {
            if (result.success && result.testimonial) {
                showTestimonialModal(result.testimonial);
            } else {
                throw new Error(result.error || 'Failed to load testimonial');
            }
        })
        .catch(error => {
            console.error('Error loading testimonial:', error);
            showNotification('Failed to load testimonial details', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    // Show testimonial modal
    function showTestimonialModal(testimonial) {
        const modal = document.getElementById('contentViewModal');
        if (!modal) {
            console.error('Content view modal not found');
            return;
        }

        const title = modal.querySelector('.modal-title');
        const body = modal.querySelector('#contentViewBody');

        if (title) title.textContent = 'Testimonial Details';
        if (body) {
            const ratingStars = '★'.repeat(testimonial.rating || 5) + '☆'.repeat(5 - (testimonial.rating || 5));

            body.innerHTML = `
                <div class="view-field">
                    <label>User:</label>
                    <span>${escapeHTML(testimonial.username || 'Anonymous')}</span>
                </div>
                <div class="view-field">
                    <label>Email:</label>
                    <span>${escapeHTML(testimonial.user_email || testimonial.email || 'N/A')}</span>
                </div>
                <div class="view-field">
                    <label>Rating:</label>
                    <span>${testimonial.rating || 5}/5 (${ratingStars})</span>
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
                    <div class="view-content" style="background: var(--bg-primary); padding: 15px; border-radius: 5px; border-left: 4px solid var(--primary);">
                        ${escapeHTML(testimonial.content || 'No content')}
                    </div>
                </div>
            `;
        }
        modal.style.display = 'block';
        console.log('✅ Testimonial modal displayed');
    }

    // Update selected trash items array
    function updateSelectedTrashItems() {
        selectedTrashItems = [];
        document.querySelectorAll('#trashTableBody .trash-item-checkbox:checked').forEach(checkbox => {
            selectedTrashItems.push({
                content_type: checkbox.getAttribute('data-type'),
                content_id: checkbox.getAttribute('data-id'),
                table_name: checkbox.getAttribute('data-table')
            });
        });

        // Update selected count display
        const selectedCountEl = document.getElementById('selectedTrashCount');
        if (selectedCountEl) {
            const count = selectedTrashItems.length;
            selectedCountEl.textContent = count === 0 ? '0 selected' : `${count} selected`;
        }

        // Update header count
        updateHeaderSelectedCount('trash', selectedTrashItems.length);
    }

    // Update trash bulk action button state
    function updateTrashBulkActionButton() {
        const selectedCount = document.querySelectorAll('#trashTableBody .trash-item-checkbox:checked').length;
        const button = document.getElementById('applyTrashBulkAction');
        if (button) {
            button.disabled = selectedCount === 0;
        }
    }

    // Update select all checkbox
    function updateSelectAllTrashCheckbox() {
        const selectAll = document.getElementById('selectAllTrash');
        if (!selectAll) return;

        const checkboxes = document.querySelectorAll('#trashTableBody .trash-item-checkbox');
        const checkedCount = document.querySelectorAll('#trashTableBody .trash-item-checkbox:checked').length;

        if (checkboxes.length > 0) {
            selectAll.checked = checkedCount === checkboxes.length;
            selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
        } else {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        }
    }

    // Setup trash event listeners
    function setupTrashEvents() {
        console.log('Setting up trash events...');

        // Refresh button
        const refreshBtn = document.getElementById('refreshTrashBtn');
        if (refreshBtn) {
            const newBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Refreshing trash...');
                loadTrashItems(currentTrashPage);
            });
        }

        // Empty trash button
        const emptyTrashBtn = document.getElementById('emptyTrashBtn');
        if (emptyTrashBtn) {
            const newBtn = emptyTrashBtn.cloneNode(true);
            emptyTrashBtn.parentNode.replaceChild(newBtn, emptyTrashBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                emptyTrash();
            });
        }

        // Clear old trash button
        const clearOldTrashBtn = document.getElementById('clearOldTrashBtn');
        if (clearOldTrashBtn) {
            const newBtn = clearOldTrashBtn.cloneNode(true);
            clearOldTrashBtn.parentNode.replaceChild(newBtn, clearOldTrashBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                clearOldTrash();
            });
        }

        // Search functionality
        const searchInput = document.getElementById('trashSearch');
        if (searchInput) {
            const searchBtn = searchInput.parentElement?.querySelector('.search-btn') ||
                              searchInput.closest('.search-box')?.querySelector('.search-btn');

            if (searchBtn) {
                const newBtn = searchBtn.cloneNode(true);
                searchBtn.parentNode.replaceChild(newBtn, searchBtn);

                newBtn.addEventListener('click', function() {
                    const searchTerm = searchInput.value.trim();
                    currentTrashPage = 1;
                    loadTrashItems(1, searchTerm);
                });

                searchInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        newBtn.click();
                    }
                });
            }
        }

        // Type filter
        const filterSelect = document.getElementById('trashTypeFilter');
        if (filterSelect) {
            const newSelect = filterSelect.cloneNode(true);
            filterSelect.parentNode.replaceChild(newSelect, filterSelect);
            newSelect.addEventListener('change', function() {
                currentTrashPage = 1;
                loadTrashItems(1, '', this.value);
            });
        }

        // Select All checkbox
        const selectAll = document.getElementById('selectAllTrash');
        if (selectAll) {
            const newSelectAll = selectAll.cloneNode(true);
            selectAll.parentNode.replaceChild(newSelectAll, selectAll);
            newSelectAll.addEventListener('change', function() {
                const checkboxes = document.querySelectorAll('#trashTableBody .trash-item-checkbox');
                selectedTrashItems = [];
                checkboxes.forEach(checkbox => {
                    checkbox.checked = this.checked;
                    if (this.checked) {
                        selectedTrashItems.push({
                            content_type: checkbox.getAttribute('data-type'),
                            content_id: checkbox.getAttribute('data-id'),
                            table_name: checkbox.getAttribute('data-table')
                        });
                    }
                });
                updateTrashBulkActionButton();
                updateSelectAllTrashCheckbox();
                updateHeaderSelectedCount('trash', selectedTrashItems.length);
            });
        }

        // Bulk action button
        const bulkActionBtn = document.getElementById('applyTrashBulkAction');
        if (bulkActionBtn) {
            const newBtn = bulkActionBtn.cloneNode(true);
            bulkActionBtn.parentNode.replaceChild(newBtn, bulkActionBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const action = document.getElementById('trashBulkAction').value;
                if (!action) {
                    showNotification('Please select a bulk action first', 'warning');
                    return;
                }
                performTrashBulkAction(action);
            });
        }
    }

    // Initialize trash section
    function initTrashSection() {
        if (hasInitializedTrash) {
            console.log('Trash section already initialized, skipping...');
            return;
        }

        console.log('Initializing trash section...');
        hasInitializedTrash = true;

        // Sync currentTrashPage with global currentPage.trash
        if (currentPage.trash && currentPage.trash > 0) {
            currentTrashPage = currentPage.trash;
        } else if (!currentTrashPage) {
            currentTrashPage = 1;
            currentPage.trash = 1;
        }

        console.log(`Trash initial page: ${currentTrashPage}`);

        // Setup trash section observer
        const trashSection = document.getElementById('trash');
        if (trashSection) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (trashSection.classList.contains('active') && !isLoadingTrash) {
                            console.log('Trash section activated - loading data');
                            loadTrashItems(currentTrashPage);
                        }
                    }
                });
            });
            observer.observe(trashSection, { attributes: true });
        }

        // Setup event listeners
        setupTrashEvents();

        // Load trash stats
        loadTrashStats(true);

        // If trash section is already active, load data
        if (trashSection && trashSection.classList.contains('active')) {
            console.log('Trash section already active, loading data...');
            loadTrashItems(currentTrashPage);
        }
    }

    // Clear old trash items (older than 30 days) - UI only
    function clearOldTrash() {
        showConfirmation('bulk_action',
            'Remove items older than 30 days from trash view? They will be kept in our records.',
            () => {
                console.log('Clearing old items from trash UI');

                // Get all rows and check their deleted date
                const rows = document.querySelectorAll('#trashTableBody tr');
                let removedCount = 0;

                rows.forEach(row => {
                    const deletedCell = row.querySelector('td:nth-child(6)'); // Deleted column
                    if (deletedCell) {
                        const deletedText = deletedCell.textContent;
                        // Check if it's older than 30 days (you can implement actual date logic)
                        // For now, we'll just remove items with "month" or "year" in the text
                        if (deletedText.includes('month') || deletedText.includes('year')) {
                            row.remove();
                            removedCount++;
                        }
                    }
                });

                if (removedCount > 0) {
                    showNotification(`Removed ${removedCount} old items from trash view`, 'success');

                    // Check if table is empty
                    const tableBody = document.getElementById('trashTableBody');
                    if (tableBody && tableBody.children.length === 0) {
                        tableBody.innerHTML = `
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 40px;">
                                    <i class="fas fa-trash-alt" style="color: var(--text-light); font-size: 48px; margin-bottom: 15px;"></i>
                                    <h3 style="color: var(--text-primary); margin: 0;">Trash is Empty</h3>
                                    <p style="color: var(--text-secondary); margin: 10px 0 0 0;">No items in the trash.</p>
                                </td>
                            </tr>
                        `;

                        // Disable select all
                        const selectAll = document.getElementById('selectAllTrash');
                        if (selectAll) {
                            selectAll.checked = false;
                            selectAll.indeterminate = false;
                            selectAll.disabled = true;
                        }
                    }

                    // Update trash count
                    const trashCountElement = document.getElementById('trashCount');
                    if (trashCountElement) {
                        const currentCount = parseInt(trashCountElement.textContent) || 0;
                        trashCountElement.textContent = Math.max(0, currentCount - removedCount);
                    }

                    // Update menu badge
                    const menuBadge = document.getElementById('trashMenuBadge');
                    if (menuBadge) {
                        const currentBadgeCount = parseInt(menuBadge.textContent) || 0;
                        const newCount = Math.max(0, currentBadgeCount - removedCount);
                        if (newCount <= 0) {
                            menuBadge.style.display = 'none';
                        } else {
                            menuBadge.textContent = newCount;
                        }
                    }
                } else {
                    showNotification('No old items found to remove', 'info');
                }
            }
        );
    }

    // Restore single item from trash
    function restoreSingleTrashItem(contentType, contentId, tableName) {
        showConfirmation('restore',
            `Restore this ${contentType} from trash? It will remain in its current state (${getStateDescription(contentType)}).`,
            () => {
                showLoading();

                console.log(`Restoring ${contentType} with ID: ${contentId} from table: ${tableName}`);

                fetch(`/api/admin/trash/restore/${contentType}/${contentId}`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(err => {
                            throw new Error(err.error || err.message || 'Failed to restore item');
                        });
                    }
                    return response.json();
                })
                .then(result => {
                    if (result.success) {
                        let displayName = getDisplayName(contentType);

                        let statusMessage = '';
                        if (result.is_active !== undefined) {
                            statusMessage = result.is_active
                                ? ' (remains active)'
                                : ' (remains inactive)';
                        }
                        if (result.is_featured !== undefined && result.is_featured) {
                            statusMessage += ' (featured status removed)';
                        }

                        showNotification(`${displayName} restored from trash${statusMessage}`, 'success');

                        // Remove the item from UI
                        const row = document.querySelector(`#trashTableBody tr .restore-item[data-id="${contentId}"]`)?.closest('tr');
                        if (row) {
                            row.remove();
                        }

                        // Check if table is empty
                        const tableBody = document.getElementById('trashTableBody');
                        if (tableBody && tableBody.children.length === 0) {
                            tableBody.innerHTML = `
                                <tr>
                                    <td colspan="8" style="text-align: center; padding: 40px;">
                                        <i class="fas fa-trash-alt" style="color: var(--text-light); font-size: 48px; margin-bottom: 15px;"></i>
                                        <h3 style="color: var(--text-primary); margin: 0;">Trash is Empty</h3>
                                        <p style="color: var(--text-secondary); margin: 10px 0 0 0;">No items in the trash.</p>
                                     </td>
                                 </tr>
                            `;

                            const selectAll = document.getElementById('selectAllTrash');
                            if (selectAll) {
                                selectAll.checked = false;
                                selectAll.indeterminate = false;
                                selectAll.disabled = true;
                            }
                        }

                        // Update counts
                        loadTrashStats(true);
                        loadDashboardStats();

                        // Clear from selected items
                        selectedTrashItems = selectedTrashItems.filter(item =>
                            !(item.content_id === contentId && item.content_type === contentType)
                        );
                        updateTrashBulkActionButton();
                        updateSelectAllTrashCheckbox();
                        updateSelectedTrashItems();

                    } else {
                        showNotification(result.error || 'Failed to restore item', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error restoring item:', error);
                    showNotification(error.message || 'Failed to restore item', 'error');
                })
                .finally(() => {
                    hideLoading();
                });
            }
        );
    }

    // "Permanently delete" from trash - mark as hidden in database
    function permanentlyDeleteSingleItem(contentType, contentId, tableName) {
        showConfirmation('delete',
            `Remove this ${contentType} from trash permanently? It will be hidden forever.`,
            async () => {
                showLoading();

                try {
                    const response = await fetch('/api/admin/trash/hide-permanently', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            items: [{
                                content_type: contentType,
                                content_id: contentId,
                                table_name: tableName
                            }]
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to hide item');
                    }

                    if (data.success) {
                        // Remove the item from UI
                        const row = document.querySelector(`#trashTableBody tr .permanent-delete-item[data-id="${contentId}"]`)?.closest('tr');
                        if (row) {
                            row.remove();
                        }

                        showNotification(`${contentType} permanently removed from trash`, 'success');

                        // Check if table is empty
                        const tableBody = document.getElementById('trashTableBody');
                        if (tableBody && tableBody.children.length === 0) {
                            tableBody.innerHTML = `
                                <tr>
                                    <td colspan="8" style="text-align: center; padding: 40px;">
                                        <i class="fas fa-trash-alt" style="color: var(--text-light); font-size: 48px; margin-bottom: 15px;"></i>
                                        <h3 style="color: var(--text-primary); margin: 0;">Trash is Empty</h3>
                                        <p style="color: var(--text-secondary); margin: 10px 0 0 0;">No items in the trash.</p>
                                    </td>
                                </tr>
                            `;

                            // Disable select all
                            const selectAll = document.getElementById('selectAllTrash');
                            if (selectAll) {
                                selectAll.checked = false;
                                selectAll.indeterminate = false;
                                selectAll.disabled = true;
                            }
                        }

                        // Update trash stats from server
                        await loadTrashStats(true);
                        await loadDashboardStats();

                        // Clear from selected items
                        selectedTrashItems = selectedTrashItems.filter(item =>
                            !(item.content_id === contentId && item.content_type === contentType)
                        );
                        updateTrashBulkActionButton();
                        updateSelectAllTrashCheckbox();
                        updateSelectedTrashItems();
                    }
                } catch (error) {
                    console.error('Error hiding item:', error);
                    showNotification(error.message || 'Failed to hide item', 'error');
                } finally {
                    hideLoading();
                }
            }
        );
    }

    // Bulk hide items from trash
    function bulkPermanentlyDeleteTrashItems(items) {
        if (!items || items.length === 0) {
            showNotification('No items selected', 'warning');
            return;
        }

        showLoading();

        fetch('/api/admin/trash/hide-permanently', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ items: items })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Remove items from UI
                items.forEach(item => {
                    const row = document.querySelector(`#trashTableBody tr .permanent-delete-item[data-id="${item.content_id}"]`)?.closest('tr');
                    if (row) row.remove();
                });

                showNotification(`Permanently removed ${items.length} items from trash`, 'success');

                // Check if table is empty
                const tableBody = document.getElementById('trashTableBody');
                if (tableBody && tableBody.children.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 40px;">
                                <i class="fas fa-trash-alt" style="color: var(--text-light); font-size: 48px;"></i>
                                <h3>Trash is Empty</h3>
                            </td>
                        </tr>
                    `;
                    const selectAll = document.getElementById('selectAllTrash');
                    if (selectAll) selectAll.disabled = true;
                }

                loadTrashStats(true);
                loadDashboardStats();
                selectedTrashItems = [];
                updateTrashBulkActionButton();
                updateSelectAllTrashCheckbox();
            } else {
                showNotification(data.error || 'Failed to delete items', 'error');
            }
        })
        .catch(error => {
            console.error('Error hiding items:', error);
            showNotification('Failed to delete items', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    // Empty trash - hide ALL items permanently
    function emptyTrash() {
        // Get all visible items first
        const allItems = [];
        document.querySelectorAll('#trashTableBody .trash-item-checkbox').forEach(checkbox => {
            allItems.push({
                content_type: checkbox.getAttribute('data-type'),
                content_id: checkbox.getAttribute('data-id'),
                table_name: checkbox.getAttribute('data-table')
            });
        });

        if (allItems.length === 0) {
            showNotification('Trash is already empty', 'info');
            return;
        }

        showConfirmation('delete',
            `Permanently remove all ${allItems.length} items from trash? They will be hidden forever.`,
            async () => {
                showLoading();

                try {
                    const response = await fetch('/api/admin/trash/hide-permanently', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ items: allItems })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to empty trash');
                    }

                    if (data.success) {
                        // Clear the table
                        const tableBody = document.getElementById('trashTableBody');
                        if (tableBody) {
                            tableBody.innerHTML = `
                                <tr>
                                    <td colspan="8" style="text-align: center; padding: 40px;">
                                        <i class="fas fa-trash-alt" style="color: var(--text-light); font-size: 48px; margin-bottom: 15px;"></i>
                                        <h3 style="color: var(--text-primary); margin: 0;">Trash is Empty</h3>
                                        <p style="color: var(--text-secondary); margin: 10px 0 0 0;">No items in the trash.</p>
                                    </td>
                                </tr>
                            `;
                        }

                        // Disable select all
                        const selectAll = document.getElementById('selectAllTrash');
                        if (selectAll) {
                            selectAll.checked = false;
                            selectAll.indeterminate = false;
                            selectAll.disabled = true;
                        }

                        showNotification('Trash emptied successfully', 'success');

                        // Update trash stats from server
                        await loadTrashStats(true);
                        await loadDashboardStats();

                        // Clear selected items
                        selectedTrashItems = [];
                        updateTrashBulkActionButton();
                        updateSelectAllTrashCheckbox();
                        updateSelectedTrashItems();
                    }
                } catch (error) {
                    console.error('Error emptying trash:', error);
                    showNotification(error.message || 'Failed to empty trash', 'error');
                } finally {
                    hideLoading();
                }
            }
        );
    }

    // Perform trash bulk action
    function performTrashBulkAction(action) {
        // Get selected items directly from checkboxes
        const selectedItems = [];
        document.querySelectorAll('#trashTableBody .trash-item-checkbox:checked').forEach(checkbox => {
            selectedItems.push({
                content_type: checkbox.getAttribute('data-type'),
                content_id: checkbox.getAttribute('data-id'),
                table_name: checkbox.getAttribute('data-table')
            });
        });

        console.log('Selected items for bulk action:', selectedItems); // DEBUG LOG

        if (selectedItems.length === 0) {
            showNotification('Please select at least one item', 'warning');
            return;
        }

        console.log(`Bulk action: ${action} on ${selectedItems.length} items`, selectedItems);

        if (action === 'restore') {
            showConfirmation('bulk_action',
                `Restore ${selectedItems.length} item(s) from trash? They will remain in their current state.`,
                () => bulkRestoreTrashItems(selectedItems)
            );
        } else if (action === 'delete') {
            showConfirmation('delete',
                `Permanently delete ${selectedItems.length} item(s)? This action CANNOT be undone.`,
                () => bulkPermanentlyDeleteTrashItems(selectedItems)
            );
        }
    }

    // Bulk restore trash items
    function bulkRestoreTrashItems(items) {
        console.log('bulkRestoreTrashItems called with:', items);

        if (!items || items.length === 0) {
            showNotification('No items selected', 'warning');
            return;
        }

        showLoading();

        // Format items for API
        const apiItems = items.map(item => ({
            content_type: item.content_type,
            content_id: item.content_id,
            table_name: item.table_name
        }));

        console.log('Sending to API:', apiItems);

        fetch('/api/admin/trash/bulk-restore', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ items: apiItems })
        })
        .then(async response => {
            console.log('Response status:', response.status);
            const text = await response.text();
            console.log('Response text:', text);

            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse JSON:', e);
                throw new Error('Invalid response from server');
            }

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Failed to restore items');
            }
            return data;
        })
        .then(result => {
            console.log('Bulk restore result:', result);

            if (result.success) {
                const restoredCount = result.restored_count || items.length;
                showNotification(`Successfully restored ${restoredCount} item(s) from trash`, 'success');

                // Remove restored items from UI
                items.forEach(item => {
                    // Find and remove the row
                    const checkbox = document.querySelector(`#trashTableBody .trash-item-checkbox[data-id="${item.content_id}"]`);
                    if (checkbox) {
                        const row = checkbox.closest('tr');
                        if (row) {
                            row.remove();
                        }
                    }
                });

                // Check if table is empty
                const tableBody = document.getElementById('trashTableBody');
                if (tableBody && tableBody.children.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 40px;">
                                <i class="fas fa-trash-alt" style="color: var(--text-light); font-size: 48px; margin-bottom: 15px;"></i>
                                <h3 style="color: var(--text-primary); margin: 0;">Trash is Empty</h3>
                                <p style="color: var(--text-secondary); margin: 10px 0 0 0;">No items in the trash.</p>
                            </td>
                        </tr>
                    `;

                    const selectAll = document.getElementById('selectAllTrash');
                    if (selectAll) {
                        selectAll.checked = false;
                        selectAll.indeterminate = false;
                        selectAll.disabled = true;
                    }
                }

                // Update counts and clear selections
                loadTrashStats(true);
                loadDashboardStats();
                selectedTrashItems = [];
                updateTrashBulkActionButton();
                updateSelectAllTrashCheckbox();
                updateSelectedTrashItems();

            } else {
                showNotification(result.error || 'Failed to restore items', 'error');
            }
        })
        .catch(error => {
            console.error('Error bulk restoring items:', error);
            showNotification(error.message || 'Failed to restore items. Please try again.', 'error');
        })
        .finally(() => {
            hideLoading();
        });
    }

    // ============================================
    // ========== 13. ACTIVITY FUNCTIONS ==========
    // ============================================

    // Initialize activity scrollbar
    function initActivityScrollbar() {
        const activityContainer = document.querySelector('.activity-container');
        const activityList = document.querySelector('.activity-list');

        if (!activityContainer || !activityList) return;

        // Calculate if we need scrollbar
        const containerHeight = activityContainer.clientHeight;
        const contentHeight = activityList.scrollHeight;

        // Show scrollbar only if content overflows
        if (contentHeight > containerHeight) {
            activityContainer.classList.add('scrollable');
            console.log(`📜 Scrollbar enabled (Content: ${contentHeight}px, Container: ${containerHeight}px)`);
        } else {
            activityContainer.classList.remove('scrollable');
        }

        // Update on window resize
        window.addEventListener('resize', initActivityScrollbar);
    }

    // Helper function: Update activities display
    function updateActivitiesDisplay(activities) {
        const activityList = document.querySelector('.activity-list');
        const activityCount = document.getElementById('activityCount');

        if (!activityList) {
            console.error('❌ Cannot update activities: .activity-list element not found');
            return;
        }

        // Update activity count
        if (activityCount) {
            activityCount.textContent = activities?.length || 0;
        }

        if (!activities || activities.length === 0) {
            showNoActivitiesMessage();
            return;
        }

        console.log(`🔄 Rendering ${activities.length} activities in scrollable container`);

        activityList.innerHTML = activities.map(activity => {
            const icon = activity.icon || getActivityIcon(activity.type);
            const message = escapeHTML(activity.message || 'No message');
            const timeAgo = formatActivityTime(activity.time || activity.timestamp || activity.created_at);

            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <i class="fas fa-${icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p class="activity-message">${message}</p>
                        <small class="activity-time">${timeAgo}</small>
                    </div>
                </div>
            `;
        }).join('');

        // Initialize scrollbar after content is loaded
        setTimeout(initActivityScrollbar, 100);
    }

    // ============================================
    // ========== 14. BLOG FUNCTIONS ==========
    // ============================================

    // Global variable to store the categories manager
    let blogCategoriesManager = null;

    //  single category dropdown for blog posts
    function setupBlogCategories() {
        console.log('Setting up blog category dropdown');

        const categorySelect = document.getElementById('blogCategory');
        const hiddenInput = document.getElementById('blogCategoriesHidden');

        if (!categorySelect) {
            console.log('Blog category select not found');
            return null;
        }

        // Function to set the selected category
        function setCategory(category) {
            if (category) {
                categorySelect.value = category;
                if (hiddenInput) {
                    // ALWAYS store as JSON array string - this is what old file expects
                    hiddenInput.value = JSON.stringify([category]);
                }
            }
        }

        // Initialize with any existing values (for edit mode)
        function initializeWithValues(categories) {
            console.log('Setting category with:', categories);
            if (categories) {
                let categoryValue = '';

                // Handle different possible formats
                if (Array.isArray(categories) && categories.length > 0) {
                    categoryValue = categories[0];
                } else if (typeof categories === 'string') {
                    // Try to parse if it's a JSON string
                    try {
                        const parsed = JSON.parse(categories);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            categoryValue = parsed[0];
                        } else {
                            categoryValue = categories;
                        }
                    } catch (e) {
                        // Not JSON, use as is
                        categoryValue = categories;
                    }
                }

                if (categoryValue) {
                    setCategory(categoryValue);
                }
            }
        }

        // Clear selection
        function clearSelections() {
            console.log('Clearing category selection');
            categorySelect.value = '';
            if (hiddenInput) {
                hiddenInput.value = '';
            }
        }

        // Get selected category as array (for compatibility with old code)
        function getSelectedCategories() {
            return categorySelect.value ? [categorySelect.value] : [];
        }

        // Handle category change - update hidden input with JSON array
        categorySelect.addEventListener('change', function(e) {
            const selectedCategory = e.target.value;
            if (hiddenInput) {
                if (selectedCategory) {
                    // Store as JSON array string - exactly what old file expects
                    hiddenInput.value = JSON.stringify([selectedCategory]);
                } else {
                    hiddenInput.value = '';
                }
            }
        });

        console.log('✅ Blog category dropdown setup complete');

        return {
            initializeWithValues: initializeWithValues,
            clearSelections: clearSelections,
            getSelectedCategories: getSelectedCategories
        };
    }

    // ============================================
    // ========== 15. LOGO PREVIEW FUNCTIONS ==========
    // ============================================

    // Setup logo preview
    function setupLogoPreview() {
        // Use event delegation for company inputs
        document.addEventListener('input', function(e) {
            // Only process if the target is a company field and the modal is open
            if ((e.target.name === 'company' || e.target.id.includes('Company')) && e.target.closest('.modal[style*="display: block"]')) {
                const companyName = e.target.value.trim();
                const inputField = e.target;

                // Clear any existing preview for this specific input
                clearLogoPreview(inputField);

                // Only show preview if company name has at least 2 characters
                if (companyName.length >= 2) {
                    // Clear previous timeout
                    if (inputField.logoPreviewTimeout) {
                        clearTimeout(inputField.logoPreviewTimeout);
                    }
                    // Add delay to avoid too many API calls
                    inputField.logoPreviewTimeout = setTimeout(() => {
                        previewCompanyLogo(companyName, inputField);
                    }, 500);
                }
            }
        });

        // Also handle blur event for immediate preview
        document.addEventListener('blur', function(e) {
            if ((e.target.name === 'company' || e.target.id.includes('Company')) && e.target.closest('.modal[style*="display: block"]')) {
                const companyName = e.target.value.trim();
                const inputField = e.target;

                if (companyName.length >= 2) {
                    clearLogoPreview(inputField);
                    previewCompanyLogo(companyName, inputField);
                }
            }
        }, true);
    }

    function clearLogoPreview(inputField) {
        if (!inputField) return;

        const formGroup = inputField.closest('.form-group');
        if (!formGroup) return;

        const existingPreview = formGroup.querySelector('.logo-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
    }

    function previewCompanyLogo(companyName, inputField) {
        // Don't show preview if company name is empty or too short
        if (!companyName || companyName.length < 2) {
            clearLogoPreview(inputField);
            return;
        }

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
                    <span>Searching logo for "${escapeHTML(companyName)}"...</span>
                </div>
                <div class="logo-result" style="display: none;">
                    <img src="" alt="${escapeHTML(companyName)} logo" class="logo-image" style="max-width: 32px; max-height: 32px; margin-right: 8px;">
                    <span class="logo-text" style="font-size: 12px; color: #666;">Logo preview available</span>
                </div>
                <div class="logo-error" style="display: none;">
                    <i class="fas fa-exclamation-triangle" style="color: #ffc107;"></i>
                    <span style="font-size: 12px; color: #666;">No logo found</span>
                </div>
            </div>
        `;

        previewContainer.style.cssText = `
            margin-top: 8px;
            padding: 8px;
            border-radius: 4px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
        `;

        // Insert after the input field
        inputField.insertAdjacentElement('afterend', previewContainer);

        // Fetch logo preview
        fetch(`/api/company-logo/preview?company=${encodeURIComponent(companyName)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Check if the preview container still exists and is for the same company
                const currentPreview = inputField.nextElementSibling;
                if (!currentPreview || !currentPreview.classList || !currentPreview.classList.contains('logo-preview')) {
                    return;
                }

                const loading = currentPreview.querySelector('.logo-loading');
                const result = currentPreview.querySelector('.logo-result');
                const error = currentPreview.querySelector('.logo-error');
                const logoImage = currentPreview.querySelector('.logo-image');

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
                const currentPreview = inputField.nextElementSibling;
                if (!currentPreview || !currentPreview.classList || !currentPreview.classList.contains('logo-preview')) {
                    return;
                }
                const loading = currentPreview.querySelector('.logo-loading');
                const errorDiv = currentPreview.querySelector('.logo-error');
                if (loading) loading.style.display = 'none';
                if (errorDiv) {
                    errorDiv.style.display = 'flex';
                    errorDiv.style.alignItems = 'center';
                    errorDiv.style.gap = '8px';
                }
            });
    }

    // ============================================
    // ========== 16. NOTIFICATION FUNCTIONS ==========
    // ============================================

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
        return fetch('/api/admin/notifications', {
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
            throw error; // Re-throw to handle in Promise.all
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

    // ============================================
    // ========== 17. NAVIGATION & HISTORY FUNCTIONS ==========
    // ============================================

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

    // Section restoration
    function restoreCurrentSection() {
        console.log('🔄 restoreCurrentSection() called');


        // Check if this is a fresh login (no previous session)
        const isFreshLogin = !sessionStorage.getItem('adminSessionStarted');
        console.log('Fresh login detected:', isFreshLogin);

        // Define valid sections including ALL sections
        const validSections = [
            'dashboard', 'courses', 'jobs', 'internships',
            'blog', 'newsletter', 'testimonials',
            'expired-content', 'users', 'messages', 'trash', 'admins', 'analytics'
        ];

        console.log('Valid sections:', validSections);

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

            // Show greeting message immediately
            displayWelcomeMessage();

            // Force dashboard
            const dashboardItem = document.querySelector('.sidebar-menu a[href="#dashboard"]');
            const dashboardSection = document.getElementById('dashboard');

            if (dashboardItem && dashboardSection) {
                // Remove active class from all menu items and sections first
                document.querySelectorAll('.sidebar-menu a').forEach(item => {
                    item.classList.remove('active');
                });
                document.querySelectorAll('.admin-section').forEach(section => {
                    section.classList.remove('active');
                });

                // Activate dashboard
                dashboardItem.classList.add('active');
                dashboardSection.classList.add('active');

                // Update page title
                document.getElementById('pageTitle').textContent = 'Dashboard Management';

                // Show micro loaders on dashboard stats immediately
                console.log('📊 Showing micro loaders on dashboard stats...');
                loadDashboardStats();
                loadNotifications();
                loadExpiredContentStats();
                loadTrashStats(true);

                console.log('✅ Fresh login: Dashboard loaded with micro loaders');
                return;
            }
        }

        // Priority 1: Check URL hash FIRST (most reliable on refresh)
        const hash = window.location.hash.substring(1);
        console.log('Current URL hash:', hash);

        if (hash && validSections.includes(hash)) {
            console.log(`🔗 Restoring from URL hash: ${hash}`);

            // Check if the section exists in DOM
            const sectionExists = document.getElementById(hash) !== null;
            console.log(`Section "${hash}" exists in DOM:`, sectionExists);

            if (sectionExists) {
                const menuItem = document.querySelector(`.sidebar-menu a[href="#${hash}"]`);

                // Special handling for admins section (since it's in submenu)
                if (hash === 'admins') {
                    // Open the parent submenu first
                    const parentSubmenu = document.querySelector('.has-submenu');
                    if (parentSubmenu && !parentSubmenu.classList.contains('open')) {
                        parentSubmenu.classList.add('open');
                    }
                }

                if (menuItem) {
                    navigateToSection(hash, menuItem, true);
                    return;
                } else {
                    console.warn(`Menu item for "${hash}" not found`);
                }
            } else {
                console.warn(`Section element for "${hash}" not found in DOM`);
            }
        }

        // Priority 2: Check browser history state
        if (history.state && history.state.section) {
            const section = history.state.section;
            console.log('History state section:', section);

            if (validSections.includes(section)) {
                const menuItem = document.querySelector(`.sidebar-menu a[href="#${section}"]`);
                const targetSection = document.getElementById(section);

                // Special handling for admins section
                if (section === 'admins') {
                    const parentSubmenu = document.querySelector('.has-submenu');
                    if (parentSubmenu && !parentSubmenu.classList.contains('open')) {
                        parentSubmenu.classList.add('open');
                    }
                }

                if (menuItem && targetSection) {
                    navigateToSection(section, menuItem, true);
                    return;
                }
            }
        }

        // Priority 3: Check session storage
        const savedSection = sessionStorage.getItem('currentSection');
        console.log('Saved section from sessionStorage:', savedSection);

        if (savedSection && validSections.includes(savedSection)) {
            const menuItem = document.querySelector(`.sidebar-menu a[href="#${savedSection}"]`);
            const targetSection = document.getElementById(savedSection);

            // Special handling for admins section
            if (savedSection === 'admins') {
                const parentSubmenu = document.querySelector('.has-submenu');
                if (parentSubmenu && !parentSubmenu.classList.contains('open')) {
                    parentSubmenu.classList.add('open');
                }
            }

            if (menuItem && targetSection) {
                navigateToSection(savedSection, menuItem, true);
                return;
            }
        }

        // Default: Dashboard
        console.log('🏠 No saved section found, defaulting to dashboard');
        const dashboardItem = document.querySelector('.sidebar-menu a[href="#dashboard"]');
        const dashboardSection = document.getElementById('dashboard');

        if (dashboardItem && dashboardSection) {
            // Remove active class from all menu items and sections first
            document.querySelectorAll('.sidebar-menu a').forEach(item => {
                item.classList.remove('active');
            });
            document.querySelectorAll('.admin-section').forEach(section => {
                section.classList.remove('active');
            });

            // Activate dashboard
            dashboardItem.classList.add('active');
            dashboardSection.classList.add('active');

            // Update page title
            document.getElementById('pageTitle').textContent = 'Dashboard Management';

            // Update current section
            currentSection = 'dashboard';
            sessionStorage.setItem('currentSection', 'dashboard');

            // Show greeting message for returning users too
            displayWelcomeMessage();

            // Show micro loaders on dashboard stats
            console.log('📊 Loading dashboard with micro loaders...');
            loadDashboardStats();
            loadNotifications();
            loadExpiredContentStats();
            loadTrashStats(true);

            console.log('✅ Default dashboard loaded with micro loaders');
        }
    }

    // Navigate to specific section with history management
    function navigateToSection(targetSection, menuItem = null, fromPopState = false) {
        console.log(`🔄 navigateToSection: ${targetSection}, fromPopState: ${fromPopState}`);

        // CLOSE MOBILE MENU - This is what closes the sidebar on mobile
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            const mobileToggle = document.querySelector('.mobile-menu-toggle');
            const overlay = document.querySelector('.mobile-overlay');

            if (sidebar && sidebar.classList.contains('mobile-active')) {
                sidebar.classList.remove('mobile-active');
                if (mobileToggle) mobileToggle.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }

        // Update menu active state
        document.querySelectorAll('.sidebar-menu a').forEach(item => {
            item.classList.remove('active');
        });

        if (menuItem) {
            menuItem.classList.add('active');
        } else {
            const correspondingMenuItem = document.querySelector(`.sidebar-menu a[href="#${targetSection}"]`);
            if (correspondingMenuItem) {
                correspondingMenuItem.classList.add('active');
            }
        }

        // Hide all sections
        document.querySelectorAll('.admin-section').forEach(section => {
            section.classList.remove('active');
        });

        const sectionElement = document.getElementById(targetSection);
        if (!sectionElement) {
            console.error(`❌ Section element not found: ${targetSection}`);
            const dashboardItem = document.querySelector('.sidebar-menu a[href="#dashboard"]');
            if (dashboardItem) dashboardItem.click();
            return;
        }

        // Show target section
        sectionElement.classList.add('active');

        // Helper function to get proper section name - ADD analytics here
        function getSectionDisplayName(section) {
            const names = {
                'dashboard': 'Dashboard',
                'courses': 'Courses',
                'jobs': 'Jobs',
                'internships': 'Internships',
                'blog': 'Blog',
                'newsletter': 'Newsletter',
                'testimonials': 'Testimonials',
                'expired-content': 'Expired Content',
                'users': 'Users',
                'messages': 'Messages',
                'trash': 'Trash',
                'admins': 'Admin Management',
                'analytics': 'Website Analytics'  // ADD THIS LINE
            };
            return names[section] || section.charAt(0).toUpperCase() + section.slice(1);
        }

        // Update page title
        const sectionName = getSectionDisplayName(targetSection);
        document.getElementById('pageTitle').textContent = sectionName + ' Management';

        // Update current section and session storage
        currentSection = targetSection;
        sessionStorage.setItem('currentSection', targetSection);
        console.log(`💾 Saved to sessionStorage: ${targetSection}`);

        // Initialize page number if not set
        if (currentPage[targetSection] === undefined) {
            currentPage[targetSection] = 1;
        }

        // Update browser history if not from popstate
        if (!fromPopState) {
            let pageToSave = currentPage[targetSection];
            if (targetSection === 'trash') {
                pageToSave = currentTrashPage || 1;
            }
            const state = {
                section: targetSection,
                page: pageToSave,
                timestamp: Date.now()
            };
            history.pushState(state, '', `#${targetSection}`);
            console.log(`📝 Updated URL hash to: #${targetSection}`);
        }

        // Load section data based on type
        switch(targetSection) {
            case 'dashboard':
                console.log('📊 Loading dashboard...');
                loadDashboardStats();
                loadNotifications();
                loadExpiredContentStats();
                loadTrashStats(true);
                break;
            case 'trash':
                console.log('🗑️ Loading trash section...');
                if (!currentTrashPage || currentTrashPage !== currentPage.trash) {
                    currentTrashPage = currentPage.trash || 1;
                }
                loadTrashItems(currentTrashPage);
                loadTrashStats(false);
                break;
            case 'expired-content':
                console.log('⏰ Loading expired content section...');
                // Reset to page 1 and load
                currentExpiredPage = 1;
                setTimeout(() => {
                    loadExpiredContentData(1);
                    loadExpiredContentStats();
                }, 50);
                break;
            case 'testimonials':
                console.log('💬 Loading testimonials section...');
                if (window.testimonialManager) {
                    if (!window.testimonialManager.isInitialized) {
                        window.testimonialManager.init();
                    } else {
                        window.testimonialManager.loadTestimonialsData(currentPage.testimonials);
                    }
                }
                break;
            case 'admins':
                console.log('👥 Loading admins section...');
                if (window.adminManager) {
                    window.adminManager.loadAdmins();
                }
                break;
            case 'analytics':  // ADD THIS CASE
                console.log('📈 Loading analytics section...');
                setTimeout(() => {
                    if (typeof loadAnalyticsData === 'function') {
                        loadAnalyticsData();
                    }
                    if (typeof setupAnalyticsEvents === 'function') {
                        setupAnalyticsEvents();
                    }
                    if (typeof loadRecentPageVisits === 'function') {
                        loadRecentPageVisits();
                    }
                }, 100);
                break;
            default:
                console.log(`📋 Loading ${targetSection} section...`);
                const tableBody = document.getElementById(`${targetSection}TableBody`);
                if (tableBody) {
                    const colSpan = document.querySelector(`#${targetSection} thead tr`)?.cells.length || 8;
                    tableBody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 48px;"></i><p>Loading...</p></td></tr>`;
                }
                if (typeof loadSectionData === 'function') {
                    loadSectionData(targetSection, currentPage[targetSection]);
                }
                break;
        }
    }

    // Enhanced navigation with back button handling - No logout on back button
    function setupNavigation() {
        // Select ALL logout links - both in sidebar-menu AND sidebar-footer
        const logoutLinks = document.querySelectorAll('.sidebar-menu a[href="/admin/logout"], .sidebar-logout a, .sidebar-user-strip .logout-btn');

        // Handle logout links separately (outside the menuItems loop)
        logoutLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                showConfirmation('logout', 'Are you sure you want to logout?', () => {
                    // Clear all session data
                    sessionStorage.removeItem('adminSessionStarted');
                    sessionStorage.removeItem('currentSection');

                    // Set a flag to indicate we're logging out programmatically
                    sessionStorage.setItem('logoutInitiated', 'true');

                    window.location.href = '/admin/logout';
                });
            });
        });

        const menuItems = document.querySelectorAll('.sidebar-menu a:not([href="/admin/logout"])');

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
            console.log('🔙 Popstate event:', event.state);

            // If we're at the initial state and user tries to go back further
            if (event.state && event.state.isInitial) {
                // We're at the beginning - prevent going back to login
                const currentState = {
                    section: currentSection || 'dashboard',
                    timestamp: Date.now(),
                    isInitial: true
                };
                history.pushState(currentState, '', `#${currentSection || 'dashboard'}`);

                showNotification('You are already at the beginning of the dashboard navigation', 'info', 3000);
                return;
            }

            // If no state, go to dashboard
            if (!event.state || !event.state.section) {
                navigateToSection('dashboard', null, true);
                return;
            }

            // Navigate to the section from history
            const section = event.state.section;
            const menuItem = document.querySelector(`.sidebar-menu a[href="#${section}"]`);

            if (menuItem) {
                navigateToSection(section, menuItem, true);

                // If page info exists in state, update current page
                if (event.state.page && currentPage[section] !== undefined) {
                    currentPage[section] = event.state.page;
                }
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

        // Handle stat card links - ENHANCED to refresh dashboard when returning
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

    // ============================================
    // ========== 18. SESSION & AUTH FUNCTIONS ==========
    // ============================================

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
    function setupExpirationDateFields() {
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

    // ============================================
    // ========== 19. ANALYTICS FUNCTIONS ==========
    // ============================================

    // ===== ANALYTICS FUNCTIONS  =====

    // Global variables for analytics
    let visitorsChartInstance = null;
    let browserChartInstance = null;
    let currentAnalyticsDays = 30;

    // Load analytics data (called when section opens)
    function loadAnalyticsData() {
        console.log('📊 Loading analytics data...');

        // Check if we're in analytics section
        const analyticsSection = document.getElementById('analytics');
        if (!analyticsSection || !analyticsSection.classList.contains('active')) {
            console.log('Analytics section not active, skipping load');
            return;
        }

        // Show loading state on cards
        showAnalyticsLoading();

        // Load summary stats (total visitors, total views, etc.)
        loadAnalyticsSummary();

        // Load chart data for current days
        loadAnalyticsDailyChart(currentAnalyticsDays);

        // Load popular pages
        loadAnalyticsPopularPages();

        // Load device stats
        loadAnalyticsDeviceStats();
    }

    // Load analytics summary stats (fixes the count issue)
    function loadAnalyticsSummary() {
        console.log('📊 Loading analytics summary...');

        fetch('/api/admin/analytics/summary', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Analytics summary response:', data);

            // Update the stat cards - FIXED element IDs
            const totalVisitorsEl = document.getElementById('totalVisitors');
            const totalViewsEl = document.getElementById('totalViews');
            const weeklyVisitorsEl = document.getElementById('weeklyVisitors');
            const todayVisitorsEl = document.getElementById('todayVisitors');

            if (totalVisitorsEl) {
                totalVisitorsEl.textContent = (data.total_visitors || 0).toLocaleString();
            }
            if (totalViewsEl) {
                totalViewsEl.textContent = (data.total_views || 0).toLocaleString();
            }
            if (weeklyVisitorsEl) {
                weeklyVisitorsEl.textContent = (data.weekly_visitors || 0).toLocaleString();
            }
            if (todayVisitorsEl) {
                todayVisitorsEl.textContent = (data.today_visitors || 0).toLocaleString();
            }

            console.log('✅ Analytics summary updated');
        })
        .catch(error => {
            console.error('Error loading analytics summary:', error);
            // Set fallback values
            const totalVisitorsEl = document.getElementById('totalVisitors');
            const totalViewsEl = document.getElementById('totalViews');
            const weeklyVisitorsEl = document.getElementById('weeklyVisitors');
            const todayVisitorsEl = document.getElementById('todayVisitors');

            if (totalVisitorsEl) totalVisitorsEl.textContent = '0';
            if (totalViewsEl) totalViewsEl.textContent = '0';
            if (weeklyVisitorsEl) weeklyVisitorsEl.textContent = '0';
            if (todayVisitorsEl) todayVisitorsEl.textContent = '0';
        })
        .finally(() => {
            hideAnalyticsLoading();
        });
    }

    // Load daily chart data - FIXED to respond to button clicks
    function loadAnalyticsDailyChart(days) {
        console.log(`📈 Loading daily chart for ${days} days...`);
        currentAnalyticsDays = days;

        const canvas = document.getElementById('visitorsChart');
        const container = document.querySelector('#analytics .chart-container');

        if (canvas) {
            canvas.style.opacity = '0.5';
        }

        fetch(`/api/admin/analytics/daily?days=${days}`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.daily_data && data.daily_data.length > 0) {
                // USE REAL DATA ONLY
                renderAnalyticsVisitorsChart(data.daily_data, days);
            } else {
                // NO REAL DATA - Show message, don't generate fake data
                showNoDataMessage();
            }
        })
        .catch(error => {
            console.error('Error loading daily chart:', error);
            showChartErrorMessage();
        })
        .finally(() => {
            if (canvas) {
                canvas.style.opacity = '1';
            }
        });
    }

    // Generate dynamic sample data with real past dates
    function generateDynamicSampleData(days) {
        const sampleData = [];
        const endDate = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(endDate.getDate() - i);

            // Generate realistic looking data with some variation
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            // Base visitors (more on weekdays, less on weekends)
            let baseVisitors = isWeekend ? 30 : 50;
            let baseViews = isWeekend ? 80 : 120;

            // Add some random variation
            const visitors = Math.floor(baseVisitors + (Math.random() * 30));
            const views = Math.floor(baseViews + (Math.random() * 60));

            sampleData.push({
                date: date.toISOString().split('T')[0],
                unique_visitors: visitors,
                total_views: views
            });
        }

        return sampleData;
    }

    // Render chart with horizontal scrollbar on container only
    function renderAnalyticsVisitorsChart(dailyData, totalDays = 30) {
        const canvas = document.getElementById('visitorsChart');
        if (!canvas) {
            console.error('Visitors chart canvas not found');
            return;
        }

        const container = document.querySelector('#analytics .chart-container');
        if (!container) return;

        // Create wrapper for horizontal scroll if needed
        let wrapper = container.querySelector('.chart-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'chart-wrapper';
            canvas.parentNode.insertBefore(wrapper, canvas);
            wrapper.appendChild(canvas);
        }

        // Calculate dynamic width based on number of data points
        const dataPoints = dailyData.length;
        // Each data point takes about 60px width
        let wrapperWidth = Math.max(dataPoints * 60, 800);
        // Cap at 2000px max
        wrapperWidth = Math.min(wrapperWidth, 2000);

        wrapper.style.width = `${wrapperWidth}px`;
        wrapper.style.minWidth = `${wrapperWidth}px`;
        wrapper.style.display = 'block';

        console.log(`Chart wrapper width: ${wrapperWidth}px for ${dataPoints} points`);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Format dates
        const dates = dailyData.map(d => {
            try {
                const date = new Date(d.date);
                if (totalDays <= 7) {
                    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                } else if (totalDays <= 30) {
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } else {
                    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                }
            } catch (e) {
                return d.date;
            }
        });

        const uniqueVisitors = dailyData.map(d => d.unique_visitors || 0);
        const totalViews = dailyData.map(d => d.total_views || 0);

        // Destroy existing chart
        if (visitorsChartInstance) {
            try { visitorsChartInstance.destroy(); } catch(e) {}
            visitorsChartInstance = null;
        }

        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded!');
            return;
        }

        try {
            visitorsChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            label: 'Unique Visitors',
                            data: uniqueVisitors,
                            borderColor: '#4a6cf7',
                            backgroundColor: 'rgba(74, 108, 247, 0.1)',
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true,
                            pointRadius: dataPoints > 50 ? 1 : 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'Total Page Views',
                            data: totalViews,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true,
                            pointRadius: dataPoints > 50 ? 1 : 3,
                            pointHoverRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                maxRotation: 45,
                                autoSkip: true,
                                maxTicksLimit: 15,
                                font: { size: 10 }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString();
                                },
                                font: { size: 10 }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            left: 10,
                            right: 20,
                            top: 20,
                            bottom: 30
                        }
                    }
                }
            });

            console.log(`✅ Chart rendered`);
        } catch (error) {
            console.error('Error rendering chart:', error);
        }
    }

    // Load popular pages
    function loadAnalyticsPopularPages() {
        const container = document.getElementById('popularPagesList');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i> Loading pages...</div>';

        fetch('/api/admin/analytics/popular-pages?days=30&limit=10', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.pages && data.pages.length > 0) {
                renderAnalyticsPopularPages(data.pages);
            } else {
                container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">No page data available</div>';
            }
        })
        .catch(error => {
            console.error('Error loading popular pages:', error);
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">Failed to load data</div>';
        });
    }

    // Render popular pages with hover + click timestamp
    function renderAnalyticsPopularPages(pages) {
        const container = document.getElementById('popularPagesList');
        if (!container) return;

        if (!pages || pages.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">No page data available</div>';
            return;
        }

        container.innerHTML = pages.map((page, index) => `
            <div class="popular-page-item">
                <div class="rank">${index + 1}</div>
                <div class="page-info">
                    <div class="page-title">${escapeHTML(page.title)}</div>
                    <div class="page-url">${escapeHTML(page.url)}</div>
                    <div class="page-meta">
                        <span class="page-views"><i class="fas fa-eye"></i> ${page.views} views</span>
                        ${page.last_visited ? `
                        <span class="timestamp-wrapper">
                            <span class="timestamp-trigger"
                                  data-timestamp="${page.last_visited}"
                                  data-formatted="${formatDateTime(page.last_visited)}">
                                <i class="far fa-clock"></i> ${getTimeAgo(page.last_visited)}
                            </span>
                            <span class="timestamp-tooltip">${formatDateTime(page.last_visited)}</span>
                        </span>
                        ` : ''}
                    </div>
                </div>
                <div class="page-views-badge">${page.views}</div>
            </div>
        `).join('');

        // Add click event for mobile (shows small horizontal strip)
        document.querySelectorAll('.timestamp-trigger').forEach(trigger => {
            // Remove any existing listener by cloning
            const newTrigger = trigger.cloneNode(true);
            trigger.parentNode.replaceChild(newTrigger, trigger);

            // Add click event
            newTrigger.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const formattedTime = this.getAttribute('data-formatted');
                if (formattedTime) {
                    showClickTimestampTooltip(formattedTime, this);
                }
            });
        });
    }

    // Show small horizontal strip popup (simple and minimal)
    function showClickTimestampTooltip(formattedTime, targetElement) {
        // Remove any existing click tooltip
        const existingTooltip = document.querySelector('.click-timestamp-tooltip');
        if (existingTooltip) existingTooltip.remove();

        // Get the timestamp-wrapper element (parent)
        const wrapper = targetElement.closest('.timestamp-wrapper');
        if (!wrapper) return;

        // Remove any existing tooltip inside wrapper
        const existingInnerTooltip = wrapper.querySelector('.click-timestamp-tooltip');
        if (existingInnerTooltip) existingInnerTooltip.remove();

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'click-timestamp-tooltip';
        tooltip.innerHTML = `
            <i class="fas fa-calendar-alt"></i>
            <span>${formattedTime}</span>
        `;

        // Append to wrapper (not to the trigger)
        wrapper.appendChild(tooltip);

        // Auto remove after 3 seconds
        const timeout = setTimeout(() => {
            if (tooltip && tooltip.remove) tooltip.remove();
        }, 3000);

        // Remove on click outside
        const removeOnClickOutside = function(e) {
            if (!wrapper.contains(e.target)) {
                if (tooltip && tooltip.remove) tooltip.remove();
                document.removeEventListener('click', removeOnClickOutside);
            }
        };

        // Delay to avoid immediate removal
        setTimeout(() => {
            document.addEventListener('click', removeOnClickOutside);
        }, 100);
    }

    // Load device stats
    function loadAnalyticsDeviceStats() {
        const container = document.getElementById('deviceStats');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-spinner fa-spin"></i> Loading device data...</div>';

        fetch('/api/admin/analytics/devices?days=30', {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderAnalyticsDeviceStats(data.device_stats || { desktop: 0, mobile: 0, tablet: 0 });
                renderAnalyticsBrowserChart(data.browser_stats || {});
            } else {
                renderAnalyticsDeviceStats({ desktop: 0, mobile: 0, tablet: 0 });
            }
        })
        .catch(error => {
            console.error('Error loading device stats:', error);
            renderAnalyticsDeviceStats({ desktop: 0, mobile: 0, tablet: 0 });
        });
    }

    // Render device stats
    function renderAnalyticsDeviceStats(deviceStats) {
        const container = document.getElementById('deviceStats');
        if (!container) return;

        const devices = [
            { name: 'Desktop', icon: '💻', count: deviceStats.desktop || 0 },
            { name: 'Mobile', icon: '📱', count: deviceStats.mobile || 0 },
            { name: 'Tablet', icon: '📟', count: deviceStats.tablet || 0 }
        ];

        const total = devices.reduce((sum, d) => sum + d.count, 0);

        if (total === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">No device data available</div>';
            return;
        }

        container.innerHTML = devices.map(device => {
            const percentage = ((device.count / total) * 100).toFixed(1);
            return `
                <div style="margin-bottom:20px">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                        <div style="font-size:24px">${device.icon}</div>
                        <div style="flex:1">
                            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                                <span style="font-weight:500">${device.name}</span>
                                <span style="color:#4a6cf7;font-weight:600">${device.count.toLocaleString()}</span>
                            </div>
                            <div style="background:#e2e8f0;border-radius:10px;overflow:hidden;height:8px">
                                <div style="background:#4a6cf7;width:${percentage}%;height:100%;border-radius:10px"></div>
                            </div>
                            <div style="margin-top:5px;font-size:12px;color:#94a3b8">${percentage}%</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Render browser chart
    function renderAnalyticsBrowserChart(browserStats) {
        const canvas = document.getElementById('browserChart');
        if (!canvas) return;

        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.minHeight = '250px';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const browsers = Object.keys(browserStats);
        const counts = Object.values(browserStats);

        if (browserChartInstance) {
            try { browserChartInstance.destroy(); } catch(e) {}
            browserChartInstance = null;
        }

        if (typeof Chart === 'undefined') return;

        if (browsers.length === 0 || counts.every(c => c === 0)) {
            return;
        }

        const colors = ['#4a6cf7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec489a'];

        try {
            browserChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: browsers,
                    datasets: [{
                        data: counts,
                        backgroundColor: colors.slice(0, browsers.length),
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } }
                    }
                }
            });
            console.log('✅ Browser chart rendered');
        } catch(error) {
            console.error('Error rendering browser chart:', error);
        }
    }

    // Setup analytics events
    function setupAnalyticsEvents() {
        console.log('🔧 Setting up analytics events...');

        // Existing refresh button for analytics
        const refreshBtn = document.getElementById('refreshAnalyticsBtn');
        if (refreshBtn) {
            const newBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);

            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                console.log('🔄 Refreshing analytics data...');
                const originalHTML = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                this.disabled = true;

                // Refresh all analytics data
                loadAnalyticsSummary();
                loadAnalyticsDailyChart(currentAnalyticsDays);
                loadAnalyticsPopularPages();  // This will now show timestamps
                loadAnalyticsDeviceStats();

                setTimeout(() => {
                    this.innerHTML = originalHTML;
                    this.disabled = false;
                }, 2000);
            });
        }

        // NEW: Refresh button specifically for popular pages
        const refreshPopularBtn = document.getElementById('refreshPopularPagesBtn');
        if (refreshPopularBtn) {
            const newBtn = refreshPopularBtn.cloneNode(true);
            refreshPopularBtn.parentNode.replaceChild(newBtn, refreshPopularBtn);

            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const originalHTML = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                this.disabled = true;

                loadAnalyticsPopularPages();

                setTimeout(() => {
                    this.innerHTML = originalHTML;
                    this.disabled = false;
                }, 1000);
            });
        }

        // Chart period buttons (existing code)
        const chartButtonsContainer = document.querySelector('#analytics .chart-controls');
        if (!chartButtonsContainer) return;

        const chartButtons = chartButtonsContainer.querySelectorAll('.btn-sm');
        chartButtons.forEach(btn => {
            btn.classList.remove('active');
        });

        chartButtons.forEach(btn => {
            const days = parseInt(btn.getAttribute('data-days'));
            if (days === currentAnalyticsDays) {
                btn.classList.add('active');
            }
        });

        chartButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const days = parseInt(this.getAttribute('data-days'));
                console.log(`Chart button clicked: ${days} days`);

                if (days) {
                    const allBtns = chartButtonsContainer.querySelectorAll('.btn-sm');
                    allBtns.forEach(b => {
                        b.classList.remove('active');
                    });

                    this.classList.add('active');
                    currentAnalyticsDays = days;
                    loadAnalyticsDailyChart(days);
                }
            });
        });
    }

    // Initialize analytics section (call this from your DOM function)
    function initAnalyticsSection() {
        console.log('📊 Initializing analytics section...');

        // Setup analytics navigation link - EXACT same pattern as other sections
        const analyticsLink = document.querySelector('.sidebar-menu a[href="#analytics"]');
        if (analyticsLink) {
            // Remove existing listeners by cloning (same as other sections)
            const newLink = analyticsLink.cloneNode(true);
            analyticsLink.parentNode.replaceChild(newLink, analyticsLink);

            newLink.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                console.log('📊 Opening analytics section...');

                // Use the global navigateToSection function (SAME as other sections)
                if (typeof navigateToSection === 'function') {
                    navigateToSection('analytics', this);
                }
            });
            console.log('✅ Analytics navigation setup complete');
        }

        // Setup analytics events (refresh button, chart buttons)
        setupAnalyticsEvents();

        // Setup observer for when analytics section becomes active (SAME as expired-content, testimonials)
        const analyticsSection = document.getElementById('analytics');
        if (analyticsSection) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (analyticsSection.classList.contains('active')) {
                            console.log('🎯 Analytics section activated - loading data');
                            loadAnalyticsData();
                            setupAnalyticsEvents();
                        }
                    }
                });
            });
            observer.observe(analyticsSection, { attributes: true });
            console.log('✅ Analytics observer setup complete');
        }

        // Check if analytics section is already active on page load
        if (analyticsSection && analyticsSection.classList.contains('active')) {
            console.log('📊 Analytics section already active, loading data...');
            setTimeout(() => {
                loadAnalyticsData();
                setupAnalyticsEvents();
            }, 100);
        }
    }

    // Show message when no data available
    function showNoDataMessage() {
        const container = document.querySelector('#analytics .chart-container');
        if (!container) return;

        // Clear any existing canvas
        const canvas = document.getElementById('visitorsChart');
        if (canvas && canvas.parentNode) {
            canvas.parentNode.removeChild(canvas);
        }

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chart-empty-message';
        messageDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; text-align: center;">
                <i class="fas fa-chart-line" style="font-size: 48px; color: #cbd5e1; margin-bottom: 15px;"></i>
                <h4 style="color: #64748b; margin: 0 0 10px 0;">No Analytics Data Available</h4>
                <p style="color: #94a3b8; margin: 0; font-size: 14px;">Data will appear once visitors start using the site.</p>
            </div>
        `;

        container.innerHTML = '';
        container.appendChild(messageDiv);
    }

    function showChartErrorMessage() {
        const container = document.querySelector('#analytics .chart-container');
        if (!container) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'chart-error-message';
        messageDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; text-align: center;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ef4444; margin-bottom: 15px;"></i>
                <h4 style="color: #64748b; margin: 0 0 10px 0;">Failed to Load Chart Data</h4>
                <p style="color: #94a3b8; margin: 0; font-size: 14px;">Please try again later or contact support.</p>
            </div>
        `;

        container.innerHTML = '';
        container.appendChild(messageDiv);
    }

    // ============================================
    // ========== 20. SIDEBAR & MENU FUNCTIONS ==========
    // ============================================

    // ===== ADMIN DASHBOARD MOBILE MENU (Matches main site) =====
    function setupMobileMenu() {
        console.log('📱 Setting up admin mobile menu...');

        // Create mobile menu toggle button (matches your main site)
        const mobileToggle = document.createElement('button');
        mobileToggle.className = 'mobile-menu-toggle';
        mobileToggle.innerHTML = '<span class="hamburger"></span>';
        mobileToggle.setAttribute('aria-label', 'Toggle Menu');

        // Create overlay (matches your main site)
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';

        // Get elements
        const adminHeader = document.querySelector('.admin-header');
        const sidebar = document.querySelector('.sidebar');

        if (!adminHeader || !sidebar) {
            console.error('❌ Required elements not found');
            return;
        }

        // Add toggle button to header (left side)
        adminHeader.insertBefore(mobileToggle, adminHeader.firstChild);

        // Add overlay to body
        document.body.appendChild(overlay);

        // Functions to toggle menu
        function openMenu() {
            console.log('📱 Opening admin mobile menu');
            mobileToggle.classList.add('active');
            sidebar.classList.add('mobile-active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeMenu() {
            console.log('📱 Closing admin mobile menu');
            mobileToggle.classList.remove('active');
            sidebar.classList.remove('mobile-active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }

        // Event listeners
        mobileToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (sidebar.classList.contains('mobile-active')) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        overlay.addEventListener('click', closeMenu);

        // Close menu when clicking menu items
        const menuItems = document.querySelectorAll('.sidebar-menu a');
        menuItems.forEach(item => {
            item.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    setTimeout(closeMenu, 300);
                }
            });
        });

        // Handle window resize
        function handleResize() {
            if (window.innerWidth > 768) {
                // Desktop - hide mobile elements
                closeMenu();
                mobileToggle.style.display = 'none';
                overlay.style.display = 'none';
            } else {
                // Mobile - show toggle button
                mobileToggle.style.display = 'flex';
                overlay.style.display = 'block';
            }
        }

        window.addEventListener('resize', handleResize);

        // Initialize
        handleResize();

        // Close menu with ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeMenu();
            }
        });

        console.log('✅ Admin mobile menu setup complete');
    }

    // Setup submenu toggle functionality For user management
    function initSubmenu() {
        console.log('🔄 Initializing vertical submenu...');

        const submenuTriggers = document.querySelectorAll('.submenu-trigger');
        console.log(`Found ${submenuTriggers.length} submenu triggers`);

        submenuTriggers.forEach(trigger => {
            // Remove any existing listeners
            const newTrigger = trigger.cloneNode(true);
            trigger.parentNode.replaceChild(newTrigger, trigger);

            newTrigger.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                const parentLi = this.closest('.has-submenu');
                console.log('Toggling submenu:', parentLi);

                if (parentLi) {
                    // Close other open submenus (optional)
                    document.querySelectorAll('.has-submenu.open').forEach(openMenu => {
                        if (openMenu !== parentLi) {
                            openMenu.classList.remove('open');
                        }
                    });

                    parentLi.classList.toggle('open');
                }
            });
        });

        // Handle submenu item clicks
        const submenuItems = document.querySelectorAll('.submenu .menu-item a');
        submenuItems.forEach(item => {
            item.addEventListener('click', function() {
                console.log('Submenu item clicked:', this.getAttribute('href'));

                // Close submenu on mobile after click
                if (window.innerWidth <= 768) {
                    const parentSubmenu = this.closest('.has-submenu');
                    if (parentSubmenu) {
                        parentSubmenu.classList.remove('open');
                    }
                }
            });
        });

        console.log('✅ Vertical submenu initialized');
    }

    // Initialize sidebar menu scrolling
    let sidebarMenuScrollManager = null;

    function initSidebarMenuScrolling() {
        // Destroy existing
        if (sidebarMenuScrollManager) {
            sidebarMenuScrollManager.destroy();
        }

        // Initialize new
        sidebarMenuScrollManager = new SidebarMenuScrollManager();

        // Also update after a delay to ensure everything is loaded
        setTimeout(() => {
            if (sidebarMenuScrollManager) {
                sidebarMenuScrollManager.updateScrollbar();
            }
        }, 1000);
    }

    // Re-initialize scrollbar on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            initSidebarMenuScrolling();
        }, 250);
    });

    // ============================================
    // ========== 21. TESTIMONIALS INTEGRATION ==========
    // ============================================

    // ===== TESTIMONIAL INTEGRATION WITH DASHBOARD =====
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

    // ============================================
    // ========== 22. ADMIN MANAGER INITIALIZATION ==========
    // ============================================

    // Initialize
    let adminManager = null;
    function initAdminManager() {
        if (!adminManager) {
            adminManager = new AdminManager();
            adminManager.init();
            window.adminManager = adminManager;
        }
    }

    // ============================================
    // ========== 23. MAIN INITIALIZATION ==========
    // ============================================

    // ===== COMPLETE DASHBOARD INITIALIZATION =====
    function initializeDashboard() {
        console.log('🚀 Starting Admin Dashboard Initialization...');

        try {
            // === 1. INITIALIZE MANAGERS ===
            console.log('🔄 Step 1: Initializing managers...');
            window.adminDarkMode = new DarkMode();
            console.log('✅ Dark Mode initialized');

            // === 2. DISPLAY WELCOME MESSAGE ===
            console.log('🔄 Step 2: Displaying welcome message...');
            displayWelcomeMessage();
            console.log('✅ Welcome message displayed');

            // === 3. SETUP ALL EVENT LISTENERS ===
            console.log('🔄 Step 3: Setting up event listeners...');

            setupNavigation();
            console.log('✅ Navigation setup complete');

            setupNotificationEvents();
            console.log('✅ Notification events setup complete');

            setupModals();
            console.log('✅ Modals setup complete');

            setupForms();
            console.log('✅ Forms setup complete');

            setupBulkActions();
            console.log('✅ Bulk actions setup complete');

            setupSearchFilters();
            console.log('✅ Search filters setup complete');

            setupPagination();
            console.log('✅ Pagination setup complete');

            setupBlogCategories();
            console.log('✅ Blog categories setup complete');

            setupLogoPreview();
            console.log('✅ Logo preview setup complete');

            setupExpirationDateFields();
            console.log('✅ Expiration date fields setup complete');

            setupTestimonialsGlobalIntegration();
            console.log('✅ Testimonials global integration complete');

            initSidebarMenuScrolling();
            console.log('✅ Sidebar menu scrolling initialized');

            // === 4. SETUP DASHBOARD SPECIFIC FUNCTIONALITY ===
            console.log('🔄 Step 4: Setting up dashboard functionality...');

            // Setup dashboard refresh button
            const refreshBtn = document.getElementById('refreshDashboardBtn');
            if (refreshBtn) {
                // Remove existing listeners by cloning
                const newBtn = refreshBtn.cloneNode(true);
                refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);

                newBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    refreshDashboard();
                });
                console.log('✅ Refresh dashboard button setup complete');
            }

            // Setup expired content check button (on dashboard)
            const checkExpiredBtn = document.getElementById('checkExpiredContentBtn');
            if (checkExpiredBtn) {
                // Remove existing listeners by cloning
                const newExpiredBtn = checkExpiredBtn.cloneNode(true);
                checkExpiredBtn.parentNode.replaceChild(newExpiredBtn, checkExpiredBtn);

                newExpiredBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    checkExpiredContentNow();
                });
                console.log('✅ Check expired content button setup complete');
            }

            // === 5. SETUP EXPIRED CONTENT SECTION ===
            console.log('🔄 Step 5: Setting up expired content section...');
            setupExpiredContentEvents();
            console.log('✅ Expired content events setup complete');

            setupExpiredContentCheckButton();
            console.log('✅ Expired content check button setup complete');

            // === 6. SETUP GLOBAL ERROR HANDLING ===
            console.log('🔄 Step 6: Setting up global error handling...');
            setupGlobalErrorHandling();
            console.log('✅ Global error handling setup complete');

            // === 7. LOAD INITIAL DASHBOARD DATA ===
            console.log('🔄 Step 7: Loading initial dashboard data...');

            // Check if we're on dashboard section
            const dashboardSection = document.getElementById('dashboard');
            const isDashboardActive = dashboardSection && dashboardSection.classList.contains('active');

            if (isDashboardActive) {
                // Load dashboard stats with micro loaders
                console.log('📊 Dashboard is active, loading stats...');
                loadDashboardStats();
                loadNotifications();
                loadExpiredContentStats();
            }

            console.log('✅ Initial data loading started');

            // === 8. INITIALIZE HISTORY ===
            console.log('🔄 Step 9: Initializing history...');
            initializeHistory();
            console.log('✅ History initialized');

            // === 9. SETUP SESSION CHECK ===
            console.log('🔄 Step 10: Setting up session check...');
            setInterval(checkAdminSession, 5 * 60 * 1000);
            console.log('✅ Session check interval set');

            // === 10. SETUP TESTIMONIAL MANAGER ===
            console.log('🔄 Step 11: Setting up testimonial manager...');
            setTimeout(() => {
                console.log('🎯 Initializing Testimonial Manager...');
                window.testimonialManager = new TestimonialManager();

                // Setup testimonial refresh button
                const refreshTestimonialsBtn = document.getElementById('refreshTestimonialsBtn');
                if (refreshTestimonialsBtn && window.testimonialManager.loadTestimonialsData) {
                    refreshTestimonialsBtn.addEventListener('click', function() {
                        window.testimonialManager.loadTestimonialsData(1);
                    });
                    console.log('✅ Testimonial refresh button setup complete');
                }

                // Load testimonials if section is active
                const testimonialsSection = document.getElementById('testimonials');
                if (testimonialsSection && testimonialsSection.classList.contains('active')) {
                    window.testimonialManager.loadTestimonialsData(1);
                }
            }, 1500);

            // === 11. SETUP EXPIRED CONTENT SECTION LOADER ===
            console.log('🔄 Step 12: Setting up expired content section loader...');
            setupExpiredContentSection();
            console.log('✅ Expired content section loader setup complete');

            // === 12. SETUP MOBILE MENU ===
            console.log('🔄 Step 13: Setting up mobile menu...');
            setupMobileMenu();
            console.log('✅ Mobile menu setup complete');

            console.log('✅✅✅ Admin Dashboard Fully Initialized ✅✅✅');

            // === 13. FINAL CHECKS ===
            setTimeout(() => {
                console.log('🔍 Running final checks...');

                // Check if any section is active (should be after restoreCurrentSection)
                const activeSection = document.querySelector('.admin-section.active');
                if (!activeSection) {
                    console.warn('⚠️ No active section found, defaulting to dashboard');
                    const dashboardItem = document.querySelector('.sidebar-menu a[href="#dashboard"]');
                    if (dashboardItem) {
                        dashboardItem.click();
                    }
                }

                console.log('✅ Final checks completed');
            }, 2000);

            // === 14. SETUP TRASH SECTION ===
            console.log('🔄 Step 14: Setting up trash section...');
            initTrashSection();
            console.log('✅ Trash section setup complete');

            // === RESTORE SESSION STATE ===
            console.log('🔄 Step 8: Restoring session state...');
            setTimeout(() => {
                restoreCurrentSection();
            }, 100);
            console.log('✅ Current section restored');

            // Setup submenu
            initSubmenu();

            // Admin Management
            setTimeout(() => {
                initAdminManager();
            }, 500);

            // Initialize analytics
            initAnalyticsSection();

            // === Initialize header height observer ===
            initHeaderHeightObserver();

        } catch (error) {
            console.error('❌❌❌ Dashboard initialization failed:', error);
            showNotification('Dashboard initialization failed. Please refresh the page.', 'error');

            // Try to at least show dashboard on error
            setTimeout(() => {
                const dashboardSection = document.getElementById('dashboard');
                if (dashboardSection) {
                    dashboardSection.classList.add('active');
                    loadDashboardStats();
                }
            }, 1000);
        }
    }

    // ============================================
    // ========== 24. CLASS DEFINITIONS ==========
    // ============================================

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
            // Handle toggle button click - THIS IS THE ONLY TRIGGER
            if (this.toggleButton) {
                const newButton = this.toggleButton.cloneNode(true);
                this.toggleButton.parentNode.replaceChild(newButton, this.toggleButton);
                this.toggleButton = newButton;

                this.toggleButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.toggle();
                });
            }

            // Handle checkbox - JUST UPDATE CHECKBOX STATE, NO TOGGLE CALL
            if (this.checkbox) {
                const newCheckbox = this.checkbox.cloneNode(true);
                this.checkbox.parentNode.replaceChild(newCheckbox, this.checkbox);
                this.checkbox = newCheckbox;

                this.checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                });

                // Sync checkbox with state without triggering toggle
                this.checkbox.checked = this.isDarkMode;
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

            // SINGLE NOTIFICATION - Only here, not in separate function
            const message = this.isDarkMode ? 'Dark mode enabled' : 'Light mode enabled';
            const type = this.isDarkMode ? 'info' : 'success';

            if (typeof showNotification === 'function') {
                showNotification(message, type);
            } else {
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

            // Single notification
            const message = this.isDarkMode ? 'Dark mode enabled' : 'Light mode enabled';
            const type = this.isDarkMode ? 'info' : 'success';

            if (typeof showNotification === 'function') {
                showNotification(message, type);
            }
        }
    }

    // Initialize dark mode - prevent duplicate
    if (!window.adminDarkMode) {
        window.adminDarkMode = new DarkMode();
    }

    // ===== TESTIMONIAL MANAGER
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
            if (!element) return;

            // Find the search box and button
            const searchBox = element.closest('.search-box');
            const searchBtn = searchBox ? searchBox.querySelector('.search-btn') : null;

            if (searchBtn) {
                // Remove existing listeners by cloning
                const newBtn = searchBtn.cloneNode(true);
                searchBtn.parentNode.replaceChild(newBtn, searchBtn);

                let isSearching = false;

                // Search button click handler
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (isSearching) return;
                    isSearching = true;

                    // Show loading state on button
                    const originalHTML = newBtn.innerHTML;
                    newBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    newBtn.disabled = true;

                    // Call the search handler
                    handler(e);

                    setTimeout(() => {
                        newBtn.innerHTML = originalHTML;
                        newBtn.disabled = false;
                        isSearching = false;
                    }, 1000);
                });

                console.log(`✅ Search button listener setup for ${id}`);
            } else {
                console.warn(`⚠️ Search button not found for ${id}`);
            }

            // Enter key support
            element.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const searchBox = element.closest('.search-box');
                    const searchBtn = searchBox ? searchBox.querySelector('.search-btn') : null;
                    if (searchBtn) {
                        searchBtn.click();
                    } else {
                        // Fallback if no button found
                        handler(e);
                    }
                }
            });

            console.log(`✅ Search listener setup complete for ${id} (no auto-search)`);
        }

        async loadTestimonialsData(page = 1) {
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
                    this.totalCount = data.total_count || 0; // Store total count
                    this.updatePaginationInfo(this.totalCount, page, data.per_page || this.perPage);
                    this.currentPage = page;

                    this.selectedIds = [];
                    this.updateBulkActionButton();

                    showNotification(`Loaded ${data.testimonials?.length || 0} testimonials`, 'success');
                } else {
                    throw new Error(data.error || 'Failed to load testimonials');
                }

            } catch (error) {
                console.error('❌ Error loading testimonials:', error);
                showNotification('Failed to load testimonials', 'error');
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
                const newCheckbox = checkbox.cloneNode(true);
                checkbox.parentNode.replaceChild(newCheckbox, checkbox);

                newCheckbox.addEventListener('change', (e) => {
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
                    // Update header count
                    updateHeaderSelectedCount('testimonials', this.selectedIds.length);
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
            // Update header count
            updateHeaderSelectedCount('testimonials', this.selectedIds.length);
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
            showConfirmation('delete',
                'Are you sure you want to delete this testimonial? It will be moved to trash.',
                async () => {
                    try {
                        showLoading();

                        const response = await fetch(`/api/admin/testimonials/${testimonialId}`, {
                            method: 'DELETE',
                            credentials: 'include',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            }
                        });

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error || `HTTP ${response.status}`);
                        }

                        const result = await response.json();

                        if (result.success) {
                            showNotification('Testimonial moved to trash', 'success');

                            // Remove from UI
                            const row = document.querySelector(`#testimonialsTableBody tr .delete-testimonial[data-id="${testimonialId}"]`)?.closest('tr');
                            if (row) {
                                row.remove();
                            }

                            // Check if table is empty
                            const tableBody = document.getElementById('testimonialsTableBody');
                            if (tableBody && tableBody.children.length === 0) {
                                tableBody.innerHTML = `
                                    <tr>
                                        <td colspan="8" style="text-align: center; padding: 40px;">
                                            <i class="fas fa-comment-slash" style="color: #6c757d; font-size: 48px; margin-bottom: 15px;"></i>
                                            <h3 style="color: #6c757d; margin: 0;">No Testimonials Found</h3>
                                            <p style="color: #6c757d; margin: 10px 0 0 0;">No testimonials match your search criteria.</p>
                                        </td>
                                    </tr>
                                `;
                            }

                            // Update counts
                            this.loadTestimonialsData(this.currentPage);
                            loadDashboardStats();
                            loadTrashStats(true);

                            // Clear from selected items
                            this.selectedIds = this.selectedIds.filter(id => id !== testimonialId);
                            this.updateBulkActionButton();
                        } else {
                            throw new Error(result.error || 'Failed to delete testimonial');
                        }
                    } catch (error) {
                        console.error('❌ Error deleting testimonial:', error);
                        showNotification('Failed to delete testimonial', 'error');
                    } finally {
                        hideLoading();
                    }
                }
            );
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
            const action = actionSelect ? actionSelect.value : '';

            if (!action) {
                this.showNotification('Please select a bulk action first', 'warning');
                return;
            }

            if (this.selectedIds.length === 0) {
                this.showNotification('Please select at least one testimonial', 'warning');
                return;
            }

            if (action === 'delete') {
                this.showConfirmation('delete',
                    `Are you sure you want to delete ${this.selectedIds.length} testimonial(s)?`,
                    () => this.bulkDeleteTestimonials()
                );
            } else if (action === 'activate' || action === 'deactivate') {
                const isActive = action === 'activate';
                const actionText = isActive ? 'activate' : 'deactivate';
                this.showConfirmation('bulk_action',
                    `Are you sure you want to ${actionText} ${this.selectedIds.length} testimonial(s)?`,
                    () => this.bulkUpdateTestimonialStatus(isActive)
                );
            }
        }

        bulkDeleteTestimonials() {
            if (!this.selectedIds || this.selectedIds.length === 0) {
                showNotification('No testimonials selected', 'warning');
                return;
            }

            showLoading();

            fetch('/api/admin/testimonials/bulk-delete', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ ids: this.selectedIds })
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showNotification(`${result.deleted_count || this.selectedIds.length} testimonial(s) moved to trash`, 'success');
                    this.selectedIds = [];
                    this.updateBulkActionButton();
                    this.loadTestimonialsData(this.currentPage);
                    loadDashboardStats();
                    loadTrashStats(true);
                } else {
                    showNotification(result.error || 'Failed to delete testimonials', 'error');
                }
            })
            .catch(error => {
                console.error('Error bulk deleting testimonials:', error);
                showNotification('Failed to delete testimonials', 'error');
            })
            .finally(() => {
                hideLoading();
            });
        }

         async bulkUpdateTestimonialStatus(isActive) {
            if (!this.selectedIds || this.selectedIds.length === 0) {
                showNotification('No testimonials selected', 'warning');
                return;
            }

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
                    this.updateBulkActionButton();
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
            // Call the global pagination UI update
            if (typeof updatePaginationUI === 'function') {
                updatePaginationUI('testimonials', currentPage, totalItems, perPage);
            }
        }

        updateBulkActionButton() {
            const button = document.getElementById('applyTestimonialBulkAction');
            const selectAll = document.getElementById('selectAllTestimonials');
            const headerButton = document.getElementById('applyTestimonialBulkActionHeader');

            if (button) {
                button.disabled = this.selectedIds.length === 0;
            }
            if (headerButton) {
                headerButton.disabled = this.selectedIds.length === 0;
            }

            // Update header count
            if (typeof updateHeaderSelectedCount === 'function') {
                updateHeaderSelectedCount('testimonials', this.selectedIds.length);
            }

            if (selectAll) {
                const totalCheckboxes = document.querySelectorAll('.testimonial-checkbox').length;
                selectAll.checked = this.selectedIds.length > 0 && this.selectedIds.length === totalCheckboxes;
                selectAll.indeterminate = this.selectedIds.length > 0 && this.selectedIds.length < totalCheckboxes;
            }
        }
    }

    /// ===== ADMIN MANAGER CLASS - WITH PROPER PASSWORD VALIDATION =====
    class AdminManager {
        constructor() {
            this.currentPage = 1;
            this.perPage = 10;
            this.selectedAdmins = [];
            this.isInitialized = false;
            this.searchTerm = '';
            this.statusFilter = '';
            this.isSuperAdmin = false;
            this.currentAdminId = '';
            this.admins = [];
            this.isEditMode = false;
            this.editingAdminId = null;
        }

        init() {
            if (this.isInitialized) return;

            console.log('🔄 Initializing Admin Manager...');

            this.isSuperAdmin = window.isSuperAdmin === true;
            this.currentAdminId = window.currentAdminId || '';

            console.log('isSuperAdmin:', this.isSuperAdmin);
            console.log('currentAdminId:', this.currentAdminId);

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }

            this.isInitialized = true;
        }

        setup() {
            console.log('Setting up Admin Manager...');

            const adminsSection = document.getElementById('admins');
            if (!adminsSection) {
                setTimeout(() => this.setup(), 500);
                return;
            }

            this.setupSearchListener();
            this.setupStatusFilter();
            this.setupPagination();
            this.setupAdminModal();
            this.setupAddAdminButton();
            this.setupBulkActions();
            this.setupSectionObserver();

            this.loadAdmins();

            console.log('✅ Admin Manager setup complete');
        }

        setupSearchListener() {
            const searchInput = document.getElementById('adminSearch');
            const searchBtn = document.querySelector('#admins .search-btn');

            if (searchInput && searchBtn) {
                const newBtn = searchBtn.cloneNode(true);
                searchBtn.parentNode.replaceChild(newBtn, searchBtn);

                newBtn.addEventListener('click', () => {
                    this.searchTerm = searchInput.value.trim();
                    this.currentPage = 1;
                    this.loadAdmins();
                });

                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.searchTerm = searchInput.value.trim();
                        this.currentPage = 1;
                        this.loadAdmins();
                    }
                });
            }
        }

        setupStatusFilter() {
            const statusFilter = document.getElementById('adminStatusFilter');
            if (statusFilter) {
                const newFilter = statusFilter.cloneNode(true);
                statusFilter.parentNode.replaceChild(newFilter, statusFilter);

                newFilter.addEventListener('change', () => {
                    this.statusFilter = newFilter.value;
                    this.currentPage = 1;
                    this.loadAdmins();
                });
            }
        }

        setupPagination() {
            const prevBtn = document.getElementById('prevAdminPage');
            const nextBtn = document.getElementById('nextAdminPage');

            if (prevBtn) {
                const newPrev = prevBtn.cloneNode(true);
                prevBtn.parentNode.replaceChild(newPrev, prevBtn);
                newPrev.addEventListener('click', () => {
                    if (this.currentPage > 1) {
                        this.currentPage--;
                        this.loadAdmins();
                    }
                });
            }

            if (nextBtn) {
                const newNext = nextBtn.cloneNode(true);
                nextBtn.parentNode.replaceChild(newNext, nextBtn);
                newNext.addEventListener('click', () => {
                    this.currentPage++;
                    this.loadAdmins();
                });
            }
        }

        setupAdminModal() {
            const modal = document.getElementById('adminModal');
            const form = document.getElementById('adminForm');

            if (!modal || !form) {
                console.error('Admin modal elements not found');
                return;
            }

            console.log('Setting up Admin Modal');

            // Click outside to close - using the same pattern as other modals
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal(); // Use global closeModal function
                }
            });

            // Password strength validation
            const passwordInput = document.getElementById('adminPassword');
            if (passwordInput) {
                passwordInput.addEventListener('input', () => {
                    this.validatePasswordField(passwordInput.value);
                });
            }

            // Confirm password validation
            const confirmInput = document.getElementById('adminConfirmPassword');
            if (confirmInput) {
                confirmInput.addEventListener('input', () => {
                    this.validateConfirmPassword();
                });
            }

            // Form submission
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });

            console.log('Admin Modal setup complete');
        }

        setupFieldValidation() {
            // Full Name validation
            const fullNameInput = document.getElementById('adminFullName');
            if (fullNameInput) {
                fullNameInput.addEventListener('input', () => {
                    this.validateField('fullName', fullNameInput.value.trim());
                });
                fullNameInput.addEventListener('blur', () => {
                    this.validateField('fullName', fullNameInput.value.trim(), true);
                });
            }

            // Username validation
            const usernameInput = document.getElementById('adminUsername');
            if (usernameInput) {
                usernameInput.addEventListener('input', () => {
                    this.validateField('username', usernameInput.value.trim());
                });
                usernameInput.addEventListener('blur', () => {
                    this.validateField('username', usernameInput.value.trim(), true);
                });
            }

            // Email validation
            const emailInput = document.getElementById('adminEmail');
            if (emailInput) {
                emailInput.addEventListener('input', () => {
                    this.validateField('email', emailInput.value.trim());
                });
                emailInput.addEventListener('blur', () => {
                    this.validateField('email', emailInput.value.trim(), true);
                });
            }

            // Password validation
            const passwordInput = document.getElementById('adminPassword');
            if (passwordInput) {
                passwordInput.addEventListener('input', () => {
                    this.validatePasswordField(passwordInput.value);
                });
                passwordInput.addEventListener('blur', () => {
                    this.validatePasswordField(passwordInput.value, true);
                });
            }

            // Confirm password validation
            const confirmInput = document.getElementById('adminConfirmPassword');
            if (confirmInput) {
                confirmInput.addEventListener('input', () => {
                    this.validateConfirmPassword();
                });
                confirmInput.addEventListener('blur', () => {
                    this.validateConfirmPassword(true);
                });
            }
        }

        validateField(field, value, showError = false) {
            const fieldMap = {
                fullName: {
                    input: document.getElementById('adminFullName'),
                    errorSpan: document.getElementById('fullNameError'),
                    validate: (val) => {
                        if (!val) return 'Full name is required';
                        if (val.length < 2) return 'Full name must be at least 2 characters';
                        return null;
                    }
                },
                username: {
                    input: document.getElementById('adminUsername'),
                    errorSpan: document.getElementById('usernameError'),
                    validate: (val) => {
                        if (!val) return 'Username is required';
                        if (val.length < 3) return 'Username must be at least 3 characters';
                        const usernameRegex = /^[a-zA-Z0-9_]+$/;
                        if (!usernameRegex.test(val)) return 'Username can only contain letters, numbers, and underscore';
                        return null;
                    }
                },
                email: {
                    input: document.getElementById('adminEmail'),
                    errorSpan: document.getElementById('emailError'),
                    validate: (val) => {
                        if (!val) return 'Email is required';
                        const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
                        if (!emailRegex.test(val)) return 'Please enter a valid email address';
                        return null;
                    }
                }
            };

            const fieldConfig = fieldMap[field];
            if (!fieldConfig) return;

            const error = fieldConfig.validate(value);

            if (error && (showError || (value && !this.isEditMode))) {
                this.showFieldError(fieldConfig.input, fieldConfig.errorSpan, error);
                return false;
            } else {
                this.clearFieldError(fieldConfig.input, fieldConfig.errorSpan);
                return true;
            }
        }

        validatePasswordField(password, showError = false) {
            const passwordInput = document.getElementById('adminPassword');
            const errorSpan = document.getElementById('passwordError');

            // In edit mode, if password is empty, it's valid (keep existing)
            if (this.isEditMode && !password) {
                this.clearFieldError(passwordInput, errorSpan);
                return true;
            }

            if (!password && !this.isEditMode) {
                if (showError) {
                    this.showFieldError(passwordInput, errorSpan, 'Password is required');
                }
                return false;
            }

            if (password && password.length < 8) {
                if (showError) {
                    this.showFieldError(passwordInput, errorSpan, 'Password must be at least 8 characters');
                }
                return false;
            }

            if (password && !/[A-Z]/.test(password)) {
                if (showError) {
                    this.showFieldError(passwordInput, errorSpan, 'Password must contain at least one uppercase letter');
                }
                return false;
            }

            if (password && !/[a-z]/.test(password)) {
                if (showError) {
                    this.showFieldError(passwordInput, errorSpan, 'Password must contain at least one lowercase letter');
                }
                return false;
            }

            if (password && !/[0-9]/.test(password)) {
                if (showError) {
                    this.showFieldError(passwordInput, errorSpan, 'Password must contain at least one number');
                }
                return false;
            }

            if (password && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                if (showError) {
                    this.showFieldError(passwordInput, errorSpan, 'Password must contain at least one special character (!@#$%^&*)');
                }
                return false;
            }

            this.clearFieldError(passwordInput, errorSpan);
            this.updatePasswordStrength(password);
            return true;
        }

        validateConfirmPassword(showError = false) {
            const password = document.getElementById('adminPassword').value;
            const confirmInput = document.getElementById('adminConfirmPassword');
            const confirmValue = confirmInput.value;
            const errorSpan = document.getElementById('confirmPasswordError');

            // In edit mode, if password is empty and confirm is empty, it's valid
            if (this.isEditMode && !password && !confirmValue) {
                this.clearFieldError(confirmInput, errorSpan);
                return true;
            }

            if (!confirmValue) {
                if (showError) {
                    this.showFieldError(confirmInput, errorSpan, 'Please confirm your password');
                }
                return false;
            }

            if (password !== confirmValue) {
                if (showError) {
                    this.showFieldError(confirmInput, errorSpan, 'Passwords do not match');
                }
                return false;
            }

            this.clearFieldError(confirmInput, errorSpan);
            return true;
        }

        updatePasswordStrength(password) {
            const strengthEl = document.getElementById('passwordStrength');
            if (!strengthEl) return;

            if (!password) {
                strengthEl.innerHTML = '';
                return;
            }

            let score = 0;
            if (password.length >= 8) score++;
            if (password.length >= 12) score++;
            if (/[A-Z]/.test(password)) score++;
            if (/[a-z]/.test(password)) score++;
            if (/[0-9]/.test(password)) score++;
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

            let strengthClass = 'weak';
            let strengthText = 'Weak';
            let strengthIcon = 'fa-times-circle';

            if (score >= 6 && password.length >= 10) {
                strengthClass = 'strong';
                strengthText = 'Strong';
                strengthIcon = 'fa-check-circle';
            } else if (score >= 4 && password.length >= 8) {
                strengthClass = 'medium';
                strengthText = 'Medium';
                strengthIcon = 'fa-exclamation-circle';
            } else {
                strengthClass = 'weak';
                strengthText = 'Weak';
                strengthIcon = 'fa-times-circle';
            }

            strengthEl.innerHTML = `<i class="fas ${strengthIcon}"></i> Password Strength: ${strengthText}`;
            strengthEl.className = `password-strength ${strengthClass}`;
        }

        showFieldError(input, errorSpan, message) {
            if (!input) return;

            input.classList.add('input-error');

            if (errorSpan) {
                errorSpan.textContent = message;
                errorSpan.style.display = 'block';
            } else {
                // Create error span if it doesn't exist
                const newErrorSpan = document.createElement('small');
                newErrorSpan.className = 'field-error';
                newErrorSpan.style.color = 'var(--danger)';
                newErrorSpan.style.display = 'block';
                newErrorSpan.style.marginTop = '5px';
                newErrorSpan.style.fontSize = '12px';
                newErrorSpan.id = `${input.id}Error`;
                newErrorSpan.textContent = message;
                input.parentNode.appendChild(newErrorSpan);
            }
        }

        clearFieldError(input, errorSpan) {
            if (!input) return;

            input.classList.remove('input-error');

            if (errorSpan) {
                errorSpan.textContent = '';
                errorSpan.style.display = 'none';
            } else {
                const existingError = document.getElementById(`${input.id}Error`);
                if (existingError) existingError.remove();
            }
        }

        validateForm() {
            let isValid = true;

            // Validate Full Name
            const fullName = document.getElementById('adminFullName').value.trim();
            if (!fullName) {
                this.showFieldError(document.getElementById('adminFullName'), document.getElementById('fullNameError'), 'Full name is required');
                isValid = false;
            } else if (fullName.length < 2) {
                this.showFieldError(document.getElementById('adminFullName'), document.getElementById('fullNameError'), 'Full name must be at least 2 characters');
                isValid = false;
            } else {
                this.clearFieldError(document.getElementById('adminFullName'), document.getElementById('fullNameError'));
            }

            // Validate Username
            const username = document.getElementById('adminUsername').value.trim();
            if (!username) {
                this.showFieldError(document.getElementById('adminUsername'), document.getElementById('usernameError'), 'Username is required');
                isValid = false;
            } else if (username.length < 3) {
                this.showFieldError(document.getElementById('adminUsername'), document.getElementById('usernameError'), 'Username must be at least 3 characters');
                isValid = false;
            } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                this.showFieldError(document.getElementById('adminUsername'), document.getElementById('usernameError'), 'Username can only contain letters, numbers, and underscore');
                isValid = false;
            } else {
                this.clearFieldError(document.getElementById('adminUsername'), document.getElementById('usernameError'));
            }

            // Validate Email
            const email = document.getElementById('adminEmail').value.trim();
            const emailRegex = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
            if (!email) {
                this.showFieldError(document.getElementById('adminEmail'), document.getElementById('emailError'), 'Email is required');
                isValid = false;
            } else if (!emailRegex.test(email)) {
                this.showFieldError(document.getElementById('adminEmail'), document.getElementById('emailError'), 'Please enter a valid email address');
                isValid = false;
            } else {
                this.clearFieldError(document.getElementById('adminEmail'), document.getElementById('emailError'));
            }

            // Validate Password
            const password = document.getElementById('adminPassword').value;
            if (!this.isEditMode) {
                if (!password) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password is required');
                    isValid = false;
                } else if (password.length < 8) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must be at least 8 characters');
                    isValid = false;
                } else if (!/[A-Z]/.test(password)) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must contain at least one uppercase letter');
                    isValid = false;
                } else if (!/[a-z]/.test(password)) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must contain at least one lowercase letter');
                    isValid = false;
                } else if (!/[0-9]/.test(password)) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must contain at least one number');
                    isValid = false;
                } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must contain at least one special character');
                    isValid = false;
                } else {
                    this.clearFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'));
                }
            } else if (password) {
                // In edit mode, if password is provided, validate it
                if (password.length < 8) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must be at least 8 characters');
                    isValid = false;
                } else if (!/[A-Z]/.test(password)) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must contain at least one uppercase letter');
                    isValid = false;
                } else if (!/[a-z]/.test(password)) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must contain at least one lowercase letter');
                    isValid = false;
                } else if (!/[0-9]/.test(password)) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must contain at least one number');
                    isValid = false;
                } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                    this.showFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'), 'Password must contain at least one special character');
                    isValid = false;
                } else {
                    this.clearFieldError(document.getElementById('adminPassword'), document.getElementById('passwordError'));
                }
            }

            // Validate Confirm Password
            const confirmPassword = document.getElementById('adminConfirmPassword').value;
            if (password || (!this.isEditMode)) {
                if (!confirmPassword) {
                    this.showFieldError(document.getElementById('adminConfirmPassword'), document.getElementById('confirmPasswordError'), 'Please confirm your password');
                    isValid = false;
                } else if (password !== confirmPassword) {
                    this.showFieldError(document.getElementById('adminConfirmPassword'), document.getElementById('confirmPasswordError'), 'Passwords do not match');
                    isValid = false;
                } else {
                    this.clearFieldError(document.getElementById('adminConfirmPassword'), document.getElementById('confirmPasswordError'));
                }
            }

            return isValid;
        }

        handleFormSubmit() {
            // First validate all fields
            if (!this.validateForm()) {
                this.showNotification('Please fix the errors in the form', 'warning');
                return;
            }

            // Check for existing username/email (async)
            const username = document.getElementById('adminUsername').value.trim();
            const email = document.getElementById('adminEmail').value.trim();

            this.checkExistingUser(username, email, (isValid, message) => {
                if (!isValid) {
                    if (message.includes('username')) {
                        this.showFieldError(document.getElementById('adminUsername'), document.getElementById('usernameError'), message);
                    } else if (message.includes('email')) {
                        this.showFieldError(document.getElementById('adminEmail'), document.getElementById('emailError'), message);
                    }
                    this.showNotification(message, 'error');
                    return;
                }

                if (this.isEditMode) {
                    this.handleAdminUpdate();
                } else {
                    this.handleAdminCreation();
                }
            });
        }

        checkExistingUser(username, email, callback) {
            // Check if username or email already exists (except current admin in edit mode)
            fetch('/api/admin/admins/check-exists', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    exclude_id: this.isEditMode ? this.editingAdminId : null
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    callback(true, '');
                } else {
                    callback(false, data.message);
                }
            })
            .catch(error => {
                console.error('Error checking existing user:', error);
                callback(true, ''); // Proceed if check fails
            });
        }

        setupAddAdminButton() {
            const addAdminBtn = document.getElementById('addAdminBtn');

            if (!addAdminBtn) {
                console.error('Add Admin button not found');
                return;
            }

            const newBtn = addAdminBtn.cloneNode(true);
            addAdminBtn.parentNode.replaceChild(newBtn, addAdminBtn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Add Admin button clicked');

                this.isEditMode = false;
                this.editingAdminId = null;
                this.resetForm();

                const modalTitle = document.getElementById('adminModalTitle');
                if (modalTitle) modalTitle.textContent = 'Add Admin';

                const passwordRequired = document.getElementById('passwordRequired');
                if (passwordRequired) passwordRequired.textContent = '*';

                const passwordHelp = document.getElementById('passwordHelp');
                if (passwordHelp) passwordHelp.textContent = 'Required for new admin. Must be at least 8 characters with uppercase, lowercase, number, and special character.';

                const adminStatusGroup = document.getElementById('adminStatusGroup');
                if (adminStatusGroup) adminStatusGroup.style.display = 'none';

                const superadminGroup = document.getElementById('superadminCheckboxGroup');
                if (superadminGroup) {
                    superadminGroup.style.display = this.isSuperAdmin ? 'block' : 'none';
                }

                const modal = document.getElementById('adminModal');
                if (modal) {
                    console.log('Opening admin modal');
                    modal.style.display = 'block';
                } else {
                    console.error('Admin modal not found');
                }
            });

            if (this.isSuperAdmin) {
                newBtn.style.display = 'inline-flex';
            } else {
                newBtn.style.display = 'none';
            }
        }

        setupBulkActions() {
            const applyBtn = document.getElementById('applyAdminBulkAction');
            const bulkActionSelect = document.getElementById('adminBulkAction');

            if (applyBtn && bulkActionSelect) {
                const newBtn = applyBtn.cloneNode(true);
                applyBtn.parentNode.replaceChild(newBtn, applyBtn);

                newBtn.addEventListener('click', () => {
                    const action = bulkActionSelect.value;
                    if (!action) {
                        this.showNotification('Please select a bulk action', 'warning');
                        return;
                    }
                    if (this.selectedAdmins.length === 0) {
                        this.showNotification('Please select at least one admin', 'warning');
                        return;
                    }
                    if (action === 'activate' || action === 'deactivate') {
                        const isActive = action === 'activate';
                        this.showConfirmation('bulk_action',
                            `Are you sure you want to ${action} ${this.selectedAdmins.length} admin(s)?`,
                            () => this.bulkUpdateStatus(this.selectedAdmins, isActive)
                        );
                    } else if (action === 'delete') {
                        this.showConfirmation('bulk_action',
                            `Are you sure you want to delete ${this.selectedAdmins.length} admin(s)?`,
                            () => this.bulkDelete(this.selectedAdmins)
                        );
                    }
                });
            }

            if (!this.isSuperAdmin) {
                const bulkDiv = document.querySelector('#admins .bulk-actions');
                if (bulkDiv) bulkDiv.style.display = 'none';
            }
        }

        setupSectionObserver() {
            const adminsSection = document.getElementById('admins');
            if (adminsSection) {
                // Add a flag to prevent multiple loads
                let isLoadingAdmins = false;
                let lastLoadTime = 0;

                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            if (adminsSection.classList.contains('active')) {
                                // Debounce: only load if not already loading and 500ms passed since last load
                                const now = Date.now();
                                if (!isLoadingAdmins && (now - lastLoadTime > 500)) {
                                    lastLoadTime = now;
                                    isLoadingAdmins = true;
                                    console.log('Admins section activated - loading data');
                                    this.loadAdmins().finally(() => {
                                        isLoadingAdmins = false;
                                    });
                                } else {
                                    console.log('Admins load skipped (already loading or too soon)');
                                }
                            }
                        }
                    });
                });
                observer.observe(adminsSection, { attributes: true });
            }
        }

        loadAdmins() {
            // Prevent multiple simultaneous loads
            if (this.isLoading) {
                console.log('⚠️ Admins already loading, skipping duplicate call');
                return Promise.resolve();
            }

            this.isLoading = true;

            const tableBody = document.getElementById('adminsTableBody');
            if (tableBody) {
                '<tr><td colspan="10" style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 48px;"></i><p>Loading admins...</p></td></tr>'
            }

            let url = `/api/admin/admins/list?page=${this.currentPage}&per_page=${this.perPage}`;
            if (this.searchTerm) url += `&search=${encodeURIComponent(this.searchTerm)}`;
            if (this.statusFilter) url += `&status=${encodeURIComponent(this.statusFilter)}`;

            return fetch(url, { credentials: 'include', headers: { 'Accept': 'application/json' } })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.admins = data.data || [];
                        this.adminsCount = data.count || 0;
                        this.renderTable(this.admins, this.adminsCount);
                        this.updatePagination(this.adminsCount);

                        // Single notification
                        if (typeof showNotification === 'function') {
                            // Only show notification if admins section is currently active
                            const adminsSection = document.getElementById('admins');
                            const isAdminsActive = adminsSection && adminsSection.classList.contains('active');

                            if (isAdminsActive) {
                                const itemCount = this.admins.length;
                                showNotification(`Loaded ${itemCount} admins`, 'success', 2000);
                            }
                        }
                    } else {
                        throw new Error(data.message || 'Failed to load admins');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    if (tableBody) {
                        tableBody.innerHTML =  `<tr><td colspan="10" style="text-align: center; color: var(--danger);">Error: ${error.message}</td></tr>`;
                    }
                    if (typeof showNotification === 'function') {
                        showNotification('Failed to load admins', 'error');
                    }
                })
                .finally(() => {
                    this.isLoading = false;
                });
        }

        renderTable(admins, totalCount) {
            const tableBody = document.getElementById('adminsTableBody');
            if (!tableBody) return;

            if (!admins || admins.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">No admins found</td></tr>';
                return;
            }

            tableBody.innerHTML = admins.map((admin, index) => {
                const serialNo = ((this.currentPage - 1) * this.perPage) + index + 1;
                const isCurrentUser = admin.id === this.currentAdminId;

                const showCheckbox = this.isSuperAdmin && !isCurrentUser;
                const showEdit = this.isSuperAdmin || isCurrentUser;
                const showDelete = this.isSuperAdmin && !isCurrentUser && !admin.is_superadmin;
                const showStatusToggle = this.isSuperAdmin && !isCurrentUser;

                const roleText = admin.is_superadmin ? 'Super Admin' : 'Admin';
                const roleIcon = admin.is_superadmin ? '<i class="fas fa-crown"></i> ' : '<i class="fas fa-user-shield"></i> ';
                const roleClass = admin.is_superadmin ? 'superadmin-role' : 'admin-role';

                return `
                    <tr data-admin-id="${admin.id}">
                        <td style="text-align: center; width: 40px;">${showCheckbox ? `<input type="checkbox" class="admin-checkbox" data-id="${admin.id}">` : '—'}</td>
                        <td style="text-align: center; width: 60px;">${serialNo}</td>
                        <td><strong>${this.escapeHTML(admin.full_name || admin.username)}</strong></td>
                        <td>${this.escapeHTML(admin.username)}</td>
                        <td style="word-break: break-all;">${this.escapeHTML(admin.email)}</td>
                        <td style="text-align: center;"><span class="role-badge ${roleClass}">${roleIcon}${roleText}</span></td>
                        <td>${this.formatDate(admin.created_at)}</td>
                        <td>${admin.last_login ? this.formatDate(admin.last_login, true) : 'Never'}</td>
                        <td style="text-align: center;">
                            <div class="status-toggle">
                                <label class="switch">
                                    <input type="checkbox" class="admin-status-toggle"
                                        ${admin.is_active ? 'checked' : ''}
                                        data-id="${admin.id}"
                                        data-is-current-user="${isCurrentUser}"
                                        ${!showStatusToggle ? 'disabled' : ''}>
                                    <span class="slider round"></span>
                                </label>
                                <span class="status-text">${admin.is_active ? 'Active' : 'Inactive'}</span>
                            </div>
                        </td>
                        <td style="text-align: center;">
                            <div class="action-buttons">
                                <button class="btn-icon view-admin" data-id="${admin.id}" title="View Details"><i class="fas fa-eye"></i></button>
                                ${showEdit ? `<button class="btn-icon edit-admin" data-id="${admin.id}" title="${this.isSuperAdmin ? 'Edit Admin' : 'Edit Profile'}"><i class="fas fa-edit"></i></button>` : ''}
                                ${showDelete ? `<button class="btn-icon delete-admin" data-id="${admin.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            this.addRowEventListeners();
            if (this.isSuperAdmin) {
                this.updateSelectAllCheckbox();
                this.updateBulkActionButton();
            }
        }

        addRowEventListeners() {
            // View buttons
            document.querySelectorAll('.view-admin').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => {
                    const adminId = newBtn.getAttribute('data-id');
                    const admin = this.admins.find(a => a.id === adminId);
                    if (admin) {
                        this.showAdminDetailsInModal(admin);
                    }
                });
            });

            // Edit buttons
            document.querySelectorAll('.edit-admin').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => {
                    const adminId = newBtn.getAttribute('data-id');
                    this.openEditModal(adminId);
                });
            });

            // Delete buttons
            document.querySelectorAll('.delete-admin').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => {
                    const adminId = newBtn.getAttribute('data-id');
                    this.deleteAdmin(adminId);
                });
            });

            // Status toggle
            document.querySelectorAll('.admin-status-toggle').forEach(toggle => {
                const newToggle = toggle.cloneNode(true);
                toggle.parentNode.replaceChild(newToggle, toggle);
                newToggle.addEventListener('change', (e) => {
                    const adminId = newToggle.getAttribute('data-id');
                    const isCurrentUser = newToggle.getAttribute('data-is-current-user') === 'true';
                    const isActive = newToggle.checked;

                    if (isCurrentUser && !isActive) {
                        this.showNotification('You cannot deactivate your own account', 'warning');
                        newToggle.checked = true;
                        return;
                    }
                    this.toggleStatus(adminId, isActive);
                });
            });

            // Checkboxes for bulk actions
            if (this.isSuperAdmin) {
                document.querySelectorAll('.admin-checkbox').forEach(checkbox => {
                    const newCheckbox = checkbox.cloneNode(true);
                    checkbox.parentNode.replaceChild(newCheckbox, checkbox);
                    newCheckbox.addEventListener('change', () => {
                        const adminId = newCheckbox.getAttribute('data-id');
                        if (newCheckbox.checked) {
                            if (!this.selectedAdmins.includes(adminId)) {
                                this.selectedAdmins.push(adminId);
                            }
                        } else {
                            this.selectedAdmins = this.selectedAdmins.filter(id => id !== adminId);
                        }
                        this.updateBulkActionButton();
                        this.updateSelectAllCheckbox();
                        // Update header count
                        updateHeaderSelectedCount('admins', this.selectedAdmins.length);
                    });
                });

                const selectAll = document.getElementById('selectAllAdmins');
                if (selectAll) {
                    const newSelectAll = selectAll.cloneNode(true);
                    selectAll.parentNode.replaceChild(newSelectAll, selectAll);
                    newSelectAll.addEventListener('change', () => {
                        const checkboxes = document.querySelectorAll('.admin-checkbox:not([disabled])');
                        this.selectedAdmins = [];
                        checkboxes.forEach(checkbox => {
                            checkbox.checked = newSelectAll.checked;
                            const adminId = checkbox.getAttribute('data-id');
                            if (newSelectAll.checked) {
                                this.selectedAdmins.push(adminId);
                            }
                        });
                        this.updateBulkActionButton();
                        // Update header count
                        updateHeaderSelectedCount('admins', this.selectedAdmins.length);
                    });
                }
            }
        }

        showAdminDetailsInModal(admin) {
            const modal = document.getElementById('contentViewModal');
            if (!modal) return;

            const title = modal.querySelector('.modal-title');
            const body = modal.querySelector('#contentViewBody');

            if (title) title.textContent = 'Admin Details';

            if (body) {
                const roleText = admin.is_superadmin ? 'Super Admin' : 'Admin';
                const roleIcon = admin.is_superadmin ? '<i class="fas fa-crown"></i> ' : '<i class="fas fa-user-shield"></i> ';
                const roleClass = admin.is_superadmin ? 'superadmin-role' : 'admin-role';

                body.innerHTML = `
                    <div class="view-field">
                        <label>Full Name:</label>
                        <span>${this.escapeHTML(admin.full_name || admin.username)}</span>
                    </div>
                    <div class="view-field">
                        <label>Username:</label>
                        <span>${this.escapeHTML(admin.username)}</span>
                    </div>
                    <div class="view-field">
                        <label>Email:</label>
                        <span>${this.escapeHTML(admin.email)}</span>
                    </div>
                    <div class="view-field">
                        <label>Role:</label>
                        <span class="role-badge ${roleClass}">${roleIcon}${roleText}</span>
                    </div>
                    <div class="view-field">
                        <label>Status:</label>
                        <span class="status-badge ${admin.is_active ? 'active' : 'inactive'}">
                            ${admin.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="view-field">
                        <label>Joined:</label>
                        <span>${this.formatDate(admin.created_at, true)}</span>
                    </div>
                    <div class="view-field">
                        <label>Last Login:</label>
                        <span>${admin.last_login ? this.formatDate(admin.last_login, true) : 'Never'}</span>
                    </div>
                `;
            }

            modal.style.display = 'block';

            const closeBtn = modal.querySelector('.close-modal');
            if (closeBtn) {
                const newClose = closeBtn.cloneNode(true);
                closeBtn.parentNode.replaceChild(newClose, closeBtn);
                newClose.addEventListener('click', () => modal.style.display = 'none');
            }
        }

        openEditModal(adminId) {
            if (!this.isSuperAdmin && adminId !== this.currentAdminId) {
                this.showNotification('You can only edit your own profile', 'warning');
                return;
            }

            const admin = this.admins.find(a => a.id === adminId);
            if (!admin) return;

            this.isEditMode = true;
            this.editingAdminId = adminId;

            document.getElementById('adminId').value = admin.id;
            document.getElementById('adminFullName').value = admin.full_name || admin.username;
            document.getElementById('adminUsername').value = admin.username;
            document.getElementById('adminEmail').value = admin.email;
            document.getElementById('adminPassword').value = '';
            document.getElementById('adminConfirmPassword').value = '';
            document.getElementById('adminIsSuperadmin').checked = admin.is_superadmin || false;
            document.getElementById('adminIsActive').checked = admin.is_active !== false;

            const modalTitle = document.getElementById('adminModalTitle');
            modalTitle.textContent = adminId === this.currentAdminId ? 'Edit Profile' : 'Edit Admin';

            document.getElementById('passwordRequired').textContent = '';
            document.getElementById('passwordHelp').textContent = 'Leave blank to keep current password. If changing, must meet requirements.';
            document.getElementById('adminStatusGroup').style.display = (this.isSuperAdmin && adminId !== this.currentAdminId) ? 'block' : 'none';
            document.getElementById('superadminCheckboxGroup').style.display = this.isSuperAdmin ? 'block' : 'none';

            // Clear all field errors
            this.clearAllFieldErrors();

            document.getElementById('adminModal').style.display = 'block';
        }

        clearAllFieldErrors() {
            const fields = ['adminFullName', 'adminUsername', 'adminEmail', 'adminPassword', 'adminConfirmPassword'];
            fields.forEach(fieldId => {
                const input = document.getElementById(fieldId);
                const errorSpan = document.getElementById(`${fieldId}Error`);
                if (errorSpan) errorSpan.remove();
                if (input) input.classList.remove('input-error');
            });
        }

        resetForm() {
            console.log('Resetting admin form');

            // Reset form fields
            const form = document.getElementById('adminForm');
            if (form) {
                form.reset();
            }

            // Reset hidden fields
            const adminId = document.getElementById('adminId');
            if (adminId) adminId.value = '';

            const adminPassword = document.getElementById('adminPassword');
            if (adminPassword) adminPassword.value = '';

            const adminConfirmPassword = document.getElementById('adminConfirmPassword');
            if (adminConfirmPassword) adminConfirmPassword.value = '';

            const adminIsSuperadmin = document.getElementById('adminIsSuperadmin');
            if (adminIsSuperadmin) adminIsSuperadmin.checked = false;

            const adminIsActive = document.getElementById('adminIsActive');
            if (adminIsActive) adminIsActive.checked = true;

            // Clear all field errors
            this.clearAllFieldErrors();

            // Clear password strength display
            const strengthEl = document.getElementById('passwordStrength');
            if (strengthEl) strengthEl.innerHTML = '';

            // Clear any mismatch message
            const mismatchMsg = document.getElementById('passwordMismatchMsg');
            if (mismatchMsg) mismatchMsg.remove();

            // Reset validation flags
            this.passwordValid = false;
            this.passwordMatch = false;

            console.log('Admin form reset complete');
        }

        clearAllFieldErrors() {
            const fields = ['adminFullName', 'adminUsername', 'adminEmail', 'adminPassword', 'adminConfirmPassword'];
            fields.forEach(fieldId => {
                const input = document.getElementById(fieldId);
                const errorSpan = document.getElementById(`${fieldId}Error`);
                if (errorSpan) {
                    errorSpan.style.display = 'none';
                    errorSpan.textContent = '';
                }
                if (input) {
                    input.classList.remove('input-error');
                }
            });
        }

        handleAdminCreation() {
            const fullName = document.getElementById('adminFullName').value.trim();
            const username = document.getElementById('adminUsername').value.trim();
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            const isSuperadmin = document.getElementById('adminIsSuperadmin').checked;

            const submitBtn = document.getElementById('saveAdminBtn');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            submitBtn.disabled = true;

            fetch('/api/admin/admins', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    username: username,
                    email: email,
                    password: password,
                    is_superadmin: isSuperadmin
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.showNotification('Admin created successfully!', 'success');
                    document.getElementById('adminModal').style.display = 'none';
                    this.resetForm();
                    this.loadAdmins();
                } else {
                    this.showNotification(data.message || 'Failed to create admin', 'error');
                    if (data.message && data.message.includes('username')) {
                        this.showFieldError(document.getElementById('adminUsername'), document.getElementById('usernameError'), data.message);
                    } else if (data.message && data.message.includes('email')) {
                        this.showFieldError(document.getElementById('adminEmail'), document.getElementById('emailError'), data.message);
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                this.showNotification('Failed to create admin', 'error');
            })
            .finally(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
        }

        handleAdminUpdate() {
            const adminId = document.getElementById('adminId').value;
            const fullName = document.getElementById('adminFullName').value.trim();
            const username = document.getElementById('adminUsername').value.trim();
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value;
            const isSuperadmin = document.getElementById('adminIsSuperadmin').checked;
            const isActive = document.getElementById('adminIsActive').checked;

            const updateData = { full_name: fullName, username, email };
            if (password) updateData.password = password;

            const isEditingSelf = adminId === this.currentAdminId;
            if (this.isSuperAdmin && !isEditingSelf) {
                updateData.is_superadmin = isSuperadmin;
                updateData.is_active = isActive;
            }

            const submitBtn = document.getElementById('saveAdminBtn');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitBtn.disabled = true;

            fetch(`/api/admin/admins/${adminId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.showNotification(isEditingSelf ? 'Profile updated successfully!' : 'Admin updated successfully!', 'success');
                    document.getElementById('adminModal').style.display = 'none';
                    this.resetForm();
                    this.loadAdmins();
                } else {
                    this.showNotification(data.message || 'Failed to update', 'error');
                    if (data.message && data.message.includes('username')) {
                        this.showFieldError(document.getElementById('adminUsername'), document.getElementById('usernameError'), data.message);
                    } else if (data.message && data.message.includes('email')) {
                        this.showFieldError(document.getElementById('adminEmail'), document.getElementById('emailError'), data.message);
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                this.showNotification('Failed to update', 'error');
            })
            .finally(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            });
        }

        toggleStatus(adminId, isActive) {
            if (!this.isSuperAdmin) {
                this.showNotification('Only super admins can change admin status', 'warning');
                this.loadAdmins();
                return;
            }

            fetch(`/api/admin/admins/${adminId}/status`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: isActive })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.showNotification(`Admin ${isActive ? 'activated' : 'deactivated'} successfully`, 'success');
                    this.loadAdmins();
                } else {
                    this.showNotification(data.message || 'Failed to update status', 'error');
                    this.loadAdmins();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                this.showNotification('Failed to update status', 'error');
                this.loadAdmins();
            });
        }

        deleteAdmin(adminId) {
            if (!this.isSuperAdmin) {
                this.showNotification('Only super admins can delete admin accounts', 'warning');
                return;
            }
            if (adminId === this.currentAdminId) {
                this.showNotification('You cannot delete your own account', 'warning');
                return;
            }

            const admin = this.admins.find(a => a.id === adminId);
            const adminName = admin ? (admin.full_name || admin.username) : 'this admin';

            this.showConfirmation('delete', `Are you sure you want to delete "${adminName}"? This action cannot be undone.`, () => {
                fetch(`/api/admin/admins/${adminId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.showNotification('Admin deleted successfully', 'success');
                        this.selectedAdmins = [];
                        this.loadAdmins();
                    } else {
                        this.showNotification(data.message || 'Failed to delete', 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    this.showNotification('Failed to delete admin', 'error');
                });
            });
        }

        bulkUpdateStatus(ids, isActive) {
            fetch('/api/admin/admins/bulk-status', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, is_active: isActive })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.showNotification(`${data.updated_count || ids.length} admin(s) ${isActive ? 'activated' : 'deactivated'}`, 'success');
                    this.selectedAdmins = [];
                    this.loadAdmins();
                } else {
                    this.showNotification(data.message || 'Failed to update', 'error');
                }
            });
        }

        bulkDelete(ids) {
            fetch('/api/admin/admins/bulk-delete', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.showNotification(`${data.deleted_count || ids.length} admin(s) deleted`, 'success');
                    this.selectedAdmins = [];
                    this.loadAdmins();
                } else {
                    this.showNotification(data.message || 'Failed to delete', 'error');
                }
            });
        }

        updatePagination(totalCount) {
            const pageInfo = document.getElementById('adminPageInfo');
            const prevBtn = document.getElementById('prevAdminPage');
            const nextBtn = document.getElementById('nextAdminPage');
            const totalPages = Math.ceil(totalCount / this.perPage);
            if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
            if (prevBtn) prevBtn.disabled = this.currentPage === 1;
            if (nextBtn) nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;

            // Call the global pagination UI update
            if (typeof updatePaginationUI === 'function') {
                updatePaginationUI('admins', this.currentPage, totalCount, this.perPage);
            }
        }

        updateBulkActionButton() {
            const applyBtn = document.getElementById('applyAdminBulkAction');
            const headerButton = document.getElementById('applyAdminBulkActionHeader');

            if (applyBtn) applyBtn.disabled = this.selectedAdmins.length === 0;
            if (headerButton) headerButton.disabled = this.selectedAdmins.length === 0;

            // Update header count
            if (typeof updateHeaderSelectedCount === 'function') {
                updateHeaderSelectedCount('admins', this.selectedAdmins.length);
            }
        }

        updateSelectAllCheckbox() {
            const selectAll = document.getElementById('selectAllAdmins');
            if (!selectAll) return;
            const checkboxes = document.querySelectorAll('.admin-checkbox:not([disabled])');
            const checkedCount = document.querySelectorAll('.admin-checkbox:checked:not([disabled])').length;
            if (checkboxes.length > 0) {
                selectAll.checked = checkedCount === checkboxes.length;
                selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
            } else {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
        }

        showNotification(message, type) {
            if (typeof showNotification === 'function') {
                showNotification(message, type);
            } else {
                alert(message);
            }
        }

        showConfirmation(type, message, callback) {
            if (typeof showConfirmation === 'function') {
                showConfirmation(type, message, callback);
            } else {
                if (confirm(message)) callback();
            }
        }

        escapeHTML(str) {
            if (!str) return '';
            return str.toString().replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
        }

        formatDate(dateString, includeTime = false) {
            if (!dateString) return 'N/A';
            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) return 'Invalid Date';
                const options = { year: 'numeric', month: 'short', day: 'numeric' };
                if (includeTime) {
                    options.hour = '2-digit';
                    options.minute = '2-digit';
                }
                return date.toLocaleDateString('en-US', options);
            } catch {
                return 'Invalid Date';
            }
        }
    }

    // ===== SIDEBAR MENU SCROLL MANAGER =====
    class SidebarMenuScrollManager {
        constructor() {
            this.sidebarMenu = document.querySelector('.sidebar-menu');
            this.sidebar = document.querySelector('.sidebar');
            this.scrollbar = null;
            this.scrollbarThumb = null;
            this.isDragging = false;
            this.isMobile = window.innerWidth <= 768;
            this.scrollTimeout = null;

            if (!this.sidebarMenu) {
                console.warn('Sidebar menu not found');
                return;
            }

            this.init();
        }

        init() {
            console.log('🔄 Initializing sidebar menu scroll manager...');

            // First, make sure menu is scrollable
            this.setupMenuScrolling();

            // Create custom scrollbar
            this.createScrollbar();

            // Setup event listeners
            this.setupEventListeners();

            // Initial update
            this.updateScrollbar();

            // Show on mobile immediately
            if (this.isMobile) {
                this.showScrollbar();
            }
        }

        setupMenuScrolling() {
            // Make menu scrollable
            this.sidebarMenu.style.overflowY = 'auto';
            this.sidebarMenu.style.overflowX = 'hidden';
            this.sidebarMenu.style.maxHeight = 'calc(100vh - 150px)'; // Adjust based on your header/footer height
            this.sidebarMenu.style.position = 'relative';
            this.sidebarMenu.style.paddingRight = '8px'; // Space for scrollbar

            // Hide native scrollbar
            this.sidebarMenu.style.scrollbarWidth = 'none';
            this.sidebarMenu.style.msOverflowStyle = 'none';

            // For Webkit browsers
            const style = document.createElement('style');
            style.textContent = `
                .sidebar-menu::-webkit-scrollbar {
                    display: none;
                    width: 0;
                }
            `;
            document.head.appendChild(style);
        }

        createScrollbar() {
            // Remove existing custom scrollbar
            const existing = this.sidebarMenu.parentElement.querySelector('.menu-scrollbar');
            if (existing) existing.remove();

            // Create scrollbar container
            this.scrollbar = document.createElement('div');
            this.scrollbar.className = 'menu-scrollbar';
            this.scrollbar.style.cssText = `
                position: absolute;
                top: 0;
                right: 0;
                width: 6px;
                height: 100%;
                z-index: 10;
                opacity: ${this.isMobile ? '0.8' : '0'};
                transition: opacity 0.3s ease;
                pointer-events: none;
            `;

            // Create scrollbar track
            const track = document.createElement('div');
            track.className = 'menu-scrollbar-track';
            track.style.cssText = `
                position: absolute;
                top: 0;
                right: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.05);
                border-radius: 3px;
            `;

            // Create scrollbar thumb
            this.scrollbarThumb = document.createElement('div');
            this.scrollbarThumb.className = 'menu-scrollbar-thumb';
            this.scrollbarThumb.style.cssText = `
                position: absolute;
                right: 0;
                width: 100%;
                background: rgba(0,0,0,0.3);
                border-radius: 3px;
                cursor: pointer;
                transition: background 0.2s ease, height 0.2s ease;
                pointer-events: auto;
                user-select: none;
            `;

            // Dark mode adjustments
            if (document.querySelector('.admin-dashboard.dark-mode')) {
                track.style.background = 'rgba(255,255,255,0.05)';
                this.scrollbarThumb.style.background = 'rgba(255,255,255,0.3)';
            }

            // Assemble
            track.appendChild(this.scrollbarThumb);
            this.scrollbar.appendChild(track);

            // Position scrollbar relative to sidebar menu
            const menuRect = this.sidebarMenu.getBoundingClientRect();
            const sidebarRect = this.sidebarMenu.parentElement.getBoundingClientRect();

            this.scrollbar.style.top = `${menuRect.top - sidebarRect.top}px`;
            this.scrollbar.style.height = `${menuRect.height}px`;

            // Add to sidebar (parent of menu)
            this.sidebarMenu.parentElement.appendChild(this.scrollbar);

            console.log('✅ Custom scrollbar created');
        }

        updateScrollbar() {
            if (!this.scrollbarThumb || !this.sidebarMenu) return;

            const menuHeight = this.sidebarMenu.clientHeight;
            const scrollHeight = this.sidebarMenu.scrollHeight;
            const scrollTop = this.sidebarMenu.scrollTop;

            // Hide if no scrolling needed
            if (scrollHeight <= menuHeight) {
                this.scrollbar.style.opacity = '0';
                this.scrollbar.style.pointerEvents = 'none';
                return;
            }

            // Calculate thumb size and position
            const ratio = menuHeight / scrollHeight;
            const thumbHeight = Math.max(menuHeight * ratio, 20); // Minimum 20px
            const maxScroll = scrollHeight - menuHeight;
            const thumbTop = (scrollTop / maxScroll) * (menuHeight - thumbHeight);

            // Update thumb
            this.scrollbarThumb.style.height = `${thumbHeight}px`;
            this.scrollbarThumb.style.top = `${thumbTop}px`;

            // Show scrollbar
            this.showScrollbar();

            console.log('📏 Scrollbar updated:', { menuHeight, scrollHeight, thumbHeight, thumbTop });
        }

        showScrollbar() {
            if (this.scrollbar) {
                this.scrollbar.style.opacity = this.isMobile ? '0.8' : '1';
                this.scrollbar.style.pointerEvents = 'auto';
            }
        }

        hideScrollbar() {
            if (this.scrollbar && !this.isDragging && !this.isMobile) {
                this.scrollbar.style.opacity = '0';
                this.scrollbar.style.pointerEvents = 'none';
            }
        }

        setupEventListeners() {
            // Menu scroll event
            this.sidebarMenu.addEventListener('scroll', () => {
                this.updateScrollbar();
                this.showScrollbar();

                // Auto-hide on desktop
                if (!this.isMobile) {
                    clearTimeout(this.scrollTimeout);
                    this.scrollTimeout = setTimeout(() => this.hideScrollbar(), 1500);
                }
            });

            // Mouse events for thumb dragging
            this.scrollbarThumb.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                this.isDragging = true;
                this.scrollbarThumb.style.background = 'rgba(0,0,0,0.5)';

                const startY = e.clientY;
                const startTop = parseFloat(this.scrollbarThumb.style.top) || 0;
                const menuHeight = this.sidebarMenu.clientHeight;
                const thumbHeight = this.scrollbarThumb.offsetHeight;

                const onMouseMove = (moveE) => {
                    if (!this.isDragging) return;

                    const deltaY = moveE.clientY - startY;
                    const newTop = Math.max(0, Math.min(startTop + deltaY, menuHeight - thumbHeight));

                    // Calculate scroll position
                    const scrollRatio = newTop / (menuHeight - thumbHeight);
                    const maxScroll = this.sidebarMenu.scrollHeight - menuHeight;
                    this.sidebarMenu.scrollTop = scrollRatio * maxScroll;

                    // Update thumb position
                    this.scrollbarThumb.style.top = `${newTop}px`;
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    this.isDragging = false;
                    this.scrollbarThumb.style.background = '';

                    if (!this.isMobile) {
                        setTimeout(() => this.hideScrollbar(), 1000);
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            // Hover events
            this.sidebarMenu.addEventListener('mouseenter', () => {
                if (!this.isMobile) this.showScrollbar();
            });

            this.sidebarMenu.addEventListener('mouseleave', () => {
                if (!this.isDragging && !this.isMobile) {
                    setTimeout(() => this.hideScrollbar(), 500);
                }
            });

            // Touch events for mobile
            this.scrollbarThumb.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.isDragging = true;
                this.scrollbarThumb.style.background = 'rgba(0,0,0,0.5)';
            }, { passive: false });

            document.addEventListener('touchmove', (e) => {
                if (!this.isDragging) return;
                e.preventDefault();

                const touch = e.touches[0];
                const thumbRect = this.scrollbarThumb.getBoundingClientRect();
                const menuRect = this.sidebarMenu.getBoundingClientRect();

                // Calculate new position
                const newTop = Math.max(0, Math.min(touch.clientY - menuRect.top - thumbRect.height/2, menuRect.height - thumbRect.height));

                // Calculate scroll position
                const scrollRatio = newTop / (menuRect.height - thumbRect.height);
                const maxScroll = this.sidebarMenu.scrollHeight - menuRect.height;
                this.sidebarMenu.scrollTop = scrollRatio * maxScroll;
            }, { passive: false });

            document.addEventListener('touchend', () => {
                this.isDragging = false;
                this.scrollbarThumb.style.background = '';
            });

            // Window resize
            window.addEventListener('resize', () => {
                this.isMobile = window.innerWidth <= 768;
                this.updateScrollbar();

                // Recreate scrollbar on resize to fix positioning
                setTimeout(() => {
                    this.createScrollbar();
                    this.updateScrollbar();
                }, 100);
            });

            // Also update when menu items change
            const observer = new MutationObserver(() => {
                setTimeout(() => this.updateScrollbar(), 100);
            });

            observer.observe(this.sidebarMenu, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }

        destroy() {
            if (this.scrollbar) {
                this.scrollbar.remove();
            }

            // Reset menu styles
            this.sidebarMenu.style.overflowY = '';
            this.sidebarMenu.style.maxHeight = '';
            this.sidebarMenu.style.paddingRight = '';
            this.sidebarMenu.style.position = '';

            console.log('🗑️ Sidebar menu scroll manager destroyed');
        }
    }

    // ============================================
    // ========== 25. WINDOW METHODS & EVENT LISTENERS ==========
    // ============================================

    // Retry function for error state
    window.retryLoadTrash = function() {
        loadTrashItems(1);
    };

    // Dynamic header height management
    function updateHeaderHeights() {
        const adminHeader = document.querySelector('.admin-header');
        let adminHeight = adminHeader ? adminHeader.offsetHeight : 56;

        const activeSection = document.querySelector('.admin-section.active');
        let sectionHeight = 0;
        let expiredTabsHeight = 0;

        if (activeSection && activeSection.id !== 'dashboard' && activeSection.id !== 'analytics') {
            const sectionHeader = activeSection.querySelector('.section-header');
            if (sectionHeader) {
                sectionHeight = sectionHeader.offsetHeight;
            }

            // Handle expired content tabs
            if (activeSection.id === 'expired-content') {
                const expiredTabs = document.querySelector('#expired-content .expired-stats-tabs');
                if (expiredTabs) {
                    expiredTabsHeight = expiredTabs.offsetHeight;
                    expiredTabs.style.top = (adminHeight + sectionHeight) + 'px';
                }
            }
        }

        // Calculate total height for table positioning
        const totalHeaderHeight = adminHeight + sectionHeight;

        // Update admin header position (desktop only)
        if (window.innerWidth > 992) {
            adminHeader.style.top = '0';
            adminHeader.style.left = '280px';
        } else {
            adminHeader.style.left = '0';
        }

        // Update section header position
        const sectionHeaders = document.querySelectorAll('.admin-section:is(#courses, #jobs, #internships, #blog, #testimonials, #newsletter, #messages, #users, #admins, #expired-content, #trash) .section-header');
        sectionHeaders.forEach(header => {
            if (window.innerWidth > 992) {
                header.style.top = adminHeight + 'px';
                header.style.left = '280px';
            } else {
                header.style.top = adminHeight + 'px';
                header.style.left = '0';
            }
        });

        // Update table containers
        const contentTables = document.querySelectorAll('.admin-section:is(#courses, #jobs, #internships, #blog, #testimonials, #newsletter, #messages, #users, #admins, #expired-content, #trash) .content-table');
        contentTables.forEach(table => {
            let topPosition = totalHeaderHeight;

            // Adjust for expired content tabs
            if (table.closest('#expired-content')) {
                topPosition = totalHeaderHeight + expiredTabsHeight;
            }

            table.style.top = topPosition + 'px';

            if (window.innerWidth > 992) {
                table.style.left = '280px';
            } else {
                table.style.left = '0';
            }
        });

        // Update dashboard and analytics position
        const dashboard = document.getElementById('dashboard');
        const analytics = document.getElementById('analytics');

        if (dashboard) {
            if (window.innerWidth > 992) {
                dashboard.style.top = adminHeight + 'px';
            } else {
                dashboard.style.top = adminHeight + 'px';
            }
        }

        if (analytics) {
            if (window.innerWidth > 992) {
                analytics.style.top = adminHeight + 'px';
            } else {
                analytics.style.top = adminHeight + 'px';
            }
        }

        console.log(`📏 Header heights - Admin: ${adminHeight}px, Section: ${sectionHeight}px, Expired Tabs: ${expiredTabsHeight}px`);
    }

    // Initialize header height observer
    function initHeaderHeightObserver() {
        // Initial update
        setTimeout(updateHeaderHeights, 100);

        // Update on resize
        window.addEventListener('resize', () => {
            setTimeout(updateHeaderHeights, 100);
        });

        // Watch for section changes
        const observer = new MutationObserver(() => {
            setTimeout(updateHeaderHeights, 100);
        });
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class'],
            subtree: true
        });

        // Also update when sidebar toggles on mobile
        const mobileToggle = document.querySelector('.mobile-menu-toggle');
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                setTimeout(updateHeaderHeights, 300);
            });
        }
    }

    // ===== SINGLE DOMContentLoaded LISTENER =====
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📄 DOM Content Loaded');
        initializeDashboard();
    });