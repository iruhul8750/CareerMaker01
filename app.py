import os
from datetime import datetime, timedelta, time
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, abort, \
    send_from_directory, make_response
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from functools import wraps
from dotenv import load_dotenv
from supabase import create_client, Client
import uuid
import re
import json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import hashlib
import binascii
import secrets
from flask import escape
from concurrent.futures import ThreadPoolExecutor
import sentry_sdk

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

# Gmail OAuth Configuration
SCOPES = ['https://www.googleapis.com/auth/gmail.send']
CLIENT_SECRETS_FILE = 'config/credentials/gmail_credentials.json'

# Password Hashing Configuration
PBKDF2_ITERATIONS = 100000
HASH_NAME = "sha256"
SALT_LENGTH = 16
HASH_LENGTH = 64

# Initialize Sentry for error tracking (optional)
if os.getenv('SENTRY_DSN'):
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        traces_sample_rate=1.0
    )


def hash_password(password: str) -> str:
    """Generate PBKDF2 hash with base64-encoded salt"""
    salt = secrets.token_bytes(16)  # 16 random bytes
    iterations = 600000
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        iterations,
        dklen=32
    )
    # Encode salt in base64 (URL-safe)
    b64_salt = base64.urlsafe_b64encode(salt).decode('ascii').rstrip('=')
    return f"pbkdf2:sha256:{iterations}${b64_salt}${binascii.hexlify(key).decode()}"


def verify_password(stored_hash: str, password: str) -> bool:
    """Verify password with base64-encoded salt"""
    try:
        # Clean hash and split
        stored_hash = stored_hash.strip()
        algorithm, b64_salt, key_hex = stored_hash.split('$')

        # Decode components
        salt = base64.urlsafe_b64decode(b64_salt + '==')  # Add padding
        iterations = int(algorithm.split(':')[2])
        stored_key = binascii.unhexlify(key_hex)

        # Generate comparison key
        new_key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt,
            iterations,
            dklen=len(stored_key)
        )

        return secrets.compare_digest(new_key, stored_key)

    except Exception as e:
        print(f"Password verification error: {str(e)}")
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

def clear_admin_session():
    session_keys = ['admin_id', 'admin_username', 'admin_email', 'is_superadmin', 'admin_logged_in']
    for key in session_keys:
        session.pop(key, None)

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

def get_gmail_service():
    creds = None
    token_path = 'config/credentials/token.json'

    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = Flow.from_client_secrets_file(
                CLIENT_SECRETS_FILE,
                SCOPES,
                redirect_uri='urn:ietf:wg:oauth:2.0:oob'
            )
            auth_url, _ = flow.authorization_url(prompt='consent')
            print('Please go to this URL and authorize the application:')
            print(auth_url)
            code = input('Enter the authorization code: ')
            flow.fetch_token(code=code)
            creds = flow.credentials

        with open(token_path, 'w') as token:
            token.write(creds.to_json())

    return build('gmail', 'v1', credentials=creds)

def send_email(to, subject, body_text, body_html=None):
    try:
        service = get_gmail_service()
        message = MIMEMultipart('alternative')
        message['to'] = to
        message['from'] = os.getenv('GMAIL_EMAIL')
        message['subject'] = subject

        part1 = MIMEText(body_text, 'plain')
        message.attach(part1)

        if body_html:
            part2 = MIMEText(body_html, 'html')
            message.attach(part2)

        raw = base64.urlsafe_b64encode(message.as_bytes())
        raw = raw.decode()
        body = {'raw': raw}

        service.users().messages().send(
            userId='me',
            body=body
        ).execute()
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

def generate_verification_token(user_id):
    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=24)

    supabase.table('verification_tokens').insert({
        'user_id': user_id,
        'token': token,
        'expires_at': expires_at.isoformat()
    }).execute()

    return token

def send_verification_email(user_email, user_name, token):
    verification_url = f"{request.host_url}verify-email/{token}"

    subject = "Verify Your CareerMaker Account"
    body_text = f"""
    Hello {user_name},

    Please verify your email address by clicking the following link:
    {verification_url}

    This link will expire in 24 hours.

    If you didn't create an account with CareerMaker, please ignore this email.

    Best regards,
    The CareerMaker Team
    """

    body_html = f"""
    <html>
        <body>
            <h2>Hello {user_name},</h2>
            <p>Please verify your email address by clicking the button below:</p>
            <a href="{verification_url}" style="
                background-color: #4361ee;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 5px;
                display: inline-block;
                margin: 10px 0;
            ">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account with CareerMaker, please ignore this email.</p>
            <br>
            <p>Best regards,</p>
            <p>The CareerMaker Team</p>
        </body>
    </html>
    """

    return send_email(user_email, subject, body_text, body_html)


def initialize_admin_account():
    """Verify admin account exists without credentials"""
    try:
        # Simple query to check connection and table existence
        response = supabase.table('admins') \
            .select("id") \
            .limit(1) \
            .execute()

        if not response.data:
            print("Warning: No admin accounts found")
        return True

    except Exception as e:
        print(f"Admin verification failed: {str(e)}")
        return False

# Routes
@app.route('/')
def index():
    try:
        courses = supabase.table('courses').select(
            'id, title, description, price, duration, image, level'
        ).eq('is_featured', True).eq('is_published', True).limit(4).execute().data

        jobs = supabase.table('jobs').select(
            'id, title, company, description, location, salary, image, type'
        ).eq('is_featured', True).eq('is_active', True).limit(4).execute().data

        internships = supabase.table('internships').select(
            'id, title, company, description, duration, stipend, image, location'
        ).eq('is_featured', True).eq('is_active', True).limit(4).execute().data

        blogs = supabase.table('blog_posts').select(
            'id, title, description, author, published_at, image'
        ).eq('is_featured', True).eq('is_published', True).limit(3).execute().data

    except Exception as e:
        print(f"Error loading index: {str(e)}")
        courses, jobs, internships, blogs = [], [], [], []

    return render_template('index.html',
                         courses=courses,
                         jobs=jobs,
                         internships=internships,
                         blogs=blogs)

@app.route('/verify-email/<token>')
def verify_email(token):
    try:
        token_data = supabase.table('verification_tokens').select(
            '*'
        ).eq('token', token).single().execute().data

        if not token_data:
            flash('Invalid verification token', 'danger')
            return redirect(url_for('index'))

        if datetime.fromisoformat(token_data['expires_at']) < datetime.utcnow():
            flash('Verification link has expired', 'danger')
            return redirect(url_for('index'))

        supabase.table('users').update({
            'is_verified': True,
            'verified_at': datetime.utcnow().isoformat()
        }).eq('id', token_data['user_id']).execute()

        supabase.table('verification_tokens').delete().eq('token', token).execute()

        flash('Email verified successfully! You can now log in.', 'success')
        return redirect(url_for('login'))
    except Exception:
        flash('Invalid verification token', 'danger')
        return redirect(url_for('index'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        if password != confirm_password:
            flash('Passwords do not match', 'danger')
        elif len(password) < 8:
            flash('Password must be at least 8 characters', 'danger')
        elif not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            flash('Invalid email format', 'danger')
        else:
            try:
                existing = supabase.table('users').select('email').eq('email', email).execute()
                if existing.data:
                    flash('Email already registered', 'danger')
                else:
                    user_data = supabase.table('users').insert({
                        'username': username,
                        'email': email,
                        'password_hash': hash_password(password),
                        'is_verified': False,
                        'created_at': datetime.utcnow().isoformat()
                    }).execute().data[0]

                    token = generate_verification_token(user_data['id'])

                    if send_verification_email(email, username, token):
                        flash('Registration successful! Please check your email to verify your account.', 'success')
                    else:
                        flash('Registration successful, but we couldn\'t send the verification email. Please contact support.', 'warning')

                    return redirect(url_for('login'))
            except Exception as e:
                print(f"Registration error: {str(e)}")
                flash('Registration failed. Please try again.', 'danger')

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        try:
            user = supabase.table('users').select('*').eq('email', email).single().execute().data

            if user and verify_password(user['password_hash'], password):
                if not user.get('is_verified'):
                    flash('Please verify your email address before logging in. Check your email for the verification link.', 'warning')
                    return redirect(url_for('login'))

                session['user_id'] = user['id']
                session['user_email'] = user['email']
                flash('Logged in successfully!', 'success')
                return redirect(url_for('user_dashboard'))
            else:
                flash('Invalid email or password', 'danger')
        except Exception as e:
            print(f"Login error: {str(e)}")
            flash('Login failed. Please try again.', 'danger')

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out successfully', 'success')
    return redirect(url_for('index'))

@app.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        email = request.form.get('email')
        try:
            user = supabase.table('users').select('*').eq('email', email).single().execute().data
            if user:
                reset_token = str(uuid.uuid4())
                reset_link = f"{request.host_url}reset-password/{reset_token}"

                supabase.table('password_reset_tokens').insert({
                    'user_id': user['id'],
                    'token': reset_token,
                    'expires_at': (datetime.utcnow() + timedelta(hours=1)).isoformat()
                }).execute()

                print(f"Password reset link would be sent to: {email}")
                print(f"Reset link: {reset_link}")

                flash('If an account exists with this email, a reset link has been sent', 'info')
            else:
                flash('If an account exists with this email, a reset link has been sent', 'info')
            return redirect(url_for('login'))
        except Exception as e:
            print(f"Password reset error: {str(e)}")
            flash('Error processing your request. Please try again.', 'danger')

    return render_template('reset-password.html')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password_token(token):
    try:
        token_data = supabase.table('password_reset_tokens').select(
            '*'
        ).eq('token', token).single().execute().data

        if not token_data:
            flash('Invalid reset token', 'danger')
            return redirect(url_for('login'))

        if datetime.fromisoformat(token_data['expires_at']) < datetime.utcnow():
            flash('Reset link has expired', 'danger')
            return redirect(url_for('login'))

        if request.method == 'POST':
            password = request.form.get('password')
            confirm_password = request.form.get('confirm_password')

            if password != confirm_password:
                flash('Passwords do not match', 'danger')
            elif len(password) < 8:
                flash('Password must be at least 8 characters', 'danger')
            else:
                supabase.table('users').update({
                    'password_hash': hash_password(password)
                }).eq('id', token_data['user_id']).execute()

                supabase.table('password_reset_tokens').delete().eq('token', token).execute()

                flash('Password updated successfully! You can now log in.', 'success')
                return redirect(url_for('login'))

        return render_template('reset-password-form.html', token=token)
    except Exception:
        flash('Invalid reset token', 'danger')
        return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def user_dashboard():
    try:
        user_id = session['user_id']
        bookmarks = supabase.table('bookmarks').select('*').eq('user_id', user_id).execute().data

        courses, jobs, internships, blogs = [], [], [], []

        for bookmark in bookmarks:
            if bookmark['item_type'] == 'course':
                course = supabase.table('courses').select('*').eq('id', bookmark['item_id']).single().execute().data
                if course: courses.append(course)
            elif bookmark['item_type'] == 'job':
                job = supabase.table('jobs').select('*').eq('id', bookmark['item_id']).single().execute().data
                if job: jobs.append(job)
            elif bookmark['item_type'] == 'internship':
                internship = supabase.table('internships').select('*').eq('id', bookmark['item_id']).single().execute().data
                if internship: internships.append(internship)
            elif bookmark['item_type'] == 'blog':
                blog = supabase.table('blog_posts').select('*').eq('id', bookmark['item_id']).single().execute().data
                if blog: blogs.append(blog)

        return render_template('user-dashboard.html',
                           courses=courses,
                           jobs=jobs,
                           internships=internships,
                           blogs=blogs)
    except Exception as e:
        print(f"Error loading dashboard: {str(e)}")
        flash('Error loading your dashboard', 'danger')
        return redirect(url_for('index'))

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
        print(f"Error loading courses: {str(e)}")
        courses = []

    return render_template('courses.html', courses=courses, search=search, category=category)

@app.route('/jobs')
def jobs():
    try:
        jobs = supabase.table('jobs').select('*').eq('is_active', True).order('created_at', desc=True).execute().data
    except Exception as e:
        print(f"Error loading jobs: {str(e)}")
        jobs = []

    return render_template('jobs.html', jobs=jobs)

@app.route('/internships')
def internships():
    try:
        internships = supabase.table('internships').select('*').eq('is_active', True).order('created_at', desc=True).execute().data
    except Exception as e:
        print(f"Error loading internships: {str(e)}")
        internships = []

    return render_template('internships.html', internships=internships)

@app.route('/blog')
def blog():
    try:
        posts = supabase.table('blog_posts').select('*').eq('is_published', True).order('published_at', desc=True).execute().data
    except Exception as e:
        print(f"Error loading blog posts: {str(e)}")
        posts = []

    return render_template('blogs.html', posts=posts)

@app.route('/contact', methods=['GET'])
def contact():
    return redirect(url_for('index', _anchor='contact'))

@app.route('/api/contact', methods=['POST'])
def contact_api():
    try:
        name = request.form.get('name')
        email = request.form.get('email')
        subject = request.form.get('subject')
        message = request.form.get('message')

        if not all([name, email, subject, message]):
            return jsonify({'error': 'All fields are required'}), 400

        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return jsonify({'error': 'Invalid email format'}), 400

        supabase.table('contact_messages').insert({
            'name': name,
            'email': email,
            'subject': subject,
            'message': message,
            'created_at': datetime.utcnow().isoformat()
        }).execute()

        return jsonify({'status': 'success', 'message': 'Your message has been sent successfully!'})
    except Exception as e:
        print(f"Contact form error: {str(e)}")
        return jsonify({'error': 'An error occurred while sending your message. Please try again later.'}), 500

@app.route('/api/bookmark', methods=['POST'])
@login_required
def bookmark():
    try:
        data = request.get_json()
        item_type = data.get('type')
        item_id = data.get('id')
        user_id = session['user_id']

        existing = supabase.table('bookmarks').select('*').eq('user_id', user_id).eq('item_type', item_type).eq(
            'item_id', item_id).execute()

        if existing.data:
            supabase.table('bookmarks').delete().eq('user_id', user_id).eq('item_type', item_type).eq('item_id',
                                                                                                      item_id).execute()
            return jsonify({'status': 'removed'})
        else:
            supabase.table('bookmarks').insert({
                'user_id': user_id,
                'item_type': item_type,
                'item_id': item_id,
                'created_at': datetime.utcnow().isoformat()
            }).execute()
            return jsonify({'status': 'added'})
    except Exception as e:
        print(f"Bookmark error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/content/<content_type>/<content_id>')
def get_content(content_type, content_id):
    try:
        if content_type == 'course':
            content = supabase.table('courses').select('*').eq('id', content_id).single().execute().data
        elif content_type == 'job':
            content = supabase.table('jobs').select('*').eq('id', content_id).single().execute().data
        elif content_type == 'internship':
            content = supabase.table('internships').select('*').eq('id', content_id).single().execute().data
        elif content_type == 'blog':
            content = supabase.table('blog_posts').select('*').eq('id', content_id).single().execute().data
        else:
            return jsonify({'error': 'Invalid content type'}), 400

        if not content:
            return jsonify({'error': 'Content not found'}), 404

        return jsonify(content)
    except Exception as e:
        print(f"Error fetching content: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Admin Routes
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'GET':
        if session.get('admin_logged_in'):
            return redirect(url_for('admin_dashboard'))
        return render_template('admin/admin-login.html')

    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')

    # Debug print
    print(f"Login attempt - Username: {username}, Password: {bool(password)}")

    if not username or not password:
        flash('Both username and password are required', 'danger')
        return render_template('admin/admin-login.html')

    try:
        # Debug: Print Supabase connection status
        print("Testing Supabase connection...")
        test_conn = supabase.table('admins').select('id').limit(1).execute()
        print("Supabase connection successful")

        # Case-sensitive username match
        response = supabase.table('admins') \
                   .select('*') \
                   .eq('username', username) \
                   .maybe_single() \
                   .execute()

        # Debug: Print query results
        print("Supabase response:", response)

        if not response.data:
            print("No admin found with that username")
            flash('Invalid credentials', 'danger')
            return render_template('admin/admin-login.html')

        admin = response.data
        print("Found admin:", admin['username'])

        # Debug: Print password verification details
        print(f"Stored hash: {admin['password_hash'][:50]}...")
        print("Verifying password...")

        if not verify_password(admin['password_hash'], password):
            print("Password verification failed")
            flash('Invalid credentials', 'danger')
            return render_template('admin/admin-login.html')

        # Set session variables
        session.update({
            'admin_id': str(admin['id']),
            'admin_username': admin['username'],
            'admin_email': admin.get('email', ''),
            'is_superadmin': bool(admin.get('is_superadmin', False)),
            'admin_logged_in': True
        })

        # Debug: Print session after setting
        print("Session after login:", dict(session))

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
@admin_required  # This decorator ensures only logged-in admins can access
def admin_dashboard():
    try:
        # Check if admin is logged in (redundant if @admin_required works, but good practice)
        if not session.get('admin_logged_in'):
            flash('Please login to access the dashboard', 'warning')
            return redirect(url_for('admin_login'))

        # Get admin stats using ThreadPoolExecutor for parallel queries
        with ThreadPoolExecutor() as executor:
            # Define all the queries we want to run in parallel
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

            # Wait for all futures to complete
            stats = {
                'users': users_future.result().count or 0,
                'courses': courses_future.result().count or 0,
                'jobs': jobs_future.result().count or 0,
                'internships': internships_future.result().count or 0,
                'messages': messages_future.result().count or 0,
                'unverified': unverified_future.result().count or 0
            }

        # Get recent activities
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

        # Format activities for the timeline
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

        # Sort activities by time
        activities.sort(key=lambda x: x['time'], reverse=True)

        # Create response with no-cache headers
        response = make_response(
            render_template(
                'admin/admin-dashboard.html',
                stats=stats,
                activities=activities[:5],  # Only show 5 most recent
                admin_name=session.get('admin_username', 'Admin')
            )
        )

        # Prevent caching of the dashboard
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

        if file and allowed_file(file.filename):
            filename = save_file(file)
            if filename:
                data['image'] = filename

        # Convert published to boolean
        data['published'] = 'published' in data

        if 'id' in data and data['id']:
            course_id = data.pop('id')
            supabase.table('courses').update(data).eq('id', course_id).execute()
            flash('Course updated successfully', 'success')
        else:
            data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('courses').insert(data).execute()
            flash('Course created successfully', 'success')

        return jsonify({'success': True, 'refresh': True})
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

        if file and allowed_file(file.filename):
            filename = save_file(file)
            if filename:
                data['image'] = filename

        # Convert active to boolean
        data['active'] = 'active' in data

        if 'id' in data and data['id']:
            job_id = data.pop('id')
            supabase.table('jobs').update(data).eq('id', job_id).execute()
            flash('Job updated successfully', 'success')
        else:
            data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('jobs').insert(data).execute()
            flash('Job created successfully', 'success')

        return jsonify({'success': True, 'refresh': True})
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

        if file and allowed_file(file.filename):
            filename = save_file(file)
            if filename:
                data['image'] = filename

        # Convert checkbox values to boolean
        data['paid'] = 'paid' in data
        data['remote'] = 'remote' in data
        data['active'] = 'active' in data

        if 'id' in data and data['id']:
            internship_id = data.pop('id')
            supabase.table('internships').update(data).eq('id', internship_id).execute()
            flash('Internship updated successfully', 'success')
        else:
            data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('internships').insert(data).execute()
            flash('Internship created successfully', 'success')

        return jsonify({'success': True, 'refresh': True})
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

        # Handle categories
        if 'categories' in data:
            data['categories'] = [cat.strip() for cat in data['categories'].split(',')]

        # Convert published to boolean
        data['published'] = 'published' in data
        if data['published']:
            data['published_at'] = datetime.utcnow().isoformat()

        if 'id' in data and data['id']:
            post_id = data.pop('id')
            supabase.table('blog_posts').update(data).eq('id', post_id).execute()
            flash('Blog post updated successfully', 'success')
        else:
            data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('blog_posts').insert(data).execute()
            flash('Blog post created successfully', 'success')

        return jsonify({'success': True, 'refresh': True})
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

@app.errorhandler(Exception)
def handle_error(e):
    print(f"Unexpected error: {str(e)}")
    flash('An unexpected error occurred. Please try again.', 'danger')
    return redirect(url_for('index'))

if __name__ == '__main__':
    # Verify environment variables
    required_env_vars = ['SUPABASE_URL', 'SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

    # Initialize directories
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs('config/credentials', exist_ok=True)

    # Initialize admin account with retry
    if not initialize_admin_account():
        print("Warning: Failed to initialize admin account after multiple attempts")

    # Run the app
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        threaded=True
    )