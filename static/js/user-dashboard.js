document.addEventListener('DOMContentLoaded', function() {
  // ======================
  // Tab Management
  // ======================
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Initialize tabs from URL hash or default to first tab
  const initialTab = window.location.hash ?
    window.location.hash.substring(1) :
    tabBtns[0]?.dataset.tab;

  function activateTab(tabId) {
    // Update URL without reload
    history.replaceState(null, null, `#${tabId}`);

    // Update active states
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
      btn.setAttribute('aria-selected', btn.dataset.tab === tabId);
    });

    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabId);
      content.setAttribute('aria-hidden', content.id !== tabId);
    });

    // Load content if not already loaded
    if (document.getElementById(tabId).children.length === 0) {
      loadTabContent(tabId);
    }
  }

  // Tab button click handlers
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.dataset.tab;
      activateTab(tabId);
    });
  });

  // Initialize
  if (initialTab) activateTab(initialTab);

  // ======================
  // Content Loading
  // ======================
  function loadTabContent(tabId) {
    const tabContent = document.getElementById(tabId);
    if (!tabContent) return;

    showLoading();

    fetch(`/api/user/${tabId}`)
      .then(handleResponse)
      .then(data => {
        if (data.length === 0) {
          renderEmptyState(tabId, tabContent);
        } else {
          renderTabContent(tabId, data, tabContent);
        }
      })
      .catch(error => {
        console.error('Error loading tab content:', error);
        renderErrorState(tabId, tabContent);
      })
      .finally(() => {
        hideLoading();
      });
  }

  function renderTabContent(tabId, items, container) {
    let html = '';

    if (tabId === 'bookmarks') {
      html = `
        <div class="bookmark-grid">
          ${items.map(item => `
            <div class="bookmark-card" data-type="${item.item_type}" data-id="${item.id}">
              <div class="bookmark-header">
                <span class="bookmark-type">${item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1)}</span>
                <button class="btn btn-icon remove-bookmark"
                        data-id="${item.id}"
                        data-type="${item.item_type}"
                        aria-label="Remove bookmark">
                  <i class="fas fa-trash-alt"></i>
                </button>
              </div>
              <div class="bookmark-content">
                <h3>${item.title}</h3>
                <p>${item.description?.substring(0, 100) || ''}...</p>
                <div class="bookmark-meta">
                  ${renderBookmarkMeta(item)}
                </div>
              </div>
              <div class="bookmark-actions">
                <a href="/${item.item_type}s/${item.id}" class="btn btn-primary">
                  View Details
                </a>
                <a href="/share/${item.item_type}/${item.id}" class="btn btn-outline share-btn">
                  <i class="fas fa-share-alt"></i> Share
                </a>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // For individual tabs (courses, jobs, internships)
      html = `
        <div class="content-grid">
          ${items.map(item => `
            <div class="content-card" data-id="${item.id}">
              <div class="card-image">
                <img src="${item.image || getDefaultImage(tabId)}" alt="${item.title}"
                     onerror="this.onerror=null;this.src='${getDefaultImage(tabId)}'">
              </div>
              <div class="card-body">
                <h3>${item.title}</h3>
                <p>${item.description?.substring(0, 100) || ''}...</p>
                <div class="card-meta">
                  ${renderContentMeta(tabId, item)}
                </div>
              </div>
              <div class="card-actions">
                <a href="/${tabId}/${item.id}" class="btn btn-primary">
                  View Details
                </a>
                <button class="btn btn-icon bookmark-btn ${item.is_bookmarked ? 'bookmarked' : ''}"
                        data-id="${item.id}"
                        data-type="${tabId.singularize()}">
                  <i class="${item.is_bookmarked ? 'fas' : 'far'} fa-bookmark"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  function renderBookmarkMeta(item) {
    switch(item.item_type) {
      case 'course':
        return `
          <span class="price"><i class="fas fa-dollar-sign"></i> ${item.price || 'Free'}</span>
          <span class="level"><i class="fas fa-chart-line"></i> ${item.level || 'All Levels'}</span>
        `;
      case 'job':
        return `
          <span class="company"><i class="fas fa-building"></i> ${item.company || 'N/A'}</span>
          <span class="location"><i class="fas fa-map-marker-alt"></i> ${item.location || 'Remote'}</span>
        `;
      case 'internship':
        return `
          <span class="stipend"><i class="fas fa-money-bill-wave"></i> ${item.stipend || 'Unpaid'}</span>
          <span class="duration"><i class="fas fa-clock"></i> ${item.duration || 'Flexible'}</span>
        `;
      default:
        return '';
    }
  }

  function renderContentMeta(tabId, item) {
    switch(tabId) {
      case 'courses':
        return `
          <span class="price"><i class="fas fa-dollar-sign"></i> ${item.price || 'Free'}</span>
          <span class="duration"><i class="fas fa-clock"></i> ${item.duration || 'Self-paced'}</span>
        `;
      case 'jobs':
        return `
          <span class="company"><i class="fas fa-building"></i> ${item.company || 'N/A'}</span>
          <span class="type"><i class="fas fa-briefcase"></i> ${item.type || 'Full-time'}</span>
        `;
      case 'internships':
        return `
          <span class="stipend"><i class="fas fa-money-bill-wave"></i> ${item.stipend || 'Unpaid'}</span>
          <span class="duration"><i class="fas fa-calendar-alt"></i> ${item.duration || 'Flexible'}</span>
        `;
      default:
        return '';
    }
  }

  function renderEmptyState(tabId, container) {
    const typeName = tabId === 'bookmarks' ? 'bookmarks' : tabId;
    container.innerHTML = `
      <div class="empty-state">
        <i class="far fa-${getEmptyStateIcon(tabId)}"></i>
        <h3>No ${typeName} found</h3>
        <p>${getEmptyStateMessage(tabId)}</p>
        <a href="/${tabId === 'bookmarks' ? 'courses' : tabId}" class="btn btn-primary">
          Browse ${tabId === 'bookmarks' ? 'Content' : tabId.charAt(0).toUpperCase() + tabId.slice(1)}
        </a>
      </div>
    `;
  }

  function renderErrorState(tabId, container) {
    container.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error Loading ${tabId.charAt(0).toUpperCase() + tabId.slice(1)}</h3>
        <p>We couldn't load your ${tabId}. Please try again later.</p>
        <button class="btn btn-outline retry-btn" data-tab="${tabId}">
          <i class="fas fa-sync-alt"></i> Retry
        </button>
      </div>
    `;
  }

  function getEmptyStateIcon(tabId) {
    switch(tabId) {
      case 'bookmarks': return 'bookmark';
      case 'courses': return 'book';
      case 'jobs': return 'briefcase';
      case 'internships': return 'user-graduate';
      default: return 'folder-open';
    }
  }

  function getEmptyStateMessage(tabId) {
    switch(tabId) {
      case 'bookmarks': return 'You haven\'t saved any bookmarks yet. Start exploring and save items for later!';
      case 'courses': return 'You haven\'t enrolled in any courses yet. Check out our course catalog!';
      case 'jobs': return 'You haven\'t applied to any jobs yet. Browse our job listings!';
      case 'internships': return 'You haven\'t applied to any internships yet. Find opportunities that match your skills!';
      default: return 'No items found.';
    }
  }

  function getDefaultImage(tabId) {
    return `/static/images/default-${tabId.singularize()}.jpg`;
  }

  // ======================
  // Bookmark Management
  // ======================
  document.addEventListener('click', async function(e) {
    // Remove bookmark
    if (e.target.closest('.remove-bookmark')) {
      const btn = e.target.closest('.remove-bookmark');
      const itemId = btn.dataset.id;
      const itemType = btn.dataset.type;
      const card = btn.closest('.bookmark-card');

      if (!confirm('Are you sure you want to remove this bookmark?')) return;

      showLoading();
      btn.disabled = true;

      try {
        const response = await fetch(`/bookmark/${itemType}/${itemId}`, {
          method: 'DELETE',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        const data = await handleResponse(response);

        if (data.status === 'removed') {
          // Animate removal
          card.style.transition = 'all 0.3s ease';
          card.style.opacity = '0';
          card.style.height = card.offsetHeight + 'px';

          setTimeout(() => {
            card.style.height = '0';
            card.style.margin = '0';
            card.style.padding = '0';
            card.style.border = 'none';

            setTimeout(() => {
              card.remove();
              showToast('Bookmark removed successfully', 'success');

              // Check if tab is now empty
              const activeTab = document.querySelector('.tab-content.active');
              if (activeTab && activeTab.querySelectorAll('.bookmark-card').length === 0) {
                renderEmptyState(activeTab.id, activeTab);
              }
            }, 300);
          }, 10);
        } else {
          throw new Error(data.error || 'Failed to remove bookmark');
        }
      } catch (error) {
        showToast(error.message, 'error');
        btn.disabled = false;
      } finally {
        hideLoading();
      }
    }

    // Toggle bookmark from individual tabs
    if (e.target.closest('.bookmark-btn') && !e.target.closest('.bookmark-card')) {
      const btn = e.target.closest('.bookmark-btn');
      const itemId = btn.dataset.id;
      const itemType = btn.dataset.type;
      const isBookmarked = btn.classList.contains('bookmarked');

      if (isBookmarked) {
        await removeBookmark(itemId, itemType, btn);
      } else {
        await addBookmark(itemId, itemType, btn);
      }
    }

    // Retry failed content loading
    if (e.target.closest('.retry-btn')) {
      const btn = e.target.closest('.retry-btn');
      const tabId = btn.dataset.tab;
      loadTabContent(tabId);
    }
  });

  async function addBookmark(itemId, itemType, element) {
    showLoading();
    element.disabled = true;

    try {
      const response = await fetch(`/bookmark/${itemType}/${itemId}`, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await handleResponse(response);

      if (data.status === 'added') {
        element.classList.add('bookmarked');
        const icon = element.querySelector('i');
        if (icon) icon.className = 'fas fa-bookmark';
        showToast('Item bookmarked', 'success');
      } else {
        throw new Error(data.error || 'Failed to add bookmark');
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      element.disabled = false;
      hideLoading();
    }
  }

  async function removeBookmark(itemId, itemType, element) {
    showLoading();
    element.disabled = true;

    try {
      const response = await fetch(`/bookmark/${itemType}/${itemId}`, {
        method: 'DELETE',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await handleResponse(response);

      if (data.status === 'removed') {
        element.classList.remove('bookmarked');
        const icon = element.querySelector('i');
        if (icon) icon.className = 'far fa-bookmark';
        showToast('Bookmark removed', 'success');
      } else {
        throw new Error(data.error || 'Failed to remove bookmark');
      }
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      element.disabled = false;
      hideLoading();
    }
  }

  // ======================
  // Helper Functions
  // ======================
  function handleResponse(response) {
    if (!response.ok) {
      return response.json().then(err => { throw err; });
    }
    return response.json();
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

  function showToast(message, type = 'success') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas ${
        type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' :
        type === 'warning' ? 'fa-exclamation-triangle' :
        'fa-info-circle'
      }"></i>
      <span>${message}</span>
      <button class="toast-close" aria-label="Close notification">
        <i class="fas fa-times"></i>
      </button>
    `;

    document.body.appendChild(toast);

    // Show animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Auto-dismiss after 5 seconds
    const dismissTimeout = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 5000);

    // Manual dismiss
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(dismissTimeout);
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    });
  }

  // String prototype extension for singularization
  String.prototype.singularize = function() {
    return this.replace(/s$/, '');
  };

  // Initialize first tab content if empty
  const activeTab = document.querySelector('.tab-content.active');
  if (activeTab && activeTab.children.length === 0) {
    loadTabContent(activeTab.id);
  }
});