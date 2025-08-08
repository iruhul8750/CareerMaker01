import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from fileinput import filename
from urllib.parse import urlparse
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, send_from_directory, make_response
from flask_wtf import file
from google.auth.transport import requests
from google_auth_oauthlib.flow import InstalledAppFlow
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from functools import wraps
from dotenv import load_dotenv
from supabase import create_client, Client
import uuid
import re
import json
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import base64
from email.mime.text import MIMEText
import hashlib
import binascii
import secrets
import smtplib
from email.message import EmailMessage
import logging
from io import BytesIO
from PIL import Image

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY') or secrets.token_hex(32)
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

# Initialize Supabase
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

# Configuration
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Email Configuration
OTP_EXPIRY_MINUTES = 5
SMTP_SERVER = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', 465))
SMTP_EMAIL = os.getenv('SMTP_EMAIL')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')

# Password Hashing Configuration
PBKDF2_ITERATIONS = 100000
HASH_NAME = "sha256"
SALT_LENGTH = 16
HASH_LENGTH = 64

# Ensure config directory exists
os.makedirs('config/credentials', exist_ok=True)

# Helper Functions
def get_current_time():
    return datetime.now(timezone.utc)

def parse_db_timestamp(timestamp_str):
    """Parse database timestamp and ensure it's timezone-aware"""
    dt = datetime.fromisoformat(timestamp_str)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def verify_password(stored_hash: str, password: str) -> bool:
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

def hash_password(password: str) -> str:
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

def send_otp_email(user_email, user_name, otp):
    """Send OTP email using SMTP with improved error handling"""
    try:
        # Create email message
        msg = EmailMessage()
        msg.set_content(f"""
        Hello {user_name},

        Your verification code is: {otp}

        This code will expire in {OTP_EXPIRY_MINUTES} minutes.
        """)

        msg['Subject'] = 'Your CareerMaker Verification Code'
        msg['From'] = SMTP_EMAIL
        msg['To'] = user_email

        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"OTP email sent successfully to {user_email}")
        return True

    except Exception as e:
        logger.error(f"SMTP Error: {str(e)}")
        logger.error(f"SMTP Configuration: Server={SMTP_SERVER}, Port={SMTP_PORT}, Username={SMTP_EMAIL}")
        return False


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

def save_file(file):
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        return unique_filename
    return None

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
                response = requests.head(logo_url, timeout=3)
                if response.status_code == 200:
                    # Store the logo URL in database if content_type and content_id provided
                    if content_type in table_map and content_id:
                        supabase.table(table_map[content_type]).update({'image': logo_url}).eq('id', content_id).execute()
                    return logo_url
            except:
                continue

    except Exception as e:
        logger.error(f"Error getting company logo: {str(e)}")
    return None


def get_profile_pic_url(filename):
    if not filename:
        return None
    try:
        # Get signed URL that's valid for 1 hour
        res = supabase.storage.from_('profile-pics').create_signed_url(filename, 3600)
        return res.signed_url
    except Exception as e:
        logger.error(f"Error getting profile pic URL: {str(e)}")
        return None


# initialization code near your Supabase client setup
def initialize_storage():
    try:
        buckets = supabase.storage.list_buckets()
        if not any(b.name == 'profile-pics' for b in buckets):
            supabase.storage.create_bucket(
                'profile-pics',
                options={
                    'public': True,
                    'allowed_mime_types': ['image/png', 'image/jpeg', 'image/gif'],
                    'file_size_limit': '2MB'
                }
            )
    except Exception as e:
        logger.error(f"Storage init error: {str(e)}")

# ======================
# Authentication Routes
# ======================
@app.route('/')
def index():
    try:
        logged_in = 'user_id' in session
        username = session.get('username') if logged_in else None

        # Fetch featured content from database
        courses = supabase.table('courses').select(
            'id, title, description, price, duration, image, level, application_link'
        ).eq('is_featured', True).eq('is_published', True).limit(4).execute().data or []

        jobs = supabase.table('jobs').select(
            'id, title, company, description, location, salary, image, type, application_link'
        ).eq('is_featured', True).eq('is_active', True).limit(4).execute().data or []

        internships = supabase.table('internships').select(
            'id, title, company, description, duration, stipend, image, location, application_link'
        ).eq('is_featured', True).eq('is_active', True).limit(4).execute().data or []

        blogs = supabase.table('blog_posts').select(
            'id, title, description, author, published_at, image'
        ).eq('is_featured', True).eq('is_published', True).limit(3).execute().data or []

        # Fetch testimonials or use empty list if not implemented yet
        testimonials = supabase.table('testimonials').select(
            'id, name, position, company, content, rating, image'
        ).eq('is_featured', True).limit(3).execute().data or []

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


@app.route('/register', methods=['POST'])
def register():
    try:
        data = request.form
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
            'expires_at': expires_at
        }).execute()

        if not otp_response.data:
            raise Exception('Failed to store OTP in database')

        # Send OTP email
        if not send_otp_email(email, username, otp):
            raise Exception('Failed to send OTP email. Please try again later.')

        return jsonify({
            'status': 'success',
            'message': 'OTP sent to your email. Please check your inbox.',
            'requires_verification': True,
            'email': email
        })

    except Exception as e:
        logger.error(f"Registration error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e) if app.debug else 'Registration failed. Please try again.'
        }), 500


@app.route('/api/send-otp', methods=['POST'])
def send_otp_verification():
    """Endpoint to send OTP for verification"""
    data = request.get_json()
    email = data.get('email')
    purpose = data.get('purpose', 'registration')  # Default to registration

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    try:
        # Check if user exists (for password reset)
        if purpose == 'password-reset':
            user = supabase.table('users').select('username').eq('email', email).maybe_single().execute()
            if not user.data:
                return jsonify(
                    {'status': 'success', 'message': 'If an account exists with this email, an OTP has been sent'})

        # Generate and store OTP
        otp, expires_at = generate_otp()

        # Determine which table to use
        table = 'password_reset_otp' if purpose == 'password-reset' else 'otp_verification'

        # Upsert the OTP record
        supabase.table(table).upsert({
            'email': email,
            'otp': otp,
            'expires_at': expires_at
        }).execute()

        # Send OTP email
        username = user.data.get('username', 'User') if purpose == 'password-reset' else 'User'
        if send_otp_email(email, username, otp):
            return jsonify({'status': 'success', 'message': 'OTP sent successfully'})
        else:
            raise Exception('Failed to send OTP email')

    except Exception as e:
        logger.error(f"Error sending OTP: {str(e)}")
        return jsonify({'error': 'Failed to send OTP'}), 500


@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')
        username = data.get('username')
        password = data.get('password')

        if not all([email, otp, username, password]):
            return jsonify({'status': 'error', 'message': 'All fields are required'}), 400

        # Get the latest OTP for this email
        otp_record = supabase.table('otp_verification') \
            .select('*') \
            .eq('email', email) \
            .order('created_at', desc=True) \
            .limit(1) \
            .maybe_single() \
            .execute()

        if not otp_record.data:
            return jsonify({'status': 'error', 'message': 'No OTP found for this email'}), 404

        # Timezone-aware comparison
        expires_at = parse_db_timestamp(otp_record.data['expires_at'])
        current_time = get_current_time()

        if otp_record.data['otp'] == otp and expires_at > current_time:
            # Create user account
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
                'message': 'Registration successful! Please login to access your dashboard.',
                'redirect': url_for('index')
            })
        else:
            return jsonify({'status': 'error', 'message': 'Invalid or expired OTP'}), 400
    except Exception as e:
        logger.error(f"OTP verification error: {str(e)}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'OTP verification failed'}), 500


@app.route('/login', methods=['POST'])
def login():
    # Only accept JSON data for API consistency
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
    if request.method == 'POST':
        email = request.form.get('email')
        try:
            user = supabase.table('users').select('*').eq('email', email).maybe_single().execute()

            # Always return success to prevent email enumeration
            if user.data:
                # Generate and send OTP for password reset
                otp, expires_at = generate_otp()
                supabase.table('password_reset_otp').insert({
                    'email': email,
                    'otp': otp,
                    'expires_at': expires_at
                }).execute()
                send_otp_email(email, user.data.get('username', 'User'), otp)

            return jsonify({
                'status': 'success',
                'message': 'If an account exists with this email, an OTP has been sent'
            })
        except Exception as e:
            logger.error(f"Password reset error: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Error processing your request. Please try again.'
            }), 500

    return render_template('reset-password.html')

@app.route('/reset-password-otp', methods=['GET', 'POST'])
def reset_password_otp():
    if request.method == 'GET':
        email = request.args.get('email')
        if not email:
            flash('Email is required', 'danger')
            return redirect(url_for('reset_password'))
        return render_template('reset-password-otp.html', email=email)

    # POST request: handle form submission
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
                'redirect': url_for('login')
            })
        else:
            return jsonify({'error': 'Invalid or expired OTP'}), 400

    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}")
        return jsonify({'error': 'Failed to reset password'}), 500

@app.route('/api/check-session')
def check_session():
    return jsonify({
        'logged_in': 'user_id' in session,
        'username': session.get('username')
    })

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
        # Generate filename and paths
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{user_id}/{uuid.uuid4().hex}.{ext}"

        # Read file content
        file_bytes = file.read()

        # Verify it's a valid image
        Image.open(BytesIO(file_bytes)).verify()

        # Upload to Supabase storage
        res = supabase.storage.from_('profile-pics').upload(
            file=file_bytes,
            path=filename,
            file_options={
                'content-type': file.content_type,
                'x-upsert': 'true'
            }
        )

        if hasattr(res, 'error') and res.error:
            raise Exception(res.error.message)

        # Update user record with filename
        supabase.table('users').update({'profile_pic': filename}).eq('id', user_id).execute()

        # Get public URL (no need for signed URL since bucket is public)
        public_url = supabase.storage.from_('profile-pics').get_public_url(filename)

        return jsonify({
            'success': True,
            'image_url': public_url
        })

    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/get-profile-pic')
@login_required
def get_profile_pic():
    user_id = session['user_id']
    try:
        user = supabase.table('users').select('profile_pic').eq('id', user_id).single().execute().data
        if user and user.get('profile_pic'):
            # Get public URL
            public_url = supabase.storage.from_('profile-pics').get_public_url(user['profile_pic'])
            return jsonify({'success': True, 'image_url': public_url})
        return jsonify({'success': False, 'error': 'No profile picture'})
    except Exception as e:
        logger.error(f"Profile pic fetch error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ======================
# User Dashboard
# ======================
# Dashboard Route
@app.route('/dashboard')
@login_required
def user_dashboard():
    try:
        if 'logout_message' in session:
            flash(session.pop('logout_message'), 'success')

        user_id = session.get('user_id')
        user = supabase.table('users').select('*').eq('id', user_id).single().execute().data

        # Get profile picture URL
        avatar_url = None
        if user.get('profile_pic'):
            try:
                res = supabase.storage.from_('profile-pics').create_signed_url(
                    user['profile_pic'],
                    3600  # 1 hour expiration
                )
                avatar_url = res.signed_url
            except Exception as e:
                logger.error(f"Error generating signed URL: {str(e)}")
                avatar_url = supabase.storage.from_('profile-pics').get_public_url(user['profile_pic'])

        # Get user bookmarks
        bookmarks = get_user_bookmarks(user_id)

        return render_template('user-dashboard.html',
                               username=user['username'],
                               email=user['email'],
                               avatar_url=avatar_url,
                               courses=[b for b in bookmarks if b['content_type'] == 'course'],
                               jobs=[b for b in bookmarks if b['content_type'] == 'job'],
                               internships=[b for b in bookmarks if b['content_type'] == 'internship'])

    except Exception as e:
        logger.error(f"Dashboard error: {str(e)}")
        flash('Error loading dashboard', 'danger')
        return redirect(url_for('index'))


@app.route('/logout', methods=['GET','POST'])
def logout():
    session.clear()
    response = make_response(redirect(url_for('index')))
    response.delete_cookie('sb-access-token')
    flash('You have been successfully logged out', 'success')
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

            table = {
                'course': 'courses',
                'job': 'jobs',
                'internship': 'internships',
                'blog': 'blog_posts'
            }.get(content_type)

            if table:
                content = supabase.table(table).select('*').in_('id', ids).execute().data
                for item in content:
                    item['content_type'] = content_type
                    results.append(item)

        return sorted(results, key=lambda x: x.get('created_at', ''), reverse=True)
    except Exception as e:
        logger.error(f"Error getting user bookmarks: {str(e)}")
        return []

# ======================
# Content Routes
# ======================

@app.route('/courses')
def courses():
    search = request.args.get('search', '')
    category = request.args.get('category', '')

    try:
        query = supabase.table('courses').select('*').eq('is_published', True)
        if search:
            query = query.ilike('title', f'%{search}%')
        if category:
            query = query.eq('category', category)
        courses = query.order('created_at', desc=True).execute().data
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
        course = supabase.table('courses').select('*').eq('id', course_id).single().execute().data

        # Ensure we have a logo
        if course.get('application_link') and not course.get('image'):
            logo_url = get_company_logo(course['application_link'], 'course', course_id)
            if logo_url:
                course['image'] = logo_url

        is_enrolled = False
        if 'user_id' in session:
            enrollment = supabase.table('enrollments').select('*') \
                .eq('user_id', session['user_id']) \
                .eq('course_id', course_id) \
                .maybe_single().execute()
            is_enrolled = bool(enrollment.data)

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
        course = supabase.table('courses').select('application_link').eq('id', course_id).single().execute().data

        if not course or not course.get('application_link'):
            flash('This course is not currently available for enrollment', 'danger')
            return redirect(url_for('course_detail', course_id=course_id))

        supabase.table('enrollments').insert({
            'user_id': session['user_id'],
            'course_id': course_id,
            'enrolled_at': get_current_time().isoformat()
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
        jobs = query.order('created_at', desc=True).execute().data
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
        job = supabase.table('jobs').select('application_link').eq('id', job_id).single().execute().data

        if not job or not job.get('application_link'):
            flash('Application link not available', 'danger')
            return redirect(url_for('jobs'))

        supabase.table('applications').insert({
            'user_id': session['user_id'],
            'job_id': job_id,
            'applied_at': get_current_time().isoformat()
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
        internships = query.order('created_at', desc=True).execute().data
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
        internship = supabase.table('internships').select('application_link').eq('id', internship_id).single().execute().data

        if not internship or not internship.get('application_link'):
            flash('Application link not available', 'danger')
            return redirect(url_for('internships'))

        supabase.table('internship_applications').insert({
            'user_id': session['user_id'],
            'internship_id': internship_id,
            'applied_at': get_current_time().isoformat()
        }).execute()

        return redirect(internship['application_link'])

    except Exception as e:
        logger.error(f"Internship application error: {str(e)}")
        flash('Failed to apply for internship', 'danger')
        return redirect(url_for('internships'))

@app.route('/blog')
def blog():
    try:
        posts = supabase.table('blog_posts').select('*').eq('is_published', True).order('published_at', desc=True).execute().data
    except Exception as e:
        logger.error(f"Error loading blog posts: {str(e)}")
        posts = []

    return render_template('blogs.html', posts=posts)

# ======================
# Bookmark and Share Routes
# ======================

@app.route('/bookmark/<content_type>/<content_id>', methods=['POST'])
@login_required
def bookmark_content(content_type, content_id):
    try:
        valid_types = ['course', 'job', 'internship', 'blog']
        if content_type not in valid_types:
            return jsonify({'error': 'Invalid content type'}), 400

        # Check if content exists
        table_map = {
            'course': 'courses',
            'job': 'jobs',
            'internship': 'internships',
            'blog': 'blog_posts'
        }

        content = supabase.table(table_map[content_type]).select('id').eq('id', content_id).maybe_single().execute()
        if not content.data:
            return jsonify({'error': 'Content not found'}), 404

        # Check if already bookmarked
        existing = supabase.table('bookmarks').select('id') \
            .eq('user_id', session['user_id']) \
            .eq('item_type', content_type) \
            .eq('item_id', content_id) \
            .maybe_single().execute()

        if existing.data:
            # Remove bookmark
            supabase.table('bookmarks').delete() \
                .eq('id', existing.data['id']) \
                .execute()
            return jsonify({
                'status': 'removed',
                'count': get_bookmark_count(content_type, content_id)
            })
        else:
            # Add bookmark
            supabase.table('bookmarks').insert({
                'user_id': session['user_id'],
                'item_type': content_type,
                'item_id': content_id,
                'created_at': get_current_time().isoformat()
            }).execute()
            return jsonify({
                'status': 'added',
                'count': get_bookmark_count(content_type, content_id)
            })

    except Exception as e:
        logger.error(f"Bookmark error: {str(e)}")
        return jsonify({'error': str(e)}), 500

def get_bookmark_count(content_type, content_id):
    try:
        count = supabase.table('bookmarks').select('id', count='exact') \
            .eq('item_type', content_type) \
            .eq('item_id', content_id) \
            .execute().count
        return count or 0
    except Exception as e:
        logger.error(f"Error getting bookmark count: {str(e)}")
        return 0

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

@app.route('/get-application-link/<content_type>/<content_id>')
@login_required
def get_application_link(content_type, content_id):
    try:
        if content_type == 'course':
            item = supabase.table('courses').select('application_link').eq('id', content_id).single().execute().data
        elif content_type == 'job':
            item = supabase.table('jobs').select('application_link').eq('id', content_id).single().execute().data
        elif content_type == 'internship':
            item = supabase.table('internships').select('application_link').eq('id', content_id).single().execute().data
        else:
            return jsonify({'error': 'Invalid content type'}), 400

        if not item or not item.get('application_link'):
            return jsonify({'error': 'Application link not available'}), 404

        # Track application in database
        if content_type == 'course':
            supabase.table('enrollments').insert({
                'user_id': session['user_id'],
                'course_id': content_id,
                'enrolled_at': get_current_time().isoformat()
            }).execute()
        elif content_type == 'job':
            supabase.table('applications').insert({
                'user_id': session['user_id'],
                'job_id': content_id,
                'applied_at': get_current_time().isoformat()
            }).execute()
        elif content_type == 'internship':
            supabase.table('internship_applications').insert({
                'user_id': session['user_id'],
                'internship_id': content_id,
                'applied_at': get_current_time().isoformat()
            }).execute()

        return jsonify({'application_link': item['application_link']})

    except Exception as e:
        logger.error(f"Error getting application link: {str(e)}")
        return jsonify({'error': 'Failed to get application link'}), 500

# ======================
# Admin Routes
# ======================

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
        response = supabase.table('admins') \
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


# Admin Dashboard
@app.route('/admin/dashboard')
@admin_required
def admin_dashboard():
    try:
        if not session.get('admin_logged_in'):
            flash('Please login to access the dashboard', 'warning')
            return redirect(url_for('admin_login'))

        with ThreadPoolExecutor() as executor:
            users_future = executor.submit(
                supabase.table('users').select('id', count='exact').execute
            )
            courses_future = executor.submit(
                supabase.table('courses').select('id', count='exact').execute
            )
            jobs_future = executor.submit(
                supabase.table('jobs').select('id', count='exact').execute
            )
            internships_future = executor.submit(
                supabase.table('internships').select('id', count='exact').execute
            )
            messages_future = executor.submit(
                supabase.table('contact_messages').select('id', count='exact').execute
            )
            unverified_future = executor.submit(
                supabase.table('users').select('id', count='exact').eq('is_verified', False).execute
            )

            stats = {
                'users': users_future.result().count or 0,
                'courses': courses_future.result().count or 0,
                'jobs': jobs_future.result().count or 0,
                'internships': internships_future.result().count or 0,
                'messages': messages_future.result().count or 0,
                'unverified': unverified_future.result().count or 0
            }

        recent_messages = supabase.table('contact_messages') \
                              .select('id, name, email, created_at') \
                              .order('created_at', desc=True) \
                              .limit(5) \
                              .execute().data or []

        recent_users = supabase.table('users') \
                           .select('id, email, username, created_at') \
                           .order('created_at', desc=True) \
                           .limit(5) \
                           .execute().data or []

        activities = []
        for msg in recent_messages:
            activities.append({
                'type': 'message',
                'icon': 'envelope',
                'title': f"New message from {msg['name']}",
                'content': msg['email'],
                'time': msg['created_at'],
                'link': url_for('manage_messages')
            })

        for user in recent_users:
            activities.append({
                'type': 'user',
                'icon': 'user-plus',
                'title': f"New user registered: {user['email']}",
                'content': user['username'],
                'time': user['created_at'],
                'link': url_for('manage_users', user_id=user['id'])
            })

        activities.sort(key=lambda x: x['time'], reverse=True)

        response = make_response(
            render_template(
                'admin/admin-dashboard.html',
                stats=stats,
                activities=activities[:5],
                admin_name=session.get('admin_username', 'Admin')
            )
        )

        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

        return response

    except Exception as e:
        print(f"Dashboard error: {str(e)}")
        flash('Failed to load dashboard data. Please try again.', 'danger')
        return redirect(url_for('admin_login'))


# Admin Content Management
@app.route('/admin/courses')
@admin_required
def manage_courses():
    try:
        courses = supabase.table('courses').select('*').order('created_at', desc=True).execute().data
        return jsonify(courses)
    except Exception as e:
        print(f"Error loading courses: {str(e)}")
        flash('Error loading courses', 'danger')
        return redirect(url_for('admin_dashboard'))


@app.route('/admin/courses/<int:course_id>')
@admin_required
def get_course(course_id):
    try:
        course = supabase.table('courses').select('*').eq('id', course_id).single().execute().data
        return jsonify(course)
    except Exception as e:
        print(f"Error fetching course: {str(e)}")
        return jsonify({'error': str(e)}), 404


@app.route('/admin/courses/save', methods=['POST'])
@admin_required
def save_course():
    try:
        data = request.form.to_dict()
        file = request.files.get('image')

        if 'application_link' in data and data['application_link']:
            logo_url = get_company_logo(data['application_link'], 'course', data.get('id'))
            if logo_url:
                data['logo_url'] = logo_url

        if file and allowed_file(file.filename):
            filename = save_file(file)
            if filename:
                data['image'] = filename

        data['published'] = 'published' in data

        course_id = data.pop('id', None)
        if course_id and course_id.strip():
            supabase.table('courses').update(data).eq('id', course_id.strip()).execute()
            return jsonify({'success': True, 'message': 'Course updated successfully'})
        else:
            data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('courses').insert(data).execute()
            return jsonify({'success': True, 'message': 'Course created successfully'})

    except Exception as e:
        print(f"Error saving course: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/courses/<int:course_id>/status', methods=['POST'])
@admin_required
def toggle_course_status(course_id):
    try:
        status = request.json.get('status')
        supabase.table('courses').update({'published': status}).eq('id', course_id).execute()
        return jsonify({'success': True, 'message': 'Course status updated'})
    except Exception as e:
        print(f"Error toggling course status: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/courses/bulk-action', methods=['POST'])
@admin_required
def bulk_action_courses():
    try:
        data = request.json
        action = data.get('action')
        ids = data.get('ids', [])

        if action == 'publish':
            supabase.table('courses').update({'published': True}).in_('id', ids).execute()
        elif action == 'unpublish':
            supabase.table('courses').update({'published': False}).in_('id', ids).execute()
        elif action == 'delete':
            supabase.table('courses').delete().in_('id', ids).execute()

        return jsonify({'success': True, 'message': f'Courses {action}ed successfully'})
    except Exception as e:
        print(f"Error performing bulk action on courses: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/jobs')
@admin_required
def manage_jobs():
    try:
        jobs = supabase.table('jobs').select('*').order('created_at', desc=True).execute().data
        return jsonify(jobs)
    except Exception as e:
        print(f"Error loading jobs: {str(e)}")
        flash('Error loading jobs', 'danger')
        return redirect(url_for('admin_dashboard'))


@app.route('/admin/jobs/<int:job_id>')
@admin_required
def get_job(job_id):
    try:
        job = supabase.table('jobs').select('*').eq('id', job_id).single().execute().data
        return jsonify(job)
    except Exception as e:
        print(f"Error fetching job: {str(e)}")
        return jsonify({'error': str(e)}), 404


@app.route('/admin/jobs/save', methods=['POST'])
@admin_required
def save_job():
    try:
        data = request.form.to_dict()
        file = request.files.get('image')

        if 'application_link' in data and data['application_link']:
            logo_url = get_company_logo(data['application_link'], 'job', data.get('id'))
            if logo_url:
                data['logo_url'] = logo_url

        if file and allowed_file(file.filename):
            filename = save_file(file)
            if filename:
                data['image'] = filename

        data['active'] = 'active' in data

        job_id = data.pop('id', None)
        if job_id and job_id.strip():
            supabase.table('jobs').update(data).eq('id', job_id.strip()).execute()
            return jsonify({'success': True, 'message': 'Job updated successfully'})
        else:
            data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('jobs').insert(data).execute()
            return jsonify({'success': True, 'message': 'Job created successfully'})

    except Exception as e:
        print(f"Error saving job: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/jobs/<int:job_id>/status', methods=['POST'])
@admin_required
def toggle_job_status(job_id):
    try:
        status = request.json.get('status')
        supabase.table('jobs').update({'active': status}).eq('id', job_id).execute()
        return jsonify({'success': True, 'message': 'Job status updated'})
    except Exception as e:
        print(f"Error toggling job status: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/internships')
@admin_required
def manage_internships():
    try:
        internships = supabase.table('internships').select('*').order('created_at', desc=True).execute().data
        return jsonify(internships)
    except Exception as e:
        print(f"Error loading internships: {str(e)}")
        flash('Error loading internships', 'danger')
        return redirect(url_for('admin_dashboard'))


@app.route('/admin/internships/<int:internship_id>')
@admin_required
def get_internship(internship_id):
    try:
        internship = supabase.table('internships').select('*').eq('id', internship_id).single().execute().data
        return jsonify(internship)
    except Exception as e:
        print(f"Error fetching internship: {str(e)}")
        return jsonify({'error': str(e)}), 404


@app.route('/admin/internships/save', methods=['POST'])
@admin_required
def save_internship():
    try:
        data = request.form.to_dict()
        file = request.files.get('image')

        if 'application_link' in data and data['application_link']:
            logo_url = get_company_logo(data['application_link'], 'internship', data.get('id'))
            if logo_url:
                data['logo_url'] = logo_url

        if file and allowed_file(file.filename):
            filename = save_file(file)
            if filename:
                data['image'] = filename

        data['paid'] = 'paid' in data
        data['remote'] = 'remote' in data
        data['active'] = 'active' in data

        internship_id = data.pop('id', None)
        if internship_id and internship_id.strip():
            supabase.table('internships').update(data).eq('id', internship_id.strip()).execute()
            return jsonify({'success': True, 'message': 'Internship updated successfully'})
        else:
            data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('internships').insert(data).execute()
            return jsonify({'success': True, 'message': 'Internship created successfully'})

    except Exception as e:
        print(f"Error saving internship: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/blog')
@admin_required
def manage_blog():
    try:
        posts = supabase.table('blog_posts').select('*').order('published_at', desc=True).execute().data
        return jsonify(posts)
    except Exception as e:
        print(f"Error loading blog posts: {str(e)}")
        flash('Error loading blog posts', 'danger')
        return redirect(url_for('admin_dashboard'))


@app.route('/admin/blog/<int:post_id>')
@admin_required
def get_blog_post(post_id):
    try:
        post = supabase.table('blog_posts').select('*').eq('id', post_id).single().execute().data
        return jsonify(post)
    except Exception as e:
        print(f"Error fetching blog post: {str(e)}")
        return jsonify({'error': str(e)}), 404


@app.route('/admin/blog/save', methods=['POST'])
@admin_required
def save_blog_post():
    try:
        data = request.form.to_dict()
        file = request.files.get('image')

        if file and allowed_file(file.filename):
            filename = save_file(file)
            if filename:
                data['image'] = filename

        if 'categories' in data:
            data['categories'] = [cat.strip() for cat in data['categories'].split(',')]

        data['published'] = 'published' in data
        if data['published']:
            data['published_at'] = datetime.utcnow().isoformat()

        post_id = data.pop('id', None)
        if post_id and post_id.strip():
            supabase.table('blog_posts').update(data).eq('id', post_id.strip()).execute()
            return jsonify({'success': True, 'message': 'Blog post updated successfully'})
        else:
            data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('blog_posts').insert(data).execute()
            return jsonify({'success': True, 'message': 'Blog post created successfully'})

    except Exception as e:
        print(f"Error saving blog post: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/blog/<int:post_id>/status', methods=['POST'])
@admin_required
def toggle_blog_post_status(post_id):
    try:
        status = request.json.get('status')
        update_data = {'published': status}
        if status:
            update_data['published_at'] = datetime.utcnow().isoformat()
        supabase.table('blog_posts').update(update_data).eq('id', post_id).execute()
        return jsonify({'success': True, 'message': 'Blog post status updated'})
    except Exception as e:
        print(f"Error toggling blog post status: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/users')
@admin_required
def manage_users():
    try:
        users = supabase.table('users').select('*').order('created_at', desc=True).execute().data
        return jsonify(users)
    except Exception as e:
        print(f"Error loading users: {str(e)}")
        flash('Error loading users', 'danger')
        return redirect(url_for('admin_dashboard'))


@app.route('/admin/users/<int:user_id>')
@admin_required
def get_user(user_id):
    try:
        user = supabase.table('users').select('*').eq('id', user_id).single().execute().data
        return jsonify(user)
    except Exception as e:
        print(f"Error fetching user: {str(e)}")
        return jsonify({'error': str(e)}), 404


@app.route('/admin/users/<int:user_id>/status', methods=['POST'])
@admin_required
def toggle_user_status(user_id):
    try:
        status = request.json.get('status')
        supabase.table('users').update({'is_active': status}).eq('id', user_id).execute()
        return jsonify({'success': True, 'message': 'User status updated'})
    except Exception as e:
        print(f"Error toggling user status: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/messages')
@admin_required
def manage_messages():
    try:
        messages = supabase.table('contact_messages').select('*').order('created_at', desc=True).execute().data
        return jsonify(messages)
    except Exception as e:
        print(f"Error loading messages: {str(e)}")
        flash('Error loading messages', 'danger')
        return redirect(url_for('admin_dashboard'))


@app.route('/admin/messages/<int:message_id>')
@admin_required
def get_message(message_id):
    try:
        message = supabase.table('contact_messages').select('*').eq('id', message_id).single().execute().data
        return jsonify(message)
    except Exception as e:
        print(f"Error fetching message: {str(e)}")
        return jsonify({'error': str(e)}), 404


@app.route('/admin/messages/<int:message_id>/delete', methods=['POST'])
@admin_required
def delete_message(message_id):
    try:
        supabase.table('contact_messages').delete().eq('id', message_id).execute()
        return jsonify({'success': True, 'message': 'Message deleted'})
    except Exception as e:
        print(f"Error deleting message: {str(e)}")
        return jsonify({'error': str(e)}), 500


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


@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


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

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs('config/credentials', exist_ok=True)


    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        threaded=True
    )