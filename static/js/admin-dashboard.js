// Admin Dashboard - Complete Working Version
(function() {
  // Constants
  const TOAST_DURATION = 5000;
  const DEBOUNCE_DELAY = 300;
  const MANAGED_SECTIONS = ['courses', 'jobs', 'internships', 'blog', 'users'];

  // DOM Elements
  const loadingOverlay = document.querySelector('.loading-overlay');
  const confirmModal = document.getElementById('confirmModal');
  const confirmMessage = document.getElementById('confirmModalMessage');
  const confirmActionBtn = document.getElementById('confirmAction');
  const cancelConfirmBtn = document.getElementById('cancelConfirm');
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content');
  const notificationCenter = document.createElement('div');

  // Current state
  let currentPage = {};
  MANAGED_SECTIONS.forEach(section => {
    currentPage[section] = 1;
  });

  // Initialize the dashboard
  function initDashboard() {
    notificationCenter.className = 'notification-center';
    document.body.appendChild(notificationCenter);

    initSelect2();
    setupEventListeners();
    loadInitialData();
    setupSidebar();
    setupEventSource();
    addFormFieldFixes();
    showWelcomeMessage();

    // Set default filters
    setDefaultFilters();
  }

  // Set default filters
  function setDefaultFilters() {
    document.getElementById('courseCategoryFilter').value = '';
    document.getElementById('internshipTypeFilter').value = '';
  }

  // Initialize Select2
  function initSelect2() {
    if (typeof $ !== 'undefined' && $.fn.select2) {
      $('select').select2({
        minimumResultsForSearch: 10,
        width: '100%'
      });
      $('#blogCategories').select2({
        tags: true,
        placeholder: 'Select categories',
        allowClear: true
      });
    }
  }

  // Setup EventSource for real-time notifications
  function setupEventSource() {
    if (typeof EventSource !== 'undefined') {
      const eventSource = new EventSource('/api/admin/notifications/stream');

      eventSource.onmessage = function(e) {
        const data = JSON.parse(e.data);
        showNotification(data.message, data.type || 'info');
      };

      eventSource.onerror = function() {
        console.error('EventSource failed');
        eventSource.close();
      };
    }
  }

  // Setup sidebar toggle
  function setupSidebar() {
    if (sidebarToggle && sidebar && mainContent) {
      sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
      });

      if (localStorage.getItem('sidebar-collapsed') === 'true') {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('expanded');
      }
    }
  }

  // Setup event listeners
  function setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.getAttribute('href').startsWith('#')) {
          e.preventDefault();
          const target = link.getAttribute('href').substring(1);
          showSection(target);
        }
      });
    });

    // View All links in dashboard stats
    document.querySelectorAll('.stat-card a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('href').substring(1);
        showSection(target);
        fetchSectionData(target);
      });
    });

    // Add buttons
    document.getElementById('addCourseBtn')?.addEventListener('click', () => showModal('course'));
    document.getElementById('addJobBtn')?.addEventListener('click', () => showModal('job'));
    document.getElementById('addInternshipBtn')?.addEventListener('click', () => showModal('internship'));
    document.getElementById('addBlogBtn')?.addEventListener('click', () => showModal('blog'));

    // Search inputs
    document.getElementById('courseSearch')?.addEventListener('input', debounce(() => filterTable('courses')));
    document.getElementById('jobSearch')?.addEventListener('input', debounce(() => filterTable('jobs')));
    document.getElementById('internshipSearch')?.addEventListener('input', debounce(() => filterTable('internships')));
    document.getElementById('blogSearch')?.addEventListener('input', debounce(() => filterTable('blog')));
    document.getElementById('userSearch')?.addEventListener('input', debounce(() => filterTable('users')));

    // Filter selects
    document.getElementById('courseCategoryFilter')?.addEventListener('change', () => filterTable('courses'));
    document.getElementById('jobTypeFilter')?.addEventListener('change', () => filterTable('jobs'));
    document.getElementById('internshipTypeFilter')?.addEventListener('change', () => filterTable('internships'));
    document.getElementById('blogCategoryFilter')?.addEventListener('change', () => filterTable('blog'));
    document.getElementById('userRoleFilter')?.addEventListener('change', () => filterTable('users'));

    // Pagination
    MANAGED_SECTIONS.forEach(section => {
      document.getElementById(`prev${capitalize(section)}Page`)?.addEventListener('click', () => navigatePage(section, -1));
      document.getElementById(`next${capitalize(section)}Page`)?.addEventListener('click', () => navigatePage(section, 1));
    });

    // Bulk actions
    MANAGED_SECTIONS.forEach(section => {
      document.getElementById(`apply${capitalize(section)}BulkAction`)?.addEventListener('click', () => applyBulkAction(section));
    });

    // Modal close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => closeAllModals());
    });

    // Form submissions
    document.getElementById('courseForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'courses'));
    document.getElementById('jobForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'jobs'));
    document.getElementById('internshipForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'internships'));
    document.getElementById('blogForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'blog'));
    document.getElementById('userForm')?.addEventListener('submit', (e) => handleFormSubmit(e, 'users'));

    // Logout button
    document.querySelector('.sidebar-menu a[href="/admin/logout"]')?.addEventListener('click', function(e) {
      e.preventDefault();
      showConfirm('Are you sure you want to logout?', () => {
        window.location.href = this.getAttribute('href');
      });
    });

    // Preview buttons for blog posts
    document.querySelectorAll('.preview-btn')?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        window.open(`/blog/preview/${id}`, '_blank');
      });
    });
  }

  // Load initial data
  function loadInitialData() {
    fetchDashboardStats();
    fetchSectionData('courses');
  }

  // Fetch dashboard statistics
  async function fetchDashboardStats() {
    try {
      const response = await fetch('/admin/dashboard', {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to load dashboard stats');

      const data = await response.json();
      updateStatsCards(data.stats);
    } catch (error) {
      showNotification(`Error loading dashboard: ${error.message}`, 'error');
    }
  }

  // Update stats cards
  function updateStatsCards(stats) {
    if (!stats) return;

    const statCards = {
      'primary': stats.users,
      'success': stats.courses,
      'warning': stats.jobs,
      'danger': stats.internships
    };

    for (const [className, value] of Object.entries(statCards)) {
      const card = document.querySelector(`.stat-card.${className} p`);
      if (card) card.textContent = value;
    }
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };

    const notification = document.createElement('div');
    notification.className = `notification notification-${type} show`;
    notification.innerHTML = `
      <i class="fas fa-${icons[type] || 'info-circle'}"></i>
      <span>${message}</span>
      <button class="notification-close"><i class="fas fa-times"></i></button>
    `;

    notificationCenter.appendChild(notification);

    // Close button
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    });

    // Auto-remove after duration
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, TOAST_DURATION);
  }

  // Loading Indicator
  function showLoading(show) {
    if (loadingOverlay) {
      loadingOverlay.style.display = show ? 'flex' : 'none';
    }
  }

  // Confirmation Dialog
  function showConfirm(message, callback) {
    if (!confirmModal || !confirmMessage || !confirmActionBtn) return;

    confirmMessage.textContent = message;
    confirmModal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Remove previous listeners
    const newConfirmBtn = confirmActionBtn.cloneNode(true);
    confirmActionBtn.parentNode.replaceChild(newConfirmBtn, confirmActionBtn);

    newConfirmBtn.addEventListener('click', function() {
      confirmModal.style.display = 'none';
      document.body.style.overflow = 'auto';
      callback();
    });

    cancelConfirmBtn.onclick = function() {
      confirmModal.style.display = 'none';
      document.body.style.overflow = 'auto';
    };
  }

  // Get CSRF Token
  function getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
  }

  // Format Date
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
      return dateString;
    }
  }

  // Debounce function for search inputs
  function debounce(func, timeout = DEBOUNCE_DELAY) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
  }

  // Capitalize first letter
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Show specific section
  function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });

    // Show selected section
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.add('active');
      const pageTitle = document.getElementById('pageTitle');
      if (pageTitle) {
        pageTitle.textContent = section.querySelector('h2').textContent;
      }

      // Load data if not already loaded
      if (sectionId !== 'dashboard' && section.querySelector('tbody').children.length === 0) {
        fetchSectionData(sectionId);
      }
    }

    // Update active menu item
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
      link.classList.remove('active');
    });
    const activeLink = document.querySelector(`.sidebar-menu a[href="#${sectionId}"]`);
    if (activeLink) activeLink.classList.add('active');
  }

  // Fetch Section Data
  async function fetchSectionData(section, page = 1, search = '', filters = {}) {
    showLoading(true);
    try {
      let url = `/api/admin/${section}?page=${page}`;

      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      // Add filters
      for (const [key, value] of Object.entries(filters)) {
        if (value) {
          url += `&${key}=${encodeURIComponent(value)}`;
        }
      }

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        throw new Error(`Failed to load ${section}`);
      }

      const data = await response.json();

      // Ensure data is properly formatted
      if (!data || !Array.isArray(data.data)) {
        throw new Error('Invalid data format received');
      }

      renderTable(section, data.data);
      updatePagination(section, data.count, page, data.per_page || 10);

      // Additional check for content visibility
      if (section === 'blog') {
        verifyBlogContentVisibility(data.data);
      }
    } catch (error) {
      showNotification(`Error loading ${section}: ${error.message}`, 'error');
      console.error(error);
    } finally {
      showLoading(false);
    }
  }

  // Additional function to verify blog content visibility
  async function verifyBlogContentVisibility(posts) {
    try {
      // Check if blog posts are visible on frontend
      const response = await fetch('/api/blog/latest');
      if (response.ok) {
        const livePosts = await response.json();
        const missingPosts = posts.filter(post =>
          !livePosts.some(livePost => livePost.id === post.id)
        );

        if (missingPosts.length > 0) {
          console.warn('Some posts not visible on frontend:', missingPosts);
          // Optionally trigger a cache refresh
          await fetch('/api/blog/refresh-cache', { method: 'POST' });
        }
      }
    } catch (error) {
      console.error('Visibility check failed:', error);
    }
  }

  // Filter table data
  function filterTable(section) {
    const searchInput = document.getElementById(`${section}Search`);
    const search = searchInput ? searchInput.value : '';

    let filter = '';
    switch (section) {
      case 'courses':
        filter = document.getElementById('courseCategoryFilter').value;
        break;
      case 'jobs':
        filter = document.getElementById('jobTypeFilter').value;
        break;
      case 'internships':
        filter = document.getElementById('internshipTypeFilter').value;
        break;
      case 'blog':
        filter = document.getElementById('blogCategoryFilter').value;
        break;
      case 'users':
        filter = document.getElementById('userRoleFilter').value;
        break;
    }

    currentPage[section] = 1;
    fetchSectionData(section, currentPage[section], search, { [section === 'users' ? 'role' : 'filter']: filter });
  }

  // Navigate between pages
  function navigatePage(section, direction) {
    currentPage[section] += direction;
    if (currentPage[section] < 1) currentPage[section] = 1;

    const searchInput = document.getElementById(`${section}Search`);
    const search = searchInput ? searchInput.value : '';

    let filter = '';
    switch (section) {
      case 'courses':
        filter = document.getElementById('courseCategoryFilter').value;
        break;
      case 'jobs':
        filter = document.getElementById('jobTypeFilter').value;
        break;
      case 'internships':
        filter = document.getElementById('internshipTypeFilter').value;
        break;
      case 'blog':
        filter = document.getElementById('blogCategoryFilter').value;
        break;
      case 'users':
        filter = document.getElementById('userRoleFilter').value;
        break;
    }

    fetchSectionData(section, currentPage[section], search, { [section === 'users' ? 'role' : 'filter']: filter });
  }

  // Update pagination info
  function updatePagination(section, totalItems, currentPage, perPage) {
    const totalPages = Math.ceil(totalItems / perPage);
    const pageInfo = document.querySelector(`#${section} .page-info`);

    if (pageInfo) {
      pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    }

    // Disable/enable prev/next buttons
    const prevBtn = document.getElementById(`prev${capitalize(section)}Page`);
    const nextBtn = document.getElementById(`next${capitalize(section)}Page`);

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  }

  // Render Table Data
  function renderTable(section, items) {
    const tableBody = document.querySelector(`#${section}TableBody`);
    if (!tableBody) return;

    tableBody.innerHTML = items.map(item => generateTableRow(section, item)).join('');

    // Attach event listeners
    document.querySelectorAll(`#${section}TableBody .status-toggle`).forEach(toggle => {
      toggle.addEventListener('change', handleStatusToggle);
    });

    document.querySelectorAll(`#${section}TableBody .edit-btn`).forEach(btn => {
      btn.addEventListener('click', handleEdit);
    });

    document.querySelectorAll(`#${section}TableBody .delete-btn`).forEach(btn => {
      btn.addEventListener('click', handleDelete);
    });

    document.querySelectorAll(`#${section}TableBody .preview-btn`).forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        window.open(`/blog/preview/${id}`, '_blank');
      });
    });
  }

  // Generate Table Row
  function generateTableRow(section, item) {
    let details = '';
    let extraColumns = '';

    if (section === 'courses') {
      details = `${item.category} | $${item.price}`;
      extraColumns = `<td>${item.duration}</td>`;
    } else if (section === 'jobs') {
      details = `${item.company}`;
      extraColumns = `<td>${item.location}</td><td>${item.type}</td>`;
    } else if (section === 'internships') {
      details = `${item.company}`;
      extraColumns = `<td>${item.duration}</td><td>${item.stipend || 'N/A'}</td>`;
    } else if (section === 'blog') {
      details = item.author;
      extraColumns = `<td>${Array.isArray(item.categories) ? item.categories.join(', ') : ''}</td><td>${formatDate(item.published_at)}</td>`;
    } else if (section === 'users') {
      details = item.email;
      extraColumns = `<td>${item.role}</td><td>${formatDate(item.created_at)}</td>`;
    }

    return `
      <tr data-id="${item.id}">
        <td><input type="checkbox" class="row-checkbox" data-id="${item.id}"></td>
        <td>${item.title || item.name || 'N/A'}</td>
        <td>${details}</td>
        ${extraColumns}
        <td>
          <label class="switch">
            <input type="checkbox" class="status-toggle" ${item.is_active || item.is_published ? 'checked' : ''}
              data-id="${item.id}" data-section="${section}">
            <span class="slider round"></span>
          </label>
        </td>
        <td>
          <button class="action-btn edit-btn" data-id="${item.id}" data-section="${section}">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn delete-btn" data-id="${item.id}" data-section="${section}">
            <i class="fas fa-trash-alt"></i>
          </button>
          ${section === 'blog' ? `
          <button class="action-btn preview-btn" data-id="${item.id}">
            <i class="fas fa-eye"></i>
          </button>
          ` : ''}
        </td>
      </tr>
    `;
  }

  // Handle status toggle
  async function handleStatusToggle(e) {
    const toggle = e.target;
    const id = toggle.getAttribute('data-id');
    const section = toggle.getAttribute('data-section');
    const isActive = toggle.checked;

    try {
      showLoading(true);
      const response = await fetch(`/api/admin/${section}/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        body: JSON.stringify({ status: isActive })
      });

      if (!response.ok) throw new Error('Failed to update status');

      const data = await response.json();
      showNotification(`Status updated successfully`, 'success');

      // Refresh frontend cache if content is published
      if (isActive && (section === 'blog' || section === 'courses')) {
        await fetch(`/api/${section}/refresh-cache`, { method: 'POST' });
      }
    } catch (error) {
      showNotification(`Error updating status: ${error.message}`, 'error');
      toggle.checked = !isActive;
    } finally {
      showLoading(false);
    }
  }

  // Handle edit button
  function handleEdit(e) {
    const btn = e.currentTarget;
    const id = btn.getAttribute('data-id');
    const section = btn.getAttribute('data-section');

    showModal(section, id);
  }

  // Handle delete button
  function handleDelete(e) {
    const btn = e.currentTarget;
    const id = btn.getAttribute('data-id');
    const section = btn.getAttribute('data-section');

    showConfirm(`Are you sure you want to delete this ${section.slice(0, -1)}?`, async () => {
      try {
        showLoading(true);
        const response = await fetch(`/api/admin/${section}/${id}`, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': getCSRFToken()
          }
        });

        if (!response.ok) throw new Error('Failed to delete');

        showNotification(`${capitalize(section.slice(0, -1))} deleted successfully`, 'success');
        fetchSectionData(section, currentPage[section]);
      } catch (error) {
        showNotification(`Error deleting ${section.slice(0, -1)}: ${error.message}`, 'error');
      } finally {
        showLoading(false);
      }
    });
  }

  // Apply bulk action
  function applyBulkAction(section) {
    const select = document.getElementById(`${section}BulkAction`);
    const action = select.value;

    if (!action) {
      showNotification('Please select an action first', 'warning');
      return;
    }

    const selectedIds = Array.from(document.querySelectorAll(`#${section}TableBody .row-checkbox:checked`))
      .map(checkbox => checkbox.getAttribute('data-id'));

    if (selectedIds.length === 0) {
      showNotification('Please select items first', 'warning');
      return;
    }

    showConfirm(`Are you sure you want to ${action} ${selectedIds.length} ${section}?`, async () => {
      try {
        showLoading(true);
        const response = await fetch(`/api/admin/${section}/bulk-action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCSRFToken()
          },
          body: JSON.stringify({
            action: action,
            ids: selectedIds
          })
        });

        if (!response.ok) throw new Error('Failed to apply bulk action');

        showNotification(`Bulk action applied to ${selectedIds.length} ${section}`, 'success');
        fetchSectionData(section, currentPage[section]);
      } catch (error) {
        showNotification(`Error applying bulk action: ${error.message}`, 'error');
      } finally {
        showLoading(false);
      }
    });
  }

  // Show modal for add/edit
  async function showModal(section, id = null) {
    const modal = document.getElementById(`${section}Modal`);
    if (!modal) return;

    // Reset form
    const form = modal.querySelector('form');
    if (form) form.reset();

    // Set title
    const title = modal.querySelector('h2');
    if (title) {
      title.textContent = id ? `Edit ${capitalize(section.slice(0, -1))}` : `Add New ${capitalize(section.slice(0, -1))}`;
    }

    // If editing, fetch data
    if (id) {
      try {
        showLoading(true);
        const response = await fetch(`/api/admin/${section}/${id}`);
        if (!response.ok) throw new Error('Failed to load data');

        const data = await response.json();
        populateForm(form, data);
      } catch (error) {
        showNotification(`Error loading data: ${error.message}`, 'error');
        return;
      } finally {
        showLoading(false);
      }
    }

    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
  }

  // Populate form with data
  function populateForm(form, data) {
    if (!form || !data) return;

    // Set ID if exists
    if (data.id) {
      const idInput = form.querySelector('input[type="hidden"]');
      if (idInput) idInput.value = data.id;
    }

    // Loop through form elements
    Array.from(form.elements).forEach(element => {
      if (element.name && data[element.name] !== undefined) {
        if (element.type === 'checkbox') {
          element.checked = Boolean(data[element.name]);
        } else if (element.type === 'select-multiple') {
          // For multi-select (like blog categories)
          Array.from(element.options).forEach(option => {
            option.selected = Array.isArray(data[element.name])
              ? data[element.name].includes(option.value)
              : false;
          });
        } else {
          element.value = data[element.name] || '';
        }
      }
    });

    // Handle image preview if exists
    if (data.image) {
      const previewContainer = form.querySelector('.preview-container');
      const previewImg = form.querySelector('.image-preview');
      if (previewContainer && previewImg) {
        previewImg.src = `/uploads/${data.image}`;
        previewContainer.style.display = 'block';
      }
    }
  }

  // Close all modals
  function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
  }

  // Handle form submission
  async function handleFormSubmit(e, section) {
    e.preventDefault();
    const form = e.target;
    const isEdit = !!form.querySelector('input[type="hidden"]')?.value;
    const saveAndNew = e.submitter?.id.includes('saveAndNew');

    try {
      showLoading(true);

      // Handle form data properly including files
      const formData = new FormData(form);

      // For non-file submissions, convert to JSON
      let body;
      let headers = {
        'X-CSRF-Token': getCSRFToken()
      };

      if (form.querySelector('input[type="file"]')) {
        body = formData;
        // Don't set Content-Type header - browser will set it with boundary
      } else {
        const data = {};
        formData.forEach((value, key) => {
          data[key] = value;
        });
        body = JSON.stringify(data);
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(form.action, {
        method: isEdit ? 'PUT' : 'POST',
        headers: headers,
        body: body
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      showNotification(`${capitalize(section.slice(0, -1))} ${isEdit ? 'updated' : 'created'} successfully`, 'success');

      // Refresh the table data
      await fetchSectionData(section, currentPage[section]);

      // Trigger cache refresh if published
      if (data.is_published || data.is_active) {
        await fetch(`/api/${section}/refresh-cache`, { method: 'POST' });
      }

      // Close modal or reset form based on button clicked
      if (saveAndNew) {
        form.reset();
        if (form.querySelector('input[type="hidden"]')) {
          form.querySelector('input[type="hidden"]').value = '';
        }
      } else {
        closeAllModals();
      }
    } catch (error) {
      console.error('Save error:', error);
      showNotification(`Error saving ${section.slice(0, -1)}: ${error.message}`, 'error');
    } finally {
      showLoading(false);
    }
  }

  function addFormFieldFixes() {
    const style = document.createElement('style');
    style.textContent = `
      .form-group.focused label {
        transform: translateY(-5px);
        font-size: 0.8rem;
        color: #4361ee;
        transition: all 0.3s ease;
      }
      .form-group .error-message {
        color: #dc3545;
        font-size: 0.8rem;
        margin-top: 0.25rem;
        display: block;
      }
      .select2-container--default .select2-selection--multiple {
        background-color: var(--input-bg) !important;
        border-color: var(--input-border) !important;
      }
      .preview-container {
        margin-top: 10px;
      }
      .image-preview {
        max-width: 200px;
        max-height: 200px;
        display: block;
      }
    `;
    document.head.appendChild(style);
  }

  function showWelcomeMessage() {
    if (!localStorage.getItem('adminDashboardVisited')) {
      showNotification('Welcome to the Admin Dashboard!', 'info');
      localStorage.setItem('adminDashboardVisited', 'true');
    }
  }

  // Initialize the dashboard when DOM is loaded
  document.addEventListener('DOMContentLoaded', initDashboard);

  // Error reporting
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    fetch('/admin/api/client-errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken()
      },
      body: JSON.stringify({
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    }).catch(console.error);
  });
})();