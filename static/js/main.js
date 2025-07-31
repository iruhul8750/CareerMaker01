document.addEventListener('DOMContentLoaded', function() {
  // ======================
  // Theme Management
  // ======================
  const themeToggle = document.querySelector('.theme-toggle');
  if (themeToggle) {
    const body = document.body;
    const savedTheme = localStorage.getItem('theme') ||
                      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-mode' : '');

    if (savedTheme === 'dark-mode') {
      body.classList.add('dark-mode');
      updateThemeMeta('dark');
    }

    themeToggle.addEventListener('click', function() {
      body.classList.toggle('dark-mode');
      const isDarkMode = body.classList.contains('dark-mode');

      localStorage.setItem('theme', isDarkMode ? 'dark-mode' : '');
      updateThemeMeta(isDarkMode ? 'dark' : 'light');
      updateDarkModeText(isDarkMode);
    });

    function updateThemeMeta(theme) {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.content = theme === 'dark' ? '#111827' : '#10b981';
      }
    }

    function updateDarkModeText(isDarkMode) {
      const toggleText = themeToggle.querySelector('.toggle-text');
      const toggleIcon = themeToggle.querySelector('.toggle-icon');

      if (toggleText && toggleIcon) {
        toggleText.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
        toggleIcon.className = isDarkMode ? 'fas fa-sun toggle-icon' : 'fas fa-moon toggle-icon';
      }
    }
  }

  // ======================
  // Mobile Navigation
  // ======================
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navContainer = document.getElementById('navContainer');

  if (mobileMenuToggle && navContainer) {
    mobileMenuToggle.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !isExpanded);
      navContainer.classList.toggle('active');
      this.classList.toggle('active');
      document.body.style.overflow = navContainer.classList.contains('active') ? 'hidden' : 'auto';
    });

    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', function() {
        if (navContainer.classList.contains('active')) {
          navContainer.classList.remove('active');
          mobileMenuToggle.classList.remove('active');
          mobileMenuToggle.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = 'auto';
        }
      });
    });
  }

  // ======================
  // Modal Handling
  // ======================
  const loginModal = document.getElementById('loginModal');
  const registerModal = document.getElementById('registerModal');
  const detailModal = document.getElementById('detailModal');

  // Show login modal
  document.querySelectorAll('.login-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      loginModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  });

  // Show register modal
  document.querySelectorAll('.register-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      registerModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });
  });

  // Toggle between login and register modals
  document.getElementById('showRegister')?.addEventListener('click', function(e) {
    e.preventDefault();
    loginModal.style.display = 'none';
    registerModal.style.display = 'flex';
  });

  document.getElementById('showLogin')?.addEventListener('click', function(e) {
    e.preventDefault();
    registerModal.style.display = 'none';
    loginModal.style.display = 'flex';
  });

  // Close modal handlers
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      loginModal.style.display = 'none';
      registerModal.style.display = 'none';
      if (detailModal) detailModal.style.display = 'none';
      document.body.style.overflow = 'auto';
    });
  });

  window.addEventListener('click', function(e) {
    if (e.target === loginModal || e.target === registerModal || (detailModal && e.target === detailModal)) {
      e.target.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  });

  // View Details Button Handler
  if (detailModal) {
    const modalContent = document.getElementById('modalContent');

    document.addEventListener('click', function(e) {
      const viewDetailsBtn = e.target.closest('.view-details-btn');
      if (viewDetailsBtn) {
        const type = viewDetailsBtn.dataset.type;
        const id = viewDetailsBtn.dataset.id;

        showLoading();
        fetch(`/api/content/${type}/${id}`)
          .then(handleResponse)
          .then(data => {
            hideLoading();
            renderModalContent(type, data);
            detailModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
          })
          .catch(handleError);
      }
    });
  }

  // ======================
  // Bookmark Functionality
  // ======================
  document.addEventListener('click', function(e) {
    const bookmarkBtn = e.target.closest('.bookmark-btn');
    if (bookmarkBtn) {
      e.preventDefault();
      const itemId = bookmarkBtn.dataset.id;
      const itemType = bookmarkBtn.dataset.type;
      const isBookmarked = bookmarkBtn.classList.contains('bookmarked');

      if (isBookmarked) {
        removeBookmark(itemId, itemType, bookmarkBtn);
      } else {
        addBookmark(itemId, itemType, bookmarkBtn);
      }
    }
  });

  // Check bookmarks on page load if user is logged in
  if (document.querySelector('.auth-buttons').textContent.includes('My Profile')) {
    checkBookmarks();
  }

  // ======================
  // Form Handling
  // ======================
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      const formResponse = document.getElementById('formResponse');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
      formResponse.style.display = 'none';

      const formData = new FormData(contactForm);

      fetch('/api/contact', {
        method: 'POST',
        body: formData
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw err; });
        }
        return response.json();
      })
      .then(data => {
        if (data.status === 'success') {
          formResponse.className = 'form-response success';
          formResponse.textContent = data.message;
          contactForm.reset();
        } else {
          formResponse.className = 'form-response error';
          formResponse.textContent = data.error || 'Failed to send message. Please try again.';
        }
      })
      .catch(error => {
        formResponse.className = 'form-response error';
        formResponse.textContent = error.error || 'An error occurred. Please try again.';
      })
      .finally(() => {
        formResponse.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      });
    });
  }

  // Login Form Handling
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

      const formData = new FormData(loginForm);

      fetch('/login', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => {
        if (response.redirected) {
          window.location.href = response.url;
        } else {
          return response.json().then(data => {
            if (data.error) throw new Error(data.error);
            return data;
          });
        }
      })
      .catch(error => {
        showToast(error.message || 'Login failed. Please try again.', 'error');
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      });
    });
  }

  // Register Form Handling
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

      const formData = new FormData(registerForm);

      fetch('/register', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => {
        if (response.redirected) {
          window.location.href = response.url;
        } else {
          return response.json().then(data => {
            if (data.error) throw new Error(data.error);
            return data;
          });
        }
      })
      .catch(error => {
        showToast(error.message || 'Registration failed. Please try again.', 'error');
      })
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      });
    });
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

  function handleError(error) {
    console.error('Error:', error);
    showToast(error.message || 'An error occurred. Please try again.', 'error');
    hideLoading();
  }

  function renderModalContent(type, data) {
    let html = '';
    const modalContent = document.getElementById('modalContent');

    switch(type) {
      case 'course':
        html = `
          <h2>${data.title}</h2>
          <div class="modal-meta">
            <span class="price">$${data.price}</span>
            <span class="duration">${data.duration} hours</span>
            <span class="level">${data.level}</span>
          </div>
          <div class="modal-description">
            <h3>Description</h3>
            <p>${data.description}</p>
          </div>
          ${data.modules ? `
          <div class="modal-modules">
            <h3>Course Modules</h3>
            ${data.modules.map(module => `
              <div class="module">
                <h4>${module.title}</h4>
                <ul>
                  ${module.lessons.map(lesson => `
                    <li>${lesson.title} (${lesson.duration} min)</li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>` : ''}
          <div class="modal-actions">
            <button class="btn btn-primary">Enroll Now</button>
          </div>
        `;
        break;

      case 'job':
        html = `
          <h2>${data.title}</h2>
          <h3>${data.company}</h3>
          <div class="modal-meta">
            <span class="location">${data.location}</span>
            <span class="salary">${data.salary}</span>
            <span class="type">${data.type}</span>
          </div>
          <div class="modal-description">
            <h3>Job Description</h3>
            <p>${data.description}</p>
          </div>
          <div class="modal-requirements">
            <h3>Requirements</h3>
            <ul>
              ${data.requirements.map(req => `<li>${req}</li>`).join('')}
            </ul>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary">Apply Now</button>
          </div>
        `;
        break;

      case 'internship':
        html = `
          <h2>${data.title}</h2>
          <h3>${data.company}</h3>
          <div class="modal-meta">
            <span class="location">${data.location}</span>
            <span class="stipend">${data.stipend}</span>
            <span class="duration">${data.duration}</span>
          </div>
          <div class="modal-description">
            <h3>Internship Description</h3>
            <p>${data.description}</p>
          </div>
          <div class="modal-requirements">
            <h3>Requirements</h3>
            <ul>
              ${data.requirements.map(req => `<li>${req}</li>`).join('')}
            </ul>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary">Apply Now</button>
          </div>
        `;
        break;

      case 'blog':
        html = `
          <h2>${data.title}</h2>
          <div class="modal-meta">
            <span class="author">By ${data.author}</span>
            <span class="date">${new Date(data.published_at).toLocaleDateString()}</span>
          </div>
          <div class="modal-image">
            <img src="${data.image ? '/static/images/blogs/' + data.image : '/static/images/default-blog.jpg'}" alt="${data.title}">
          </div>
          <div class="modal-content">
            <p>${data.description}</p>
          </div>
          <div class="modal-actions">
            <a href="/blog/${data.id}" class="btn btn-primary">Read Full Article</a>
          </div>
        `;
        break;
    }

    if (modalContent) {
      modalContent.innerHTML = html;
    }
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

  // Bookmark Functions
  function addBookmark(itemId, itemType, element) {
    showLoading();
    fetch('/api/bookmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item_id: itemId,
        item_type: itemType
      }),
      credentials: 'same-origin'
    })
    .then(handleResponse)
    .then(data => {
      if (data.status === 'added') {
        element.classList.add('bookmarked');
        const icon = element.querySelector('i') || document.createElement('i');
        icon.className = 'fas fa-bookmark';
        element.innerHTML = icon.outerHTML + ' Saved';
        showToast('Item bookmarked', 'success');
      } else {
        showToast('Failed to bookmark', 'error');
      }
    })
    .catch(handleError);
  }

  function removeBookmark(itemId, itemType, element) {
    showLoading();
    fetch('/api/bookmark', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        item_id: itemId,
        item_type: itemType
      }),
      credentials: 'same-origin'
    })
    .then(handleResponse)
    .then(data => {
      if (data.status === 'removed') {
        element.classList.remove('bookmarked');
        const icon = element.querySelector('i') || document.createElement('i');
        icon.className = 'far fa-bookmark';
        element.innerHTML = icon.outerHTML + ' Save';
        showToast('Bookmark removed', 'success');
      } else {
        showToast('Failed to remove bookmark', 'error');
      }
    })
    .catch(handleError);
  }

  function checkBookmarks() {
    fetch('/dashboard')
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const bookmarkedItems = doc.querySelectorAll('.bookmarked-item');

        bookmarkedItems.forEach(item => {
          const itemId = item.dataset.id;
          const itemType = item.dataset.type;
          const btn = document.querySelector(`.bookmark-btn[data-id="${itemId}"][data-type="${itemType}"]`);
          if (btn) {
            btn.classList.add('bookmarked');
            const icon = btn.querySelector('i') || document.createElement('i');
            icon.className = 'fas fa-bookmark';
            btn.innerHTML = icon.outerHTML + ' Saved';
          }
        });
      })
      .catch(error => {
        console.error('Error checking bookmarks:', error);
      });
  }

  // Toast Notifications
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Scroll to Top Button
  const scrollToTopBtn = document.createElement('div');
  scrollToTopBtn.className = 'scroll-to-top';
  scrollToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
  document.body.appendChild(scrollToTopBtn);

  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      scrollToTopBtn.classList.add('active');
    } else {
      scrollToTopBtn.classList.remove('active');
    }
  });

  scrollToTopBtn.addEventListener('click', function() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Active Navigation on Scroll
  const sections = document.querySelectorAll('section');
  const navLinks = document.querySelectorAll('.nav-links a');

  function updateActiveNav() {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (pageYOffset >= (sectionTop - 200)) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active-scroll');
      if (link.getAttribute('href').includes(current)) {
        link.classList.add('active-scroll');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav);
  updateActiveNav();

  // Smooth Scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: 'smooth'
        });
        history.pushState(null, null, targetId);
      }
    });
  });

  // Set current year in footer
  const currentYear = document.getElementById('currentYear');
  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  // Close flash messages
  document.querySelectorAll('.flash-close').forEach(btn => {
    btn.addEventListener('click', function() {
      this.parentElement.remove();
    });
  });
});