    // =============================================
    // ADMIN SETUP - COMPLETE
    // =============================================

    // =============================================
    // 1. TOAST SYSTEM
    // =============================================
    function showToast(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        const timeoutId = setTimeout(() => {
            removeToast(toast);
        }, duration);

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            clearTimeout(timeoutId);
            removeToast(toast);
        });

        return toast;
    }

    function removeToast(toast) {
        toast.classList.remove('show');
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    // =============================================
    // 2. ALERT SYSTEM
    // =============================================
    function showAlert(message, type = 'error', containerId = 'alertMessage') {
        const alertEl = document.getElementById(containerId);
        if (!alertEl) return;

        alertEl.textContent = message;
        alertEl.className = `alert alert-${type} show`;

        clearTimeout(alertEl._hideTimeout);
        alertEl._hideTimeout = setTimeout(() => {
            alertEl.classList.remove('show');
        }, 8000);
    }

    function hideAlert(containerId = 'alertMessage') {
        const alertEl = document.getElementById(containerId);
        if (alertEl) {
            alertEl.classList.remove('show');
            clearTimeout(alertEl._hideTimeout);
        }
    }

    // =============================================
    // 3. FLOATING LABELS
    // =============================================
    function initFloatingLabels() {
        const inputs = document.querySelectorAll('.floating-group input');

        inputs.forEach(input => {
            // Set initial placeholder based on value
            if (input.value && input.value.trim() !== '') {
                input.setAttribute('placeholder', ' ');
            } else {
                input.removeAttribute('placeholder');
            }

            // On focus: set placeholder so label floats up
            input.addEventListener('focus', function() {
                this.setAttribute('placeholder', ' ');
                this.closest('.floating-group').classList.add('focused');
            });

            // On blur: decide if placeholder should stay or be removed
            input.addEventListener('blur', function() {
                this.closest('.floating-group').classList.remove('focused');

                if (this.value && this.value.trim() !== '') {
                    // Has value: keep placeholder (label stays up)
                    this.setAttribute('placeholder', ' ');
                } else {
                    // Empty: remove placeholder (label goes back to center)
                    this.removeAttribute('placeholder');
                }
            });

            // On input: update placeholder based on value
            input.addEventListener('input', function() {
                if (this.value && this.value.trim() !== '') {
                    this.setAttribute('placeholder', ' ');
                } else if (!this.matches(':focus')) {
                    this.removeAttribute('placeholder');
                }
            });
        });
    }

    // =============================================
    // 4. PASSWORD STRENGTH CHECKLIST
    // =============================================
    function initPasswordChecklist() {
        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirmPassword');

        if (!passwordInput) return;

        const requirements = [
            { id: 'minLength', label: 'At least 8 characters', test: (p) => p.length >= 8 },
            { id: 'uppercase', label: 'At least one uppercase letter', test: (p) => /[A-Z]/.test(p) },
            { id: 'lowercase', label: 'At least one lowercase letter', test: (p) => /[a-z]/.test(p) },
            { id: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
            { id: 'special', label: 'At least one special character', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) }
        ];

        function updateChecklist(password) {
            let allValid = true;
            let validCount = 0;

            requirements.forEach(req => {
                const item = document.getElementById(`req-${req.id}`);
                if (!item) return;

                const icon = item.querySelector('.requirement-icon');
                const isValid = req.test(password);

                if (isValid) {
                    icon.textContent = '✅';
                    item.classList.add('valid');
                    item.classList.remove('invalid');
                    validCount++;
                } else {
                    icon.textContent = '❌';
                    item.classList.add('invalid');
                    item.classList.remove('valid');
                    allValid = false;
                }
            });

            const statusEl = document.getElementById('checklistStatus');
            if (statusEl) {
                if (allValid && password.length > 0) {
                    statusEl.textContent = '✅ All requirements met!';
                    statusEl.style.color = '#10b981';
                } else if (password.length > 0) {
                    statusEl.textContent = `${validCount}/${requirements.length} requirements met`;
                    statusEl.style.color = '#f59e0b';
                } else {
                    statusEl.textContent = '❌';
                    statusEl.style.color = '';
                }
            }

            const submitBtn = document.getElementById('adminSetupSubmit');
            if (submitBtn) {
                submitBtn.disabled = !allValid || password.length === 0;
            }

            return allValid;
        }

        // Real-time validation
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            updateChecklist(password);
            if (confirmInput && confirmInput.value.length > 0) {
                validateConfirmPassword();
            }
        });

        function validateConfirmPassword() {
            const confirmError = document.getElementById('confirmPasswordError');
            if (!confirmError || !confirmInput) return;

            const password = passwordInput.value;
            const confirm = confirmInput.value;

            if (confirm.length === 0) {
                confirmError.classList.remove('show');
                confirmInput.classList.remove('error');
                return;
            }

            if (password !== confirm) {
                confirmError.classList.add('show');
                confirmInput.classList.add('error');
            } else {
                confirmError.classList.remove('show');
                confirmInput.classList.remove('error');
            }
        }

        if (confirmInput) {
            confirmInput.addEventListener('input', validateConfirmPassword);
        }

        // Password toggle for both fields
        document.querySelectorAll('.password-toggle').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const input = this.closest('.input-wrapper').querySelector('input');
                const icon = this.querySelector('i');
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    input.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            });
        });

        // Initialize
        updateChecklist(passwordInput.value || '');
    }

    // =============================================
    // 5. EMAIL VALIDATION
    // =============================================
    function validateEmailFormat(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function isDisposableEmail(email) {
        const domain = email.split('@')[1].toLowerCase();
        const disposableDomains = [
            'tempmail.com', 'guerrillamail.com', '10minutemail.com',
            'throwawaymail.com', 'mailinator.com', 'temp-mail.org',
            'fakeinbox.com', 'dispostable.com', 'trashmail.com',
            'yopmail.com', 'spamgourmet.com', 'guerrillamail.org',
            'getnada.com', 'mohmal.com', 'mailnesia.com'
        ];
        return disposableDomains.includes(domain);
    }

    function initEmailValidation() {
        const emailInput = document.getElementById('email');
        if (!emailInput) return;

        let emailCheckTimeout = null;

        emailInput.addEventListener('blur', function() {
            const email = this.value.trim();
            const errorEl = document.getElementById('emailError');
            const dupErrorEl = document.getElementById('emailDuplicateError');

            errorEl.classList.remove('show');
            dupErrorEl.style.display = 'none';
            this.classList.remove('error');

            if (!email) return;

            if (!validateEmailFormat(email)) {
                errorEl.textContent = 'Please enter a valid email address';
                errorEl.classList.add('show');
                this.classList.add('error');
                return;
            }

            if (isDisposableEmail(email)) {
                errorEl.textContent = 'Please use a permanent email address (no temporary emails)';
                errorEl.classList.add('show');
                this.classList.add('error');
                return;
            }

            checkEmailExists(email);
        });

        emailInput.addEventListener('input', function() {
            const errorEl = document.getElementById('emailError');
            const dupErrorEl = document.getElementById('emailDuplicateError');
            errorEl.classList.remove('show');
            dupErrorEl.style.display = 'none';
            this.classList.remove('error');
        });

        function checkEmailExists(email) {
            if (emailCheckTimeout) clearTimeout(emailCheckTimeout);

            emailCheckTimeout = setTimeout(() => {
                fetch('/api/check-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.exists) {
                        const dupErrorEl = document.getElementById('emailDuplicateError');
                        dupErrorEl.textContent = 'This email is already registered';
                        dupErrorEl.style.display = 'flex';
                        emailInput.classList.add('error');
                    }
                })
                .catch(error => console.error('Email check error:', error));
            }, 500);
        }
    }

    // =============================================
    // 6. OTP MODAL
    // =============================================
    function openOTPModal(email) {
        const modal = document.getElementById('otpModal');
        const emailDisplay = document.getElementById('otpEmailDisplay');

        if (emailDisplay) emailDisplay.textContent = email;
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            setTimeout(() => {
                const otpInput = document.getElementById('otpCode');
                if (otpInput) otpInput.focus();
            }, 300);
        }
    }

    function closeOTPModal() {
        const modal = document.getElementById('otpModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    // =============================================
    // 7. FORM SUBMISSION
    // =============================================
    function initFormSubmission() {
        const form = document.getElementById('setupForm');
        if (!form) return;

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            hideAlert();

            const submitBtn = document.getElementById('adminSetupSubmit');
            const emailInput = document.getElementById('email');
            const fullNameInput = document.getElementById('fullName');
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const confirmInput = document.getElementById('confirmPassword');

            const email = emailInput.value.trim();
            const fullName = fullNameInput.value.trim();
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmInput.value;

            let hasError = false;

            // Full Name validation
            if (!fullName) {
                document.getElementById('fullNameError').classList.add('show');
                fullNameInput.classList.add('error');
                hasError = true;
            }

            // Username validation
            if (!username) {
                document.getElementById('usernameError').classList.add('show');
                usernameInput.classList.add('error');
                hasError = true;
            }

            // Email validation
            if (!email || !validateEmailFormat(email)) {
                document.getElementById('emailError').textContent = 'Please enter a valid email address';
                document.getElementById('emailError').classList.add('show');
                emailInput.classList.add('error');
                hasError = true;
            }

            // Password validation
            if (!password || password.length < 8) {
                document.getElementById('passwordError').classList.add('show');
                passwordInput.classList.add('error');
                hasError = true;
            }

            // Confirm password validation
            if (password !== confirmPassword) {
                document.getElementById('confirmPasswordError').classList.add('show');
                confirmInput.classList.add('error');
                hasError = true;
            }

            if (hasError) {
                showAlert('Please fix the errors above', 'error');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.classList.add('loading');

            try {
                const response = await fetch('/api/admin/setup/request-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        full_name: fullName,
                        username: username,
                        password: password,
                        confirm_password: confirmPassword
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showToast('📧 OTP sent to your email. Please check your inbox.', 'success', 5000);
                    openOTPModal(email);
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('loading');
                } else {
                    showAlert(result.error || 'Failed to send OTP', 'error');
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('loading');
                }

            } catch (error) {
                console.error('Error:', error);
                showAlert('Network error. Please try again.', 'error');
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
            }
        });
    }

    // =============================================
    // 8. OTP VERIFICATION - FIXED VERSION
    // =============================================
    function initOTPVerification() {
        const form = document.getElementById('otpForm');
        if (!form) return;

        const otpInput = document.getElementById('otpCode');
        const submitBtn = document.getElementById('verifyOtpBtn');
        const resendBtn = document.getElementById('resendOtpBtn');
        const timerDisplay = document.getElementById('timerDisplay');
        const closeBtn = document.getElementById('otpModalClose');

        // ===== CLOSE MODAL =====
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                closeOTPModal();
            });
        }

        // ===== AUTO-FOCUS ON MODAL OPEN =====
        function focusOTPInput() {
            if (otpInput && !otpInput.disabled) {
                setTimeout(() => {
                    otpInput.focus();
                    otpInput.select();
                }, 300);
            }
        }

        // ===== EXPIRED STATE =====
        let isExpired = false;

        function setExpiredState() {
            isExpired = true;
            if (otpInput) {
                otpInput.disabled = true;
                otpInput.style.opacity = '0.7';
                otpInput.value = '';
                // ✅ Keep placeholder same (no expired message)
                otpInput.placeholder = '• • • • • •';
            }
            if (submitBtn) {
                submitBtn.disabled = true;
            }
            if (timerDisplay) {
                timerDisplay.classList.add('expired');
                timerDisplay.textContent = 'Expired click resend for new otp';
            }
            if (resendBtn) {
                resendBtn.disabled = false;
            }
        }

        function resetExpiredState() {
            isExpired = false;
            if (otpInput) {
                otpInput.disabled = false;
                otpInput.style.opacity = '1';
                otpInput.value = '';
                otpInput.placeholder = '• • • • • •';
            }
            if (submitBtn) {
                submitBtn.disabled = false;
            }
            if (timerDisplay) {
                timerDisplay.classList.remove('expired');
                timerDisplay.textContent = '05:00';
            }
            if (resendBtn) {
                resendBtn.disabled = true;
            }
            // Auto-focus after reset
            focusOTPInput();
        }

        // ===== SHOW OTP ERROR WITH SHAKE =====
        function showOtpError(message) {
            // Remove existing error
            const existingError = document.querySelector('.otp-error-message');
            if (existingError) existingError.remove();

            // Add shake and red border
            otpInput.classList.add('otp-shake', 'otp-error-border');
            otpInput.classList.add('error');

            if (otpInput._shakeTimeout) {
                clearTimeout(otpInput._shakeTimeout);
            }

            otpInput._shakeTimeout = setTimeout(() => {
                otpInput.classList.remove('otp-shake');
            }, 500);

            // Create error message below field
            const errorDiv = document.createElement('div');
            errorDiv.className = 'otp-error-message';
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;

            const inputWrapper = otpInput.closest('.otp-input-wrapper');
            if (inputWrapper) {
                inputWrapper.parentNode.insertBefore(errorDiv, inputWrapper.nextSibling);
            }

            // Auto clear after 5 seconds
            setTimeout(() => {
                clearOtpError();
            }, 5000);
        }

        // ===== CLEAR OTP ERROR =====
        function clearOtpError() {
            otpInput.classList.remove('otp-shake', 'otp-error-border', 'error');
            const errorMsg = document.querySelector('.otp-error-message');
            if (errorMsg) errorMsg.remove();

            const alertEl = document.getElementById('otpAlertMessage');
            if (alertEl) {
                alertEl.classList.remove('show');
            }
        }

        // ===== OTP INPUT EVENTS =====
        if (otpInput) {
            otpInput.addEventListener('input', function() {
                clearOtpError();
                if (isExpired) {
                    resetExpiredState();
                }

                this.value = this.value.replace(/\D/g, '');
                if (this.value.length > 6) {
                    this.value = this.value.substring(0, 6);
                }

                if (this.value.length === 6) {
                    form.dispatchEvent(new Event('submit'));
                }
            });

            otpInput.addEventListener('paste', function(e) {
                e.preventDefault();
                clearOtpError();
                if (isExpired) {
                    resetExpiredState();
                }

                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const numbersOnly = pastedText.replace(/\D/g, '').substring(0, 6);
                this.value = numbersOnly;
                if (numbersOnly.length === 6) {
                    form.dispatchEvent(new Event('submit'));
                }
            });

            otpInput.addEventListener('focus', function() {
                clearOtpError();
            });
        }

        // ===== TIMER =====
        let timerInterval;
        let timeLeft = 300;

        function updateTimer() {
            if (!timerDisplay) return;

            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                setExpiredState();
            }
        }

        function startTimer() {
            timeLeft = 300;
            resetExpiredState();

            if (resendBtn) resendBtn.disabled = true;

            updateTimer();

            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(() => {
                timeLeft--;
                updateTimer();
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                }
            }, 1000);
        }

        // Start timer and auto-focus
        startTimer();
        focusOTPInput();

        // ===== FORM SUBMISSION =====
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            if (isExpired) {
                setExpiredState();
                showAlert('OTP expired. Click "Resend Code" to get a new one.', 'error', 'otpAlertMessage');
                return;
            }

            clearOtpError();
            hideAlert('otpAlertMessage');

            const otp = otpInput ? otpInput.value.trim() : '';

            if (!otp || otp.length !== 6) {
                showOtpError('Please enter a valid 6-digit OTP');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.classList.add('loading');

            try {
                const response = await fetch('/api/admin/setup/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ otp: otp })
                });

                const result = await response.json();

                if (result.success) {
                    closeOTPModal();
                    showToast('✅ Admin created successfully! Redirecting to login...', 'success', 3000);
                    setTimeout(() => {
                        window.location.href = result.redirect;
                    }, 3000);
                } else {
                    if (result.expired || (result.error && result.error.includes('expired'))) {
                        setExpiredState();
                        showAlert('OTP expired. Click "Resend Code" to get a new one.', 'error', 'otpAlertMessage');
                        submitBtn.disabled = true;
                        submitBtn.classList.remove('loading');
                    } else {
                        showOtpError(result.error || 'Invalid OTP. Please try again.');
                        showAlert(result.error || 'Verification failed', 'error', 'otpAlertMessage');
                        if (otpInput) {
                            otpInput.value = '';
                            setTimeout(() => otpInput.focus(), 300);
                        }
                        submitBtn.disabled = false;
                        submitBtn.classList.remove('loading');
                    }
                }

            } catch (error) {
                console.error('Error:', error);
                showOtpError('Network error. Please try again.');
                showAlert('Network error. Please try again.', 'error', 'otpAlertMessage');
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
            }
        });

        // ===== RESEND OTP =====
        if (resendBtn) {
            let resendTimerInterval;
            let resendTimeLeft = 30;

            function startResendTimer() {
                resendTimeLeft = 30;
                resendBtn.disabled = true;
                const timerEl = document.getElementById('resendTimer');
                const countEl = document.getElementById('timerCount');

                if (timerEl) timerEl.style.display = 'inline';
                if (countEl) countEl.textContent = resendTimeLeft;

                if (resendTimerInterval) clearInterval(resendTimerInterval);
                resendTimerInterval = setInterval(() => {
                    resendTimeLeft--;
                    if (countEl) countEl.textContent = resendTimeLeft;

                    if (resendTimeLeft <= 0) {
                        clearInterval(resendTimerInterval);
                        resendBtn.disabled = false;
                        if (timerEl) timerEl.style.display = 'none';
                    }
                }, 1000);
            }

            resendBtn.addEventListener('click', async function() {
                if (this.disabled) return;

                clearOtpError();

                this.disabled = true;
                const originalText = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

                try {
                    const response = await fetch('/api/admin/setup/resend-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    const result = await response.json();

                    if (result.success) {
                        showToast('📧 New OTP sent to your email', 'success', 4000);
                        clearInterval(timerInterval);
                        startTimer();
                        startResendTimer();
                        submitBtn.disabled = false;
                        if (otpInput) {
                            otpInput.value = '';
                            focusOTPInput();
                        }
                    } else {
                        showAlert(result.error || 'Failed to resend OTP', 'error', 'otpAlertMessage');
                        this.disabled = false;
                    }

                } catch (error) {
                    console.error('Error:', error);
                    showAlert('Network error. Please try again.', 'error', 'otpAlertMessage');
                    this.disabled = false;
                } finally {
                    this.innerHTML = originalText;
                }
            });

            startResendTimer();
        }
    }

    // =============================================
    // 9. MAIN INITIALIZATION
    // =============================================
    document.addEventListener('DOMContentLoaded', function() {
        console.log('✅ Admin setup page loaded');

        // Check which page we're on
        const isSetupPage = document.getElementById('setupForm') !== null;

        if (isSetupPage) {
            initFloatingLabels();
            initPasswordChecklist();
            initEmailValidation();
            initFormSubmission();
            initOTPVerification();
        }

        console.log('✅ Admin setup initialized');
    });