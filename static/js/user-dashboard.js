document.addEventListener('DOMContentLoaded', function() {
    // ======================
    // DOM Elements
    // ======================
    const avatarInitials = document.getElementById('userAvatarInitials');
    const avatarImg = document.getElementById('userAvatarImage');
    const profilePicUpload = document.getElementById('profilePicUpload');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const flashMessages = document.querySelector('.flash-messages');

    // ======================
    // Initialization
    // ======================
    initProfilePicture();
    setupTabs();
    setupBookmarkRemoval();
    setupAvatarUpload();
    setupFlashMessages();

    // ======================
    // Profile Picture Functions
    // ======================
    function initProfilePicture() {
    if (!avatarInitials) return;

    // Set initial
    const usernameElement = document.querySelector('.user-info h2');
    const username = usernameElement ? usernameElement.textContent.trim() : '';
    const userInitial = username ? username[0].toUpperCase() : '?';
    avatarInitials.textContent = userInitial;

    const cachedProfilePic = localStorage.getItem('profilePicUrl');
    const cachedTimestamp = localStorage.getItem('profilePicTimestamp');
    const currentTime = new Date().getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    // 1) Always try to use cached image first (even if timestamp is missing/expired)
    if (cachedProfilePic) {
        const testImage = new Image();
        testImage.onload = function() {
            // Add cache busting parameter to ensure fresh image
            const timestamp = new Date().getTime();
            const imageUrl = cachedProfilePic + '?t=' + timestamp;

            avatarImg.src = imageUrl;
            avatarImg.style.display = 'block';
            avatarInitials.style.display = 'none';
            console.log('Using cached profile picture (bypassing timestamp check)');

            // Update timestamp for future use
            localStorage.setItem('profilePicTimestamp', timestamp);
        };
        testImage.onerror = function() {
            // If cached image fails, try to load from server
            console.log('Cached image failed to load, trying server');
            loadProfilePicture();
        };
        testImage.src = cachedProfilePic;
        return;
    }

    // 2) If no cached image, fetch from API
    loadProfilePicture();
}

    function showInitialAvatar() {
        avatarInitials.style.display = 'flex';
        avatarImg.style.display = 'none';
        // Don't clear the URL cache, just the timestamp
        localStorage.removeItem('profilePicTimestamp');
        console.log('Showing initial avatar');
    }

    async function loadProfilePicture() {
        try {
            showLoading();
            const response = await fetch('/get-profile-pic', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to load profile picture');

            const data = await response.json();

            if (data.success && data.image_url) {
                const testImage = new Image();
                testImage.onload = function() {
                    const timestamp = new Date().getTime();
                    // Add cache busting parameter to ensure fresh image
                    const imageUrl = data.image_url + '?t=' + timestamp;

                    // Update avatar
                    avatarImg.src = imageUrl;
                    avatarImg.style.display = 'block';
                    avatarInitials.style.display = 'none';

                    // Store in localStorage with timestamp (store base URL without timestamp)
                    localStorage.setItem('profilePicUrl', data.image_url);
                    localStorage.setItem('profilePicTimestamp', timestamp);
                    console.log('Profile picture loaded from API and cached');
                    hideLoading();
                };
                testImage.onerror = function() {
                    showInitialAvatar();
                    console.log('API image failed to load, showing initial');
                    hideLoading();
                };
                testImage.src = data.image_url;
            } else {
                // No profile picture found, show initial
                showInitialAvatar();
                console.log('No profile picture found, showing initial');
                hideLoading();
            }
        } catch (error) {
            console.error('Profile picture load error:', error);
            showInitialAvatar();
            hideLoading();
        }
    }

    function setupAvatarUpload() {
        if (!profilePicUpload) return;

        profilePicUpload.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file
            const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (!validTypes.includes(file.type)) {
                showToast('Only JPEG, PNG or GIF images allowed', 'error');
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                showToast('Image must be smaller than 2MB', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                showLoading();
                avatarInitials.style.display = 'none';
                avatarImg.style.display = 'none';

                const response = await fetch('/upload-profile-pic', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Upload failed');

                // Add cache busting parameter
                const timestamp = new Date().getTime();
                const imageUrl = data.image_url + '?t=' + timestamp;

                // Update avatar
                avatarImg.src = imageUrl;
                avatarImg.style.display = 'block';

                // Store in localStorage with timestamp (store base URL without timestamp)
                localStorage.setItem('profilePicUrl', data.image_url);
                localStorage.setItem('profilePicTimestamp', timestamp);

                showToast('Profile picture updated!', 'success');
            } catch (error) {
                // Show initial on upload error
                showInitialAvatar();
                showToast(error.message, 'error');
                console.error('Upload error:', error);
            } finally {
                hideLoading();
                e.target.value = '';
            }
        });
    }

    // ======================
    // Tab Management
    // ======================
    function setupTabs() {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                tabBtns.forEach(btn => btn.classList.remove('active'));

                // Add active class to clicked button
                this.classList.add('active');

                // Hide all tab contents
                tabContents.forEach(content => content.classList.remove('active'));

                // Show the selected tab content
                const tabId = this.dataset.tab;
                document.getElementById(tabId).classList.add('active');
            });
        });

        // Activate first tab if none active
        if (tabBtns.length > 0 && !document.querySelector('.tab-btn.active')) {
            tabBtns[0].click();
        }
    }

    // ======================
    // Bookmark Management - UPDATED with Custom Modal
    // ======================
    function setupBookmarkRemoval() {
        document.addEventListener('click', async function(e) {
            if (e.target.closest('.remove-bookmark')) {
                const btn = e.target.closest('.remove-bookmark');
                const itemId = btn.dataset.id;
                const itemType = btn.dataset.type;
                const bookmarkItem = btn.closest('.bookmark-item');

                // Show custom modal instead of confirm()
                showRemoveConfirmationModal(itemId, itemType, bookmarkItem);
            }
        });
    }

    function showRemoveConfirmationModal(itemId, itemType, bookmarkItem) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('removeBookmarkModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'removeBookmarkModal';
            modal.className = 'confirmation-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-icon">
                        <i class="fas fa-trash-alt"></i>
                    </div>
                    <h3 class="modal-title">Remove Bookmark</h3>
                    <p class="modal-message">Are you sure you want to remove this bookmark? This action cannot be undone.</p>
                    <div class="modal-actions">
                        <button class="modal-btn modal-btn-cancel" id="cancelRemove">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                        <button class="modal-btn modal-btn-confirm" id="confirmRemove">
                            <i class="fas fa-check"></i>
                            Remove
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Setup event listeners
        const cancelBtn = document.getElementById('cancelRemove');
        const confirmBtn = document.getElementById('confirmRemove');

        const cleanup = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            cancelBtn.removeEventListener('click', cancelHandler);
            confirmBtn.removeEventListener('click', confirmHandler);
        };

        const cancelHandler = () => {
            cleanup();
        };

        const confirmHandler = async () => {
            cleanup();
            await removeBookmark(itemId, itemType, bookmarkItem);
        };

        cancelBtn.addEventListener('click', cancelHandler);
        confirmBtn.addEventListener('click', confirmHandler);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cleanup();
            }
        });
    }

    async function removeBookmark(itemId, itemType, bookmarkItem) {
        try {
            showLoading();
            const btn = bookmarkItem.querySelector('.remove-bookmark');
            if (btn) btn.disabled = true;

            // Add removal animation class
            bookmarkItem.classList.add('bookmark-removing');

            const response = await fetch(`/api/bookmark/${itemType}/${itemId}`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to remove bookmark');
            }

            // Wait for animation to complete before removing
            setTimeout(() => {
                bookmarkItem.remove();
                showToast('Bookmark removed successfully', 'success');

                // Check and update empty state immediately after removal
                checkEmptyTabState();

            }, 700); // Match the CSS animation duration

        } catch (error) {
            console.error('Remove bookmark error:', error);
            // Remove animation class on error
            bookmarkItem.classList.remove('bookmark-removing');
            showToast(error.message, 'error');
            const btn = bookmarkItem.querySelector('.remove-bookmark');
            if (btn) btn.disabled = false;
        } finally {
            hideLoading();
        }
    }

    function checkEmptyTabState() {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;

        const dashboardCard = activeTab.querySelector('.dashboard-card');
        if (!dashboardCard) return;

        // Count only visible bookmark items (not ones being removed)
        const items = Array.from(activeTab.querySelectorAll('.bookmark-item')).filter(item => {
            return item.style.opacity !== '0' && !item.style.height.includes('0');
        });

        const emptyState = activeTab.querySelector('.empty-state');
        const hasItems = items.length > 0;

        if (!hasItems) {
            // Only create empty state if it doesn't exist
            if (!emptyState) {
                const tabName = activeTab.id;
                let browseText = '';
                let browseUrl = '';
                let description = '';

                // Set appropriate text and URL based on tab type
                switch(tabName) {
                    case 'courses':
                        browseText = 'Browse Courses';
                        browseUrl = '/courses';
                        description = 'Save courses from the courses page to view them here';
                        break;
                    case 'jobs':
                        browseText = 'Browse Jobs';
                        browseUrl = '/jobs';
                        description = 'Save jobs from the jobs page to view them here';
                        break;
                    case 'internships':
                        browseText = 'Browse Internships';
                        browseUrl = '/internships';
                        description = 'Save internships from the internships page to view them here';
                        break;
                    default:
                        browseText = `Browse ${tabName}`;
                        browseUrl = `/${tabName}`;
                        description = `Save ${tabName} from the ${tabName} page to view them here`;
                }

                const emptyHTML = `
                    <div class="empty-state">
                        <i class="far fa-bookmark"></i>
                        <h4>No ${tabName} saved yet</h4>
                        <p>${description}</p>
                        <a href="${browseUrl}" class="btn btn-primary">${browseText}</a>
                    </div>
                `;

                dashboardCard.innerHTML = emptyHTML;
            }
        } else {
            // If there are items but empty state exists, remove the empty state
            if (emptyState) {
                emptyState.remove();

                // Restore the original dashboard card structure if needed
                if (!dashboardCard.querySelector('h3')) {
                    const tabName = activeTab.id;
                    const title = tabName.charAt(0).toUpperCase() + tabName.slice(1);
                    dashboardCard.innerHTML = `
                        <h3>Saved ${title}</h3>
                        <!-- Bookmark items will be dynamically added here -->
                    `;
                }
            }
        }
    }

    // ======================
    // Flash Messages
    // ======================
    function setupFlashMessages() {
        if (flashMessages) {
            // Auto-close flash messages after 5 seconds
            const messages = flashMessages.querySelectorAll('.flash-message');
            messages.forEach((msg, index) => {
                setTimeout(() => {
                    msg.style.opacity = '0';
                    setTimeout(() => msg.remove(), 300);
                }, 5000 + (index * 300));
            });
        }
    }

    // ======================
    // UI Helper Functions
    // ======================
    function showLoading() {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
    }

    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = 'none';
    }

    function showToast(message, type = 'success') {
        // Create or find toast container
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        // Add toast to container
        toastContainer.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto-remove toast after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                // Remove container if empty
                if (toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            }, 300);
        }, 3000);
    }

    // ======================
    // Clear cache on logout
    // ======================
    function setupLogoutCacheClear() {
        const logoutButtons = document.querySelectorAll('#logoutBtn, #dashboardLogoutBtn');
        logoutButtons.forEach(button => {
            button.addEventListener('click', function() {
                // ✅ Store the current URL before clearing timestamp
                const currentProfilePic = localStorage.getItem('profilePicUrl');
                const currentTimestamp = localStorage.getItem('profilePicTimestamp');

                // Clear both URL and timestamp temporarily
                localStorage.removeItem('profilePicUrl');
                localStorage.removeItem('profilePicTimestamp');

                // Immediately restore the URL (but not the timestamp)
                if (currentProfilePic) {
                    setTimeout(() => {
                        localStorage.setItem('profilePicUrl', currentProfilePic);
                        console.log('Logout: Profile URL restored after temporary clear');
                    }, 100);
                }
            });
        });
    }

    // Initialize logout cache clearing
    setupLogoutCacheClear();
});