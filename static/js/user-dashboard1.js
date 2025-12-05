   // ======================
    // GLOBAL BLOG MODAL FUNCTIONS (outside DOMContentLoaded)
    // ======================

    // These need to be global for the onclick handlers to work
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
                // Use the existing showToast function if available, otherwise alert
                if (typeof showToast === 'function') {
                    showToast('Link copied to clipboard!', 'success');
                } else {
                    alert('Link copied to clipboard!');
                }
            });
        }
    }

    // ======================
    // MAIN DASHBOARD FUNCTIONALITY
    // ======================
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
        setupBlogReading();
        setupTestimonials();



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
                console.log('📖 Reading blog from dashboard:', blogId);

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
            null, // No success toast
            'Failed to load blog post'
        );
    }

    function showBlogModal(blog) {
        // Create modal HTML if it doesn't exist
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
                            <!-- Blog content will be loaded here -->
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

            // Add event listeners for dynamically created modal buttons
            setTimeout(() => {
                setupModalEventListeners();
            }, 100);
        } else {
            // If modal exists, just update the content
            updateBlogModalContent(blog);
            setupModalEventListeners();
        }

        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function updateBlogModalContent(blog) {
        // Populate modal with blog data
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

        // Set content
        const contentElement = document.getElementById('modalContent');
        contentElement.innerHTML = formatBlogContent(blog.content || blog.description || 'No content available.');

        // Setup bookmark button
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

        // Setup like button
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

        // Close modal on overlay click
        const overlay = document.querySelector('#blogDetailModal .modal-overlay');
        if (overlay) {
            overlay.onclick = closeBlogModal;
        }

        // Close modal on escape key
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

        if (icon) {
            icon.className = isLiked ? 'fas fa-heart' : 'far fa-heart';
        }

        if (countElement) {
            countElement.textContent = count;
        }
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


    function shareBlog() {
        const modal = document.getElementById('blogDetailModal');
        if (!modal) return;

        const title = document.getElementById('modalTitle').textContent;
        const url = window.location.href; // Current page URL

        if (navigator.share) {
            navigator.share({
                title: title,
                url: url
            });
        } else {
            navigator.clipboard.writeText(`${title} - ${url}`).then(() => {
                showToast('Link copied to clipboard!', 'success');
            });
        }
    }

    // ======================
    // TESTIMONIALS MANAGEMENT - FIXED API ROUTES
    // ======================

    function setupTestimonials() {
        setupTestimonialActions();
        setupTestimonialReadModal();
        setupEditTestimonialModal();
        setupTestimonialScrolling();

        // Initialize empty state check for testimonials
        setTimeout(() => {
            checkTestimonialsEmptyState();
        }, 100);

        console.log('✅ Testimonials setup complete');
    }

    function setupTestimonialActions() {
        console.log('🔄 Setting up testimonial action listeners...');

        // Use event delegation for better performance
        document.addEventListener('click', function(e) {
            // View testimonial
            if (e.target.closest('.view-testimonial')) {
                const viewBtn = e.target.closest('.view-testimonial');
                e.preventDefault();
                e.stopPropagation();
                const testimonialId = viewBtn.dataset.id;
                console.log('👁️ View testimonial:', testimonialId);
                openTestimonialReadModal(testimonialId);
                return;
            }

            // Edit testimonial
            if (e.target.closest('.edit-testimonial')) {
                const editBtn = e.target.closest('.edit-testimonial');
                e.preventDefault();
                e.stopPropagation();
                const testimonialId = editBtn.dataset.id;
                console.log('✏️ Edit testimonial:', testimonialId);
                editTestimonial(testimonialId);
                return;
            }

            // Delete testimonial
            if (e.target.closest('.delete-testimonial')) {
                const deleteBtn = e.target.closest('.delete-testimonial');
                e.preventDefault();
                e.stopPropagation();
                const testimonialId = deleteBtn.dataset.id;
                console.log('🗑️ Delete testimonial:', testimonialId);
                deleteTestimonial(testimonialId);
                return;
            }
        });
    }

    function setupTestimonialReadModal() {
        // Close modal on overlay click
        const overlay = document.querySelector('#testimonialReadModal .modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeTestimonialReadModal);
        }

        // Close modal on escape key
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

        // Character count for edit form
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

    // FIXED: View Testimonial Function
    async function openTestimonialReadModal(testimonialId) {
        try {
            showLoader('Loading testimonial...');

            // Use the correct API endpoint from your backend
            const response = await fetch(`/api/testimonials/${testimonialId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

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
        if (!modal) {
            console.error('Testimonial read modal not found');
            return;
        }

        // Populate modal with testimonial data
        document.getElementById('testimonialModalContent').textContent = testimonial.content || 'No content available';
        document.getElementById('testimonialModalAuthor').textContent = testimonial.username || 'User';
        document.getElementById('testimonialModalRole').textContent = testimonial.role || 'CareerMaker User';

        // Set date
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

        // Set avatar
        const avatarElement = document.getElementById('testimonialModalAvatar');
        if (testimonial.profile_pic_url) {
            avatarElement.src = testimonial.profile_pic_url;
        } else {
            // Fallback to default avatar
            const userName = testimonial.username || 'User';
            avatarElement.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=4361ee&color=fff&bold=true`;
        }
        avatarElement.alt = testimonial.username || 'User';

        // Store current testimonial ID for sharing
        modal.dataset.currentTestimonialId = testimonial.id;

        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        console.log('✅ Testimonial read modal shown');
    }

    function closeTestimonialReadModal() {
        const modal = document.getElementById('testimonialReadModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            // Clear stored ID
            delete modal.dataset.currentTestimonialId;
        }
    }

    // FIXED: Edit Testimonial Function
    async function editTestimonial(testimonialId) {
        try {
            showLoader('Loading testimonial...');

            // Use the correct API endpoint
            const response = await fetch(`/api/testimonials/${testimonialId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

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
        if (!modal) {
            console.error('Edit testimonial modal not found');
            return;
        }

        // Populate form with testimonial data
        document.getElementById('editTestimonialId').value = testimonial.id;
        document.getElementById('editTestimonialRole').value = testimonial.role || '';
        document.getElementById('editTestimonialContent').value = testimonial.content || '';
        document.getElementById('editCharCount').textContent = testimonial.content ? testimonial.content.length : 0;

        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        console.log('✅ Edit testimonial modal shown');
    }

    function closeEditTestimonialModal() {
        const modal = document.getElementById('editTestimonialModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    // FIXED: Update Testimonial Function
    async function handleTestimonialUpdate(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const testimonialId = document.getElementById('editTestimonialId').value;
        const testimonialData = {
            content: formData.get('content'),
            rating: 5 // Default rating as per your backend
        };

        // Add role if provided
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

            // Use the correct API endpoint for updating
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

                // Reload the testimonials tab after a short delay
                setTimeout(() => {
                    window.location.reload();
                }, 1500);

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

    // FIXED: Delete Testimonial Function
    async function deleteTestimonial(testimonialId) {
        showDeleteConfirmationModal(testimonialId);
    }

    function showDeleteConfirmationModal(testimonialId) {
        const modal = document.getElementById('deleteTestimonialModal');
        if (!modal) {
            console.error('Delete confirmation modal not found');
            return;
        }

        // Show modal
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Clear any existing event listeners
        const cancelBtn = document.getElementById('cancelTestimonialDelete');
        const confirmBtn = document.getElementById('confirmTestimonialDelete');

        // Remove existing listeners
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));

        // Get fresh references
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

        // Close on background click
        const overlayHandler = (e) => {
            if (e.target === modal) {
                cleanup();
                modal.removeEventListener('click', overlayHandler);
            }
        };
        modal.addEventListener('click', overlayHandler);
    }

    // FIXED: Updated performTestimonialDelete with matching animation
    async function performTestimonialDelete(testimonialId) {
        try {
            showLoader('Deleting testimonial...');

            // Use the correct API endpoint for deletion
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

                // Remove the testimonial item from DOM with matching animation
                const testimonialItem = document.querySelector(`.testimonial-item[data-id="${testimonialId}"]`);
                if (testimonialItem) {
                    // Use the same animation class as bookmarks for consistency
                    testimonialItem.classList.add('bookmark-removing');

                    setTimeout(() => {
                        testimonialItem.remove();
                        // Use the correct function for testimonials
                        checkTestimonialsEmptyState();
                    }, 700); // Match the bookmark animation duration
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

    // FIXED: Share Testimonial Function
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
                console.log('Share cancelled:', err);
                // Fallback to clipboard
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

    // Debug function to check event listeners
    function debugEventListeners() {
        console.log('🔍 Debugging event listeners...');

        const viewButtons = document.querySelectorAll('.view-testimonial');
        const editButtons = document.querySelectorAll('.edit-testimonial');
        const deleteButtons = document.querySelectorAll('.delete-testimonial');

        console.log(`View buttons: ${viewButtons.length}`);
        console.log(`Edit buttons: ${editButtons.length}`);
        console.log(`Delete buttons: ${deleteButtons.length}`);

        // Check if buttons have click handlers
        viewButtons.forEach((btn, index) => {
            console.log(`View button ${index}:`, btn);
        });
    }

    function checkTestimonialsEmptyState() {
        const testimonialsTab = document.getElementById('testimonials');
        if (!testimonialsTab) return;

        const dashboardCard = testimonialsTab.querySelector('.dashboard-card');
        if (!dashboardCard) return;

        // Count only visible testimonial items (not ones being removed)
        const testimonialItems = Array.from(testimonialsTab.querySelectorAll('.testimonial-item')).filter(item => {
            return !item.classList.contains('testimonial-removing') &&
                   item.style.opacity !== '0' &&
                   !item.style.height.includes('0');
        });

        const emptyState = testimonialsTab.querySelector('.empty-state');
        const hasTestimonials = testimonialItems.length > 0;

        console.log(`Testimonials check: ${testimonialItems.length} items, empty state: ${!!emptyState}`);

        if (!hasTestimonials && !emptyState) {
            // Create empty state for testimonials
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
            // Remove empty state if testimonials exist
            emptyState.remove();

            // Restore the testimonials header if needed
            if (!dashboardCard.querySelector('h3')) {
                dashboardCard.innerHTML = `
                    <div class="testimonials-header">
                        <h3>My Testimonials</h3>
                        <p class="testimonials-subtitle">Your feedback and experiences shared with the community</p>
                    </div>
                    ${dashboardCard.innerHTML}
                `;
            }
        }
    }

    function setupTestimonialScrolling() {
        document.addEventListener('click', function(e) {
            if (e.target.closest('#addTestimonialBtn')) {
                e.preventDefault();

                // Simply redirect to home page with clear hash
                window.location.href = '/#testimonials';
            }
        });
    }

    // Global functions for modal close buttons
    window.closeTestimonialReadModal = closeTestimonialReadModal;
    window.closeEditTestimonialModal = closeEditTestimonialModal;
    window.shareTestimonial = shareTestimonial;

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
                showLoader('Uploading profile picture...');

                avatarInitials.style.display = 'none';
                avatarImg.style.display = 'none';

                const response = await fetch('/upload-profile-pic', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
                }

                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || 'Upload failed');
                }

                const timestamp = new Date().getTime();
                const imageUrl = data.image_url + '?t=' + timestamp;

                avatarImg.src = imageUrl;
                avatarImg.style.display = 'block';

                localStorage.setItem('profilePicUrl', data.image_url);
                localStorage.setItem('profilePicTimestamp', timestamp);

                showToast('Profile picture updated!', 'success');

            } catch (error) {
                console.error('Upload error:', error);
                showInitialAvatar();
                showToast(error.message || 'Failed to upload image', 'error');
            } finally {
                hideLoader();
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

        const tabId = activeTab.id;

        // Handle testimonials tab differently
        if (tabId === 'testimonials') {
            checkTestimonialsEmptyState();
            return;
        }

        const items = Array.from(activeTab.querySelectorAll('.bookmark-item')).filter(item => {
            return item.style.opacity !== '0' && !item.style.height.includes('0');
        });

        const emptyState = activeTab.querySelector('.empty-state');
        const hasItems = items.length > 0;

        if (!hasItems) {
            // Only create empty state if it doesn't exist
            if (!emptyState) {
                let browseText = '';
                let browseUrl = '';
                let description = '';

                // Set appropriate text and URL based on tab type
                switch(tabId) {
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
                    case 'blogs':
                        browseText = 'Browse Articles';
                        browseUrl = '/blogs.html';
                        description = 'Save articles from the blog page to view them here';
                        break;
                    default:
                        browseText = `Browse ${tabId}`;
                        browseUrl = `/${tabId}`;
                        description = `Save ${tabId} from the ${tabId} page to view them here`;
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
            }
        } else {
            // If there are items but empty state exists, remove the empty state
            if (emptyState) {
                emptyState.remove();

                // Restore the original dashboard card structure if needed
                if (!dashboardCard.querySelector('h3')) {
                    const title = tabId.charAt(0).toUpperCase() + tabId.slice(1);
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
    // UNIVERSAL LOADER MANAGEMENT
    // ======================

    const LoaderManager = {
        // Loader configuration
        config: {
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            spinnerColor: '#ffffff',
            textColor: '#ffffff',
            blurEffect: '5px',
            animationDuration: '0.3s'
        },

        // Active loaders counter
        activeLoaders: 0,

        // Show loader with custom message
        show: function(message = 'Loading...', options = {}) {
            this.activeLoaders++;

            let overlay = document.getElementById('universalLoadingOverlay');

            // Create loader if it doesn't exist
            if (!overlay) {
                overlay = this.createLoader();
            }

            // Update message if provided
            if (message) {
                const messageElement = overlay.querySelector('.loading-message');
                if (messageElement) {
                    messageElement.textContent = message;
                }
            }

            // Apply custom options
            this.applyOptions(overlay, options);

            // Show loader
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            console.log(`🔄 Loader shown: ${message} (Active: ${this.activeLoaders})`);

            return overlay;
        },

        // Hide loader
        hide: function(force = false) {
            if (force) {
                this.activeLoaders = 0;
            } else {
                this.activeLoaders = Math.max(0, this.activeLoaders - 1);
            }

            // Only hide if no more active loaders
            if (this.activeLoaders <= 0) {
                const overlay = document.getElementById('universalLoadingOverlay');
                if (overlay) {
                    // Add fade-out animation
                    overlay.style.opacity = '0';
                    overlay.style.transition = `opacity ${this.config.animationDuration} ease`;

                    setTimeout(() => {
                        overlay.style.display = 'none';
                        overlay.style.opacity = '1'; // Reset for next time
                        document.body.style.overflow = '';
                        console.log('✅ All loaders hidden');
                    }, 300);
                }
                this.activeLoaders = 0; // Reset counter
            } else {
                console.log(`⏳ Loader kept active: ${this.activeLoaders} pending operations`);
            }
        },

        // Create the loader element
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

        // Apply base styles
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

        // Apply custom options
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

        // Reset all loaders (emergency use)
        reset: function() {
            this.activeLoaders = 0;
            this.hide(true);
            console.log('🔄 All loaders reset');
        },

        // Get current loader status
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

    // Shortcut functions
    function showLoader(message = 'Loading...', options = {}) {
        return LoaderManager.show(message, options);
    }

    function hideLoader(force = false) {
        return LoaderManager.hide(force);
    }

    function resetLoader() {
        return LoaderManager.reset();
    }

    // Async wrapper for API calls
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
    // USAGE EXAMPLES
    // ======================

    // Example 1: Basic usage
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

    // Example 2: Using the wrapper
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

    // Example 3: Multiple sequential operations
    async function performMultipleOperations() {
        showLoader('Starting process...');
        try {
            // Operation 1
            showLoader('Loading user data...');
            await fetch('/api/user');

            // Operation 2
            showLoader('Loading preferences...');
            await fetch('/api/preferences');

            // Operation 3
            showLoader('Finalizing...');
            await fetch('/api/finalize');

        } finally {
            hideLoader();
        }
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