   // Enhanced course image preview functionality
    function setupAdminCourseImagePreview() {
        let currentSearchState = {
            title: '',
            category: '',
            currentImageIndex: 0,
            images: [],
            currentPage: 1
        };

        // Listen for course title input
        document.addEventListener('input', function(e) {
            if (e.target.name === 'title' && e.target.closest('#courseModal')) {
                const courseTitle = e.target.value.trim();
                const categorySelect = document.querySelector('#courseModal [name="category"]');
                const category = categorySelect ? categorySelect.value : '';

                currentSearchState.title = courseTitle;
                currentSearchState.category = category;
                currentSearchState.currentImageIndex = 0;
                currentSearchState.images = [];
                currentSearchState.currentPage = 1;

                if (courseTitle.length > 2) {
                    clearTimeout(e.target.courseImageTimeout);
                    e.target.courseImageTimeout = setTimeout(() => {
                        searchCourseImages(courseTitle, category, e.target);
                    }, 800);
                } else {
                    clearAdminCourseImagePreview(e.target);
                }
            }
        });

        // Handle category changes
        document.addEventListener('change', function(e) {
            if (e.target.name === 'category' && e.target.closest('#courseModal')) {
                const titleInput = document.querySelector('#courseModal [name="title"]');
                if (titleInput && titleInput.value.trim().length > 2) {
                    currentSearchState.title = titleInput.value.trim();
                    currentSearchState.category = e.target.value;
                    currentSearchState.currentImageIndex = 0;
                    currentSearchState.images = [];
                    currentSearchState.currentPage = 1;

                    searchCourseImages(currentSearchState.title, currentSearchState.category, titleInput);
                }
            }
        });
    }

    function searchCourseImages(courseTitle, category, inputField) {
        clearAdminCourseImagePreview(inputField);

        const formRow = inputField.closest('.form-row') || inputField.closest('.form-group');
        if (!formRow) return;

        // Create enhanced preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'admin-course-image-preview enhanced';
        previewContainer.innerHTML = `
            <div class="admin-course-image-content">
                <div class="admin-image-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Searching course images for "${courseTitle}"...</span>
                </div>
                <div class="admin-image-results" style="display: none;">
                    <div class="image-carousel">
                        <div class="carousel-nav">
                            <button class="carousel-btn prev-btn" disabled>
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <span class="image-counter">Image 1 of <span class="total-images">0</span></span>
                            <button class="carousel-btn next-btn">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                        <div class="current-image-container">
                            <img src="" alt="${courseTitle}" class="current-preview-image">
                            <div class="image-source-info">
                                <span class="source-badge"></span>
                                <span class="image-title"></span>
                            </div>
                        </div>
                        <div class="image-actions">
                            <button type="button" class="btn-small btn-primary use-current-image">
                                <i class="fas fa-check"></i> Use This Image
                            </button>
                            <button type="button" class="btn-small btn-outline skip-current-image">
                                <i class="fas fa-forward"></i> Next Image
                            </button>
                            <button type="button" class="btn-small btn-outline search-more-images">
                                <i class="fas fa-search"></i> More Options
                            </button>
                            <button type="button" class="btn-small btn-outline cancel-image-search">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                        </div>
                    </div>
                </div>
                <div class="admin-image-error" style="display: none;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>No images found. Will use category default image.</span>
                    <button type="button" class="btn-small btn-outline use-default-image">
                        Use Default Image
                    </button>
                </div>
            </div>
        `;

        previewContainer.style.cssText = `
            margin-top: 15px;
            padding: 15px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

        formRow.appendChild(previewContainer);

        // Perform image search
        performImageSearch(courseTitle, category, 1, previewContainer, inputField);
    }

    function performImageSearch(courseTitle, category, page, previewContainer, inputField) {
        const params = new URLSearchParams({
            title: courseTitle,
            page: page
        });
        if (category) params.append('category', category);

        fetch(`/api/course-image/search?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                const loading = previewContainer.querySelector('.admin-image-loading');
                const results = previewContainer.querySelector('.admin-image-results');
                const error = previewContainer.querySelector('.admin-image-error');

                if (loading) loading.style.display = 'none';

                if (data.success && data.images && data.images.length > 0) {
                    // Store images in current search state
                    const searchState = getSearchState(inputField);
                    if (page === 1) {
                        searchState.images = data.images;
                    } else {
                        searchState.images = [...searchState.images, ...data.images];
                    }
                    searchState.currentPage = page;
                    searchState.hasMore = data.has_more;

                    if (results) {
                        displayImageResults(previewContainer, searchState, inputField);
                        results.style.display = 'block';
                    }
                } else {
                    if (error) {
                        error.style.display = 'block';
                        // Add event listener for default image button
                        const useDefaultBtn = previewContainer.querySelector('.use-default-image');
                        if (useDefaultBtn) {
                            useDefaultBtn.addEventListener('click', function() {
                                const defaultImage = getCategoryDefaultImage(category);
                                setCourseImage(inputField, defaultImage);
                                previewContainer.remove();
                                showNotification('Default category image selected', 'info');
                            });
                        }
                    }
                }
            })
            .catch(error => {
                console.error('Course image search error:', error);
                const loading = previewContainer.querySelector('.admin-image-loading');
                const errorDiv = previewContainer.querySelector('.admin-image-error');
                if (loading) loading.style.display = 'none';
                if (errorDiv) errorDiv.style.display = 'block';
            });
    }

    function displayImageResults(previewContainer, searchState, inputField) {
        const currentImageIndex = searchState.currentImageIndex;
        const images = searchState.images;
        const currentImage = images[currentImageIndex];

        if (!currentImage) return;

        // Update carousel
        const currentImageEl = previewContainer.querySelector('.current-preview-image');
        const sourceBadge = previewContainer.querySelector('.source-badge');
        const imageTitle = previewContainer.querySelector('.image-title');
        const imageCounter = previewContainer.querySelector('.image-counter');
        const totalImages = previewContainer.querySelector('.total-images');
        const prevBtn = previewContainer.querySelector('.prev-btn');
        const nextBtn = previewContainer.querySelector('.next-btn');

        // Set image and info
        currentImageEl.src = currentImage.url;
        currentImageEl.alt = currentImage.title;

        sourceBadge.textContent = currentImage.source.toUpperCase();
        sourceBadge.className = `source-badge source-${currentImage.source}`;

        imageTitle.textContent = currentImage.title || 'Course image';
        imageCounter.innerHTML = `Image ${currentImageIndex + 1} of <span class="total-images">${images.length}</span>`;
        totalImages.textContent = images.length;

        // Update button states
        prevBtn.disabled = currentImageIndex === 0;
        nextBtn.disabled = currentImageIndex === images.length - 1;

        // Add event listeners
        addImageCarouselListeners(previewContainer, searchState, inputField);
    }

    function addImageCarouselListeners(previewContainer, searchState, inputField) {
        const useBtn = previewContainer.querySelector('.use-current-image');
        const skipBtn = previewContainer.querySelector('.skip-current-image');
        const moreBtn = previewContainer.querySelector('.search-more-images');
        const cancelBtn = previewContainer.querySelector('.cancel-image-search');
        const prevBtn = previewContainer.querySelector('.prev-btn');
        const nextBtn = previewContainer.querySelector('.next-btn');

        // Use current image
        useBtn.addEventListener('click', function() {
            const currentImage = searchState.images[searchState.currentImageIndex];
            if (currentImage) {
                setCourseImage(inputField, currentImage.url);
                previewContainer.remove();
                showNotification('Course image selected successfully!', 'success');
            }
        });

        // Skip to next image
        skipBtn.addEventListener('click', function() {
            if (searchState.currentImageIndex < searchState.images.length - 1) {
                searchState.currentImageIndex++;
                displayImageResults(previewContainer, searchState, inputField);
            } else if (searchState.hasMore) {
                // Load more images
                searchState.currentPage++;
                performImageSearch(searchState.title, searchState.category,
                                 searchState.currentPage, previewContainer, inputField);
            }
        });

        // Search for more options
        moreBtn.addEventListener('click', function() {
            searchState.currentPage++;
            performImageSearch(searchState.title, searchState.category,
                             searchState.currentPage, previewContainer, inputField);
        });

        // Cancel search
        cancelBtn.addEventListener('click', function() {
            previewContainer.remove();
        });

        // Previous image
        prevBtn.addEventListener('click', function() {
            if (searchState.currentImageIndex > 0) {
                searchState.currentImageIndex--;
                displayImageResults(previewContainer, searchState, inputField);
            }
        });

        // Next image
        nextBtn.addEventListener('click', function() {
            if (searchState.currentImageIndex < searchState.images.length - 1) {
                searchState.currentImageIndex++;
                displayImageResults(previewContainer, searchState, inputField);
            } else if (searchState.hasMore) {
                searchState.currentPage++;
                performImageSearch(searchState.title, searchState.category,
                                 searchState.currentPage, previewContainer, inputField);
            }
        });
    }

    function getSearchState(inputField) {
        // Store search state on the input field for persistence
        if (!inputField.searchState) {
            inputField.searchState = {
                title: '',
                category: '',
                currentImageIndex: 0,
                images: [],
                currentPage: 1,
                hasMore: false
            };
        }
        return inputField.searchState;
    }

    function setCourseImage(inputField, imageUrl) {
        const imageInput = document.querySelector('#courseModal [name="image"]');
        if (imageInput) {
            imageInput.value = imageUrl;
        }

        // Also update the image preview if it exists
        const existingPreview = inputField.closest('.form-row').querySelector('.image-preview');
        if (existingPreview) {
            existingPreview.querySelector('img').src = imageUrl;
        }
    }

    function getCategoryDefaultImage(category) {
        const categoryImages = {
            'programming': '/static/images/courses/programming.jpg',
            'design': '/static/images/courses/design.jpg',
            'business': '/static/images/courses/business.jpg',
            'marketing': '/static/images/courses/marketing.jpg',
            'data science': '/static/images/courses/data-science.jpg',
            'artificial intelligence': '/static/images/courses/ai.jpg',
            'default': '/static/images/courses/default.jpg'
        };

        return categoryImages[category?.toLowerCase()] || categoryImages.default;
    }

    function clearAdminCourseImagePreview(inputField) {
        const formRow = inputField.closest('.form-row') || inputField.closest('.form-group');
        if (!formRow) return;

        const existingPreview = formRow.querySelector('.admin-course-image-preview');
        if (existingPreview) {
            existingPreview.remove();
        }
    }

