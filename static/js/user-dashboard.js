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

        // Get username from the page to show initial
        const usernameElement = document.querySelector('.user-info h2');
        const username = usernameElement ? usernameElement.textContent.trim() : '';
        const userInitial = username ? username[0].toUpperCase() : '?';

        // Always set the initial in the avatar (will be shown if no profile picture)
        avatarInitials.textContent = userInitial;

        // Check if we have a cached profile picture URL
        const cachedProfilePic = localStorage.getItem('profilePicUrl');
        const cachedTimestamp = localStorage.getItem('profilePicTimestamp');
        const currentTime = new Date().getTime();
        const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        // Use cached image if it's less than 24 hours old and not a broken image
        if (cachedProfilePic && cachedTimestamp && (currentTime - cachedTimestamp < oneDay)) {
            // Preload the image to check if it's valid
            const testImage = new Image();
            testImage.onload = function() {
                // Image loaded successfully, show it
                avatarImg.src = cachedProfilePic;
                avatarImg.style.display = 'block';
                avatarInitials.style.display = 'none';
                console.log('Using cached profile picture');
            };
            testImage.onerror = function() {
                // Image failed to load, show initial
                showInitialAvatar();
                console.log('Cached image failed to load, showing initial');
            };
            testImage.src = cachedProfilePic;
        }
        // Check if server-rendered image exists and is not empty
        else if (avatarImg.src && avatarImg.src !== window.location.origin + '/') {
            // Preload the image to check if it's valid
            const testImage = new Image();
            testImage.onload = function() {
                // Image loaded successfully, show it and cache it
                localStorage.setItem('profilePicUrl', avatarImg.src);
                localStorage.setItem('profilePicTimestamp', currentTime);
                avatarImg.style.display = 'block';
                avatarInitials.style.display = 'none';
                console.log('Using server-rendered profile picture');
            };
            testImage.onerror = function() {
                // Image failed to load, show initial
                showInitialAvatar();
                console.log('Server image failed to load, showing initial');
            };
            testImage.src = avatarImg.src;
        }
        // Show initial avatar if no profile picture
        else {
            showInitialAvatar();
            console.log('No profile picture found, showing initial');
        }
    }

    function showInitialAvatar() {
        avatarInitials.style.display = 'flex';
        avatarImg.style.display = 'none';
        // Clear any outdated cache
        localStorage.removeItem('profilePicUrl');
        localStorage.removeItem('profilePicTimestamp');
    }

    async function loadProfilePicture() {
        try {
            showLoading();
            const response = await fetch('/get-profile-pic', {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to load profile picture');

            const data = await response.json();

            // Check if we got a valid image URL
            if (data.success && data.image_url) {
                // Preload the image to check if it's valid
                const testImage = new Image();
                testImage.onload = function() {
                    // Image loaded successfully
                    const timestamp = new Date().getTime();
                    const imageUrl = data.image_url + '?t=' + timestamp;

                    // Update avatar
                    avatarImg.src = imageUrl;
                    avatarImg.style.display = 'block';
                    avatarInitials.style.display = 'none';

                    // Store in localStorage with timestamp
                    localStorage.setItem('profilePicUrl', imageUrl);
                    localStorage.setItem('profilePicTimestamp', timestamp);
                    console.log('Profile picture loaded from API and cached');
                    hideLoading();
                };
                testImage.onerror = function() {
                    // Image failed to load, show initial
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
            // Fallback to initial on error
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

                // Store in localStorage with timestamp
                localStorage.setItem('profilePicUrl', imageUrl);
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
    // Bookmark Management
    // ======================
    function setupBookmarkRemoval() {
        document.addEventListener('click', async function(e) {
            if (e.target.closest('.remove-bookmark')) {
                const btn = e.target.closest('.remove-bookmark');
                const itemId = btn.dataset.id;
                const itemType = btn.dataset.type;
                const bookmarkItem = btn.closest('.bookmark-item');

                if (!confirm('Are you sure you want to remove this bookmark?')) return;

                try {
                    showLoading();
                    btn.disabled = true;

                    const response = await fetch(`/bookmark/${itemType}/${itemId}`, {
                        method: 'POST',
                        credentials: 'include'
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to remove bookmark');

                    // Animate removal
                    bookmarkItem.style.transition = 'all 0.3s ease';
                    bookmarkItem.style.opacity = '0';
                    bookmarkItem.style.height = `${bookmarkItem.offsetHeight}px`;

                    setTimeout(() => {
                        bookmarkItem.remove();
                        showToast('Bookmark removed', 'success');
                        checkEmptyTabState();
                    }, 300);
                } catch (error) {
                    showToast(error.message, 'error');
                    btn.disabled = false;
                } finally {
                    hideLoading();
                }
            }
        });
    }

    function checkEmptyTabState() {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;

        const items = activeTab.querySelectorAll('.bookmark-item');
        const emptyState = activeTab.querySelector('.empty-state');

        if (items.length === 0 && !emptyState) {
            const tabName = activeTab.id;
            const emptyHTML = `
                <div class="empty-state">
                    <i class="far fa-bookmark"></i>
                    <h4>No ${tabName} saved yet</h4>
                    <p>Browse ${tabName} to save items to your dashboard</p>
                    <a href="/${tabName}" class="btn btn-primary">Browse ${tabName.charAt(0).toUpperCase() + tabName.slice(1)}</a>
                </div>
            `;
            activeTab.querySelector('.dashboard-card').innerHTML = emptyHTML;
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
                // Clear profile picture cache on logout
                localStorage.removeItem('profilePicUrl');
                localStorage.removeItem('profilePicTimestamp');
            });
        });
    }

    // Initialize logout cache clearing
    setupLogoutCacheClear();
});