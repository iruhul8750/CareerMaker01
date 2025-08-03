// Self-contained admin dashboard functionality
(function() {
  // Constants
  const CURRENT_FRONTEND_VERSION = '1.0.0';
  const TOAST_DURATION = 5000; // 5 seconds

  // Helper functions
  function showLoading(show) {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.style.display = show ? 'flex' : 'none';
    }
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.innerHTML = `
      <i class="fas ${getToastIcon(type)}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, TOAST_DURATION);
  }

  function getToastIcon(type) {
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
  }

  function showConfirm(message, callback) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmAction');

    if (modal && messageEl && confirmBtn) {
      messageEl.textContent = message;
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';

      // Remove previous listeners
      const newConfirmBtn = confirmBtn.cloneNode(true);
      confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

      newConfirmBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        callback();
      });

      document.getElementById('cancelConfirm').onclick = function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      };
    }
  }

  function generateSlug(text) {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-');
  }

  function getCSRFToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content;
  }

  function checkAuthError(response) {
    if (response.status === 401) {
      showToast('Session expired. Please login again.', 'error');
      setTimeout(() => window.location.href = '/admin/login', 2000);
      return true;
    }
    return false;
  }

  function initializeDataTables() {
    document.querySelectorAll('.content-table table').forEach(table => {
      const tbody = table.querySelector('tbody');
      if (tbody.children.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="100" class="no-data">No records found</td>`;
        tbody.appendChild(row);
      }
    });

    // Fetch data for each section
    fetchSectionData('courses');
    fetchSectionData('jobs');
    fetchSectionData('internships');
    fetchSectionData('blog');
    fetchSectionData('users');
  }

  async function fetchSectionData(section) {
    try {
      showLoading(true);
      const response = await fetch(`/admin/${section}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      if (!data || !Array.isArray(data)) return;

      const tableBody = document.querySelector(`#${section}TableBody`);
      if (!tableBody) return;

      tableBody.innerHTML = '';

      if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="100" class="no-data">No records found</td>`;
        tableBody.appendChild(row);
        return;
      }

      data.forEach(item => {
        const row = document.createElement('tr');
        row.dataset.id = item.id;
        row.innerHTML = generateTableRow(section, item);
        tableBody.appendChild(row);
      });

      // Reinitialize any event listeners
      setupStatusToggleButtons();
      setupEditButtons();
      setupDeleteButtons();
      setupPreviewButtons();
    } catch (error) {
      console.error(`Error loading ${section}:`, error);
      showToast(`Failed to load ${section}`, 'error');
    } finally {
      showLoading(false);
    }
  }

  function generateTableRow(section, item) {
    switch(section) {
      case 'courses':
        return `
          <td><input type="checkbox" class="course-checkbox" value="${item.id}"></td>
          <td>${item.title || 'N/A'}</td>
          <td>${item.category || 'N/A'}</td>
          <td>${item.price ? '$' + item.price : 'N/A'}</td>
          <td>
            <span class="status-badge ${item.published ? 'published' : 'draft'}">
              ${item.published ? 'Published' : 'Draft'}
            </span>
          </td>
          <td>${formatDate(item.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn preview-btn" data-id="${item.id}"><i class="fas fa-eye"></i></button>
              <button class="action-btn edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
              <button class="action-btn status-btn" data-id="${item.id}" data-status="${item.published}">
                <i class="fas ${item.published ? 'fa-eye-slash' : 'fa-eye'}"></i>
              </button>
              <button class="action-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
          </td>
        `;
      case 'jobs':
        return `
          <td><input type="checkbox" class="job-checkbox" value="${item.id}"></td>
          <td>${item.title || 'N/A'}</td>
          <td>${item.company || 'N/A'}</td>
          <td>${item.location || 'N/A'}</td>
          <td>${item.type || 'N/A'}</td>
          <td>
            <span class="status-badge ${item.active ? 'active' : 'expired'}">
              ${item.active ? 'Active' : 'Expired'}
            </span>
          </td>
          <td>${formatDate(item.posted_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn preview-btn" data-id="${item.id}"><i class="fas fa-eye"></i></button>
              <button class="action-btn edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
              <button class="action-btn status-btn" data-id="${item.id}" data-status="${item.active}">
                <i class="fas ${item.active ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
              </button>
              <button class="action-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
          </td>
        `;
      case 'internships':
        return `
          <td><input type="checkbox" class="internship-checkbox" value="${item.id}"></td>
          <td>${item.title || 'N/A'}</td>
          <td>${item.company || 'N/A'}</td>
          <td>${item.duration || 'N/A'}</td>
          <td>
            ${item.paid ? '<span class="badge paid">Paid</span>' : ''}
            ${item.remote ? '<span class="badge remote">Remote</span>' : ''}
          </td>
          <td>
            <span class="status-badge ${item.active ? 'active' : 'expired'}">
              ${item.active ? 'Active' : 'Expired'}
            </span>
          </td>
          <td>${formatDate(item.posted_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn preview-btn" data-id="${item.id}"><i class="fas fa-eye"></i></button>
              <button class="action-btn edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
              <button class="action-btn status-btn" data-id="${item.id}" data-status="${item.active}">
                <i class="fas ${item.active ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
              </button>
              <button class="action-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
          </td>
        `;
      case 'blog':
        return `
          <td><input type="checkbox" class="blog-checkbox" value="${item.id}"></td>
          <td>${item.title || 'N/A'}</td>
          <td>${item.author || 'N/A'}</td>
          <td>
            ${item.categories ? item.categories.map(cat => `<span class="badge">${cat}</span>`).join('') : 'N/A'}
          </td>
          <td>
            <span class="status-badge ${item.published ? 'published' : 'draft'}">
              ${item.published ? 'Published' : 'Draft'}
            </span>
          </td>
          <td>${formatDate(item.published_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn preview-btn" data-id="${item.id}"><i class="fas fa-eye"></i></button>
              <button class="action-btn edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
              <button class="action-btn status-btn" data-id="${item.id}" data-status="${item.published}">
                <i class="fas ${item.published ? 'fa-eye-slash' : 'fa-eye'}"></i>
              </button>
              <button class="action-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
            </div>
          </td>
        `;
      case 'users':
        return `
          <td><input type="checkbox" class="user-checkbox" value="${item.id}"></td>
          <td>${item.username || item.email || 'N/A'}</td>
          <td>${item.email || 'N/A'}</td>
          <td>${item.role || 'user'}</td>
          <td>
            <span class="status-badge ${item.is_active ? 'active' : 'suspended'}">
              ${item.is_active ? 'Active' : 'Suspended'}
            </span>
          </td>
          <td>${formatDate(item.created_at)}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn view-btn" data-id="${item.id}"><i class="fas fa-user"></i></button>
              <button class="action-btn edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i></button>
              <button class="action-btn status-btn" data-id="${item.id}" data-status="${item.is_active}">
                <i class="fas ${item.is_active ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
              </button>
              <button class="action-btn message-btn" data-id="${item.id}"><i class="fas fa-envelope"></i></button>
            </div>
          </td>
        `;
      default:
        return '';
    }
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return dateString;
    }
  }

  function setupFormValidation(form) {
    form.querySelectorAll('[required]').forEach(input => {
      input.addEventListener('invalid', (e) => {
        e.preventDefault();
        const formGroup = input.closest('.form-group');
        if (formGroup) {
          formGroup.classList.add('error');
          let errorElement = formGroup.querySelector('.error-message');
          if (!errorElement) {
            errorElement = document.createElement('small');
            errorElement.className = 'error-message';
            formGroup.appendChild(errorElement);
          }
          errorElement.textContent = input.validationMessage;
        }
      });

      input.addEventListener('input', () => {
        const formGroup = input.closest('.form-group');
        if (formGroup) {
          formGroup.classList.remove('error');
          const errorElement = formGroup.querySelector('.error-message');
          if (errorElement) errorElement.textContent = '';
        }
      });

      // Add focus/blur effects
      input.addEventListener('focus', () => {
        const formGroup = input.closest('.form-group');
        if (formGroup) {
          formGroup.classList.add('focused');
        }
      });

      input.addEventListener('blur', () => {
        const formGroup = input.closest('.form-group');
        if (formGroup) {
          formGroup.classList.remove('focused');
        }
      });
    });
  }

  function setupSlugGeneration() {
    document.querySelectorAll('[id$="Slug"]').forEach(slugInput => {
      const titleInput = document.getElementById(slugInput.id.replace('Slug', 'Title'));
      if (titleInput) {
        titleInput.addEventListener('blur', function() {
          if (!slugInput.value && this.value) {
            slugInput.value = generateSlug(this.value);
          }
        });
      }
    });
  }

  function setupImagePreview() {
    document.querySelectorAll('input[type="file"]').forEach(input => {
      input.addEventListener('change', function() {
        const previewId = this.id + 'Preview';
        const preview = document.getElementById(previewId);
        const container = this.closest('.file-upload').querySelector('.preview-container');

        if (this.files && this.files[0]) {
          const reader = new FileReader();
          reader.onload = function(e) {
            preview.src = e.target.result;
            container.style.display = 'block';
          };
          reader.readAsDataURL(this.files[0]);
        }
      });
    });

    document.querySelectorAll('.btn-remove-image').forEach(button => {
      button.addEventListener('click', function() {
        const container = this.closest('.preview-container');
        const input = container.closest('.file-upload').querySelector('input[type="file"]');
        const preview = container.querySelector('img');
        container.style.display = 'none';
        input.value = '';
        if (preview) preview.src = '';
      });
    });
  }

  function setupBulkActions() {
    document.querySelectorAll('[id^="apply"]').forEach(button => {
      button.addEventListener('click', function() {
        const type = this.id.replace('apply', '').replace('BulkAction', '').toLowerCase();
        const action = document.getElementById(`${type}BulkAction`).value;
        const checkboxes = document.querySelectorAll(`.${type}-checkbox:checked`);

        if (action && checkboxes.length > 0) {
          const ids = Array.from(checkboxes).map(cb => cb.value);
          showConfirm(
            `Are you sure you want to ${action} ${ids.length} selected ${type}${ids.length > 1 ? 's' : ''}?`,
            () => performBulkAction(type, action, ids)
          );
        } else {
          showToast('Please select items and an action', 'warning');
        }
      });
    });
  }

  async function performBulkAction(type, action, ids) {
    showLoading(true);
    try {
      const response = await fetch(`/admin/${type}/bulk-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        body: JSON.stringify({ action, ids })
      });

      if (checkAuthError(response)) return;

      const data = await response.json();
      if (data?.success) {
        showToast(data.message, 'success');
        fetchSectionData(type); // Refresh the data
      } else {
        showToast(data?.error || 'Action failed', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      showLoading(false);
    }
  }

  function setupModals() {
    // Modal triggers
    document.querySelectorAll('[id$="Btn"]').forEach(trigger => {
      trigger.addEventListener('click', function(e) {
        e.preventDefault();
        const modalId = `${this.id.replace('add', '').replace('Btn', '').toLowerCase()}Modal`;
        const modal = document.getElementById(modalId);

        if (modal) {
          modal.style.display = 'block';
          document.body.style.overflow = 'hidden';

          // Reset form if it's an "Add" button
          if (this.id.startsWith('add')) {
            const form = modal.querySelector('form');
            if (form) {
              form.reset();
              // Clear image previews
              form.querySelectorAll('.preview-container').forEach(container => {
                container.style.display = 'none';
              });
            }
          }
        }
      });
    });

    // Close buttons
    document.querySelectorAll('.close-modal, [id$="Cancel"], .cancel-btn').forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        const modal = this.closest('.modal');
        if (modal) {
          modal.style.display = 'none';
          document.body.style.overflow = 'auto';

          // Reset form
          const form = modal.querySelector('form');
          if (form) {
            form.reset();
            // Clear image previews
            form.querySelectorAll('.preview-container').forEach(container => {
              container.style.display = 'none';
            });
          }
        }
      });
    });

    // Close when clicking outside modal content
    window.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    });
  }

  function setupFormSubmissions() {
    document.querySelectorAll('.admin-form').forEach(form => {
      setupFormValidation(form);

      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        showLoading(true);

        const isNew = e.submitter?.id?.endsWith('AndNew');
        const formData = new FormData(this);

        try {
          const response = await fetch(this.action, {
            method: 'POST',
            body: formData,
            headers: {
              'X-CSRF-Token': getCSRFToken()
            }
          });

          if (checkAuthError(response)) return;

          if (response.redirected) {
            window.location.href = response.url;
            return;
          }

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Request failed');
          }

          if (data?.success) {
            showToast(data.message || 'Operation successful', 'success');

            // Refresh the section data
            const section = this.action.split('/')[2]; // Extract section from URL
            fetchSectionData(section);

            if (isNew) {
              this.reset();
              // Clear image previews
              this.querySelectorAll('.preview-container').forEach(container => {
                container.style.display = 'none';
              });
            } else {
              this.closest('.modal').style.display = 'none';
              document.body.style.overflow = 'auto';
            }
          } else {
            showToast(data?.error || 'Action failed', 'error');
          }
        } catch (error) {
          console.error('Error:', error);
          showToast(error.message || 'An error occurred', 'error');
        } finally {
          showLoading(false);
        }
      });
    });
  }

  function setupSidebarToggle() {
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (sidebarToggle && sidebar && mainContent) {
      sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
      });

      if (localStorage.getItem('sidebar-collapsed') === 'true') {
        sidebar.classList.add('collapsed');
        mainContent.classList.add('sidebar-collapsed');
      }
    }
  }

  function setupSectionSwitching() {
    const menuItems = document.querySelectorAll('.sidebar-menu a');
    const adminSections = document.querySelectorAll('.admin-section');

    // Initialize first section as active if none are active
    if (!document.querySelector('.admin-section.active')) {
      document.querySelector('.admin-section').classList.add('active');
      document.querySelector('.sidebar-menu a').classList.add('active');
    }

    menuItems.forEach(item => {
      item.addEventListener('click', function(e) {
        if (this.getAttribute('href').startsWith('#')) {
          e.preventDefault();
          const targetId = this.getAttribute('href').substring(1);

          // Update active states
          menuItems.forEach(i => i.classList.remove('active'));
          this.classList.add('active');

          adminSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === targetId) {
              section.classList.add('active');
              // Update page title
              const pageTitle = document.getElementById('pageTitle');
              if (pageTitle) {
                const linkText = this.querySelector('span').textContent;
                pageTitle.textContent = linkText + (targetId === 'dashboard' ? '' : ' Management');
              }
            }
          });
        }
      });
    });

    // Handle view-all buttons in stat cards
    document.querySelectorAll('.stat-card a').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);

        // Update active states
        menuItems.forEach(i => i.classList.remove('active'));
        document.querySelector(`.sidebar-menu a[href="#${targetId}"]`).classList.add('active');

        adminSections.forEach(section => {
          section.classList.remove('active');
          if (section.id === targetId) {
            section.classList.add('active');
            // Update page title
            const pageTitle = document.getElementById('pageTitle');
            if (pageTitle) {
              const linkText = document.querySelector(`.sidebar-menu a[href="#${targetId}"] span`).textContent;
              pageTitle.textContent = linkText + (targetId === 'dashboard' ? '' : ' Management');
            }
          }
        });
      });
    });
  }

  function setupLogoutButton() {
    document.querySelector('.sidebar-menu a[href="/admin/logout"]')?.addEventListener('click', function(e) {
      e.preventDefault();
      showConfirm('Are you sure you want to logout?', () => {
        window.location.href = this.getAttribute('href');
      });
    });
  }

  function initializeSelect2() {
    if (typeof $ !== 'undefined' && $.fn.select2) {
      $('.admin-dashboard select').select2({
        minimumResultsForSearch: 10,
        width: '100%'
      });

      $('#blogCategories').select2({
        placeholder: "Select categories",
        allowClear: true,
        tags: true
      });
    } else {
      console.warn('Select2 not loaded - jQuery or Select2 missing');
    }
  }

  function setupSearchFunctionality() {
    document.querySelectorAll('.search-box input').forEach(input => {
      input.addEventListener('input', function() {
        const sectionId = this.closest('.admin-section').id;
        const searchTerm = this.value.toLowerCase();
        document.querySelectorAll(`#${sectionId} tbody tr`).forEach(row => {
          const rowText = row.textContent.toLowerCase();
          row.style.display = rowText.includes(searchTerm) ? '' : 'none';
        });
      });
    });
  }

  function setupStatusToggleButtons() {
    document.querySelectorAll('.action-btn.status-btn').forEach(button => {
      button.addEventListener('click', function() {
        const id = this.getAttribute('data-id');
        const currentStatus = this.getAttribute('data-status') === 'true';
        const newStatus = !currentStatus;
        const type = this.closest('.admin-section').id.replace(/s$/, ''); // Remove trailing 's'

        showConfirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this ${type}?`, () => {
          toggleStatus(type, id, newStatus);
        });
      });
    });
  }

  async function toggleStatus(type, id, newStatus) {
    showLoading(true);
    try {
      const response = await fetch(`/admin/${type}/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (checkAuthError(response)) return;

      const data = await response.json();
      if (data?.success) {
        showToast(data.message || 'Status updated', 'success');
        fetchSectionData(type + 's'); // Refresh the data
      } else {
        showToast(data?.error || 'Failed to update status', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      showLoading(false);
    }
  }

  function setupEditButtons() {
    document.querySelectorAll('.action-btn.edit-btn').forEach(button => {
      button.addEventListener('click', function() {
        const id = this.getAttribute('data-id');
        const type = this.closest('.admin-section').id.replace(/s$/, ''); // Remove trailing 's'
        const modalId = `${type}Modal`;
        const modal = document.getElementById(modalId);

        if (modal) {
          fetch(`/admin/${type}/${id}`)
            .then(response => {
              if (checkAuthError(response)) return;
              return response.json();
            })
            .then(data => {
              if (data) {
                const form = modal.querySelector('form');
                if (form) {
                  // Populate form fields (excluding provider field)
                  Object.entries(data).forEach(([key, value]) => {
                    if (key !== 'provider') { // Skip provider field
                      const input = form.querySelector(`[name="${key}"]`);
                      if (input) {
                        if (input.type === 'checkbox') {
                          input.checked = value;
                        } else if (input.type === 'select-multiple') {
                          const options = input.options;
                          for (let i = 0; i < options.length; i++) {
                            options[i].selected = value.includes(options[i].value);
                          }
                        } else {
                          input.value = value !== null ? value : '';
                        }
                      }
                    }
                  });

                  // Update modal title
                  const title = modal.querySelector('.modal-title');
                  if (title) {
                    title.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;
                  }

                  // Show modal
                  modal.style.display = 'block';
                  document.body.style.overflow = 'hidden';
                }
              }
            })
            .catch(error => {
              console.error('Error:', error);
              showToast('Failed to load data', 'error');
            });
        }
      });
    });
  }

  function setupDeleteButtons() {
    document.querySelectorAll('.action-btn.delete-btn').forEach(button => {
      button.addEventListener('click', function() {
        const id = this.getAttribute('data-id');
        const type = this.closest('.admin-section').id.replace(/s$/, ''); // Remove trailing 's'

        showConfirm(`Are you sure you want to delete this ${type}?`, () => {
          deleteItem(type, id);
        });
      });
    });
  }

  async function deleteItem(type, id) {
    showLoading(true);
    try {
      const response = await fetch(`/admin/${type}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': getCSRFToken()
        }
      });

      if (checkAuthError(response)) return;

      const data = await response.json();
      if (data?.success) {
        showToast(data.message || 'Item deleted', 'success');
        fetchSectionData(type + 's'); // Refresh the data
      } else {
        showToast(data?.error || 'Failed to delete', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred', 'error');
    } finally {
      showLoading(false);
    }
  }

  function setupPreviewButtons() {
    document.querySelectorAll('.action-btn.preview-btn').forEach(button => {
      button.addEventListener('click', function() {
        const id = this.getAttribute('data-id');
        const type = this.closest('.admin-section').id.replace(/s$/, ''); // Remove trailing 's'
        window.open(`/${type}/${id}/preview`, '_blank');
      });
    });
  }

  function checkVersion() {
    fetch('/api/version')
      .then(res => res.json())
      .then(data => {
        if (data.backend !== CURRENT_FRONTEND_VERSION) {
          showToast('New version available. Please refresh your browser.', 'warning');
        }
      })
      .catch(console.error);
  }

  function showWelcomeMessage() {
    if (!localStorage.getItem('adminDashboardVisited')) {
      showToast('Welcome to the Admin Dashboard!', 'info');
      localStorage.setItem('adminDashboardVisited', 'true');
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
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing admin dashboard...');
    addFormFieldFixes();

    // 1. Core UI first
    setupSidebarToggle();
    setupSectionSwitching();
    setupLogoutButton();

    // 2. Initialize plugins
    initializeSelect2();

    // 3. Setup interactive elements
    setupModals();  // This must come before form submissions
    setupFormSubmissions();
    setupBulkActions();
    setupSlugGeneration();
    setupImagePreview();
    setupSearchFunctionality();
    setupStatusToggleButtons();
    setupEditButtons();
    setupDeleteButtons();
    setupPreviewButtons();
    initializeDataTables();

    // 4. Background processes
    showWelcomeMessage();
    checkVersion();

    console.log('Admin dashboard initialized successfully');
  });

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