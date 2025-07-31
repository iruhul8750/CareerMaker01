document.addEventListener('DOMContentLoaded', function() {
  // Tab functionality with URL hash support
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  function activateTab(tabId) {
    // Update URL hash without page reload
    history.replaceState(null, null, `#${tabId}`);

    // Update active tab
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const activeContent = document.getElementById(tabId);

    if (activeBtn && activeContent) {
      activeBtn.classList.add('active');
      activeContent.classList.add('active');
    }
  }

  // Initialize tab from URL hash or default to first tab
  const initialTab = window.location.hash ?
    window.location.hash.substring(1) :
    tabBtns[0]?.dataset.tab;

  if (initialTab) activateTab(initialTab);

  // Tab button click handlers
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.dataset.tab;
      activateTab(tabId);
    });
  });

  // Remove bookmark functionality with confirmation
  document.addEventListener('click', async function(e) {
    if (e.target.closest('.remove-bookmark')) {
      e.preventDefault();
      const btn = e.target.closest('.remove-bookmark');
      const itemId = btn.dataset.id;
      const itemType = btn.dataset.type;
      const bookmarkItem = btn.closest('.bookmark-item');

      // Show confirmation dialog
      if (!confirm('Are you sure you want to remove this item from your bookmarks?')) {
        return;
      }

      // Show loading state
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';

      try {
        const response = await fetch('/bookmark/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            item_id: itemId,
            item_type: itemType
          })
        });

        const data = await response.json();

        if (data.status === 'success') {
          // Animate removal
          bookmarkItem.style.transition = 'all 0.3s ease';
          bookmarkItem.style.opacity = '0';
          bookmarkItem.style.transform = 'translateX(-20px)';

          setTimeout(() => {
            bookmarkItem.remove();
            showToast('Item removed from bookmarks', 'success');

            // Check if any items left in this tab
            const activeTab = document.querySelector('.tab-content.active');
            const items = activeTab.querySelectorAll('.bookmark-item');

            if (items.length === 0) {
              const emptyState = document.createElement('div');
              emptyState.className = 'empty-state';
              emptyState.innerHTML = `
                <i class="far fa-bookmark"></i>
                <h4>No items saved yet</h4>
                <p>Save ${itemType}s from the ${itemType}s page to view them here</p>
                <a href="/${itemType}s" class="btn btn-primary">Browse ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}s</a>
              `;
              activeTab.appendChild(emptyState);
            }
          }, 300);
        } else {
          showToast(data.message || 'Failed to remove bookmark', 'error');
        }
      } catch (error) {
        console.error('Error:', error);
        showToast('An error occurred while removing bookmark', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  });

  // Dark mode toggle (if implemented)
  const darkModeToggle = document.querySelector('.dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', function() {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });

    // Initialize dark mode from localStorage
    if (localStorage.getItem('darkMode') === 'true') {
      document.body.classList.add('dark-mode');
    }
  }
});

// Enhanced Toast Notification
function showToast(message, type = 'success') {
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
  `;

  document.body.appendChild(toast);

  // Animation in
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

  // Allow manual dismiss
  toast.addEventListener('click', () => {
    clearTimeout(dismissTimeout);
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  });
}