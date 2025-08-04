document.addEventListener('DOMContentLoaded', function() {
  // ======================
  // Tab Management
  // ======================
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Tab button click handlers
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

  // ======================
  // Bookmark Removal
  // ======================
  document.addEventListener('click', async function(e) {
    if (e.target.closest('.remove-bookmark')) {
      const btn = e.target.closest('.remove-bookmark');
      const itemId = btn.dataset.id;
      const itemType = btn.dataset.type;
      const bookmarkItem = btn.closest('.bookmark-item');

      if (!confirm('Are you sure you want to remove this bookmark?')) return;

      showLoading();
      btn.disabled = true;

      try {
        const response = await fetch(`/bookmark/${itemType}/${itemId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin'
        });

        const data = await response.json();

        if (data.status === 'removed') {
          // Animate removal
          bookmarkItem.style.transition = 'all 0.3s ease';
          bookmarkItem.style.opacity = '0';
          bookmarkItem.style.height = bookmarkItem.offsetHeight + 'px';

          setTimeout(() => {
            bookmarkItem.style.height = '0';
            bookmarkItem.style.margin = '0';
            bookmarkItem.style.padding = '0';
            bookmarkItem.style.border = 'none';

            setTimeout(() => {
              bookmarkItem.remove();
              showToast('Bookmark removed successfully', 'success');

              // Check if tab is now empty
              const activeTab = document.querySelector('.tab-content.active');
              const items = activeTab.querySelectorAll('.bookmark-item');
              if (items.length === 0) {
                const emptyState = activeTab.querySelector('.empty-state');
                if (!emptyState) {
                  const emptyHTML = `
                    <div class="empty-state">
                      <i class="far fa-bookmark"></i>
                      <h4>No ${activeTab.id} saved yet</h4>
                      <p>Save ${activeTab.id} from the ${activeTab.id} page to view them here</p>
                      <a href="/${activeTab.id}" class="btn btn-primary">Browse ${activeTab.id.charAt(0).toUpperCase() + activeTab.id.slice(1)}</a>
                    </div>
                  `;
                  activeTab.querySelector('.dashboard-card').innerHTML = emptyHTML;
                }
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
  });

  // ======================
  // Profile Picture Upload
  // ======================
  const profilePicUpload = document.getElementById('profilePicUpload');
  if (profilePicUpload) {
    profilePicUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;

      // Validate file type and size
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      const maxSize = 2 * 1024 * 1024; // 2MB

      if (!validTypes.includes(file.type)) {
        showToast('Please upload a valid image (JPEG, PNG, GIF)', 'error');
        return;
      }

      if (file.size > maxSize) {
        showToast('Image size should be less than 2MB', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const avatarImg = document.getElementById('userAvatar');
      const originalSrc = avatarImg.src;

      // Show loading state
      avatarImg.src = "/static/images/loading.gif";

      showLoading();

      fetch('/upload-profile-pic', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
      })
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              avatarImg.src = data.image_url + '?t=' + new Date().getTime(); // Cache busting
              showToast('Profile picture updated successfully!', 'success');
          } else {
              avatarImg.src = originalSrc;
              showToast(data.error || 'Failed to upload profile picture', 'error');
          }
      })
      .catch(error => {
          avatarImg.src = originalSrc;
          showToast('An error occurred. Please try again.', 'error');
      })
      .finally(() => {
          hideLoading();
          profilePicUpload.value = ''; // Reset file input
      });
    });
  }

  // ======================
  // Helper Functions
  // ======================
  function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
      const overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
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
    document.querySelectorAll('.toast').forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }
});