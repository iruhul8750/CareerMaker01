import os
import json
import ssl
import uuid
import secrets
import logging
import smtplib
import hashlib
import binascii
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from flask import Flask, request, jsonify
import smtplib
from zoneinfo import ZoneInfo
import os
from supabase import create_client, Client
import logging
import base64
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
from supabase.lib.client_options import ClientOptions
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, send_from_directory, \
    make_response, Response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from functools import wraps
from dotenv import load_dotenv
from PIL import Image
from flask_cors import CORS
from supabase import create_client, Client

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)
app.secret_key = os.getenv('SECRET_KEY') or secrets.token_hex(32)
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

# Configuration
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Email Configuration
OTP_EXPIRY_MINUTES = 5
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
SMTP_EMAIL = os.getenv('SMTP_EMAIL')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')

# Password Hashing Configuration
PBKDF2_ITERATIONS = 100000
HASH_NAME = "sha256"
SALT_LENGTH = 16
HASH_LENGTH = 64

# Initialize Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(supabase_url, supabase_key)
supabase_admin = create_client(supabase_url, supabase_service_key)

# Test Supabase connection
try:
    test = supabase.table('users').select('*').limit(1).execute()
    logger.info("Supabase connection test successful")
except Exception as e:
    logger.error(f"Supabase connection failed: {str(e)}")

# Helper Functions
def get_current_time():
    return datetime.now(ZoneInfo("Asia/Kolkata"))


def parse_db_timestamp(timestamp_str):
    """Parse database timestamp and ensure it's timezone-aware"""
    if not timestamp_str:
        return None
    try:
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def verify_password(stored_hash, password):
    """Verify password with base64-encoded salt"""
    try:
        algorithm, b64_salt, key_hex = stored_hash.split('$')
        salt = base64.urlsafe_b64decode(b64_salt + '==')
        iterations = int(algorithm.split(':')[2])
        stored_key = binascii.unhexlify(key_hex)
        new_key = hashlib.pbkdf2_hmac(
            HASH_NAME,
            password.encode('utf-8'),
            salt,
            iterations,
            dklen=len(stored_key))
        return secrets.compare_digest(new_key, stored_key)
    except Exception as e:
        logger.error(f"Password verification error: {str(e)}")
        return False


def validate_password(password):
    """Validate password meets strength requirements"""
    if len(password) < 8:
        return False, 'Password must be at least 8 characters long'
    if not any(c.isupper() for c in password):
        return False, 'Password must contain at least one uppercase letter'
    if not any(c.isdigit() for c in password):
        return False, 'Password must contain at least one number'
    if not any(c in '!@#$%^&*(),.?":{}|<>' for c in password):
        return False, 'Password must contain at least one special character'
    return True, ''


def hash_password(password):
    """Generate PBKDF2 hash with base64-encoded salt"""
    salt = secrets.token_bytes(SALT_LENGTH)
    key = hashlib.pbkdf2_hmac(
        HASH_NAME,
        password.encode('utf-8'),
        salt,
        PBKDF2_ITERATIONS,
        dklen=HASH_LENGTH
    )
    b64_salt = base64.urlsafe_b64encode(salt).decode('ascii').rstrip('=')
    return f"pbkdf2:{HASH_NAME}:{PBKDF2_ITERATIONS}${b64_salt}${binascii.hexlify(key).decode()}"


def generate_otp():
    """Generate a 6-digit OTP and return it with expiration time"""
    otp = str(secrets.randbelow(900000) + 100000)
    expires_at = get_current_time() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    return otp, expires_at.isoformat()


def send_email_smtp(to_email, subject, message):
    """Send email with SSL/TLS fallback and proper Unicode support"""
    try:
        # Create message with proper encoding
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject

        # Add message body with UTF-8 encoding
        msg.attach(MIMEText(message, 'plain', 'utf-8'))

        # First try SSL
        try:
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"✅ Email sent via SSL to {to_email}")
            return True
        except (smtplib.SMTPException, ssl.SSLError) as ssl_error:
            logger.warning(f"SSL failed, trying TLS: {str(ssl_error)}")

            # Fallback to TLS
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"✅ Email sent via TLS to {to_email}")
            return True

    except Exception as e:
        logger.error(f"❌ Email sending failed for {to_email}: {str(e)}")
        return False

def send_otp_email(user_email, user_name, otp):
    """Send OTP email using SMTP with SSL/TLS fallback"""
    subject = "Your CareerMaker Verification Code"
    message = f"""Hello {user_name},

Your verification code is: {otp}

This code will expire in {OTP_EXPIRY_MINUTES} minutes.

If you didn't request this, please ignore this email.
"""
    return send_email_smtp(user_email, subject, message)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)

    return decorated_function


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            flash('Please log in as admin to access this page', 'warning')
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)

    return decorated_function


def get_company_logo(application_link, content_type=None, content_id=None):
    try:
        # First check if we already have a logo in database
        if content_type and content_id:
            table_map = {
                'course': 'courses',
                'job': 'jobs',
                'internship': 'internships'
            }
            if content_type in table_map:
                content = supabase.table(table_map[content_type]).select('image').eq('id', content_id).single().execute().data
                if content and content.get('image'):
                    return content['image']

        # If no image in DB, try to fetch from application link domain
        domain = urlparse(application_link).netloc
        if domain.startswith('www.'):
            domain = domain[4:]

        # Try multiple logo sources
        logo_sources = [
            f"https://logo.clearbit.com/{domain}?size=150",
            f"https://favicon.{domain}/favicon.ico",
            f"https://{domain}/favicon.ico"
        ]

        for logo_url in logo_sources:
            try:
                import requests
                response = requests.head(logo_url, timeout=3)
                if response.status_code == 200:
                    # Store the logo URL in database if content_type and content_id provided
                    if content_type in table_map and content_id:
                        supabase.table(table_map[content_type]).update({'image': logo_url}).eq('id', content_id).execute()
                    return logo_url
            except:
                continue

        # Return empty string if no logo found
        return ""

    except Exception as e:
        logger.error(f"Error getting company logo: {str(e)}")
        return ""


# Routes
@app.route('/')
def index():
    try:
        logged_in = 'user_id' in session
        username = session.get('username') if logged_in else None

        # Fetch featured content from database
        courses = supabase.table('courses').select('*').eq('is_featured', True).eq('is_published', True).limit(
            4).execute().data or []
        jobs = supabase.table('jobs').select('*').eq('is_featured', True).eq('is_active', True).limit(
            4).execute().data or []
        internships = supabase.table('internships').select('*').eq('is_featured', True).eq('is_active', True).limit(
            4).execute().data or []
        blogs = supabase.table('blog_posts').select('*').eq('is_featured', True).eq('is_published', True).limit(
            3).execute().data or []

        # Fetch testimonials (using blog posts as testimonials for now)
        testimonials = supabase.table('blog_posts').select('id, title, author, description, image').eq('is_featured',
                                                                                                       True).eq(
            'is_published', True).limit(3).execute().data or []

    except Exception as e:
        logger.error(f"Error loading index: {str(e)}")
        courses, jobs, internships, blogs, testimonials = [], [], [], [], []

    return render_template('index.html',
                           courses=courses,
                           jobs=jobs,
                           internships=internships,
                           blogs=blogs,
                           testimonials=testimonials,
                           logged_in=logged_in,
                           username=username)


@app.route('/register', methods=['GET', 'POST'])
def register():
    try:
        if request.method == 'GET':
            return render_template('index.html')

        # Get data from request
        data = request.get_json() if request.is_json else request.form.to_dict()

        # Handle OTP resend request
        if data.get('resend') == 'true':
            return handle_otp_resend(data)

        # Original registration logic
        required_fields = ['username', 'email', 'password', 'confirm_password']
        if not all(data.get(field) for field in required_fields):
            return jsonify({'status': 'error', 'message': 'All fields are required'}), 400

        email = data['email']
        username = data['username']
        password = data['password']
        confirm_password = data['confirm_password']

        if password != confirm_password:
            return jsonify({'status': 'error', 'message': 'Passwords do not match'}), 400

        # Validate password strength
        is_valid, message = validate_password(password)
        if not is_valid:
            return jsonify({'status': 'error', 'message': message}), 400

        # Check if user exists
        existing = supabase.table('users').select('email').eq('email', email).execute()
        if existing.data:
            return jsonify({'status': 'error', 'message': 'Email already registered'}), 400

        # Generate and store OTP
        otp, expires_at = generate_otp()
        otp_response = supabase.table('otp_verification').insert({
            'email': email,
            'otp': otp,
            'expires_at': expires_at,
            'purpose': 'registration'
        }).execute()

        if not otp_response.data:
            raise Exception('Failed to store OTP in database')

        # Attempt to send OTP email
        email_sent = send_otp_email(email, username, otp)

        return jsonify({
            'status': 'success',
            'message': 'OTP sent to your email. Please verify to complete registration.',
            'requires_verification': True,
            'email': email,
            'username': username,
            'otp': otp if not email_sent else None  # For development only
        })

    except Exception as e:
        logger.error(f"Registration error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': 'Registration failed. Please try again.'
        }), 500

@app.route('/resend-otp', methods=['POST'])
def resend_otp():
    try:
        data = request.get_json()
        email = data.get('email')
        purpose = data.get('purpose', 'registration')

        if not email:
            return jsonify({'status': 'error', 'message': 'Email is required'}), 400

        # Check if this is for registration and email isn't already registered
        if purpose == 'registration':
            existing_user = supabase.table('users').select('email').eq('email', email).execute()
            if existing_user.data:
                return jsonify({'status': 'error', 'message': 'Email already registered'}), 400

        # Delete any existing OTPs for this email
        supabase.table('otp_verification').delete().eq('email', email).eq('purpose', purpose).execute()

        # Generate and store new OTP
        otp, expires_at = generate_otp()
        supabase.table('otp_verification').insert({
            'email': email,
            'otp': otp,
            'expires_at': expires_at,
            'purpose': purpose
        }).execute()

        # Send OTP email
        username = data.get('username', 'User')
        email_sent = send_otp_email(email, username, otp)

        return jsonify({
            'status': 'success',
            'message': 'New OTP sent successfully',
            'otp': otp if not email_sent else None  # For development only
        })

    except Exception as e:
        logger.error(f"OTP resend error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')
        username = data.get('username')
        password = data.get('password')
        purpose = data.get('purpose', 'registration')

        if not all([email, otp]):
            return jsonify({'status': 'error', 'message': 'Email and OTP are required'}), 400

        # For registration, ensure we have all required fields
        if purpose == 'registration' and not all([username, password]):
            return jsonify({'status': 'error', 'message': 'All fields are required'}), 400

        # Get the latest OTP for this email and purpose
        otp_record = supabase.table('otp_verification') \
            .select('*') \
            .eq('email', email) \
            .eq('purpose', purpose) \
            .order('created_at', desc=True) \
            .limit(1) \
            .maybe_single() \
            .execute()

        if not otp_record.data:
            return jsonify({'status': 'error', 'message': 'No OTP found for this email'}), 404

        # Check expiration
        expires_at = parse_db_timestamp(otp_record.data['expires_at'])
        current_time = get_current_time()

        if otp_record.data['otp'] == otp and expires_at > current_time:
            if purpose == 'registration':
                # OTP is valid - create the user
                user_data = {
                    'username': username,
                    'email': email,
                    'password_hash': hash_password(password),
                    'is_verified': True,
                    'verified_at': current_time.isoformat(),
                    'created_at': current_time.isoformat()
                }

                user_response = supabase.table('users').insert(user_data).execute()

                if not user_response.data:
                    raise Exception('Failed to create user account')

            # Delete the used OTP
            supabase.table('otp_verification').delete().eq('id', otp_record.data['id']).execute()

            return jsonify({
                'status': 'success',
                'message': 'Verification successful!' + (' You can now login.' if purpose == 'registration' else ''),
                'redirect': '/',  # Redirect to home page
                'showLoginModal': purpose == 'registration'  # Show login modal for registration
            })
        else:
            return jsonify({'status': 'error', 'message': 'Invalid or expired OTP'}), 400

    except Exception as e:
        logger.error(f"OTP verification error: {str(e)}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'OTP verification failed'}), 500


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        # If user is already logged in, redirect to dashboard
        if 'user_id' in session:
            return redirect(url_for('user_dashboard'))
        return render_template('index.html')  # This will show the modal via JavaScript

    # POST request handling
    if not request.is_json:
        return jsonify({'error': 'Content-Type must be application/json'}), 415

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid JSON data'}), 400

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    try:
        user = supabase.table('users').select('*').eq('email', email).single().execute().data

        if user and verify_password(user['password_hash'], password):
            if not user.get('is_verified'):
                return jsonify({
                    'error': 'Please verify your email first',
                    'requires_verification': True,
                    'email': email
                }), 401

            # Set session variables
            session['user_id'] = user['id']
            session['user_email'] = user['email']
            session['username'] = user['username']
            session.permanent = True

            return jsonify({
                'status': 'success',
                'message': 'Login successful!',
                'redirect': url_for('index')
            })

        return jsonify({'error': 'Invalid email or password'}), 401

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed. Please try again.'}), 500


@app.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'GET':
        return render_template('reset-password.html')

    try:
        data = request.get_json() if request.is_json else request.form
        is_resend = data.get('resend', False)
        email = data.get('email')

        if not email:
            return jsonify({'status': 'error', 'message': 'Email is required'}), 400

        # Handle OTP resend request
        if is_resend:
            # Generate and store new OTP
            otp, expires_at = generate_otp()
            supabase.table('password_reset_otp').insert({
                'email': email,
                'otp': otp,
                'expires_at': expires_at
            }).execute()

            # Get username for email
            user = supabase.table('users').select('username').eq('email', email).maybe_single().execute()
            username = user.data.get('username', 'User') if user.data else 'User'

            send_otp_email(email, username, otp)
            return jsonify({
                'status': 'success',
                'message': 'New OTP sent successfully'
            })

        # Original password reset logic
        user = supabase.table('users').select('*').eq('email', email).maybe_single().execute()

        if user.data:
            otp, expires_at = generate_otp()
            supabase.table('password_reset_otp').insert({
                'email': email,
                'otp': otp,
                'expires_at': expires_at
            }).execute()

            send_otp_email(email, user.data.get('username', 'User'), otp)

        return jsonify({
            'status': 'success',
            'message': 'If an account exists with this email, an OTP has been sent',
            'redirect': url_for('reset_password_otp', email=email)
        })

    except Exception as e:
        logger.error(f"Password reset error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Error processing your request. Please try again.'
        }), 500

@app.route('/reset-password-otp', methods=['GET', 'POST'])
def reset_password_otp():
    if request.method == 'GET':
        email = request.args.get('email')
        if not email:
            flash('Email is required', 'danger')
            return redirect(url_for('reset_password'))
        return render_template('reset-password-otp.html', email=email)

    # POST request
    try:
        data = request.get_json() or request.form
        email = data.get('email')
        otp = data.get('otp')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        if not all([email, otp, new_password, confirm_password]):
            return jsonify({'error': 'All fields are required'}), 400

        if new_password != confirm_password:
            return jsonify({'error': 'Passwords do not match'}), 400

        # Validate password strength
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': message}), 400

        # Verify OTP
        otp_record = supabase.table('password_reset_otp').select('*') \
            .eq('email', email) \
            .order('created_at', desc=True) \
            .limit(1) \
            .maybe_single() \
            .execute()

        if not otp_record.data:
            return jsonify({'error': 'No OTP found for this email'}), 404

        # Timezone-aware expiration check
        expires_at = parse_db_timestamp(otp_record.data['expires_at'])
        current_time = get_current_time()

        if otp_record.data['otp'] == otp and expires_at > current_time:
            # Update password in user table
            supabase.table('users').update({
                'password_hash': hash_password(new_password)
            }).eq('email', email).execute()

            # Delete used OTP
            supabase.table('password_reset_otp').delete().eq('id', otp_record.data['id']).execute()

            return jsonify({
                'status': 'success',
                'message': 'Password updated successfully',
                'redirect': '/',  # Redirect to home page
                'showLoginModal': True  # Flag to show login modal
            })
        else:
            return jsonify({'error': 'Invalid or expired OTP'}), 400

    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}")
        return jsonify({'error': 'Failed to reset password'}), 500


# ===== CHECK SESSION ENDPOINT =====
@app.route('/api/check-session')
def check_session():
    try:
        return jsonify({
            'logged_in': 'user_id' in session,
            'username': session.get('username'),
            'user_id': session.get('user_id')
        })
    except Exception as e:
        logger.error(f"Error checking session: {str(e)}")
        return jsonify({'logged_in': False})

# Profile Picture Routes
@app.route('/upload-profile-pic', methods=['POST'])
@login_required
def upload_profile_pic():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'error': 'Only JPG, PNG or GIF allowed'}), 400

    user_id = session['user_id']

    try:
        # Read file data
        file_data = file.read()

        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_name = f"{user_id}/{uuid.uuid4().hex}.{ext}"

        # Use admin client to bypass RLS for storage operations
        response = supabase_admin.storage.from_("profile-pictures").upload(
            unique_name,
            file_data,
            {"content-type": file.content_type}
        )

        # Get public URL using regular client
        image_url = supabase.storage.from_("profile-pictures").get_public_url(unique_name)

        # Store the file path in DB using regular client
        db_value = unique_name
        supabase.table('users').update({'profile_pic': db_value}).eq('id', user_id).execute()

        return jsonify({
            'success': True,
            'image_url': image_url
        })

    except Exception as e:
        logger.error(f"Upload error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/get-profile-pic')
@login_required
def get_profile_pic():
    user_id = session['user_id']
    try:
        user = supabase.table('users').select('profile_pic').eq('id', user_id).single().execute().data
        if user and user.get('profile_pic'):
            # Get public URL from Supabase Storage
            image_url = supabase.storage.from_("profile-pictures").get_public_url(user['profile_pic'])
            return jsonify({
                'success': True,
                'image_url': image_url
            })
        return jsonify({'success': False, 'error': 'No profile picture'})
    except Exception as e:
        logger.error(f"Profile pic fetch error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


# Helper function to get profile picture URL from database value
def profile_pic_url_from_db(value):
    """
    Given the DB value (path in Supabase storage),
    return the public URL from Supabase Storage.
    """
    if not value:
        return None

    try:
        return supabase.storage.from_("profile-pictures").get_public_url(value)
    except Exception as e:
        logger.error(f"Error getting profile picture URL: {str(e)}")
        return None

@app.route('/dashboard')
@login_required
def user_dashboard():
    try:
        if 'logout_message' in session:
            flash(session.pop('logout_message'), 'success')

        user_id = session.get('user_id')
        user = supabase.table('users').select('*').eq('id', user_id).single().execute().data

        # Get profile picture URL from Supabase storage
        avatar_url = None
        if user and user.get('profile_pic'):
            try:
                avatar_url = supabase.storage.from_("profile-pictures").get_public_url(user['profile_pic'])
            except Exception as e:
                logger.error(f"Error getting profile picture URL: {str(e)}")
                avatar_url = None

        # Get user bookmarks (existing helper)
        bookmarks = get_user_bookmarks(user_id)

        return render_template('user-dashboard.html',
                               username=user.get('username'),
                               email=user.get('email'),
                               avatar_url=avatar_url,
                               courses=[b for b in bookmarks if b['item_type'] == 'course'],
                               jobs=[b for b in bookmarks if b['item_type'] == 'job'],
                               internships=[b for b in bookmarks if b['item_type'] == 'internship'])
    except Exception as e:
        logger.error(f"Dashboard error: {str(e)}", exc_info=True)
        flash('Error loading dashboard', 'danger')
        return redirect(url_for('index'))

@app.route('/logout', methods=['GET', 'POST'])
def logout():
    # Store a message to show after logout
    session['logout_message'] = 'You have been successfully logged out'
    session.clear()
    response = make_response(redirect(url_for('index')))
    return response


def get_user_bookmarks(user_id):
    """Get all bookmarks for a user with content details"""
    try:
        bookmarks = supabase.table('bookmarks').select('*').eq('user_id', user_id).execute().data
        if not bookmarks:
            return []

        # Group by content type
        content_map = {'course': [], 'job': [], 'internship': [], 'blog': []}
        for b in bookmarks:
            content_map[b['item_type']].append(b['item_id'])

        # Fetch all content in batches
        results = []
        for content_type, ids in content_map.items():
            if not ids:
                continue

            if content_type == 'course':
                content = supabase.table('courses').select('*').in_('id', ids).execute().data
            elif content_type == 'job':
                content = supabase.table('jobs').select('*').in_('id', ids).execute().data
            elif content_type == 'internship':
                content = supabase.table('internships').select('*').in_('id', ids).execute().data
            elif content_type == 'blog':
                content = supabase.table('blog_posts').select('*').in_('id', ids).execute().data

            for item in content:
                item['content_type'] = content_type
                results.append(item)

        return sorted(results, key=lambda x: x.get('created_at', ''), reverse=True)
    except Exception as e:
        logger.error(f"Error getting user bookmarks: {str(e)}")
        return []


# Content Routes
@app.route('/courses')
def courses():
    search = request.args.get('search', '')
    category = request.args.get('category', '')

    try:
        query = supabase.table('courses').select('*').eq('is_published', True).eq('is_active', True)
        if search:
            query = query.ilike('title', f'%{search}%')
        if category:
            query = query.eq('category', category)
        courses = query.order('created_at', desc=True).execute().data or []
    except Exception as e:
        logger.error(f"Error loading courses: {str(e)}")
        courses = []

    return render_template('courses.html',
                           courses=courses,
                           search=search,
                           category=category,
                           course_categories=['Programming', 'Design', 'Business', 'Marketing'])


@app.route('/courses/<course_id>')
def course_detail(course_id):
    try:
        course = supabase.table('courses').select('*').eq('id', course_id).eq('is_published', True).eq('is_active',
                                                                                                       True).single().execute().data

        if not course:
            flash('Course not found', 'danger')
            return redirect(url_for('courses'))

        # Ensure we have a logo
        if course.get('application_link') and not course.get('image'):
            logo_url = get_company_logo(course['application_link'], 'course', course_id)
            if logo_url:
                course['image'] = logo_url

        is_enrolled = False
        if 'user_id' in session:
            # Check if user has bookmarked this course
            bookmark = supabase.table('bookmarks').select('id') \
                .eq('user_id', session['user_id']) \
                .eq('item_type', 'course') \
                .eq('item_id', course_id) \
                .maybe_single().execute()
            is_enrolled = bool(bookmark.data)

        return render_template('course-detail.html',
                               course=course,
                               is_enrolled=is_enrolled)
    except Exception as e:
        logger.error(f"Error loading course: {str(e)}")
        flash('Course not found', 'danger')
        return redirect(url_for('courses'))


@app.route('/courses/<course_id>/enroll', methods=['POST'])
@login_required
def enroll_course(course_id):
    try:
        course = supabase.table('courses').select('application_link').eq('id', course_id).eq('is_published', True).eq(
            'is_active', True).single().execute().data

        if not course or not course.get('application_link'):
            flash('This course is not currently available for enrollment', 'danger')
            return redirect(url_for('course_detail', course_id=course_id))

        # Add to bookmarks
        supabase.table('bookmarks').insert({
            'user_id': session['user_id'],
            'item_type': 'course',
            'item_id': course_id
        }).execute()

        return redirect(course['application_link'])

    except Exception as e:
        logger.error(f"Enrollment error: {str(e)}")
        flash('Failed to enroll in course', 'danger')
        return redirect(url_for('course_detail', course_id=course_id))


@app.route('/jobs')
def jobs():
    search = request.args.get('search', '')
    location = request.args.get('location', '')
    job_type = request.args.get('type', '')

    try:
        query = supabase.table('jobs').select('*').eq('is_active', True)
        if search:
            query = query.ilike('title', f'%{search}%')
        if location:
            query = query.ilike('location', f'%{location}%')
        if job_type:
            query = query.eq('type', job_type)
        jobs = query.order('created_at', desc=True).execute().data or []
    except Exception as e:
        logger.error(f"Error loading jobs: {str(e)}")
        jobs = []

    return render_template('jobs.html',
                           jobs=jobs,
                           search=search,
                           location=location,
                           job_type=job_type)


@app.route('/jobs/<job_id>/apply')
@login_required
def apply_job(job_id):
    try:
        job = supabase.table('jobs').select('application_link').eq('id', job_id).eq('is_active',
                                                                                    True).single().execute().data

        if not job or not job.get('application_link'):
            flash('Application link not available', 'danger')
            return redirect(url_for('jobs'))

        # Add to bookmarks
        supabase.table('bookmarks').insert({
            'user_id': session['user_id'],
            'item_type': 'job',
            'item_id': job_id
        }).execute()

        return redirect(job['application_link'])

    except Exception as e:
        logger.error(f"Job application error: {str(e)}")
        flash('Failed to apply for job', 'danger')
        return redirect(url_for('jobs'))


@app.route('/internships')
def internships():
    search = request.args.get('search', '')
    location = request.args.get('location', '')
    internship_type = request.args.get('type', '')

    try:
        query = supabase.table('internships').select('*').eq('is_active', True)
        if search:
            query = query.ilike('title', f'%{search}%')
        if location:
            query = query.ilike('location', f'%{location}%')
        if internship_type:
            query = query.eq('type', internship_type)
        internships = query.order('created_at', desc=True).execute().data or []
    except Exception as e:
        logger.error(f"Error loading internships: {str(e)}")
        internships = []

    return render_template('internships.html',
                           internships=internships,
                           search=search,
                           location=location,
                           internship_type=internship_type)


@app.route('/internships/<internship_id>/apply')
@login_required
def apply_internship(internship_id):
    try:
        internship = supabase.table('internships').select('application_link').eq('id', internship_id).eq('is_active',
                                                                                                         True).single().execute().data

        if not internship or not internship.get('application_link'):
            flash('Application link not available', 'danger')
            return redirect(url_for('internships'))

        # Add to bookmarks
        supabase.table('bookmarks').insert({
            'user_id': session['user_id'],
            'item_type': 'internship',
            'item_id': internship_id
        }).execute()

        return redirect(internship['application_link'])

    except Exception as e:
        logger.error(f"Internship application error: {str(e)}")
        flash('Failed to apply for internship', 'danger')
        return redirect(url_for('internships'))


@app.route('/blog')
def blog():
    try:
        posts = supabase.table('blog_posts').select('*').eq('is_published', True).eq('is_active', True).order(
            'published_at', desc=True).execute().data or []
    except Exception as e:
        logger.error(f"Error loading blog posts: {str(e)}")
        posts = []

    return render_template('blogs.html', posts=posts)


# ===== BOOKMARK ENDPOINT FIX =====
@app.route('/api/bookmark/<content_type>/<content_id>', methods=['POST'])
@login_required
def bookmark_content(content_type, content_id):
    try:
        valid_types = ['course', 'job', 'internship', 'blog']
        if content_type not in valid_types:
            return jsonify({'error': 'Invalid content type'}), 400

        # Check if user is logged in (should be handled by @login_required, but double-check)
        if 'user_id' not in session:
            return jsonify({'error': 'Please login to bookmark items'}), 401

        # Use regular client (respects RLS)
        table_map = {
            'course': 'courses',
            'job': 'jobs',
            'internship': 'internships',
            'blog': 'blog_posts'
        }

        # Check if content exists - handle potential errors
        try:
            content_response = supabase.table(table_map[content_type]).select('id').eq('id',
                                                                                       content_id).maybe_single().execute()
            if not content_response.data:
                return jsonify({'error': 'Content not found'}), 404
        except Exception as e:
            logger.error(f"Error checking content existence: {str(e)}")
            return jsonify({'error': 'Content not found'}), 404

        # Check if already bookmarked
        try:
            existing_response = supabase.table('bookmarks').select('id') \
                .eq('user_id', session['user_id']) \
                .eq('item_type', content_type) \
                .eq('item_id', content_id) \
                .maybe_single().execute()
        except Exception as e:
            logger.error(f"Error checking existing bookmark: {str(e)}")
            return jsonify({'error': 'Failed to check bookmark status'}), 500

        if existing_response.data:
            # Remove bookmark
            try:
                delete_response = supabase.table('bookmarks').delete() \
                    .eq('id', existing_response.data['id']) \
                    .execute()

                if delete_response.data:
                    return jsonify({
                        'status': 'removed',
                        'message': 'Bookmark removed successfully'
                    })
                else:
                    return jsonify({'error': 'Failed to remove bookmark'}), 500
            except Exception as e:
                logger.error(f"Error removing bookmark: {str(e)}")
                return jsonify({'error': 'Failed to remove bookmark'}), 500
        else:
            # Add bookmark
            try:
                insert_response = supabase.table('bookmarks').insert({
                    'user_id': session['user_id'],
                    'item_type': content_type,
                    'item_id': content_id,
                    'created_at': get_current_time().isoformat()
                }).execute()

                if insert_response.data:
                    return jsonify({
                        'status': 'added',
                        'message': 'Bookmark added successfully'
                    })
                else:
                    return jsonify({'error': 'Failed to add bookmark'}), 500
            except Exception as e:
                logger.error(f"Error adding bookmark: {str(e)}")
                return jsonify({'error': 'Failed to add bookmark'}), 500

    except Exception as e:
        logger.error(f"Bookmark error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to update bookmark'}), 500


# Helper function to get bookmark count
def get_bookmark_count(content_type, content_id):
    try:
        count_response = supabase.table('bookmarks').select('id', count='exact') \
            .eq('item_type', content_type) \
            .eq('item_id', content_id) \
            .execute()
        return count_response.count or 0
    except Exception as e:
        logger.error(f"Error getting bookmark count: {str(e)}")
        return 0

# ===== APPLICATION LINK ENDPOINT FIX =====
@app.route('/get-application-link/<content_type>/<content_id>')
def get_application_link(content_type, content_id):
    try:
        # Validate content type
        if content_type not in ['course', 'job', 'internship']:
            return jsonify({'error': 'Invalid content type'}), 400

        # Validate content ID
        if not content_id or content_id == 'null':
            return jsonify({'error': 'Invalid content ID'}), 400

        if content_type == 'course':
            item_response = supabase.table('courses').select('application_link').eq('id', content_id).single().execute()
        elif content_type == 'job':
            item_response = supabase.table('jobs').select('application_link').eq('id', content_id).single().execute()
        elif content_type == 'internship':
            item_response = supabase.table('internships').select('application_link').eq('id', content_id).single().execute()

        if not item_response.data or not item_response.data.get('application_link'):
            return jsonify({'error': 'Application link not available'}), 404

        # Track application in database only if user is logged in
        if 'user_id' in session:
            try:
                supabase.table('bookmarks').insert({
                    'user_id': session['user_id'],
                    'item_type': content_type,
                    'item_id': content_id
                }).execute()
            except Exception as e:
                logger.warning(f"Could not add bookmark for tracking: {str(e)}")
                # Continue even if bookmarking fails

        return jsonify({'application_link': item_response.data['application_link']})

    except Exception as e:
        logger.error(f"Error getting application link: {str(e)}")
        return jsonify({'error': 'Failed to get application link'}), 500

# Share Route
@app.route('/share/<content_type>/<content_id>')
def share_content(content_type, content_id):
    try:
        table_map = {
            'course': ('courses', 'title', 'description'),
            'job': ('jobs', 'title', 'company'),
            'internship': ('internships', 'title', 'company'),
            'blog': ('blog_posts', 'title', 'description')
        }

        if content_type not in table_map:
            flash('Invalid content type', 'danger')
            return redirect(url_for('index'))

        table, title_field, desc_field = table_map[content_type]

        content = supabase.table(table).select(f'id, {title_field}, {desc_field}, application_link') \
            .eq('id', content_id).single().execute().data

        if not content:
            flash('Content not found', 'danger')
            return redirect(url_for(f'{content_type}s'))

        share_url = request.host_url.rstrip('/') + url_for(
            f'apply_{content_type}' if content_type != 'blog' else 'blog_detail',
            **{f'{content_type}_id': content_id})

        # Social share links
        social_links = {
            'facebook': f'https://www.facebook.com/sharer/sharer.php?u={share_url}',
            'twitter': f'https://twitter.com/intent/tweet?text={content[title_field]}&url={share_url}',
            'linkedin': f'https://www.linkedin.com/sharing/share-offsite/?url={share_url}',
            'whatsapp': f'https://wa.me/?text={content[title_field]} - {share_url}'
        }

        return render_template('share.html',
                               content_type=content_type,
                               content_id=content_id,
                               title=content[title_field],
                               description=content[desc_field],
                               share_url=share_url,
                               social_links=social_links,
                               direct_link=content.get('application_link', share_url))

    except Exception as e:
        logger.error(f"Share error: {str(e)}")
        flash('Failed to generate share link', 'danger')
        return redirect(url_for(f'{content_type}s'))

# Contact and newsletter subscribe routes
@app.route('/api/contact', methods=['POST'])
def contact():
    try:
        # Get form data
        data = request.form.to_dict()
        required_fields = ['name', 'email', 'subject', 'message']

        if not all(data.get(field) for field in required_fields):
            return jsonify({'status': 'error', 'message': 'All fields are required'}), 400

        # Save message to database
        message_data = {
            'name': data['name'],
            'email': data['email'],
            'subject': data['subject'],
            'message': data['message'],
            'created_at': get_current_time().isoformat(),
            'updated_at': get_current_time().isoformat()
        }

        response = supabase.table('contact_messages').insert(message_data).execute()

        if not response.data:
            raise Exception('Failed to save message')

        # Create notification
        notification_data = {
            'type': 'message',
            'title': 'New Contact Message',
            'message': f'New message from {data["name"]} ({data["email"]}) about {data["subject"]}',
            'related_id': response.data[0]['id'],
            'created_at': get_current_time().isoformat()
        }
        supabase.table('admin_notifications').insert(notification_data).execute()

        return jsonify({
            'status': 'success',
            'message': 'Your message has been sent successfully!'
        })

    except Exception as e:
        logger.error(f"Contact form error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to send message. Please try again.'
        }), 500


# Subscribe
# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============== EMAIL HELPERS ===============
def send_newsletter_welcome(email):
    """Send welcome email"""
    try:
        subject = "Welcome to CareerMaker Newsletter"
        message = f"""Hello,

Thank you for subscribing to the CareerMaker Newsletter! 🎉

You'll now receive updates on:
- New courses
- Jobs and internships
- Tech blogs & news
- Exclusive content for subscribers

If this wasn't you, you can unsubscribe anytime.

Best regards,  
CareerMaker Team
"""
        return send_email_smtp(email, subject, message)
    except Exception as e:
        logger.error(f"❌ Failed to send welcome email to {email}: {str(e)}")
        return False

def send_newsletter_goodbye(email):
    """Send goodbye email"""
    try:
        subject = "You've unsubscribed from CareerMaker Newsletter"
        message = f"""Hello,

We're sorry to see you go! You have been unsubscribed from the CareerMaker Newsletter.

If this was a mistake, you can subscribe again anytime on our website.

Thank you for being with us,  
CareerMaker Team
"""
        return send_email_smtp(email, subject, message)
    except Exception as e:
        logger.error(f"❌ Failed to send goodbye email to {email}: {str(e)}")
        return False

# =============== ROUTES ===============

@app.route('/api/subscribe', methods=['POST'])
def subscribe_newsletter():
    email = None
    try:
        # Extract email
        if request.is_json:
            data = request.get_json(silent=True) or {}
            email = data.get("email")
        else:
            email = request.form.get("email")

        # Validate email
        if not email or "@" not in email:
            return jsonify({"status": "error", "message": "Please provide a valid email address"}), 400

        # Check if subscriber exists
        existing = supabase_admin.table("newsletter_subscribers") \
            .select("email", "is_active") \
            .eq("email", email) \
            .maybe_single().execute()

        if existing and existing.data:
            if existing.data.get("is_active", True):
                return jsonify({"status": "success", "message": "You are already subscribed!"})
            else:
                # Reactivate subscription
                supabase_admin.table("newsletter_subscribers") \
                    .update({"is_active": True, "unsubscribed_at": None}) \
                    .eq("email", email).execute()

                send_newsletter_welcome(email)
                return jsonify({"status": "success", "message": "Welcome back! Subscription reactivated."})

        # Insert new subscriber
        subscriber_data = {
            "email": email,
            "subscribed_at": get_current_time().isoformat(),
            "is_active": True
        }
        supabase_admin.table("newsletter_subscribers").insert(subscriber_data).execute()

        send_newsletter_welcome(email)
        return jsonify({"status": "success", "message": "Thank you for subscribing to our newsletter!"})

    except Exception as e:
        if "duplicate key value violates unique constraint" in str(e):
            return jsonify({"status": "success", "message": "You are already subscribed!"})
        logger.error(f"❌ Newsletter subscription error for {email}: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Failed to subscribe. Please try again."}), 500

@app.route('/api/unsubscribe', methods=['POST'])
def unsubscribe_newsletter():
    email = None
    try:
        # Extract email
        if request.is_json:
            data = request.get_json(silent=True) or {}
            email = data.get("email")
        else:
            email = request.form.get("email")

        # Validate email
        if not email or "@" not in email:
            return jsonify({"status": "error", "message": "Please provide a valid email address"}), 400

        # Check if subscriber exists
        existing = supabase_admin.table("newsletter_subscribers") \
            .select("email", "is_active") \
            .eq("email", email) \
            .maybe_single().execute()

        if not existing or not existing.data:
            return jsonify({"status": "error", "message": "Email not found in our subscription list"}), 404

        if not existing.data.get("is_active", True):
            return jsonify({"status": "success", "message": "You are already unsubscribed."})

        # Mark as unsubscribed
        supabase_admin.table("newsletter_subscribers") \
            .update({"is_active": False, "unsubscribed_at": get_current_time().isoformat()}) \
            .eq("email", email).execute()

        send_newsletter_goodbye(email)
        return jsonify({"status": "success", "message": "You have been unsubscribed from the newsletter."})

    except Exception as e:
        logger.error(f"❌ Newsletter unsubscribe error for {email}: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Failed to unsubscribe. Please try again."}), 500


# ===== ADMIN ROUTES =====

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'GET':
        if session.get('admin_logged_in'):
            return redirect(url_for('admin_dashboard'))
        return render_template('admin/admin-login.html')

    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')

    if not username or not password:
        flash('Both username and password are required', 'danger')
        return render_template('admin/admin-login.html')

    try:
        # Use admin client to check admin credentials (bypasses RLS)
        response = supabase_admin.table('admins') \
            .select('*') \
            .eq('username', username) \
            .maybe_single() \
            .execute()

        if not response.data:
            flash('Invalid credentials', 'danger')
            return render_template('admin/admin-login.html')

        admin = response.data

        if not verify_password(admin['password_hash'], password):
            flash('Invalid credentials', 'danger')
            return render_template('admin/admin-login.html')

        session.update({
            'admin_id': str(admin['id']),
            'admin_username': admin['username'],
            'admin_email': admin.get('email', ''),
            'is_superadmin': bool(admin.get('is_superadmin', False)),
            'admin_logged_in': True
        })

        return redirect(url_for('admin_dashboard'))

    except Exception as e:
        print(f"ADMIN LOGIN ERROR: {str(e)}")
        flash('An error occurred. Please try again.', 'danger')
        return render_template('admin/admin-login.html')


@app.route('/admin/logout')
def admin_logout():
    session.pop('admin_id', None)
    session.pop('admin_username', None)
    session.pop('admin_email', None)
    session.pop('is_superadmin', None)
    session.pop('admin_logged_in', None)
    flash('Logged out successfully', 'success')
    return redirect(url_for('admin_login'))


@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    try:
        if not session.get('admin_logged_in'):
            flash('Please login to access the dashboard', 'warning')
            return redirect(url_for('admin_login'))

        # Check if it's an AJAX request for data only
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            # Return JSON data for AJAX requests
            return admin_dashboard_stats()

        # Get statistics using admin client (bypasses RLS)
        with ThreadPoolExecutor() as executor:
            users_future = executor.submit(
                supabase_admin.table('users').select('id', count='exact').execute
            )
            courses_future = executor.submit(
                supabase_admin.table('courses').select('id', count='exact').eq('is_active', True).execute
            )
            jobs_future = executor.submit(
                supabase_admin.table('jobs').select('id', count='exact').eq('is_active', True).execute
            )
            internships_future = executor.submit(
                supabase_admin.table('internships').select('id', count='exact').eq('is_active', True).execute
            )
            messages_future = executor.submit(
                supabase_admin.table('contact_messages').select('id', count='exact').execute
            )
            unread_future = executor.submit(
                supabase_admin.table('contact_messages').select('id', count='exact').eq('status', 'unread').execute
            )
            subscribers_future = executor.submit(
                supabase_admin.table('newsletter_subscribers').select('id', count='exact').eq('is_active', True).execute
            )

            stats = {
                'users': users_future.result().count or 0,
                'courses': courses_future.result().count or 0,
                'jobs': jobs_future.result().count or 0,
                'internships': internships_future.result().count or 0,
                'messages': messages_future.result().count or 0,
                'unread_messages': unread_future.result().count or 0,
                'subscribers': subscribers_future.result().count or 0
            }

        # Get recent activities using admin client
        recent_messages = supabase_admin.table('contact_messages') \
                              .select('id, name, email, created_at') \
                              .order('created_at', desc=True) \
                              .limit(5) \
                              .execute().data or []

        recent_users = supabase_admin.table('users') \
                           .select('id, email, username, created_at') \
                           .order('created_at', desc=True) \
                           .limit(5) \
                           .execute().data or []

        activities = []
        for msg in recent_messages:
            activities.append({
                'icon': 'envelope',
                'message': f"New message from {msg['name']}",
                'timestamp': parse_db_timestamp(msg['created_at'])
            })

        for user in recent_users:
            activities.append({
                'icon': 'user-plus',
                'message': f"New user registered: {user['username']}",
                'timestamp': parse_db_timestamp(user['created_at'])
            })

        activities.sort(key=lambda x: x['timestamp'], reverse=True)

        return render_template(
            'admin/admin-dashboard.html',
            stats=stats,
            recent_activities=activities[:5],
            admin_name=session.get('admin_username', 'Admin')
        )

    except Exception as e:
        print(f"Dashboard error: {str(e)}")
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'error': str(e)}), 500
        else:
            flash('Failed to load dashboard data. Please try again.', 'danger')
            return redirect(url_for('admin_login'))

# Add this new endpoint for dashboard stats
@app.route('/api/admin/dashboard-stats')
@admin_required
def admin_dashboard_stats():
    try:
        # Get statistics using admin client (bypasses RLS)
        with ThreadPoolExecutor() as executor:
            users_future = executor.submit(
                supabase_admin.table('users').select('id', count='exact').execute
            )
            courses_future = executor.submit(
                supabase_admin.table('courses').select('id', count='exact').eq('is_active', True).execute
            )
            jobs_future = executor.submit(
                supabase_admin.table('jobs').select('id', count='exact').eq('is_active', True).execute
            )
            internships_future = executor.submit(
                supabase_admin.table('internships').select('id', count='exact').eq('is_active', True).execute
            )
            messages_future = executor.submit(
                supabase_admin.table('contact_messages').select('id', count='exact').execute
            )
            unread_future = executor.submit(
                supabase_admin.table('contact_messages').select('id', count='exact').eq('status', 'unread').execute
            )
            subscribers_future = executor.submit(
                supabase_admin.table('newsletter_subscribers').select('id', count='exact').eq('is_active', True).execute
            )

            stats = {
                'users': users_future.result().count or 0,
                'courses': courses_future.result().count or 0,
                'jobs': jobs_future.result().count or 0,
                'internships': internships_future.result().count or 0,
                'messages': messages_future.result().count or 0,
                'unread_messages': unread_future.result().count or 0,
                'subscribers': subscribers_future.result().count or 0
            }

        return jsonify(stats)
    except Exception as e:
        logger.error(f"Error loading dashboard stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== ADMIN DATA FETCHING ROUTES =====

@app.route('/api/admin/courses')
@admin_required
def admin_courses():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        category_filter = request.args.get('category', '')

        # Use admin client (bypasses RLS)
        query = supabase_admin.table('courses').select('*')

        if search:
            query = query.ilike('title', f'%{search}%')

        if category_filter:
            query = query.eq('category', category_filter)

        query = query.order('created_at', desc=True)

        # Get paginated data
        courses = query.range((page - 1) * per_page, page * per_page - 1).execute()

        # Get total count
        count_query = supabase_admin.table('courses').select('id', count='exact')
        if search:
            count_query = count_query.ilike('title', f'%{search}%')
        if category_filter:
            count_query = count_query.eq('category', category_filter)

        total_count = count_query.execute().count

        return jsonify({
            'data': courses.data,
            'count': total_count,
            'per_page': per_page
        })
    except Exception as e:
        print(f"Error loading courses: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/jobs')
@admin_required
def admin_jobs():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        type_filter = request.args.get('type', '')

        # Use admin client (bypasses RLS)
        query = supabase_admin.table('jobs').select('*')

        if search:
            query = query.ilike('title', f'%{search}%')

        if type_filter:
            query = query.eq('type', type_filter)

        query = query.order('created_at', desc=True)

        # Get paginated data
        jobs = query.range((page - 1) * per_page, page * per_page - 1).execute()

        # Get total count
        count_query = supabase_admin.table('jobs').select('id', count='exact')
        if search:
            count_query = count_query.ilike('title', f'%{search}%')
        if type_filter:
            count_query = count_query.eq('type', type_filter)

        total_count = count_query.execute().count

        return jsonify({
            'data': jobs.data,
            'count': total_count,
            'per_page': per_page
        })
    except Exception as e:
        print(f"Error loading jobs: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/internships')
@admin_required
def admin_internships():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        type_filter = request.args.get('type', '')

        # Use admin client (bypasses RLS)
        query = supabase_admin.table('internships').select('*')

        if search:
            query = query.ilike('title', f'%{search}%')

        if type_filter:
            query = query.eq('type', type_filter)

        query = query.order('created_at', desc=True)

        # Get paginated data
        internships = query.range((page - 1) * per_page, page * per_page - 1).execute()

        # Get total count
        count_query = supabase_admin.table('internships').select('id', count='exact')
        if search:
            count_query = count_query.ilike('title', f'%{search}%')
        if type_filter:
            count_query = count_query.eq('type', type_filter)

        total_count = count_query.execute().count

        return jsonify({
            'data': internships.data,
            'count': total_count,
            'per_page': per_page
        })
    except Exception as e:
        print(f"Error loading internships: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/blog')
@admin_required
def admin_blog():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        category_filter = request.args.get('category', '')

        # Use admin client (bypasses RLS)
        query = supabase_admin.table('blog_posts').select('*')

        if search:
            query = query.ilike('title', f'%{search}%')

        if category_filter:
            query = query.ilike('categories', f'%{category_filter}%')

        query = query.order('created_at', desc=True)

        # Get paginated data
        posts = query.range((page - 1) * per_page, page * per_page - 1).execute()

        # Get total count
        count_query = supabase_admin.table('blog_posts').select('id', count='exact')
        if search:
            count_query = count_query.ilike('title', f'%{search}%')
        if category_filter:
            count_query = count_query.ilike('categories', f'%{category_filter}%')

        total_count = count_query.execute().count

        return jsonify({
            'data': posts.data,
            'count': total_count,
            'per_page': per_page
        })
    except Exception as e:
        print(f"Error loading blog posts: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users')
@admin_required
def admin_users():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        role_filter = request.args.get('role', '')

        # Use admin client (bypasses RLS)
        query = supabase_admin.table('users').select('*')

        if search:
            query = query.ilike('username', f'%{search}%')

        if role_filter:
            query = query.eq('role', role_filter)

        query = query.order('created_at', desc=True)

        # Get paginated data
        users = query.range((page - 1) * per_page, page * per_page - 1).execute()

        # Get total count
        count_query = supabase_admin.table('users').select('id', count='exact')
        if search:
            count_query = count_query.ilike('username', f'%{search}%')
        if role_filter:
            count_query = count_query.eq('role', role_filter)

        total_count = count_query.execute().count

        return jsonify({
            'data': users.data,
            'count': total_count,
            'per_page': per_page
        })
    except Exception as e:
        print(f"Error loading users: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/messages')
@admin_required
def admin_messages():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        status_filter = request.args.get('status', '')

        # Use admin client (bypasses RLS)
        query = supabase_admin.table('contact_messages').select('*')

        if search:
            query = query.ilike('name', f'%{search}%')

        if status_filter:
            query = query.eq('status', status_filter)

        query = query.order('created_at', desc=True)

        # Get paginated data
        messages = query.range((page - 1) * per_page, page * per_page - 1).execute()

        # Get total count
        count_query = supabase_admin.table('contact_messages').select('id', count='exact')
        if search:
            count_query = count_query.ilike('name', f'%{search}%')
        if status_filter:
            count_query = count_query.eq('status', status_filter)

        total_count = count_query.execute().count

        return jsonify({
            'data': messages.data,
            'count': total_count,
            'per_page': per_page
        })
    except Exception as e:
        print(f"Error loading messages: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/newsletter')
@admin_required
def admin_newsletter():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        status_filter = request.args.get('status', '')

        # Use admin client (bypasses RLS)
        query = supabase_admin.table('newsletter_subscribers').select('*')

        if search:
            query = query.ilike('email', f'%{search}%')

        if status_filter:
            if status_filter == 'active':
                query = query.eq('is_active', True)
            elif status_filter == 'inactive':
                query = query.eq('is_active', False)

        query = query.order('subscribed_at', desc=True)

        # Get paginated data
        subscribers = query.range((page - 1) * per_page, page * per_page - 1).execute()

        # Get total count
        count_query = supabase_admin.table('newsletter_subscribers').select('id', count='exact')
        if search:
            count_query = count_query.ilike('email', f'%{search}%')
        if status_filter:
            if status_filter == 'active':
                count_query = count_query.eq('is_active', True)
            elif status_filter == 'inactive':
                count_query = count_query.eq('is_active', False)

        total_count = count_query.execute().count

        return jsonify({
            'data': subscribers.data,
            'count': total_count,
            'per_page': per_page
        })
    except Exception as e:
        print(f"Error loading newsletter subscribers: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== COURSES CRUD ROUTES =====

@app.route('/api/admin/courses/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@admin_required
def manage_course(id):
    try:
        if request.method == 'GET':
            # Use admin client (bypasses RLS)
            course = supabase_admin.table('courses').select('*').eq('id', id).single().execute().data
            if not course:
                return jsonify({'error': 'Course not found'}), 404
            return jsonify(course)

        elif request.method == 'PUT':
            data = request.get_json()

            # Update course fields using admin client
            update_data = {}
            for field in ['title', 'description', 'category', 'price', 'duration', 'level', 'application_link',
                          'is_published', 'is_featured', 'is_active']:
                if field in data:
                    update_data[field] = data[field]

            if update_data:
                update_data['updated_at'] = get_current_time().isoformat()
                supabase_admin.table('courses').update(update_data).eq('id', id).execute()

            return jsonify({'success': True, 'message': 'Course updated'})

        elif request.method == 'DELETE':
            supabase_admin.table('courses').update({'is_active': False}).eq('id', id).execute()
            return jsonify({'success': True, 'message': 'Course deleted'})

    except Exception as e:
        logger.error(f"Error managing course: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/courses', methods=['POST'])
@admin_required
def create_course():
    try:
        data = request.get_json()

        course_data = {
            'title': data['title'],
            'description': data['description'],
            'category': data['category'],
            'price': data['price'],
            'duration': data.get('duration'),
            'level': data.get('level', 'beginner'),
            'application_link': data.get('application_link'),
            'is_published': data.get('is_published', True),  # Published by default
            'is_featured': data.get('is_featured', False),
            'is_active': data.get('is_active', True),  # Active by default
            'created_at': get_current_time().isoformat(),
            'updated_at': get_current_time().isoformat()
        }

        # Use admin client (bypasses RLS)
        response = supabase_admin.table('courses').insert(course_data).execute()

        # Try to fetch logo after creation
        if response.data and data.get('application_link'):
            course_id = response.data[0]['id']
            logo_url = get_company_logo(data['application_link'], 'course', course_id)
            if logo_url:
                supabase_admin.table('courses').update({'image': logo_url}).eq('id', course_id).execute()

        return jsonify(
            {'success': True, 'message': 'Course created', 'data': response.data[0] if response.data else None})
    except Exception as e:
        logger.error(f"Error creating course: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== JOBS CRUD ROUTES =====

@app.route('/api/admin/jobs/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@admin_required
def manage_job(id):
    try:
        if request.method == 'GET':
            # Use admin client (bypasses RLS)
            job = supabase_admin.table('jobs').select('*').eq('id', id).single().execute().data
            if not job:
                return jsonify({'error': 'Job not found'}), 404
            return jsonify(job)

        elif request.method == 'PUT':
            data = request.get_json()

            # Update job fields using admin client
            update_data = {}
            for field in ['title', 'company', 'location', 'description', 'salary', 'type', 'application_link',
                          'is_active', 'is_featured', 'is_remote']:
                if field in data:
                    update_data[field] = data[field]

            if update_data:
                update_data['updated_at'] = get_current_time().isoformat()
                supabase_admin.table('jobs').update(update_data).eq('id', id).execute()

            return jsonify({'success': True, 'message': 'Job updated'})

        elif request.method == 'DELETE':
            supabase_admin.table('jobs').update({'is_active': False}).eq('id', id).execute()
            return jsonify({'success': True, 'message': 'Job deleted'})

    except Exception as e:
        logger.error(f"Error managing job: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/jobs', methods=['POST'])
@admin_required
def create_job():
    try:
        data = request.get_json()

        job_data = {
            'title': data['title'],
            'company': data['company'],
            'location': data['location'],
            'description': data['description'],
            'salary': data.get('salary'),
            'type': data.get('type'),
            'application_link': data['application_link'],
            'is_active': data.get('is_active', True),  # Active by default
            'is_featured': data.get('is_featured', False),
            'is_remote': data.get('is_remote', False),
            'created_at': get_current_time().isoformat(),
            'updated_at': get_current_time().isoformat()
        }

        # Use admin client (bypasses RLS)
        response = supabase_admin.table('jobs').insert(job_data).execute()

        # Try to fetch logo after creation
        if response.data and data.get('application_link'):
            job_id = response.data[0]['id']
            logo_url = get_company_logo(data['application_link'], 'job', job_id)
            if logo_url:
                supabase_admin.table('jobs').update({'image': logo_url}).eq('id', job_id).execute()

        return jsonify({'success': True, 'message': 'Job created', 'data': response.data[0] if response.data else None})
    except Exception as e:
        logger.error(f"Error creating job: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== INTERNSHIPS CRUD ROUTES =====

@app.route('/api/admin/internships/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@admin_required
def manage_internship(id):
    try:
        if request.method == 'GET':
            # Use admin client (bypasses RLS)
            internship = supabase_admin.table('internships').select('*').eq('id', id).single().execute().data
            if not internship:
                return jsonify({'error': 'Internship not found'}), 404
            return jsonify(internship)

        elif request.method == 'PUT':
            data = request.get_json()

            # Update internship fields using admin client
            update_data = {}
            for field in ['title', 'company', 'location', 'description', 'duration', 'stipend', 'type',
                          'application_link', 'is_active', 'is_featured', 'is_paid', 'is_remote']:
                if field in data:
                    update_data[field] = data[field]

            if update_data:
                update_data['updated_at'] = get_current_time().isoformat()
                supabase_admin.table('internships').update(update_data).eq('id', id).execute()

            return jsonify({'success': True, 'message': 'Internship updated'})

        elif request.method == 'DELETE':
            supabase_admin.table('internships').update({'is_active': False}).eq('id', id).execute()
            return jsonify({'success': True, 'message': 'Internship deleted'})

    except Exception as e:
        logger.error(f"Error managing internship: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/internships', methods=['POST'])
@admin_required
def create_internship():
    try:
        data = request.get_json()

        internship_data = {
            'title': data['title'],
            'company': data['company'],
            'location': data.get('location'),
            'description': data['description'],
            'duration': data['duration'],
            'stipend': data.get('stipend'),
            'type': data.get('type'),
            'application_link': data['application_link'],
            'is_paid': data.get('is_paid', False),
            'is_remote': data.get('is_remote', False),
            'is_active': data.get('is_active', True),  # Active by default
            'is_featured': data.get('is_featured', False),
            'created_at': get_current_time().isoformat(),
            'updated_at': get_current_time().isoformat()
        }

        # Use admin client (bypasses RLS)
        response = supabase_admin.table('internships').insert(internship_data).execute()

        # Try to fetch logo after creation
        if response.data and data.get('application_link'):
            internship_id = response.data[0]['id']
            logo_url = get_company_logo(data['application_link'], 'internship', internship_id)
            if logo_url:
                supabase_admin.table('internships').update({'image': logo_url}).eq('id', internship_id).execute()

        return jsonify(
            {'success': True, 'message': 'Internship created', 'data': response.data[0] if response.data else None})
    except Exception as e:
        logger.error(f"Error creating internship: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== BLOG POSTS CRUD ROUTES =====

@app.route('/api/admin/blog/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@admin_required
def manage_blog_post(id):
    try:
        if request.method == 'GET':
            # Use admin client (bypasses RLS)
            post = supabase_admin.table('blog_posts').select('*').eq('id', id).single().execute().data
            if not post:
                return jsonify({'error': 'Blog post not found'}), 404
            return jsonify(post)

        elif request.method == 'PUT':
            data = request.get_json()

            # Update blog post fields using admin client
            update_data = {}
            for field in ['title', 'content', 'description', 'author', 'categories', 'is_published', 'is_featured',
                          'is_active']:
                if field in data:
                    update_data[field] = data[field]

            if update_data:
                update_data['updated_at'] = get_current_time().isoformat()
                supabase_admin.table('blog_posts').update(update_data).eq('id', id).execute()

            return jsonify({'success': True, 'message': 'Blog post updated'})

        elif request.method == 'DELETE':
            supabase_admin.table('blog_posts').update({'is_active': False}).eq('id', id).execute()
            return jsonify({'success': True, 'message': 'Blog post deleted'})

    except Exception as e:
        logger.error(f"Error managing blog post: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/blog', methods=['POST'])
@admin_required
def create_blog_post():
    try:
        data = request.get_json()

        blog_data = {
            'title': data['title'],
            'content': data['content'],
            'description': data.get('description'),
            'author': data['author'],
            'categories': data.get('categories'),
            'is_published': data.get('is_published', True),  # Published by default
            'is_featured': data.get('is_featured', False),
            'is_active': data.get('is_active', True),  # Active by default
            'published_at': get_current_time().isoformat() if data.get('is_published', True) else None,
            'created_at': get_current_time().isoformat(),
            'updated_at': get_current_time().isoformat()
        }

        # Use admin client (bypasses RLS)
        response = supabase_admin.table('blog_posts').insert(blog_data).execute()

        return jsonify(
            {'success': True, 'message': 'Blog post created', 'data': response.data[0] if response.data else None})
    except Exception as e:
        logger.error(f"Error creating blog post: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== USERS CRUD ROUTES =====

@app.route('/api/admin/users/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@admin_required
def manage_user(id):
    try:
        if request.method == 'GET':
            # Use admin client (bypasses RLS)
            user = supabase_admin.table('users').select('*').eq('id', id).single().execute().data
            if not user:
                return jsonify({'error': 'User not found'}), 404
            return jsonify(user)

        elif request.method == 'PUT':
            data = request.get_json()

            # Update user fields using admin client
            update_data = {}
            for field in ['username', 'email', 'role', 'is_active', 'is_verified']:
                if field in data:
                    update_data[field] = data[field]

            if update_data:
                update_data['updated_at'] = get_current_time().isoformat()
                supabase_admin.table('users').update(update_data).eq('id', id).execute()

            return jsonify({'success': True, 'message': 'User updated'})

        elif request.method == 'DELETE':
            supabase_admin.table('users').update({'is_active': False}).eq('id', id).execute()
            return jsonify({'success': True, 'message': 'User deleted'})

    except Exception as e:
        logger.error(f"Error managing user: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ===== MESSAGES MANAGEMENT ROUTES =====

@app.route('/api/admin/messages/<int:id>/status', methods=['PUT'])
@admin_required
def update_message_status(id):
    try:
        data = request.get_json()

        if 'status' in data:
            # Use admin client (bypasses RLS)
            supabase_admin.table('contact_messages').update({'status': data['status']}).eq('id', id).execute()

        return jsonify({'success': True, 'message': 'Status updated'})
    except Exception as e:
        print(f"Error updating message status: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/messages/bulk', methods=['POST'])
@admin_required
def bulk_message_action():
    try:
        data = request.get_json()
        action = data.get('action')
        ids = data.get('ids', [])

        if not ids:
            return jsonify({'success': False, 'message': 'No messages selected'})

        # Use admin client (bypasses RLS)
        if action == 'mark_read':
            supabase_admin.table('contact_messages').update({'status': 'read'}).in_('id', ids).execute()
        elif action == 'mark_unread':
            supabase_admin.table('contact_messages').update({'status': 'unread'}).in_('id', ids).execute()
        elif action == 'mark_replied':
            supabase_admin.table('contact_messages').update({'status': 'replied'}).in_('id', ids).execute()
        elif action == 'delete':
            supabase_admin.table('contact_messages').update({'is_active': False}).in_('id', ids).execute()

        return jsonify({'success': True, 'message': 'Bulk action completed'})
    except Exception as e:
        logger.error(f"Bulk message action error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/messages/reply', methods=['POST'])
@admin_required
def reply_to_message():
    try:
        data = request.get_json()
        message_id = data.get('message_id')
        recipient_email = data.get('recipient_email')
        subject = data.get('subject')
        message_content = data.get('message')

        # Get the original message using admin client
        original_message = supabase_admin.table('contact_messages').select('*').eq('id',
                                                                                   message_id).single().execute().data

        if not original_message:
            return jsonify({'success': False, 'message': 'Message not found'})

        try:
            # Send email
            msg = f"""Subject: {subject}

{message_content}

---
This is a response to your message:
{original_message['message']}
"""

            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
                server.login(SMTP_EMAIL, SMTP_PASSWORD)
                server.sendmail(SMTP_EMAIL, recipient_email, msg)

            # Update message status using admin client
            supabase_admin.table('contact_messages').update({'status': 'replied'}).eq('id', message_id).execute()

            return jsonify({'success': True, 'message': 'Reply sent successfully'})
        except Exception as e:
            return jsonify({'success': False, 'message': f'Error sending email: {str(e)}'})

    except Exception as e:
        logger.error(f"Error replying to message: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to send reply'}), 500


# ===== NEWSLETTER MANAGEMENT ROUTES =====

@app.route('/api/admin/newsletter/bulk', methods=['POST'])
@admin_required
def bulk_newsletter_action():
    try:
        data = request.get_json()
        action = data.get('action')
        ids = data.get('ids', [])

        if not ids:
            return jsonify({'success': False, 'message': 'No subscribers selected'})

        # Use admin client (bypasses RLS)
        if action == 'activate':
            supabase_admin.table('newsletter_subscribers').update({'is_active': True, 'unsubscribed_at': None}).in_(
                'id', ids).execute()
        elif action == 'deactivate':
            supabase_admin.table('newsletter_subscribers').update(
                {'is_active': False, 'unsubscribed_at': get_current_time().isoformat()}).in_('id', ids).execute()
        elif action == 'delete':
            supabase_admin.table('newsletter_subscribers').delete().in_('id', ids).execute()

        return jsonify({'success': True, 'message': 'Bulk action completed'})
    except Exception as e:
        logger.error(f"Bulk newsletter action error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/newsletter/send', methods=['POST'])
@admin_required
def send_newsletter():
    try:
        data = request.get_json()
        subject = data.get('subject')
        content = data.get('content')
        recipients_type = data.get('recipients', 'all')
        test_mode = data.get('test_mode', False)

        # Get subscribers using admin client (bypasses RLS)
        if recipients_type == 'all':
            subscribers = supabase_admin.table('newsletter_subscribers').select('*').eq('is_active',
                                                                                        True).execute().data
        elif recipients_type == 'active':
            subscribers = supabase_admin.table('newsletter_subscribers').select('*').eq('is_active',
                                                                                        True).execute().data
        else:
            # For selected recipients, you would need to pass specific IDs
            subscriber_ids = data.get('subscriber_ids', [])
            if not subscriber_ids:
                return jsonify({'success': False, 'message': 'No subscribers selected'})

            subscribers = supabase_admin.table('newsletter_subscribers').select('*').in_('id', subscriber_ids).eq(
                'is_active', True).execute().data

        if test_mode:
            # Send test email to admin
            email_sent = send_email_smtp(
                session.get('admin_email', 'admin@careermaker.com'),
                f"[TEST] {subject}",
                content
            )

            if email_sent:
                return jsonify({'success': True, 'message': 'Test email sent successfully'})
            else:
                return jsonify({'success': False, 'message': 'Error sending test email'})
        else:
            # Send to all subscribers
            success_count = 0
            for subscriber in subscribers:
                email_sent = send_email_smtp(subscriber['email'], subject, content)
                if email_sent:
                    success_count += 1

            return jsonify({
                'success': True,
                'message': f'Newsletter sent to {success_count} out of {len(subscribers)} subscribers'
            })

    except Exception as e:
        logger.error(f"Error sending newsletter: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to send newsletter'}), 500


# ===== NOTIFICATION ROUTES =====

@app.route('/api/admin/notifications/count')
@admin_required
def notification_count():
    try:
        # Use admin client (bypasses RLS)
        unread_count = supabase_admin.table('admin_notifications').select('id', count='exact').eq('is_read',
                                                                                                  False).execute().count
        return jsonify({'count': unread_count})
    except Exception as e:
        logger.error(f"Error getting notification count: {str(e)}")
        return jsonify({'count': 0})


@app.route('/api/admin/notifications/stream')
@admin_required
def notification_stream():
    def event_stream():
        last_check = datetime.utcnow()
        while True:
            # Check for new notifications using admin client
            new_notifications = supabase_admin.table('admin_notifications').select('*') \
                .gt('created_at', last_check.isoformat()) \
                .eq('is_read', False) \
                .execute().data

            if new_notifications:
                for notification in new_notifications:
                    yield f"data: {json.dumps(notification)}\n\n"
                last_check = datetime.utcnow()

            # Sleep for 5 seconds
            import time
            time.sleep(5)

    return Response(event_stream(), mimetype='text/event-stream')


# ===== ADMIN REQUIRED DECORATOR =====
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)

    return decorated_function

# Error Handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template('404.html'), 404


@app.errorhandler(403)
def forbidden(e):
    return render_template('403.html'), 403


@app.errorhandler(500)
def internal_server_error(e):
    return render_template('500.html'), 500

if __name__ == '__main__':
    # Verify SMTP config
    logger.debug("SMTP Configuration Verification:")
    logger.debug(f"SMTP_EMAIL: {os.getenv('SMTP_EMAIL')}")
    logger.debug(f"SMTP_SERVER: {os.getenv('SMTP_SERVER')}")
    logger.debug(f"SMTP_PORT: {os.getenv('SMTP_PORT')}")

    required_env_vars = ['SUPABASE_URL', 'SUPABASE_KEY', 'SMTP_PASSWORD']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]

    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

    # make sure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        threaded=True,
        debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    )