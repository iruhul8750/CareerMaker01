    // ======================
    // GLOBAL BLOG MODAL FUNCTIONS
    // ======================

    function closeBlogModal() {
        const modal = document.getElementById('blogDetailModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    function shareBlog() {
        const modal = document.getElementById('blogDetailModal');
        if (!modal) return;

        const title = document.getElementById('modalTitle').textContent;
        const url = window.location.href;

        if (navigator.share) {
            navigator.share({
                title: title,
                url: url
            });
        } else {
            navigator.clipboard.writeText(`${title} - ${url}`).then(() => {
                if (typeof showToast === 'function') {
                    showToast('Link copied to clipboard!', 'success');
                } else {
                    alert('Link copied to clipboard!');
                }
            });
        }
    }

    // ======================
    // DASHBOARD STATE MANAGEMENT
    // ======================

    const DashboardState = {
        currentTab: 'courses',

        init() {
            this.restoreTabState();
        },

        saveState() {
            localStorage.setItem('dashboardActiveTab', this.currentTab);
        },

        restoreTabState() {
            const savedTab = localStorage.getItem('dashboardActiveTab');
            if (savedTab) {
                setTimeout(() => this.switchToTab(savedTab), 100);
            }
        },

        switchToTab(tabId) {
            const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
            if (tabBtn) {
                tabBtn.click();
            }
        }
    };

    // ======================
    // UNIVERSAL LOADER MANAGEMENT
    // ======================

    const LoaderManager = {
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

    // ======================
    // CONVENIENCE FUNCTIONS
    // ======================

    function showLoader(message = 'Loading...', options = {}) {
        return LoaderManager.show(message, options);
    }

    function hideLoader(force = false) {
        return LoaderManager.hide(force);
    }

    function resetLoader() {
        return LoaderManager.reset();
    }

    async function withLoader(promise, loadingMessage = 'Loading...', successMessage = null, errorMessage = null) {
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
    }

    // ======================
    // MAIN DASHBOARD FUNCTIONALITY
    // ======================

    document.addEventListener('DOMContentLoaded', function() {
    const avatarInitials = document.getElementById('userAvatarInitials');
    const avatarImg = document.getElementById('userAvatarImage');
    const profilePicUpload = document.getElementById('profilePicUpload');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const flashMessages = document.querySelector('.flash-messages');

    // Initialize everything
    DashboardState.init();
    initProfilePicture();
    setupTabs();
    setupBookmarkRemoval();
    setupAvatarUpload();
    setupFlashMessages();
    setupBlogReading();
    setupTestimonials();
    setupLogoutCacheClear();

    // ======================
    // Tab Management with State Preservation
    // ======================

    function setupTabs() {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const tabId = this.dataset.tab;

                showTabLoading(tabId);

                tabBtns.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                tabContents.forEach(content => content.classList.remove('active'));

                setTimeout(() => {
                    const tabContent = document.getElementById(tabId);
                    if (tabContent) {
                        tabContent.classList.add('active');
                        hideTabLoading(tabId);
                        loadTabContent(tabId);
                    }
                }, 300);

                DashboardState.currentTab = tabId;
                DashboardState.saveState();
            });
        });

        const savedTab = localStorage.getItem('dashboardActiveTab');
        if (savedTab && document.querySelector(`[data-tab="${savedTab}"]`)) {
            setTimeout(() => {
                document.querySelector(`[data-tab="${savedTab}"]`).click();
            }, 200);
        } else if (tabBtns.length > 0) {
            tabBtns[0].click();
        }
    }

    function showTabLoading(tabId) {
        const tabContent = document.getElementById(tabId);
        if (!tabContent) return;

        let loadingOverlay = tabContent.querySelector('.tab-loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'tab-loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="tab-loading-content">
                    <div class="tab-spinner"></div>
                    <p>Loading...</p>
                </div>
            `;
            tabContent.appendChild(loadingOverlay);
        }
        loadingOverlay.style.display = 'flex';
    }

    function hideTabLoading(tabId) {
        const tabContent = document.getElementById(tabId);
        if (!tabContent) return;

        const loadingOverlay = tabContent.querySelector('.tab-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    async function loadTabContent(tabId) {
        showTabLoading(tabId);
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (tabId === 'testimonials') {
                await loadTestimonialsContent();
            }
        } catch (error) {
            console.error(`Error loading ${tabId}:`, error);
        } finally {
            hideTabLoading(tabId);
        }
    }

    async function loadTestimonialsContent() {
        try {
            const response = await fetch('/api/testimonials/user', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    renderTestimonials(data.testimonials);
                }
            }
        } catch (error) {
            console.error('Failed to load testimonials:', error);
        }
    }

    // ======================
    // Profile Picture Functions
    // ======================

    function initProfilePicture() {
        if (!avatarInitials) return;

        const usernameElement = document.querySelector('.user-info h2');
        const username = usernameElement ? usernameElement.textContent.trim() : '';
        const userInitial = username ? username[0].toUpperCase() : '?';
        avatarInitials.textContent = userInitial;

        // Always fetch fresh image, don't rely on cache
        loadProfilePicture();
    }

     function loadProfilePicture() {
        const timestamp = Date.now();
        const cacheBusterUrl = `/get-profile-pic?t=${timestamp}`;

        // Fetch with cache busting
        fetch(cacheBusterUrl, {
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.image_url) {
                // Force reload by setting src with cache busting
                avatarImg.src = data.image_url + '&_=' + timestamp;
                avatarImg.style.display = 'block';
                avatarInitials.style.display = 'none';
            } else {
                showInitialAvatar();
            }
        })
        .catch(error => {
            console.error('Profile picture load error:', error);
            showInitialAvatar();
        });
    }

    function showInitialAvatar() {
        avatarInitials.style.display = 'flex';
        avatarImg.style.display = 'none';
        localStorage.removeItem('profilePicTimestamp');
        console.log('Showing initial avatar');
    }

    function setupAvatarUpload() {
        if (!profilePicUpload) return;

        profilePicUpload.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                showToast('Only JPEG, PNG, GIF or WebP images allowed', 'error');
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                showToast('Image must be smaller than 2MB', 'error');
                return;
            }

            // Show preview immediately
            const reader = new FileReader();
            reader.onload = function(e) {
                // Set the preview immediately
                avatarImg.src = e.target.result;
                avatarImg.style.display = 'block';
                avatarInitials.style.display = 'none';

                // Clear cache for this image
                localStorage.removeItem('profilePicUrl');
                localStorage.removeItem('profilePicTimestamp');
                localStorage.removeItem('profilePicCacheBust');
            };
            reader.readAsDataURL(file);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('timestamp', Date.now()); // Add timestamp to prevent caching

            try {
                showLoader('Uploading profile picture...');

                const response = await fetch('/upload-profile-pic', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Upload failed');
                }

                // Add cache-busting timestamp to the image URL
                const timestamp = Date.now();
                const imageUrl = data.image_url + '?t=' + timestamp;

                // Force reload the image
                const img = new Image();
                img.onload = function() {
                    // Set the new image with timestamp
                    avatarImg.src = imageUrl;
                    avatarImg.style.display = 'block';

                    // Store with timestamp
                    localStorage.setItem('profilePicUrl', data.image_url);
                    localStorage.setItem('profilePicTimestamp', timestamp);
                    localStorage.setItem('profilePicCacheBust', timestamp.toString());

                    showToast('Profile picture updated successfully!', 'success');

                    // TRIGGER PROFILE PICTURE REFRESH ON ALL PAGES
                    triggerProfilePictureRefresh();
                };

                img.onerror = function() {
                    // Fallback to the preview if server image fails to load
                    console.log('Server image failed to load, using preview');
                    showToast('Profile picture updated! (Using preview)', 'success');

                    // Still trigger refresh even if preview is used
                    triggerProfilePictureRefresh();
                };

                img.src = imageUrl;

            } catch (error) {
                console.error('Upload error:', error);
                // Show initials as fallback
                avatarImg.style.display = 'none';
                avatarInitials.style.display = 'flex';
                showToast(error.message || 'Failed to upload image', 'error');
            } finally {
                hideLoader();
                e.target.value = '';
            }
        });
    }

    // Add this function to trigger profile picture refresh across all pages
    function triggerProfilePictureRefresh() {
        console.log('🔄 Triggering profile picture refresh...');

        // Method 1: Dispatch custom event (for single page app behavior)
        const profileUpdatedEvent = new CustomEvent('profilePictureUpdated', {
            detail: {
                timestamp: Date.now(),
                source: 'dashboard'
            }
        });
        document.dispatchEvent(profileUpdatedEvent);

        // Method 2: Broadcast to all tabs using BroadcastChannel
        try {
            const broadcastChannel = new BroadcastChannel('profile_picture_updates');
            broadcastChannel.postMessage({
                type: 'PROFILE_PICTURE_UPDATED',
                timestamp: Date.now()
            });
            broadcastChannel.close();
        } catch (e) {
            console.log('BroadcastChannel not supported, using localStorage method');
        }

        // Method 3: Use localStorage to signal refresh (works across tabs)
        localStorage.setItem('profilePicLastUpdate', Date.now().toString());

        // Method 4: Force reload navigation profile picture if function exists
        if (typeof refreshNavigationProfilePicture === 'function') {
            setTimeout(() => {
                refreshNavigationProfilePicture();
            }, 500);
        }

        // Method 5: If on dashboard page, force reload main page after a delay
        if (window.location.pathname.includes('/dashboard')) {
            console.log('On dashboard - scheduling main page profile refresh');
            setTimeout(() => {
                // Try to fetch main page profile picture
                fetch('/get-profile-pic?force=' + Date.now(), {
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                }).catch(() => {
                    // Ignore errors
                });
            }, 1000);
        }
    }

    // Also add a listener for profile picture updates (for when user is on other tabs)
    document.addEventListener('DOMContentLoaded', function() {
        // Listen for the custom event
        document.addEventListener('profilePictureUpdated', function(e) {
            console.log('📢 Profile picture update event received:', e.detail);

            // Reload the profile picture
            if (typeof loadNavigationProfilePicture === 'function') {
                setTimeout(() => {
                    loadNavigationProfilePicture();
                }, 300);
            }

            // If there's a welcome banner profile picture, reload it too
            const welcomeProfilePic = document.querySelector('.welcome-profile-pic');
            if (welcomeProfilePic) {
                const newTimestamp = Date.now();
                const currentSrc = welcomeProfilePic.src;
                const baseSrc = currentSrc.split('?')[0];
                welcomeProfilePic.src = baseSrc + '?t=' + newTimestamp;
            }
        });

        // Listen for BroadcastChannel messages
        try {
            const broadcastChannel = new BroadcastChannel('profile_picture_updates');
            broadcastChannel.onmessage = function(event) {
                if (event.data.type === 'PROFILE_PICTURE_UPDATED') {
                    console.log('📢 Profile picture updated via BroadcastChannel');
                    if (typeof loadNavigationProfilePicture === 'function') {
                        setTimeout(() => {
                            loadNavigationProfilePicture();
                        }, 300);
                    }
                }
            };
        } catch (e) {
            console.log('BroadcastChannel not supported');
        }

        // Check localStorage for recent updates
        const lastUpdate = localStorage.getItem('profilePicLastUpdate');
        if (lastUpdate) {
            const now = Date.now();
            const updateTime = parseInt(lastUpdate);

            // If update was within the last 10 seconds, refresh
            if (now - updateTime < 10000) {
                console.log('Recent profile picture update detected, refreshing...');
                if (typeof loadNavigationProfilePicture === 'function') {
                    setTimeout(() => {
                        loadNavigationProfilePicture();
                    }, 1000);
                }
            }
        }
    });

    // Also add a periodic check for profile picture updates (every 30 seconds)
    setInterval(() => {
        const lastUpdate = localStorage.getItem('profilePicLastUpdate');
        if (lastUpdate) {
            const now = Date.now();
            const updateTime = parseInt(lastUpdate);

            // If update was within the last minute, refresh
            if (now - updateTime < 60000) {
                if (typeof loadNavigationProfilePicture === 'function') {
                    loadNavigationProfilePicture();
                }
            }
        }
    }, 30000);

    function clearImageCache(imageElement) {
        if (!imageElement) return;

        // Replace the src with a data URL to clear the current image
        imageElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        // Force browser to release memory
        setTimeout(() => {
            imageElement.removeAttribute('src');
        }, 100);
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

                showRemoveConfirmationModal(itemId, itemType, bookmarkItem);
            }
        });
    }

    function showRemoveConfirmationModal(itemId, itemType, bookmarkItem) {
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

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

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

            setTimeout(() => {
                bookmarkItem.remove();
                showToast('Bookmark removed successfully', 'success');
                checkEmptyTabState();
            }, 700);

        } catch (error) {
            console.error('Remove bookmark error:', error);
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

        const tabId = activeTab.id;

        if (tabId === 'testimonials') {
            checkTestimonialsEmptyState();
            return;
        }

        const items = Array.from(activeTab.querySelectorAll('.bookmark-item')).filter(item => {
            return item.style.opacity !== '0' && !item.style.height.includes('0');
        });

        const emptyState = activeTab.querySelector('.empty-state');
        const hasItems = items.length > 0;

        if (!hasItems && !emptyState) {
            let browseText = '', browseUrl = '', description = '';

            switch(tabId) {
                case 'courses':
                    browseText = 'Browse Courses'; browseUrl = '/courses';
                    description = 'Save courses from the courses page to view them here'; break;
                case 'jobs':
                    browseText = 'Browse Jobs'; browseUrl = '/jobs';
                    description = 'Save jobs from the jobs page to view them here'; break;
                case 'internships':
                    browseText = 'Browse Internships'; browseUrl = '/internships';
                    description = 'Save internships from the internships page to view them here'; break;
                case 'blogs':
                    browseText = 'Browse Articles'; browseUrl = '/blogs.html';
                    description = 'Save articles from the blog page to view them here'; break;
                case 'testimonials':
                    browseText = 'Add Testimonial'; browseUrl = '/#testimonials-section';
                    description = 'Share your experience and help others in their career journey'; break;
            }

            const emptyHTML = `
                <div class="empty-state">
                    <i class="far fa-bookmark"></i>
                    <h4>No ${tabId} saved yet</h4>
                    <p>${description}</p>
                    <a href="${browseUrl}" class="btn btn-primary">${browseText}</a>
                </div>
            `;
            dashboardCard.innerHTML = emptyHTML;
        } else if (hasItems && emptyState) {
            emptyState.remove();
        }
    }

    // ======================
    // Blog Reading Functionality
    // ======================

    function setupBlogReading() {
        document.addEventListener('click', function(e) {
            const readBlogBtn = e.target.closest('.read-blog-btn');
            if (readBlogBtn) {
                e.preventDefault();
                e.stopPropagation();
                const blogId = readBlogBtn.dataset.id;
                openBlogModal(blogId);
            }
        });
    }

    async function openBlogModal(blogId) {
        return withLoader(
            (async () => {
                const response = await fetch(`/api/blog/${blogId}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

                const data = await response.json();
                if (!data.success) throw new Error(data.error || 'Blog post not found');

                const blog = data.blog;
                showBlogModal(blog);
                trackBlogView(blogId);
                return blog;
            })(),
            'Loading article...',
            null,
            'Failed to load blog post'
        );
    }

    function showBlogModal(blog) {
        let modal = document.getElementById('blogDetailModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'blogDetailModal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-overlay" onclick="closeBlogModal()"></div>
                <div class="modal-content blog-modal-content">
                    <button class="close-modal" onclick="closeBlogModal()" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="blog-modal-header">
                        <div class="blog-modal-category" id="modalCategory">Career</div>
                        <h2 id="modalTitle">Blog Title</h2>
                        <div class="blog-modal-meta">
                            <div class="modal-author">
                                <img id="modalAuthorAvatar" src="" alt="Author" class="modal-avatar">
                                <div>
                                    <span id="modalAuthorName">Author Name</span>
                                    <span class="modal-date" id="modalDate">January 1, 2024</span>
                                </div>
                            </div>
                            <div class="modal-stats">
                                <button class="btn-like-modal" id="modalLikeBtn" data-id="">
                                    <i class="far fa-heart"></i>
                                    <span class="like-count" id="modalLikeCount">0</span>
                                </button>
                                <span class="read-time" id="modalReadTime">
                                    <i class="far fa-clock"></i> 5 min read
                                </span>
                                <span class="views-count-modal" id="modalViewsCount">
                                    <i class="fas fa-eye"></i> <span id="viewsCount">0</span> views
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="blog-modal-body">
                        <div class="blog-modal-image">
                            <img id="modalImage" src="" alt="Blog Image">
                        </div>
                        <div class="blog-modal-content-text" id="modalContent">
                        </div>
                    </div>
                    <div class="blog-modal-footer">
                        <button class="btn btn-outline bookmark-modal-btn" id="modalBookmarkBtn" data-id="" data-type="blog">
                            <i class="far fa-bookmark"></i>
                            <span class="bookmark-text">Bookmark</span>
                        </button>
                        <button class="btn btn-primary share-modal-btn" onclick="shareBlog()">
                            <i class="fas fa-share-alt"></i>
                            Share Article
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            setTimeout(() => setupModalEventListeners(), 100);
        } else {
            updateBlogModalContent(blog);
            setupModalEventListeners();
        }

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function updateBlogModalContent(blog) {
        document.getElementById('modalCategory').textContent = blog.categories?.[0] || 'Career';
        document.getElementById('modalTitle').textContent = blog.title;
        document.getElementById('modalAuthorName').textContent = blog.author || 'CareerMaker Team';
        document.getElementById('modalDate').textContent = formatDate(blog.published_at || blog.created_at);
        document.getElementById('modalReadTime').innerHTML = `<i class="far fa-clock"></i> ${blog.read_time || '5 min read'}`;
        document.getElementById('viewsCount').textContent = blog.views || 0;

        const modalImage = document.getElementById('modalImage');
        modalImage.src = blog.image || '/static/images/default-blog.jpg';
        modalImage.alt = blog.title;

        const authorAvatar = document.getElementById('modalAuthorAvatar');
        authorAvatar.src = blog.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(blog.author || 'CareerMaker Team')}&background=8B5FBF&color=fff&bold=true`;
        authorAvatar.alt = blog.author || 'CareerMaker Team';

        const contentElement = document.getElementById('modalContent');
        contentElement.innerHTML = formatBlogContent(blog.content || blog.description || 'No content available.');

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

        const likeBtn = document.getElementById('modalLikeBtn');
        likeBtn.dataset.id = blog.id;
        const likeCount = blog.like_count || 0;
        const isLiked = blog.is_liked || false;
        updateLikeUI(likeBtn, likeCount, isLiked);
    }

    function setupModalEventListeners() {
        const likeBtn = document.getElementById('modalLikeBtn');
        const bookmarkBtn = document.getElementById('modalBookmarkBtn');

        if (likeBtn) {
            likeBtn.onclick = () => handleBlogLike(likeBtn.dataset.id, likeBtn);
        }
        if (bookmarkBtn) {
            bookmarkBtn.onclick = () => handleBlogBookmark(bookmarkBtn.dataset.id, bookmarkBtn);
        }

        const overlay = document.querySelector('#blogDetailModal .modal-overlay');
        if (overlay) {
            overlay.onclick = closeBlogModal;
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeBlogModal();
            }
        });
    }

    function formatDate(dateString) {
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
    }

    function formatBlogContent(content) {
        if (!content.includes('<')) {
            return content.split('\n').filter(para => para.trim()).map(para =>
                `<p>${para.trim()}</p>`
            ).join('');
        }
        return content;
    }

    function updateLikeUI(button, count, isLiked) {
        const icon = button.querySelector('i');
        const countElement = button.querySelector('.like-count');

        button.classList.toggle('liked', isLiked);
        if (icon) icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
        if (countElement) countElement.textContent = count;
    }

    async function handleBlogLike(blogId, button) {
        try {
            const response = await fetch(`/api/blog/${blogId}/like`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                updateLikeUI(button, data.like_count, data.action === 'liked');
                showToast(`Article ${data.action}`, 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Like error:', error);
            showToast(error.message || 'Failed to update like', 'error');
        }
    }

    async function handleBlogBookmark(blogId, button) {
        try {
            const response = await fetch(`/api/bookmark/blog/${blogId}`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                const isBookmarked = data.status === 'added';
                button.classList.toggle('bookmarked', isBookmarked);

                const icon = button.querySelector('i');
                const text = button.querySelector('.bookmark-text');
                if (icon) icon.className = isBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
                if (text) text.textContent = isBookmarked ? 'Bookmarked' : 'Bookmark';

                showToast(`Article ${data.status} bookmarks`, 'success');
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Bookmark error:', error);
            showToast(error.message || 'Failed to update bookmark', 'error');
        }
    }

    async function trackBlogView(blogId) {
        try {
            await fetch(`/api/blog/${blogId}/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.error('View tracking error:', error);
        }
    }

    // ======================
    // TESTIMONIALS MANAGEMENT
    // ======================

    function setupTestimonials() {
        setupTestimonialActions();
        setupTestimonialReadModal();
        setupEditTestimonialModal();
        setupTestimonialScrolling();

        setTimeout(() => {
            checkTestimonialsEmptyState();
        }, 100);
    }

    function setupTestimonialActions() {
        document.addEventListener('click', function(e) {
            if (e.target.closest('.view-testimonial')) {
                const viewBtn = e.target.closest('.view-testimonial');
                e.preventDefault();
                e.stopPropagation();
                const testimonialId = viewBtn.dataset.id;
                openTestimonialReadModal(testimonialId);
                return;
            }

            if (e.target.closest('.edit-testimonial')) {
                const editBtn = e.target.closest('.edit-testimonial');
                e.preventDefault();
                e.stopPropagation();
                const testimonialId = editBtn.dataset.id;
                editTestimonial(testimonialId);
                return;
            }

            if (e.target.closest('.delete-testimonial')) {
                const deleteBtn = e.target.closest('.delete-testimonial');
                e.preventDefault();
                e.stopPropagation();
                const testimonialId = deleteBtn.dataset.id;
                deleteTestimonial(testimonialId);
                return;
            }
        });
    }

    function setupTestimonialReadModal() {
        const overlay = document.querySelector('#testimonialReadModal .modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeTestimonialReadModal);
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeTestimonialReadModal();
                closeEditTestimonialModal();
            }
        });
    }

    function setupEditTestimonialModal() {
        const form = document.getElementById('editTestimonialForm');
        if (form) {
            form.addEventListener('submit', handleTestimonialUpdate);
        }

        const contentTextarea = document.getElementById('editTestimonialContent');
        if (contentTextarea) {
            contentTextarea.addEventListener('input', function() {
                const charCount = this.value.length;
                document.getElementById('editCharCount').textContent = charCount;
                if (charCount > 500) {
                    this.value = this.value.substring(0, 500);
                    document.getElementById('editCharCount').textContent = 500;
                }
            });
        }
    }

    async function openTestimonialReadModal(testimonialId) {
        try {
            showLoader('Loading testimonial...');
            const response = await fetch(`/api/testimonials/${testimonialId}`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.success) {
                showTestimonialReadModal(data.testimonial);
            } else {
                throw new Error(data.error || 'Failed to load testimonial');
            }
        } catch (error) {
            console.error('View testimonial error:', error);
            showToast(error.message || 'Failed to load testimonial', 'error');
        } finally {
            hideLoader();
        }
    }

    function showTestimonialReadModal(testimonial) {
        const modal = document.getElementById('testimonialReadModal');
        if (!modal) return;

        document.getElementById('testimonialModalContent').textContent = testimonial.content || 'No content available';
        document.getElementById('testimonialModalAuthor').textContent = testimonial.username || 'User';
        document.getElementById('testimonialModalRole').textContent = testimonial.role || 'CareerMaker User';

        const dateElement = document.getElementById('testimonialModalDate');
        if (testimonial.created_at) {
            const date = new Date(testimonial.created_at);
            dateElement.innerHTML = `<i class="far fa-calendar"></i> ${date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}`;
        } else {
            dateElement.innerHTML = `<i class="far fa-calendar"></i> Recently`;
        }

        const avatarElement = document.getElementById('testimonialModalAvatar');
        if (testimonial.profile_pic_url) {
            avatarElement.src = testimonial.profile_pic_url;
        } else {
            const userName = testimonial.username || 'User';
            avatarElement.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=4361ee&color=fff&bold=true`;
        }
        avatarElement.alt = testimonial.username || 'User';

        modal.dataset.currentTestimonialId = testimonial.id;
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeTestimonialReadModal() {
        const modal = document.getElementById('testimonialReadModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            delete modal.dataset.currentTestimonialId;
        }
    }

    async function editTestimonial(testimonialId) {
        try {
            showLoader('Loading testimonial...');
            const response = await fetch(`/api/testimonials/${testimonialId}`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            if (data.success) {
                showEditTestimonialModal(data.testimonial);
            } else {
                throw new Error(data.error || 'Failed to load testimonial');
            }
        } catch (error) {
            console.error('Edit testimonial error:', error);
            showToast(error.message || 'Failed to load testimonial for editing', 'error');
        } finally {
            hideLoader();
        }
    }

    function showEditTestimonialModal(testimonial) {
        const modal = document.getElementById('editTestimonialModal');
        if (!modal) return;

        document.getElementById('editTestimonialId').value = testimonial.id;
        document.getElementById('editTestimonialRole').value = testimonial.role || '';
        document.getElementById('editTestimonialContent').value = testimonial.content || '';
        document.getElementById('editCharCount').textContent = testimonial.content ? testimonial.content.length : 0;

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeEditTestimonialModal() {
        const modal = document.getElementById('editTestimonialModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    async function handleTestimonialUpdate(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const testimonialId = document.getElementById('editTestimonialId').value;
        const testimonialData = {
            content: formData.get('content'),
            rating: 5
        };

        const role = formData.get('role');
        if (role && role.trim()) {
            testimonialData.role = role.trim();
        }

        if (!testimonialData.content.trim()) {
            showToast('Please enter your testimonial content', 'error');
            return;
        }

        try {
            showLoader('Updating testimonial...');

            const response = await fetch(`/api/testimonial/update/${testimonialId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(testimonialData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            if (data.success) {
                showToast(data.message || 'Testimonial updated successfully!', 'success');
                closeEditTestimonialModal();
                await loadTestimonialsContent();
            } else {
                throw new Error(data.message || 'Failed to update testimonial');
            }

        } catch (error) {
            console.error('Testimonial update error:', error);
            showToast(error.message || 'Failed to update testimonial', 'error');
        } finally {
            hideLoader();
        }
    }

    async function deleteTestimonial(testimonialId) {
        showDeleteConfirmationModal(testimonialId);
    }

    function showDeleteConfirmationModal(testimonialId) {
        const modal = document.getElementById('deleteTestimonialModal');
        if (!modal) {
            console.error('Delete confirmation modal not found');
            return;
        }

        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const cancelBtn = document.getElementById('cancelTestimonialDelete');
        const confirmBtn = document.getElementById('confirmTestimonialDelete');

        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));

        const newCancelBtn = document.getElementById('cancelTestimonialDelete');
        const newConfirmBtn = document.getElementById('confirmTestimonialDelete');

        const cleanup = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        const cancelHandler = () => {
            cleanup();
        };

        const confirmHandler = async () => {
            cleanup();
            await performTestimonialDelete(testimonialId);
        };

        newCancelBtn.addEventListener('click', cancelHandler);
        newConfirmBtn.addEventListener('click', confirmHandler);

        const overlayHandler = (e) => {
            if (e.target === modal) {
                cleanup();
                modal.removeEventListener('click', overlayHandler);
            }
        };
        modal.addEventListener('click', overlayHandler);
    }

    async function performTestimonialDelete(testimonialId) {
        try {
            showLoader('Deleting testimonial...');

            const response = await fetch(`/api/testimonial/delete/${testimonialId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            if (data.success) {
                showToast(data.message || 'Testimonial deleted successfully', 'success');

                const testimonialItem = document.querySelector(`.testimonial-item[data-id="${testimonialId}"]`);
                if (testimonialItem) {
                    testimonialItem.classList.add('bookmark-removing');
                    setTimeout(() => {
                        testimonialItem.remove();
                        checkTestimonialsEmptyState();
                    }, 700);
                }
            } else {
                throw new Error(data.message || 'Failed to delete testimonial');
            }

        } catch (error) {
            console.error('Testimonial deletion error:', error);
            showToast(error.message || 'Failed to delete testimonial', 'error');
        } finally {
            hideLoader();
        }
    }

    function renderTestimonials(testimonials) {
        const testimonialsContainer = document.querySelector('#testimonials .testimonials-list');
        if (!testimonialsContainer) return;

        if (testimonials.length === 0) {
            checkTestimonialsEmptyState();
            return;
        }

        testimonialsContainer.innerHTML = testimonials.map(testimonial => `
            <div class="testimonial-item" data-id="${testimonial.id}">
                <div class="testimonial-header">
                    <div class="testimonial-user-info">
                        <img src="${testimonial.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.username || 'User')}&background=10b981&color=fff&bold=true`}"
                             alt="${testimonial.username || 'User'}"
                             class="testimonial-avatar">
                        <div class="testimonial-user-details">
                            <div class="testimonial-username">${testimonial.username || 'User'}</div>
                            <div class="testimonial-user-type">${testimonial.role || 'CareerMaker User'}</div>
                        </div>
                    </div>
                    <div class="testimonial-date">${formatTestimonialDate(testimonial.created_at)}</div>
                </div>
                <div class="testimonial-content-wrapper">
                    <div class="testimonial-content">${testimonial.content}</div>
                    ${testimonial.role ? `<div class="testimonial-role">${testimonial.role}</div>` : ''}
                </div>
                <div class="testimonial-actions">
                    <button class="btn-icon view-testimonial" data-id="${testimonial.id}" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon edit-testimonial" data-id="${testimonial.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete-testimonial" data-id="${testimonial.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        setupTestimonialActions();
    }

    function formatTestimonialDate(dateString) {
        if (!dateString) return 'Recently';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;

            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    function checkTestimonialsEmptyState() {
        const testimonialsTab = document.getElementById('testimonials');
        if (!testimonialsTab) return;

        const dashboardCard = testimonialsTab.querySelector('.dashboard-card');
        if (!dashboardCard) return;

        const testimonialItems = Array.from(testimonialsTab.querySelectorAll('.testimonial-item')).filter(item => {
            return !item.classList.contains('bookmark-removing') &&
                   item.style.opacity !== '0' &&
                   !item.style.height.includes('0');
        });

        const emptyState = testimonialsTab.querySelector('.empty-state');
        const hasTestimonials = testimonialItems.length > 0;

        if (!hasTestimonials && !emptyState) {
            const emptyHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-dots"></i>
                    <h4>No testimonials yet</h4>
                    <p>Share your experience and help others in their career journey</p>
                    <a href="/#testimonials-section" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Add Your Testimonial
                    </a>
                </div>
            `;
            dashboardCard.innerHTML = emptyHTML;
        } else if (hasTestimonials && emptyState) {
            emptyState.remove();
        }
    }

    function setupTestimonialScrolling() {
        document.addEventListener('click', function(e) {
            if (e.target.closest('#addTestimonialBtn')) {
                e.preventDefault();
                window.location.href = '/#testimonials';
            }
        });
    }

    function shareTestimonial() {
        const modal = document.getElementById('testimonialReadModal');
        if (!modal) return;

        const content = document.getElementById('testimonialModalContent').textContent;
        const author = document.getElementById('testimonialModalAuthor').textContent;
        const shareText = `"${content}" - ${author}`;

        if (navigator.share) {
            navigator.share({
                title: 'CareerMaker Testimonial',
                text: shareText,
                url: window.location.href
            }).catch(err => {
                copyToClipboard(shareText);
            });
        } else {
            copyToClipboard(shareText);
        }
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Testimonial copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            showToast('Failed to copy testimonial', 'error');
        });
    }

    // ======================
    // Flash Messages
    // ======================

    function setupFlashMessages() {
        if (flashMessages) {
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
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
                if (toastContainer.children.length === 0) {
                    toastContainer.remove();
                }
            }, 300);
        }, 3000);
    }

    // ======================
    // Clear cache on logout - UPDATED
    // ======================

    function setupLogoutCacheClear() {
        const logoutButtons = document.querySelectorAll('#logoutBtn, #dashboardLogoutBtn');

        logoutButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Show confirmation modal first
                const logoutModal = document.getElementById('logoutModal');
                if (logoutModal) {
                    logoutModal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                } else {
                    // If no modal exists, directly show loader and logout
                    performLogout();
                }
            });
        });

        // Setup logout modal handlers
        setupLogoutModal();
    }

    function setupLogoutModal() {
        const logoutModal = document.getElementById('logoutModal');
        if (!logoutModal) return;

        const cancelBtn = logoutModal.querySelector('#cancelLogoutBtn');
        const confirmBtn = logoutModal.querySelector('#confirmLogoutBtn');
        const closeBtn = logoutModal.querySelector('#closeLogoutModal');

        // Cancel logout
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function(e) {
                e.preventDefault();
                logoutModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
        }

        // Close modal
        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                logoutModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
        }

        // Confirm logout - FIXED VERSION
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                await performLogout();
            });
        }

        // Close on overlay click
        logoutModal.addEventListener('click', function(e) {
            if (e.target === logoutModal) {
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

    // ======================
    // USAGE EXAMPLES
    // ======================

    async function fetchUserData() {
        showLoader('Loading user data...');
        try {
            const response = await fetch('/api/user/data');
            const data = await response.json();
            return data;
        } finally {
            hideLoader();
        }
    }

    async function updateProfile(data) {
        return withLoader(
            fetch('/api/profile', {
                method: 'POST',
                body: JSON.stringify(data)
            }),
            'Updating profile...',
            'Profile updated successfully!',
            'Failed to update profile'
        );
    }

    async function performMultipleOperations() {
        showLoader('Starting process...');
        try {
            showLoader('Loading user data...');
            await fetch('/api/user');

            showLoader('Loading preferences...');
            await fetch('/api/preferences');

            showLoader('Finalizing...');
            await fetch('/api/finalize');

        } finally {
            hideLoader();
        }
    }

    // ======================
    // Global functions
    // ======================

    window.closeTestimonialReadModal = closeTestimonialReadModal;
    window.closeEditTestimonialModal = closeEditTestimonialModal;
    window.shareTestimonial = shareTestimonial;
});