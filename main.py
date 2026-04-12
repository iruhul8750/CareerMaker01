import os

from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
import httpx
import time
load_dotenv()
import uuid
import secrets
import binascii
import hashlib
import user_agents
from fuzzywuzzy import fuzz
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import logging
from datetime import datetime, timedelta, timezone, time
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, make_response
from functools import wraps
from dotenv import load_dotenv
from flask_cors import CORS
from supabase import create_client
import requests
from PIL import Image
import io
import base64
import re
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

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
supabase_key = os.getenv('SUPABASE_KEY')  # anon/public key
supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # service role key
# Regular client (respects RLS)
supabase = create_client(supabase_url, supabase_key)
# Admin client (should bypass RLS with service role key)
supabase_admin = create_client(supabase_url, supabase_service_key)
# Test the connection
try:
    # Test regular client
    test = supabase.table('users').select('*').limit(1).execute()
    logger.info("Regular Supabase connection test successful")

    # Test admin client
    test_admin = supabase_admin.table('users').select('*').limit(1).execute()
    logger.info("Admin Supabase connection test successful")
except Exception as e:
    logger.error(f"Supabase connection failed: {str(e)}")


# Helper Functions
def get_current_utc_time():
    """Get current time in UTC for consistent expiration checks"""
    return datetime.now(timezone.utc)


def test_supabase_connection():
    """Test Supabase connection with retry logic"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Test regular client
            test = supabase.table('users').select('*').limit(1).execute()
            logger.info("✅ Supabase connection test successful")
            return True
        except Exception as e:
            logger.warning(f"⚠️ Supabase connection attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(1)  # Wait 1 second before retry
            else:
                logger.error(f"❌ All Supabase connection attempts failed")
                return False


def parse_db_timestamp(timestamp_str):
    """Parse database timestamp and ensure it's timezone-aware"""
    if not timestamp_str:
        return None
    try:
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def is_valid_uuid(uuid_string):
    """Validate if a string is a valid UUID"""
    try:
        uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
        return bool(uuid_pattern.match(str(uuid_string)))
    except:
        return False


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
    expires_at = get_current_utc_time() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    return otp, expires_at.isoformat()


def send_email_smtp(to_email, subject, plain_text, html_content=None):
    """Send email with SSL/TLS fallback, Unicode support, and HTML capability"""
    try:
        # Create message with proper encoding
        msg = MIMEMultipart('alternative')
        msg['From'] = SMTP_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg['Reply-To'] = SMTP_EMAIL

        # Add plain text part with UTF-8 encoding
        text_part = MIMEText(plain_text, 'plain', 'utf-8')
        msg.attach(text_part)

        # Add HTML part if provided
        if html_content:
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)

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


def handle_otp_resend(data):
    """Handle OTP resend requests"""
    try:
        email = data.get('email')
        purpose = data.get('purpose', 'registration')

        if not email:
            return jsonify({'status': 'error', 'message': 'Email is required'}), 400

        # For registration, check if email is already registered
        if purpose == 'registration':
            existing_user = supabase.table('users').select('email').eq('email', email).execute()
            if existing_user.data:
                return jsonify({'status': 'error', 'message': 'Email already registered'}), 400

        # Delete any existing OTPs
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
            'otp': otp if not email_sent else None  # For development
        })

    except Exception as e:
        logger.error(f"OTP resend error: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


def initialize_blog_modals():
    """Initialize blog modal functionality"""
    try:
        # This function will be called from the frontend JavaScript
        # to set up event listeners for blog modals
        pass
    except Exception as e:
        logger.error(f"Error initializing blog modals: {str(e)}")


def close_blog_modal():
    """Close blog detail modal"""
    try:
        # This function will be called from the frontend JavaScript
        pass
    except Exception as e:
        logger.error(f"Error closing blog modal: {str(e)}")


def share_blog():
    """Share blog post functionality"""
    try:
        # This function will be called from the frontend JavaScript
        pass
    except Exception as e:
        logger.error(f"Error sharing blog: {str(e)}")


def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            if not session.get('admin_logged_in'):
                return jsonify({
                    'success': False,
                    'message': 'Admin access required. Please login.',
                    'requires_login': True,
                    'redirect_url': '/admin/login'
                }), 401
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Admin required decorator error: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'Authentication error',
                'requires_login': True,
                'redirect_url': '/admin/login'
            }), 500

    return decorated_function


# Logo fetch functions for contents
def fetch_company_logo(company_name):
    """
    Optimized company logo fetching with multiple strategies and better matching
    """
    if not company_name or len(company_name.strip()) < 2:
        return None

    try:
        clean_name = company_name.strip()
        logger.info(f"🔍 Optimized logo search for: {clean_name}")

        # Normalize company name for better matching
        normalized_name = normalize_company_name(clean_name)

        # Strategy 1: Pre-defined well-known companies with exact mappings
        well_known_logos = get_well_known_logos()
        logo_url = check_well_known_companies(normalized_name, well_known_logos)
        if logo_url:
            logger.info(f"✅ Found in well-known companies: {logo_url}")
            return logo_url

        # Strategy 2: Clearbit API with multiple domain variations
        logo_url = try_clearbit_api(normalized_name)
        if logo_url:
            logger.info(f"✅ Found via Clearbit: {logo_url}")
            return logo_url

        # Strategy 3: Google favicon with domain discovery
        logo_url = try_google_favicon(normalized_name)
        if logo_url:
            logger.info(f"✅ Found via Google favicon: {logo_url}")
            return logo_url

        # Strategy 4: DuckDuckGo icon service
        logo_url = try_duckduckgo(normalized_name)
        if logo_url:
            logger.info(f"✅ Found via DuckDuckGo: {logo_url}")
            return logo_url

        # Strategy 5: Company domain discovery and favicon fetching
        logo_url = try_domain_discovery(normalized_name)
        if logo_url:
            logger.info(f"✅ Found via domain discovery: {logo_url}")
            return logo_url

        logger.warning(f"❌ No logo found for: {clean_name}")
        return None

    except Exception as e:
        logger.error(f"Error in optimized logo fetch for {company_name}: {str(e)}")
        return None


def normalize_company_name(company_name):
    """
    Normalize company name for better matching
    """
    # Convert to lowercase
    name = company_name.lower()

    # Remove common suffixes and legal entities
    suffixes = [
        'inc', 'corp', 'corporation', 'company', 'llc', 'limited', 'gmbh',
        'ltd', 'plc', 'co', 'group', 'holdings', 'technologies', 'tech',
        'software', 'systems', 'solutions', 'services', 'international'
    ]

    for suffix in suffixes:
        name = re.sub(rf'\b{suffix}\b', '', name)

    # Remove special characters and extra spaces
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()

    return name


def get_well_known_logos():
    """
    Comprehensive list of well-known companies with exact logo URLs
    """
    return {
        # Indian Companies with proper domains
        'tata': 'https://logo.clearbit.com/tata.com',
        'tata motors': 'https://logo.clearbit.com/tatamotors.com',
        'tata consultancy services': 'https://logo.clearbit.com/tcs.com',
        'tcs': 'https://logo.clearbit.com/tcs.com',
        'infosys': 'https://logo.clearbit.com/infosys.com',
        'wipro': 'https://logo.clearbit.com/wipro.com',
        'hcl': 'https://logo.clearbit.com/hcl.com',
        'hcl technologies': 'https://logo.clearbit.com/hcl.com',
        'tech mahindra': 'https://logo.clearbit.com/techmahindra.com',
        'reliance': 'https://logo.clearbit.com/ril.com',
        'reliance industries': 'https://logo.clearbit.com/ril.com',
        'reliance jio': 'https://logo.clearbit.com/jio.com',
        'jio': 'https://logo.clearbit.com/jio.com',
        'adani': 'https://logo.clearbit.com/adani.com',
        'adani group': 'https://logo.clearbit.com/adani.com',
        'mahindra': 'https://logo.clearbit.com/mahindra.com',
        'mahindra group': 'https://logo.clearbit.com/mahindra.com',
        'bajaj': 'https://logo.clearbit.com/bajaj.com',
        'bajaj auto': 'https://logo.clearbit.com/bajajauto.com',
        'bajaj finserv': 'https://logo.clearbit.com/bajajfinserv.com',
        'icici': 'https://logo.clearbit.com/icici.com',
        'icici bank': 'https://logo.clearbit.com/icicibank.com',
        'hdfc': 'https://logo.clearbit.com/hdfc.com',
        'hdfc bank': 'https://logo.clearbit.com/hdfcbank.com',
        'axis bank': 'https://logo.clearbit.com/axisbank.com',
        'state bank of india': 'https://logo.clearbit.com/sbi.co.in',
        'sbi': 'https://logo.clearbit.com/sbi.co.in',
        'kotak mahindra bank': 'https://logo.clearbit.com/kotak.com',
        'kotak': 'https://logo.clearbit.com/kotak.com',

        # Indian PSUs and Government
        'ongc': 'https://logo.clearbit.com/ongc.co.in',
        'oil and natural gas corporation': 'https://logo.clearbit.com/ongc.co.in',
        'ioc': 'https://logo.clearbit.com.iocl.com',
        'indian oil': 'https://logo.clearbit.com.iocl.com',
        'bhel': 'https://logo.clearbit.com/bhel.com',
        'bharat heavy electricals': 'https://logo.clearbit.com/bhel.com',
        'ntpc': 'https://logo.clearbit.com/ntpc.co.in',
        'coal india': 'https://logo.clearbit.com/coalindia.in',
        'bharat petroleum': 'https://logo.clearbit.com/bharatpetroleum.in',
        'hpcl': 'https://logo.clearbit.com/hindustanpetroleum.com',
        'hindustan petroleum': 'https://logo.clearbit.com/hindustanpetroleum.com',

        # Indian IT Services
        'mindtree': 'https://logo.clearbit.com/mindtree.com',
        'larsen & toubro infotech': 'https://logo.clearbit.com/lntinfotech.com',
        'lti': 'https://logo.clearbit.com/lntinfotech.com',
        'mphasis': 'https://logo.clearbit.com/mphasis.com',
        'hexaware': 'https://logo.clearbit.com/hexaware.com',
        'cipla': 'https://logo.clearbit.com/cipla.com',
        'dr reddys': 'https://logo.clearbit.com/drreddys.com',
        'sun pharma': 'https://logo.clearbit.com/sunpharma.com',

        # Indian Startups & Unicorns
        'nykaa': 'https://logo.clearbit.com/nykaa.com',
        'policybazaar': 'https://logo.clearbit.com/policybazaar.com',
        'phonepe': 'https://logo.clearbit.com/phonepe.com',
        'cred': 'https://logo.clearbit.com/cred.com',

        # Indian Automotive
        'maruti suzuki': 'https://logo.clearbit.com/marutisuzuki.com',
        'maruti': 'https://logo.clearbit.com/marutisuzuki.com',
        'hero motocorp': 'https://logo.clearbit.com/heromotocorp.com',
        'hero': 'https://logo.clearbit.com/heromotocorp.com',
        'mahindra & mahindra': 'https://logo.clearbit.com/mahindra.com',
        'ashok leyland': 'https://logo.clearbit.com/ashokleyland.com',

        # Indian Telecom
        'airtel': 'https://logo.clearbit.com/airtel.com',
        'bharti airtel': 'https://logo.clearbit.com/airtel.com',
        'vodafone idea': 'https://logo.clearbit.com/myvi.com',
        'vi': 'https://logo.clearbit.com/myvi.com',
        'bsnl': 'https://logo.clearbit.com.bsnl.co.in',

        # Global Tech Companies
        'google': 'https://logo.clearbit.com/google.com',
        'microsoft': 'https://logo.clearbit.com/microsoft.com',
        'apple': 'https://logo.clearbit.com/apple.com',
        'amazon': 'https://logo.clearbit.com/amazon.com',
        'meta': 'https://logo.clearbit.com/meta.com',
        'facebook': 'https://logo.clearbit.com/facebook.com',
        'twitter': 'https://logo.clearbit.com/twitter.com',
        'linkedin': 'https://logo.clearbit.com/linkedin.com',
        'netflix': 'https://logo.clearbit.com/netflix.com',
        'spotify': 'https://logo.clearbit.com/spotify.com',
        'ibm': 'https://logo.clearbit.com/ibm.com',
        'oracle': 'https://logo.clearbit.com/oracle.com',
        'cisco': 'https://logo.clearbit.com/cisco.com',
        'intel': 'https://logo.clearbit.com/intel.com',
        'amd': 'https://logo.clearbit.com/amd.com',
        'nvidia': 'https://logo.clearbit.com/nvidia.com',
        'samsung': 'https://logo.clearbit.com/samsung.com',
        'sony': 'https://logo.clearbit.com/sony.com',
        'compass-group-india': 'https://logo.clearbit.com/compass-group.co.in',

        # Consulting & Services
        'accenture': 'https://logo.clearbit.com/accenture.com',
        'deloitte': 'https://logo.clearbit.com/deloitte.com',
        'pwc': 'https://logo.clearbit.com/pwc.com',
        'ey': 'https://logo.clearbit.com/ey.com',
        'kpmg': 'https://logo.clearbit.com/kpmg.com',
        'capgemini': 'https://logo.clearbit.com/capgemini.com',
        'cognizant': 'https://logo.clearbit.com/cognizant.com',

        # Startups & Indian IT
        'flipkart': 'https://logo.clearbit.com/flipkart.com',
        'ola': 'https://logo.clearbit.com/olacabs.com',
        'ola electric': 'https://logo.clearbit.com/olaelectric.com',
        'paytm': 'https://logo.clearbit.com/paytm.com',
        'zomato': 'https://logo.clearbit.com/zomato.com',
        'swiggy': 'https://logo.clearbit.com/swiggy.com',
        'byjus': 'https://logo.clearbit.com/byjus.com',
        'unacademy': 'https://logo.clearbit.com/unacademy.com',
        'upgrad': 'https://logo.clearbit.com/upgrad.com',
        'razorpay': 'https://logo.clearbit.com/razorpay.com',
        'freshworks': 'https://logo.clearbit.com/freshworks.com',
        'zoho': 'https://logo.clearbit.com/zoho.com',
    }


def check_well_known_companies(normalized_name, well_known_logos):
    """
    Check if company name matches well-known companies with fuzzy matching
    """
    # Exact match first
    if normalized_name in well_known_logos:
        return well_known_logos[normalized_name]

    # Fuzzy matching for close matches
    for known_name, logo_url in well_known_logos.items():
        similarity = fuzz.ratio(normalized_name, known_name)
        if similarity > 85:  # 85% similarity threshold
            logger.info(f"🎯 Fuzzy match: {normalized_name} ~ {known_name} ({similarity}%)")
            return logo_url

    return None


def try_clearbit_api(company_name):
    """
    Try Clearbit API with multiple domain variations including Indian domains
    """
    # Expanded domain list with Indian domains prioritized
    domains = ['co.in', 'in', 'com', 'org', 'net', 'io', 'co', 'ai', 'dev', 'tech', 'ac.in']
    variations = generate_domain_variations(company_name)

    # Prioritize Indian domains for Indian company names
    if is_likely_indian_company(company_name):
        domains = ['co.in', 'in', 'com', 'org', 'net']  # Indian domains first

    for domain_variation in variations:
        for domain in domains:
            clearbit_url = f"https://logo.clearbit.com/{domain_variation}.{domain}?size=400"

            try:
                response = requests.get(clearbit_url, timeout=3, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                })

                if response.status_code == 200:
                    # Validate it's a real image (not placeholder)
                    content_type = response.headers.get('content-type', '')
                    content_length = len(response.content)

                    if ('image' in content_type and
                            content_length > 5000 and  # Clearbit placeholders are usually smaller
                            not is_clearbit_placeholder(response.content)):
                        return clearbit_url

            except requests.RequestException:
                continue

    return None


def try_google_favicon(company_name):
    """
    Try to find favicon via Google services with domain discovery including Indian domains
    """
    variations = generate_domain_variations(company_name)

    # Domain priority based on company origin
    if is_likely_indian_company(company_name):
        domains = ['co.in', 'in', 'com', 'org']
    else:
        domains = ['com', 'co.in', 'in', 'org']

    for domain_variation in variations:
        for domain in domains:
            # Try Google favicon API
            favicon_url = f"https://www.google.com/s2/favicons?domain={domain_variation}.{domain}&sz=128"

            try:
                response = requests.get(favicon_url, timeout=2)
                if response.status_code == 200 and len(response.content) > 100:
                    # Verify it's not the default favicon
                    if not is_default_favicon(response.content):
                        return favicon_url
            except:
                continue

    return None


def try_domain_discovery(company_name):
    """
    Try to discover actual domain and fetch favicon with Indian domain priority
    """
    try:
        # Domain priority based on company origin
        if is_likely_indian_company(company_name):
            domain_extensions = ['.co.in', '.in', '.com', '.org']
        else:
            domain_extensions = ['.com', '.co.in', '.in', '.org']

        domains_to_try = []
        base_name = company_name.replace(' ', '').lower()

        for ext in domain_extensions:
            domains_to_try.append(f"{base_name}{ext}")
            domains_to_try.append(f"{base_name.replace(' ', '-')}{ext}")

            # Try without common words for Indian companies
            if is_likely_indian_company(company_name):
                clean_name = remove_common_indian_suffixes(company_name).replace(' ', '').lower()
                if clean_name != base_name:
                    domains_to_try.append(f"{clean_name}{ext}")

        # Add acronym-based domains for longer company names
        if len(company_name.split()) > 2:
            acronym = ''.join([word[0] for word in company_name.split()]).lower()
            if len(acronym) > 1:
                for ext in domain_extensions[:2]:  # Try only main extensions for acronyms
                    domains_to_try.append(f"{acronym}{ext}")

        for domain in domains_to_try:
            # Try favicon for this domain
            favicon_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
            response = requests.get(favicon_url, timeout=2)

            if response.status_code == 200 and len(response.content) > 100:
                if not is_default_favicon(response.content):
                    return favicon_url

    except:
        pass

    return None


def is_likely_indian_company(company_name):
    """
    Detect if company is likely Indian based on name patterns and keywords
    """
    name_lower = company_name.lower()

    # Indian company name patterns
    indian_keywords = [
        'tata', 'reliance', 'adani', 'mahindra', 'bajaj', 'infosys', 'wipro',
        'hcl', 'tech mahindra', 'icici', 'hdfc', 'sbi', 'axis bank', 'kotak',
        'ongc', 'ioc', 'bhel', 'ntpc', 'coal india', 'itc', 'lt', 'dr reddy',
        'sun pharma', 'cipla', 'britannia', 'nestle india', 'britannia',
        'maruti', 'hero', 'bajaj auto', 'ashok leyland', 'eicher',
        'indian oil', 'bharat petroleum', 'hindustan petroleum',
        'airtel', 'jio', 'vodafone idea', 'bsnl', 'mtnl'
    ]

    # Check for Indian keywords
    for keyword in indian_keywords:
        if keyword in name_lower:
            return True

    # Check for Indian location names in company name
    indian_locations = [
        'india', 'indian', 'bharat', 'delhi', 'mumbai', 'bangalore', 'chennai',
        'kolkata', 'hyderabad', 'pune', 'ahmedabad', 'surat', 'jaipur',
        'lucknow', 'kanpur', 'nagpur', 'patna', 'indore', 'thane', 'bhopal'
    ]

    for location in indian_locations:
        if location in name_lower:
            return True

    # Check for common Indian business suffixes
    indian_suffixes = [
        'limited', 'ltd', 'pvt ltd', 'private limited', 'india ltd',
        'bharat', 'industries', 'enterprises', 'traders', 'company'
    ]

    words = name_lower.split()
    if words and words[-1] in indian_suffixes:
        return True

    return False


def remove_common_indian_suffixes(company_name):
    """
    Remove common Indian business suffixes for cleaner domain generation
    """
    suffixes = [
        'limited', 'ltd', 'pvt ltd', 'private limited', 'india limited',
        'india ltd', 'bharat', 'industries', 'enterprises', 'traders',
        'company', 'corp', 'corporation', 'international', 'global'
    ]

    name = company_name.lower()
    for suffix in suffixes:
        # Remove suffix with various spacings
        patterns = [
            f' {suffix}',
            f'-{suffix}',
            f'{suffix}',
        ]

        for pattern in patterns:
            if name.endswith(pattern):
                name = name[:-len(pattern)].strip()

    return name.title()  # Return with proper capitalization


def generate_domain_variations(company_name):
    """
    Generate possible domain name variations with Indian domain preferences
    """
    variations = set()

    # Original name variations
    base_variations = [
        company_name.replace(' ', '').lower(),
        company_name.replace(' ', '-').lower(),
        company_name.replace(' ', '').replace('.', '').lower(),
        company_name.replace(' ', '').replace('&', 'and').lower(),
    ]

    variations.update(base_variations)

    # For Indian companies, generate additional variations
    if is_likely_indian_company(company_name):
        clean_name = remove_common_indian_suffixes(company_name)
        if clean_name.lower() != company_name.lower():
            variations.add(clean_name.replace(' ', '').lower())
            variations.add(clean_name.replace(' ', '-').lower())

    # Common abbreviations and acronyms
    if ' ' in company_name:
        # Use first word
        first_word = company_name.split(' ')[0].lower()
        variations.add(first_word)

        # Use acronym (only if meaningful)
        words = company_name.split()
        if len(words) > 1:
            acronym = ''.join([word[0] for word in words]).lower()
            if len(acronym) > 1 and len(acronym) <= 5:  # Reasonable acronym length
                variations.add(acronym)

            # Try first two words for longer names
            if len(words) > 2:
                first_two = ''.join(words[:2]).lower()
                variations.add(first_two)
                variations.add('-'.join(words[:2]).lower())

    # Remove any empty variations
    variations = {v for v in variations if v and len(v) > 1}

    return list(variations)


def try_duckduckgo(company_name):
    """
    Try DuckDuckGo icon service with Indian domains
    """
    domains = ['com', 'co.in', 'in', 'org']

    for domain in domains:
        try:
            ddg_url = f"https://icons.duckduckgo.com/ip3/{company_name.replace(' ', '')}.{domain}.ico"
            response = requests.get(ddg_url, timeout=3)

            if response.status_code == 200 and len(response.content) > 100:
                return ddg_url
        except:
            continue

    return None


def is_clearbit_placeholder(image_content):
    """
    Check if Clearbit returned a placeholder image
    """
    # Simple check based on content length (placeholders are usually smaller)
    return len(image_content) < 5000


def is_default_favicon(image_content):
    """
    Check if it's a default favicon (usually very small or generic)
    """
    return len(image_content) < 500  # Default favicons are usually very small


# Add this new function for better company name extraction
def extract_company_name_from_content(content_data):
    """
    Extract and clean company name from content data
    """
    company_name = content_data.get('company', '').strip()
    if not company_name:
        return None

    # Clean and normalize the company name
    company_name = re.sub(r'[^\w\s]', '', company_name)  # Remove special chars
    company_name = re.sub(r'\s+', ' ', company_name).strip()  # Normalize spaces

    return company_name


def download_and_store_logo(logo_url, company_name, content_type, content_id):
    """
    Download logo and store it in Supabase Storage
    """
    try:
        response = requests.get(logo_url, timeout=10)
        if response.status_code != 200:
            return None

        # Validate image
        try:
            image = Image.open(io.BytesIO(response.content))
            image.verify()  # Verify it's a valid image
        except:
            return None

        # Generate unique filename
        file_extension = logo_url.split('.')[-1].lower()
        if file_extension not in ['png', 'jpg', 'jpeg', 'gif', 'ico']:
            file_extension = 'png'

        unique_filename = f"company-logos/{company_name.lower().replace(' ', '-')}-{content_id}.{file_extension}"

        # Upload to Supabase Storage
        upload_response = supabase_admin.storage.from_("company-logos").upload(
            unique_filename,
            response.content,
            {"content-type": f"image/{file_extension}"}
        )

        if upload_response:
            # Get public URL
            public_url = supabase.storage.from_("company-logos").get_public_url(unique_filename)
            return public_url

        return None

    except Exception as e:
        logger.error(f"Error storing logo for {company_name}: {str(e)}")
        return None


def get_or_fetch_logo(company_name, content_type, content_id):
    """
    Get existing logo from database or fetch new one - improved version
    """
    try:
        if not company_name:
            return None

        # First, check if we already have a logo for this company
        try:
            existing_logo = supabase.table('company_logos') \
                .select('*') \
                .ilike('company_name', f"%{company_name.lower()}%") \
                .maybe_single() \
                .execute()

            if existing_logo.data and existing_logo.data.get('logo_url'):
                logger.info(f"✅ Found existing logo in DB for {company_name}")
                return existing_logo.data['logo_url']
        except Exception as db_error:
            logger.warning(f"Database query failed for {company_name}: {str(db_error)}")
            # Continue to fetch new logo

        # If no existing logo, fetch new one
        logo_url = fetch_company_logo(company_name)
        if not logo_url:
            logger.warning(f"❌ No logo found for {company_name}")
            return None

        # Download and store the logo
        stored_logo_url = download_and_store_logo(logo_url, company_name, content_type, content_id)
        if not stored_logo_url:
            logger.warning(f"❌ Failed to store logo for {company_name}")
            return None

        # Store logo reference in database
        try:
            logo_data = {
                'company_name': company_name.lower(),
                'original_logo_url': logo_url,
                'logo_url': stored_logo_url,
                'content_type': content_type,
                'content_id': content_id,
                'created_at': get_current_utc_time().isoformat()
            }

            supabase.table('company_logos').insert(logo_data).execute()
            logger.info(f"✅ Logo stored in database for {company_name}")

            return stored_logo_url

        except Exception as e:
            logger.error(f"Error storing logo in database for {company_name}: {str(e)}")
            return stored_logo_url  # Still return the URL even if DB storage fails

    except Exception as e:
        logger.error(f"Error in get_or_fetch_logo for {company_name}: {str(e)}")
        return None


def enhance_content_with_logo(content_data, content_type, content_id):
    """
    Enhanced content data with company logo - optimized version with course fix
    """
    try:
        if not content_data:
            return content_data

        # For courses, always ensure there's a logo
        if content_type == 'course':
            # Extract and clean company name
            company_name = extract_company_name_from_content(content_data)

            if company_name:
                logger.info(f"🔍 Course logo fetch for: {company_name} ({content_type})")
                # Try to get logo with optimized method
                logo_url = get_or_fetch_logo_optimized(company_name, content_type, content_id)

                if logo_url:
                    content_data['company_logo'] = logo_url
                    logger.info(f"✅ Course logo found for {company_name}: {logo_url}")
                else:
                    # Use course default logo
                    content_data = apply_default_logo(content_data, content_type)
                    logger.info(f"⚠️ Using default course logo for {company_name}")
            else:
                # No company name, use default course logo
                content_data = apply_default_logo(content_data, content_type)
                logger.info(f"⚠️ Using default course logo (no company name)")

            return content_data

        # Original logic for jobs and internships
        company_name = extract_company_name_from_content(content_data)
        if not company_name:
            # No company name, use default logo
            return apply_default_logo(content_data, content_type)

        # If content already has a valid logo, use it
        if content_data.get('company_logo') and is_valid_logo_url(content_data['company_logo']):
            logger.info(f"✅ Using existing logo for {company_name}")
            return content_data

        logger.info(f"🔍 Optimized logo fetch for: {company_name} ({content_type})")

        # Try to get logo with optimized method
        logo_url = get_or_fetch_logo_optimized(company_name, content_type, content_id)

        if logo_url:
            content_data['company_logo'] = logo_url
            logger.info(f"✅ Logo found for {company_name}: {logo_url}")
        else:
            # Use appropriate default logo
            content_data = apply_default_logo(content_data, content_type)
            logger.info(f"⚠️ Using default logo for {company_name}")

        return content_data

    except Exception as e:
        logger.error(f"Error enhancing content with logo: {str(e)}")
        return apply_default_logo(content_data, content_type)


def get_or_fetch_logo_optimized(company_name, content_type, content_id):
    """
    Optimized version of logo fetching with better error handling
    """
    try:
        if not company_name:
            return None

        # First, check if we already have a logo for this company (fuzzy match)
        try:
            existing_logo = find_similar_company_logo(company_name)
            if existing_logo:
                return existing_logo
        except Exception as e:
            logger.warning(f"Error finding similar company logo: {str(e)}")

        # If no existing logo, fetch new one with optimized method
        try:
            logo_url = fetch_company_logo(company_name)
            if not logo_url:
                return None
        except Exception as e:
            logger.warning(f"Error fetching company logo: {str(e)}")
            return None

        # Download and store the logo
        try:
            stored_logo_url = download_and_store_logo(logo_url, company_name, content_type, content_id)
            if not stored_logo_url:
                return None
        except Exception as e:
            logger.warning(f"Error storing logo: {str(e)}")
            return logo_url  # Return the original URL if storage fails

        # Store logo reference in database (don't fail if this doesn't work)
        try:
            logo_data = {
                'company_name': company_name.lower(),
                'original_logo_url': logo_url,
                'logo_url': stored_logo_url,
                'content_type': content_type,
                'content_id': content_id,
                'created_at': get_current_utc_time().isoformat()
            }

            supabase.table('company_logos').insert(logo_data).execute()
            logger.info(f"✅ Logo stored in database for {company_name}")
        except Exception as e:
            logger.warning(f"Error storing logo in database: {str(e)}")
            # Still return the URL even if DB storage fails

        return stored_logo_url

    except Exception as e:
        logger.error(f"Error in optimized logo fetch for {company_name}: {str(e)}")
        return None


def find_similar_company_logo(company_name):
    """
    Find similar company logo in database using fuzzy matching
    """
    try:
        # Get all company logos from database
        all_logos = supabase.table('company_logos').select('company_name, logo_url').execute()

        if not all_logos.data:
            return None

        normalized_search = normalize_company_name(company_name)

        best_match = None
        highest_similarity = 0

        for logo in all_logos.data:
            db_company_name = logo['company_name']
            normalized_db = normalize_company_name(db_company_name)

            similarity = fuzz.ratio(normalized_search, normalized_db)

            if similarity > 80 and similarity > highest_similarity:  # 80% similarity threshold
                highest_similarity = similarity
                best_match = logo['logo_url']
                logger.info(f"🎯 Found similar company in DB: {db_company_name} ({similarity}% match)")

        return best_match

    except Exception as e:
        logger.warning(f"Error in similar company search: {str(e)}")
        return None


def apply_default_logo(content_data, content_type):
    """
    Apply appropriate default logo based on content type
    """
    default_logos = {
        'course': '/static/images/default-course.png',
        'job': '/static/images/default-job.png',
        'internship': '/static/images/default-internship.png'
    }

    content_data['company_logo'] = default_logos.get(content_type, '/static/images/default-company.png')
    return content_data


def is_valid_logo_url(url):
    """
    Check if logo URL is valid and not a default/placeholder
    """
    if not url or url.startswith('/static/images/default-'):
        return False

    # Check if it's a properly formatted URL
    return url.startswith('http') and len(url) > 10


def get_fallback_logo(company_name):
    """
    Get a fallback logo using better search techniques
    """
    try:
        clean_name = company_name.lower().strip()

        # Try to find logo using better search
        search_queries = [
            f"{clean_name} company logo",
            f"{clean_name} logo",
            clean_name
        ]

        for query in search_queries:
            # Try Google Custom Search API (you'd need to set this up)
            # For now, use a simple favicon approach
            logo_url = f"https://www.google.com/s2/favicons?domain={clean_name.replace(' ', '')}.com&sz=128"

            try:
                response = requests.get(logo_url, timeout=2)
                if response.status_code == 200 and len(response.content) > 100:
                    return logo_url
            except:
                continue

        return None
    except Exception as e:
        logger.error(f"Error in fallback logo: {str(e)}")
        return None


@app.route('/admin/update-content-logos')
@admin_required
def update_content_logos():
    """Utility route to add logos to existing content"""
    try:
        # Update courses
        courses = supabase.table('courses').select('id, company').execute().data or []
        for course in courses:
            if course.get('company') and not course.get('company_logo'):
                enhanced = enhance_content_with_logo(course, 'course', course['id'])
                if enhanced.get('company_logo'):
                    supabase.table('courses').update({'company_logo': enhanced['company_logo']}).eq('id', course[
                        'id']).execute()

        # Update jobs
        jobs = supabase.table('jobs').select('id, company').execute().data or []
        for job in jobs:
            if job.get('company') and not job.get('company_logo'):
                enhanced = enhance_content_with_logo(job, 'job', job['id'])
                if enhanced.get('company_logo'):
                    supabase.table('jobs').update({'company_logo': enhanced['company_logo']}).eq('id',
                                                                                                 job['id']).execute()

        # Update internships
        internships = supabase.table('internships').select('id, company').execute().data or []
        for internship in internships:
            if internship.get('company') and not internship.get('company_logo'):
                enhanced = enhance_content_with_logo(internship, 'internship', internship['id'])
                if enhanced.get('company_logo'):
                    supabase.table('internships').update({'company_logo': enhanced['company_logo']}).eq('id',
                                                                                                        internship[
                                                                                                            'id']).execute()

        return jsonify({'success': True, 'message': 'Content logos updated successfully'})

    except Exception as e:
        logger.error(f"Error updating content logos: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500


# Categories handle
def handle_categories_data(data):
    """Handle categories data conversion from string to array"""
    if 'categories' in data:
        if isinstance(data['categories'], str):
            # Convert comma-separated string to array
            categories = [cat.strip() for cat in data['categories'].split(',') if cat.strip()]
            data['categories'] = categories
        elif isinstance(data['categories'], list):
            # Ensure it's a proper array
            data['categories'] = [cat for cat in data['categories'] if cat]
    return data


# function to check and auto-deactivate expired content
# Initialize scheduler
scheduler = BackgroundScheduler()


def check_expired_content():
    """Check and deactivate expired content - ENHANCED VERSION"""
    try:
        current_time = get_current_utc_time()
        current_time_iso = current_time.isoformat()
        logger.info(f"🔍 Checking expired content at {current_time_iso}")

        total_deactivated = 0
        deactivated_items = []

        # Find expired but still active courses and deactivate them
        expired_courses = supabase_admin.table('courses').select(
            'id, title, expiration_date, is_active, company'
        ).lt('expiration_date', current_time_iso).eq('is_active', True).execute().data or []

        logger.info(f"📚 Found {len(expired_courses)} expired active courses to deactivate")

        for course in expired_courses:
            try:
                result = supabase_admin.table('courses').update({
                    'is_active': False,
                    'is_featured': False,  # Also remove from featured when expired
                    'updated_at': current_time_iso
                }).eq('id', course['id']).execute()

                if result.data:
                    logger.info(f"✅ Auto-deactivated expired course: {course['title']} (ID: {course['id']})")
                    total_deactivated += 1
                    deactivated_items.append({
                        'type': 'course',
                        'title': course['title'],
                        'id': course['id'],
                        'company': course.get('company', 'N/A')
                    })
                else:
                    logger.error(f"❌ Failed to deactivate course: {course['title']} (ID: {course['id']})")
            except Exception as course_error:
                logger.error(f"❌ Error deactivating course {course['id']}: {str(course_error)}")

        # Find expired but still active jobs and deactivate them
        expired_jobs = supabase_admin.table('jobs').select(
            'id, title, expiration_date, is_active, company, location'
        ).lt('expiration_date', current_time_iso).eq('is_active', True).execute().data or []

        logger.info(f"💼 Found {len(expired_jobs)} expired active jobs to deactivate")

        for job in expired_jobs:
            try:
                result = supabase_admin.table('jobs').update({
                    'is_active': False,
                    'is_featured': False,  # Also remove from featured when expired
                    'updated_at': current_time_iso
                }).eq('id', job['id']).execute()

                if result.data:
                    logger.info(f"✅ Auto-deactivated expired job: {job['title']} (ID: {job['id']})")
                    total_deactivated += 1
                    deactivated_items.append({
                        'type': 'job',
                        'title': job['title'],
                        'id': job['id'],
                        'company': job.get('company', 'N/A')
                    })
                else:
                    logger.error(f"❌ Failed to deactivate job: {job['title']} (ID: {job['id']})")
            except Exception as job_error:
                logger.error(f"❌ Error deactivating job {job['id']}: {str(job_error)}")

        # Find expired but still active internships and deactivate them
        expired_internships = supabase_admin.table('internships').select(
            'id, title, expiration_date, is_active, company, location'
        ).lt('expiration_date', current_time_iso).eq('is_active', True).execute().data or []

        logger.info(f"🎓 Found {len(expired_internships)} expired active internships to deactivate")

        for internship in expired_internships:
            try:
                result = supabase_admin.table('internships').update({
                    'is_active': False,
                    'is_featured': False,  # Also remove from featured when expired
                    'updated_at': current_time_iso
                }).eq('id', internship['id']).execute()

                if result.data:
                    logger.info(
                        f"✅ Auto-deactivated expired internship: {internship['title']} (ID: {internship['id']})")
                    total_deactivated += 1
                    deactivated_items.append({
                        'type': 'internship',
                        'title': internship['title'],
                        'id': internship['id'],
                        'company': internship.get('company', 'N/A')
                    })
                else:
                    logger.error(f"❌ Failed to deactivate internship: {internship['title']} (ID: {internship['id']})")
            except Exception as internship_error:
                logger.error(f"❌ Error deactivating internship {internship['id']}: {str(internship_error)}")

        # Log detailed summary
        if total_deactivated > 0:
            logger.info(f"🎯 Total auto-deactivated: {total_deactivated} items")

            # Create detailed admin notification
            notification_message = f"Automatically deactivated {total_deactivated} expired content items:\n"

            for item in deactivated_items:
                notification_message += f"- {item['type'].title()}: {item['title']} ({item['company']})\n"

            # Create admin notification
            notification_data = {
                'type': 'system',
                'title': 'Expired Content Auto-Deactivated',
                'message': notification_message,
                'created_at': current_time_iso
            }

            try:
                supabase_admin.table('admin_notifications').insert(notification_data).execute()
                logger.info("📢 Admin notification created for expired content")
            except Exception as notif_error:
                logger.error(f"❌ Failed to create admin notification: {str(notif_error)}")

        else:
            logger.info("✅ No expired content found to deactivate")

        return {
            'success': True,
            'total_deactivated': total_deactivated,
            'deactivated_items': deactivated_items,
            'timestamp': current_time_iso
        }

    except Exception as e:
        logger.error(f"❌ Error checking expired content: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'timestamp': get_current_utc_time().isoformat()
        }


def start_scheduler():
    """Start the background scheduler"""
    try:
        # Add the expiration check job - run every 30 seconds
        scheduler.add_job(
            check_expired_content,
            'interval',
            seconds=30,
            id='expiration_check',
            name='Check and deactivate expired content'
        )

        scheduler.start()
        logger.info("🚀 APScheduler started - Expiration checks running every 30 seconds")

        # Run immediate check on startup
        check_expired_content()

    except Exception as e:
        logger.error(f"❌ Failed to start scheduler: {str(e)}")


def shutdown_scheduler():
    """Shutdown scheduler gracefully"""
    try:
        if scheduler.running:
            scheduler.shutdown()
            logger.info("🛑 Scheduler shut down gracefully")
    except Exception as e:
        logger.error(f"Error shutting down scheduler: {str(e)}")


# Register shutdown function
atexit.register(shutdown_scheduler)

# Start scheduler immediately
start_scheduler()


# Routes
@app.route('/')
def index():
    try:
        user_id = session.get('user_id')

        # Get current time in UTC for expiration comparison
        current_time = get_current_utc_time().isoformat()
        logger.info(f"🕐 Current time for expiration check: {current_time}")

        # Initialize empty lists for all sections
        enhanced_courses = []
        enhanced_jobs = []
        enhanced_internships = []
        blogs = []
        testimonials = []

        # ===== FETCH COURSES - Most recent first =====
        try:
            # Get active and featured courses that are NOT expired
            courses_query = supabase.table('courses') \
                .select('*') \
                .eq('is_featured', True) \
                .eq('is_active', True) \
                .or_(f'expiration_date.is.null,expiration_date.gt.{current_time}') \
                .order('created_at', desc=True) \
                .limit(4)

            courses = courses_query.execute().data or []

            # Ensure views field exists
            for course in courses:
                if 'views' not in course:
                    course['views'] = 0
            logger.info(f"📚 Found {len(courses)} active featured courses for homepage")

            # Enhance courses with logos
            for course in courses:
                try:
                    # Simple enhancement without complex logo fetching that might fail
                    if course.get('company'):
                        # Try to get logo but don't fail if it doesn't work
                        try:
                            logo_url = get_or_fetch_logo_optimized(course['company'], 'course', course.get('id'))
                            if logo_url:
                                course['company_logo'] = logo_url
                            else:
                                course['company_logo'] = '/static/images/default-course.png'
                        except:
                            course['company_logo'] = '/static/images/default-course.png'
                    else:
                        course['company_logo'] = '/static/images/default-course.png'

                    enhanced_courses.append(course)
                except Exception as e:
                    logger.error(f"Error enhancing course {course.get('id')}: {str(e)}")
                    # Add course with default image rather than failing
                    course['company_logo'] = '/static/images/default-course.png'
                    enhanced_courses.append(course)

        except Exception as e:
            logger.error(f"Error loading courses for homepage: {str(e)}")
            # Keep enhanced_courses as empty list

        # ===== FETCH JOBS - Most recent first =====
        try:
            jobs_query = supabase.table('jobs') \
                .select('*') \
                .eq('is_featured', True) \
                .eq('is_active', True) \
                .or_(f'expiration_date.is.null,expiration_date.gt.{current_time}') \
                .order('created_at', desc=True) \
                .limit(4)

            jobs = jobs_query.execute().data or []
            logger.info(f"💼 Found {len(jobs)} active featured jobs for homepage")

            for job in jobs:
                try:
                    # Simple enhancement for jobs
                    if job.get('company'):
                        try:
                            logo_url = get_or_fetch_logo_optimized(job['company'], 'job', job.get('id'))
                            if logo_url:
                                job['company_logo'] = logo_url
                            else:
                                job['company_logo'] = '/static/images/default-job.png'
                        except:
                            job['company_logo'] = '/static/images/default-job.png'
                    else:
                        job['company_logo'] = '/static/images/default-job.png'

                    # Ensure all required fields exist
                    job.setdefault('description', 'No description available')
                    job.setdefault('location', 'Location not specified')
                    job.setdefault('salary', 'Not specified')
                    job.setdefault('type', 'Full-time')

                    enhanced_jobs.append(job)
                except Exception as e:
                    logger.error(f"Error enhancing job {job.get('id')}: {str(e)}")
                    # Add job with defaults rather than failing
                    job['company_logo'] = '/static/images/default-job.png'
                    enhanced_jobs.append(job)

        except Exception as e:
            logger.error(f"Error loading jobs for homepage: {str(e)}")
            # Keep enhanced_jobs as empty list

        # ===== FETCH INTERNSHIPS - Most recent first =====
        try:
            internships_query = supabase.table('internships') \
                .select('*') \
                .eq('is_featured', True) \
                .eq('is_active', True) \
                .or_(f'expiration_date.is.null,expiration_date.gt.{current_time}') \
                .order('created_at', desc=True) \
                .limit(4)

            internships = internships_query.execute().data or []
            logger.info(f"🎓 Found {len(internships)} active featured internships for homepage")

            for internship in internships:
                try:
                    # Simple enhancement for internships
                    if internship.get('company'):
                        try:
                            logo_url = get_or_fetch_logo_optimized(internship['company'], 'internship',
                                                                   internship.get('id'))
                            if logo_url:
                                internship['company_logo'] = logo_url
                            else:
                                internship['company_logo'] = '/static/images/default-internship.png'
                        except:
                            internship['company_logo'] = '/static/images/default-internship.png'
                    else:
                        internship['company_logo'] = '/static/images/default-internship.png'

                    # Ensure all required fields exist
                    internship.setdefault('description', 'No description available')
                    internship.setdefault('location', 'Location not specified')
                    internship.setdefault('stipend', 'Unpaid')
                    internship.setdefault('duration', 'Flexible')
                    internship.setdefault('type', 'Internship')

                    enhanced_internships.append(internship)
                except Exception as e:
                    logger.error(f"Error enhancing internship {internship.get('id')}: {str(e)}")
                    # Add internship with defaults rather than failing
                    internship['company_logo'] = '/static/images/default-internship.png'
                    enhanced_internships.append(internship)

        except Exception as e:
            logger.error(f"Error loading internships for homepage: {str(e)}")

        # ===== FETCH BLOGS - Most recent first =====
        try:
            blogs_query = supabase.table('blog_posts') \
                .select('*') \
                .eq('is_featured', True) \
                .eq('is_active', True) \
                .order('created_at', desc=True) \
                .limit(4)

            blogs = blogs_query.execute().data or []

            # Get view counts for each blog
            if blogs:
                blog_ids = [blog['id'] for blog in blogs]

                # Fetch view counts from blog_views table
                view_counts_response = supabase_admin.table('blog_views') \
                    .select('blog_id, id') \
                    .in_('blog_id', blog_ids) \
                    .execute()

                # Count views per blog
                view_counts = {}
                for view in (view_counts_response.data or []):
                    blog_id = view['blog_id']
                    view_counts[blog_id] = view_counts.get(blog_id, 0) + 1

                # Add view count to each blog
                for blog in blogs:
                    blog['views'] = view_counts.get(blog['id'], 0)

            logger.info(f"📝 Found {len(blogs)} active featured blogs for homepage")

        except Exception as e:
            logger.error(f"Error loading blogs for homepage: {str(e)}")
            blogs = []

        # ===== FETCH TESTIMONIALS =====
        try:
            testimonials_query = supabase.table('testimonials') \
                .select('*') \
                .eq('is_active', True) \
                .order('created_at', desc=True) \
                .limit(3)

            testimonials = testimonials_query.execute().data or []
            logger.info(f"💬 Found {len(testimonials)} testimonials for homepage")

        except Exception as e:
            logger.error(f"Error loading testimonials for homepage: {str(e)}")

        # ===== ADD BOOKMARK STATUS IF USER IS LOGGED IN =====
        if user_id:
            try:
                user_bookmarks = get_user_bookmarks(user_id)
                bookmark_map = {}

                # Create a map of (content_type, id) -> True for faster lookup
                for item in user_bookmarks:
                    content_type = item.get('content_type')
                    item_id = item.get('id')
                    if content_type and item_id:
                        bookmark_map[(content_type, item_id)] = True

                # Add bookmark status to courses
                for course in enhanced_courses:
                    course['is_bookmarked'] = bookmark_map.get(('course', course.get('id')), False)

                # Add bookmark status to jobs
                for job in enhanced_jobs:
                    job['is_bookmarked'] = bookmark_map.get(('job', job.get('id')), False)

                # Add bookmark status to internships
                for internship in enhanced_internships:
                    internship['is_bookmarked'] = bookmark_map.get(('internship', internship.get('id')), False)

                # Add bookmark status to blogs
                for blog in blogs:
                    blog['is_bookmarked'] = bookmark_map.get(('blog', blog.get('id')), False)

                logger.info(f"🔖 Added bookmark status for user {user_id}")

            except Exception as e:
                logger.error(f"Error loading bookmarks for homepage: {str(e)}")

        # ===== GET USER PROFILE PICTURE IF LOGGED IN =====
        profile_pic_data = None
        if user_id:
            try:
                user_response = supabase_admin.table('users').select('profile_pic, username, email').eq('id',
                                                                                                        user_id).execute()
                if user_response.data:
                    user = user_response.data[0]

                    if user.get('profile_pic'):
                        timestamp = int(datetime.now().timestamp())
                        project_ref = supabase_url.split('//')[1].split('.')[0]
                        profile_pic_url = f"https://{project_ref}.supabase.co/storage/v1/object/public/profile-pictures/{user['profile_pic']}?t={timestamp}"

                        profile_pic_data = {
                            'url': profile_pic_url,
                            'username': user['username'],
                            'email': user.get('email', ''),
                            'has_picture': True
                        }
                    else:
                        profile_pic_data = {
                            'url': None,
                            'username': user['username'],
                            'email': user.get('email', ''),
                            'has_picture': False
                        }
            except Exception as e:
                logger.error(f"Error fetching user data for index: {str(e)}")
                profile_pic_data = None

        # Log final counts
        logger.info(
            f"🏠 Homepage loaded - Courses: {len(enhanced_courses)}, Jobs: {len(enhanced_jobs)}, Internships: {len(enhanced_internships)}, Blogs: {len(blogs)}")

        # Add current time to template for expiration badge comparison
        now = datetime.now()

        return render_template('index.html',
                               courses=enhanced_courses,
                               jobs=enhanced_jobs,
                               internships=enhanced_internships,
                               blogs=blogs,
                               testimonials=testimonials,
                               profile_pic_data=profile_pic_data,
                               now=now)

    except Exception as e:
        logger.error(f"❌ Critical error in index route: {str(e)}", exc_info=True)
        # Return template with empty lists rather than crashing
        now = datetime.now()
        return render_template('index.html',
                               courses=[],
                               jobs=[],
                               internships=[],
                               blogs=[],
                               testimonials=[],
                               profile_pic_data=None,
                               now=now)


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
            return jsonify({
                'status': 'error',
                'message': 'Email already registered. Please use a different email or login.'
            }), 400

        # Also check for existing username
        existing_username = supabase.table('users').select('username').eq('username', username).execute()
        if existing_username.data:
            return jsonify({
                'status': 'error',
                'message': 'Username already taken. Please choose another username.'
            }), 400

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
        current_time = get_current_utc_time()

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
            # Check if user is active
            if not user.get('is_active', True):
                return jsonify({
                    'error': 'Your account has been deactivated. Please contact administrator.',
                    'account_inactive': True
                }), 401

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


# =============================================
# PASSWORD RESET ROUTES (MODAL VERSION)
# =============================================

@app.route('/reset-password-request', methods=['POST'])
def reset_password_request():
    """Step 1: Send OTP to email"""
    try:
        data = request.get_json()
        email = data.get('email')

        if not email:
            return jsonify({'status': 'error', 'message': 'Email is required'}), 400

        # Check if user exists
        user = supabase_admin.table('users').select('username').eq('email', email).maybe_single().execute()

        if not user.data:
            # Return success even if email doesn't exist (security best practice)
            return jsonify({
                'status': 'success',
                'message': 'If an account exists, an OTP has been sent'
            })

        # Delete any existing OTPs for this email
        supabase_admin.table('password_reset_otp').delete().eq('email', email).execute()

        # Generate and store new OTP
        otp, expires_at = generate_otp()
        supabase_admin.table('password_reset_otp').insert({
            'email': email,
            'otp': otp,
            'expires_at': expires_at
        }).execute()

        # Send OTP email
        username = user.data.get('username', 'User')
        email_sent = send_otp_email(email, username, otp)

        return jsonify({
            'status': 'success',
            'message': 'OTP sent successfully',
            'email': email
        })

    except Exception as e:
        logger.error(f"Reset password request error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Failed to send OTP'}), 500


@app.route('/reset-password-verify', methods=['POST'])
def reset_password_verify():
    """Step 2: Verify OTP"""
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')

        if not email or not otp:
            return jsonify({'status': 'error', 'message': 'Email and OTP are required'}), 400

        # Verify OTP
        otp_record = supabase_admin.table('password_reset_otp').select('*') \
            .eq('email', email) \
            .order('created_at', desc=True) \
            .limit(1) \
            .maybe_single() \
            .execute()

        if not otp_record.data:
            return jsonify({'status': 'error', 'message': 'No OTP found. Please request a new one.'}), 404

        # Check expiration
        expires_at = parse_db_timestamp(otp_record.data['expires_at'])
        current_time = get_current_utc_time()

        if otp_record.data['otp'] != otp:
            return jsonify({'status': 'error', 'message': 'Invalid OTP code'}), 400

        if expires_at <= current_time:
            return jsonify({'status': 'error', 'message': 'OTP has expired. Please request a new one.'}), 400

        # OTP is valid - delete it and create a reset token
        supabase_admin.table('password_reset_otp').delete().eq('id', otp_record.data['id']).execute()

        # Create a temporary reset token (valid for 15 minutes)
        reset_token = secrets.token_urlsafe(32)

        # Check if table exists, if not create it
        try:
            supabase_admin.table('password_reset_tokens').insert({
                'email': email,
                'token': reset_token,
                'expires_at': (current_time + timedelta(minutes=15)).isoformat()
            }).execute()
        except Exception as table_error:
            # Table might not exist, create it via raw SQL or use a different approach
            logger.warning(f"Could not insert token: {str(table_error)}")
            # Fallback: store in session
            session['reset_token'] = reset_token
            session['reset_email'] = email

        return jsonify({
            'status': 'success',
            'message': 'OTP verified successfully',
            'reset_token': reset_token
        })

    except Exception as e:
        logger.error(f"OTP verification error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Verification failed'}), 500


@app.route('/reset-password-confirm', methods=['POST'])
def reset_password_confirm():
    """Step 3: Set new password"""
    try:
        data = request.get_json()
        reset_token = data.get('reset_token')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')

        if not reset_token or not new_password or not confirm_password:
            return jsonify({'status': 'error', 'message': 'All fields are required'}), 400

        if new_password != confirm_password:
            return jsonify({'status': 'error', 'message': 'Passwords do not match'}), 400

        # Validate password strength
        is_valid, message = validate_password(new_password)
        if not is_valid:
            return jsonify({'status': 'error', 'message': message}), 400

        # Get email from token
        email = None

        # Try to get from database first
        try:
            token_record = supabase_admin.table('password_reset_tokens').select('*') \
                .eq('token', reset_token) \
                .maybe_single() \
                .execute()

            if token_record.data:
                expires_at = parse_db_timestamp(token_record.data['expires_at'])
                current_time = get_current_utc_time()

                if expires_at <= current_time:
                    return jsonify({'status': 'error', 'message': 'Reset token has expired'}), 400

                email = token_record.data['email']
                # Delete the used token
                supabase_admin.table('password_reset_tokens').delete().eq('token', reset_token).execute()
        except Exception:
            # Fallback to session
            if session.get('reset_token') == reset_token:
                email = session.get('reset_email')
                session.pop('reset_token', None)
                session.pop('reset_email', None)

        if not email:
            return jsonify({'status': 'error', 'message': 'Invalid or expired reset token'}), 400

        # Update password
        supabase_admin.table('users').update({
            'password_hash': hash_password(new_password),
            'updated_at': get_current_utc_time().isoformat()
        }).eq('email', email).execute()

        return jsonify({
            'status': 'success',
            'message': 'Password reset successfully! Please login with your new password.'
        })

    except Exception as e:
        logger.error(f"Password reset confirm error: {str(e)}")
        return jsonify({'status': 'error', 'message': 'Failed to reset password'}), 500


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

        # Validate image
        try:
            image = Image.open(BytesIO(file_data))
            image.verify()
            image = Image.open(BytesIO(file_data))  # Re-open after verification
            image_format = image.format.lower() if image.format else 'png'

            # Resize image if too large
            max_size = (800, 800)
            if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                image.thumbnail(max_size, Image.Resampling.LANCZOS)

                # Convert back to bytes
                img_byte_arr = BytesIO()
                image.save(img_byte_arr, format=image_format)
                file_data = img_byte_arr.getvalue()
        except Exception as img_error:
            logger.warning(f"Image processing error: {str(img_error)}")
            # Continue with original file if processing fails

        # Generate unique filename with timestamp to prevent caching
        ext = file.filename.rsplit('.', 1)[1].lower()
        timestamp = int(datetime.now().timestamp())
        unique_name = f"{user_id}/{uuid.uuid4().hex}_{timestamp}.{ext}"

        # Delete old profile picture if exists
        try:
            user_response = supabase_admin.table('users').select('profile_pic').eq('id', user_id).execute()
            if user_response.data and user_response.data[0].get('profile_pic'):
                old_file_path = user_response.data[0]['profile_pic']
                # Try to delete old file from storage
                try:
                    supabase_admin.storage.from_("profile-pictures").remove([old_file_path])
                except Exception as delete_error:
                    logger.warning(f"Could not delete old profile picture: {str(delete_error)}")
        except Exception as e:
            logger.warning(f"Error checking old profile picture: {str(e)}")

        # Use admin client to bypass RLS for storage operations
        response = supabase_admin.storage.from_("profile-pictures").upload(
            unique_name,
            file_data,
            {
                "content-type": file.content_type,
                "cache-control": "no-cache, no-store, must-revalidate",
                "pragma": "no-cache"
            }
        )

        if isinstance(response, dict) and response.get("error"):
            logger.error(f"Supabase upload error: {response}")
            return jsonify({'success': False, 'error': 'Failed to upload image'}), 500

        # Get public URL - FORCE CACHE BUSTING
        project_ref = supabase_url.split('//')[1].split('.')[0]
        image_url = f"https://{project_ref}.supabase.co/storage/v1/object/public/profile-pictures/{unique_name}?t={timestamp}"

        # Store the file path in DB using admin client (bypasses RLS)
        supabase_admin.table('users').update({'profile_pic': unique_name}).eq('id', user_id).execute()

        # Clear any cached user data
        if 'user_profile_pic' in session:
            del session['user_profile_pic']

        return jsonify({
            'success': True,
            'image_url': image_url,
            'cache_bust_timestamp': timestamp,
            'message': 'Profile picture updated successfully'
        })

    except Exception as e:
        logger.error(f"Upload error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/get-profile-pic')
@login_required
def get_profile_pic():
    user_id = session['user_id']
    try:
        # Get current timestamp for cache busting
        cache_bust_timestamp = request.args.get('t') or str(int(datetime.now().timestamp()))

        user = supabase_admin.table('users').select('profile_pic').eq('id', user_id).single().execute().data
        if user and user.get('profile_pic'):
            # Generate fresh URL with cache busting parameter
            project_ref = supabase_url.split('//')[1].split('.')[0]
            image_url = f"https://{project_ref}.supabase.co/storage/v1/object/public/profile-pictures/{user['profile_pic']}?t={cache_bust_timestamp}"

            return jsonify({
                'success': True,
                'image_url': image_url,
                'cache_bust_timestamp': cache_bust_timestamp,
                'profile_pic_path': user['profile_pic']
            })

        return jsonify({
            'success': False,
            'error': 'No profile picture',
            'default_url': f"https://ui-avatars.com/api/?name=User&background=007bff&color=fff&bold=true"
        })

    except Exception as e:
        logger.error(f"Profile pic fetch error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'default_url': f"https://ui-avatars.com/api/?name=User&background=007bff&color=fff&bold=true"
        }), 500


@app.route('/api/clear-profile-cache', methods=['POST'])
@login_required
def clear_profile_cache():
    """Clear client-side cache for profile picture"""
    try:
        user_id = session['user_id']

        # Generate new cache bust timestamp
        timestamp = int(datetime.now().timestamp())

        # Get current profile picture path
        user_response = supabase_admin.table('users').select('profile_pic').eq('id', user_id).execute()

        if user_response.data and user_response.data[0].get('profile_pic'):
            profile_pic_path = user_response.data[0]['profile_pic']
            project_ref = supabase_url.split('//')[1].split('.')[0]
            image_url = f"https://{project_ref}.supabase.co/storage/v1/object/public/profile-pictures/{profile_pic_path}?t={timestamp}"

            return jsonify({
                'success': True,
                'image_url': image_url,
                'cache_bust_timestamp': timestamp
            })

        return jsonify({
            'success': True,
            'image_url': None,
            'message': 'No profile picture to clear cache for'
        })

    except Exception as e:
        logger.error(f"Clear profile cache error: {str(e)}")
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


def get_profile_pic_url_with_cache_bust(profile_pic_path, timestamp=None):
    """
    Generate profile picture URL with cache busting
    """
    if not profile_pic_path:
        return None

    if timestamp is None:
        timestamp = int(datetime.now().timestamp())

    try:
        project_ref = supabase_url.split('//')[1].split('.')[0]
        return f"https://{project_ref}.supabase.co/storage/v1/object/public/profile-pictures/{profile_pic_path}?t={timestamp}"
    except Exception as e:
        logger.error(f"Error generating profile pic URL: {str(e)}")
        return None


@app.route('/dashboard')
@login_required
def user_dashboard():
    try:
        if 'logout_message' in session:
            flash(session.pop('logout_message'), 'success')

        user_id = session.get('user_id')
        logger.info(f"Loading dashboard for user: {user_id}")

        # Get user data
        user_response = supabase_admin.table('users').select('*').eq('id', user_id).execute()
        if not user_response.data:
            flash('User not found', 'danger')
            return redirect(url_for('index'))

        user = user_response.data[0]

        # Get profile picture URL from Supabase storage WITH CACHE BUSTING
        avatar_url = None
        cache_timestamp = int(datetime.now().timestamp())

        if user and user.get('profile_pic'):
            try:
                # Force fresh URL with timestamp
                project_ref = supabase_url.split('//')[1].split('.')[0]
                avatar_url = f"https://{project_ref}.supabase.co/storage/v1/object/public/profile-pictures/{user['profile_pic']}?t={cache_timestamp}"

                logger.info(f"Profile picture URL with cache busting: {avatar_url}")
            except Exception as e:
                logger.error(f"Error getting profile picture URL: {str(e)}")
                avatar_url = None

        # If no profile picture, use default avatar
        if not avatar_url:
            username = user.get('username', 'User')
            avatar_url = f"https://ui-avatars.com/api/?name={username}&background=007bff&color=fff&bold=true"

        # Get user bookmarks
        bookmarks = get_user_bookmarks(user_id)
        logger.info(f"Retrieved {len(bookmarks)} bookmarks for dashboard")

        # Separate bookmarks by type
        course_bookmarks = [b for b in bookmarks if b.get('content_type') == 'course']
        job_bookmarks = [b for b in bookmarks if b.get('content_type') == 'job']
        internship_bookmarks = [b for b in bookmarks if b.get('content_type') == 'internship']
        blog_bookmarks = [b for b in bookmarks if b.get('content_type') == 'blog']

        # FIX: Fetch FRESH course data from courses table
        enhanced_courses = []
        if course_bookmarks:
            course_ids = [bookmark['id'] for bookmark in course_bookmarks]

            try:
                courses_data = supabase_admin.table('courses') \
                                   .select('*') \
                                   .in_('id', course_ids) \
                                   .eq('is_active', True) \
                                   .execute().data or []

                enhanced_courses = [enhance_content_with_logo(course, 'course', course.get('id')) for course in
                                    courses_data]

                for course in enhanced_courses:
                    course['is_bookmarked'] = True

            except Exception as e:
                logger.error(f"Error enhancing course data: {str(e)}")
                for bookmark in course_bookmarks:
                    enhanced_course = bookmark.copy()
                    enhanced_course['company_logo'] = '/static/images/default-course.jpg'
                    enhanced_courses.append(enhanced_course)

        # FIX: Fetch FRESH job data from jobs table
        enhanced_jobs = []
        if job_bookmarks:
            job_ids = [bookmark['id'] for bookmark in job_bookmarks]

            try:
                jobs_data = supabase_admin.table('jobs') \
                                .select('*') \
                                .in_('id', job_ids) \
                                .eq('is_active', True) \
                                .execute().data or []

                enhanced_jobs = [enhance_content_with_logo(job, 'job', job.get('id')) for job in jobs_data]

                for job in enhanced_jobs:
                    job['is_bookmarked'] = True

            except Exception as e:
                logger.error(f"Error enhancing job data: {str(e)}")
                for bookmark in job_bookmarks:
                    enhanced_job = bookmark.copy()
                    enhanced_job['company_logo'] = '/static/images/default-job.jpg'
                    enhanced_jobs.append(enhanced_job)

        # FIX: Fetch FRESH internship data from internships table
        enhanced_internships = []
        if internship_bookmarks:
            internship_ids = [bookmark['id'] for bookmark in internship_bookmarks]

            try:
                internships_data = supabase_admin.table('internships') \
                                       .select('*') \
                                       .in_('id', internship_ids) \
                                       .eq('is_active', True) \
                                       .execute().data or []

                enhanced_internships = [enhance_content_with_logo(internship, 'internship', internship.get('id')) for
                                        internship in internships_data]

                for internship in enhanced_internships:
                    internship['is_bookmarked'] = True

            except Exception as e:
                logger.error(f"Error enhancing internship data: {str(e)}")
                for bookmark in internship_bookmarks:
                    enhanced_internship = bookmark.copy()
                    enhanced_internship['company_logo'] = '/static/images/default-internship.jpg'
                    enhanced_internships.append(enhanced_internship)

        # ENHANCE BLOG BOOKMARKS
        enhanced_blogs = []
        if blog_bookmarks:
            blog_ids = [bookmark['id'] for bookmark in blog_bookmarks]

            try:
                blogs_data_response = supabase_admin.table('blog_posts') \
                    .select('*') \
                    .in_('id', blog_ids) \
                    .eq('is_active', True) \
                    .execute()

                blogs_data = {blog['id']: blog for blog in (blogs_data_response.data or [])}

                # Get view counts
                view_counts_response = supabase_admin.table('blog_views') \
                    .select('blog_id, id') \
                    .in_('blog_id', blog_ids) \
                    .execute()

                view_counts = {}
                for view in (view_counts_response.data or []):
                    blog_id = view['blog_id']
                    view_counts[blog_id] = view_counts.get(blog_id, 0) + 1

                # Get like counts
                like_counts_response = supabase_admin.table('blog_likes') \
                    .select('blog_id, id') \
                    .in_('blog_id', blog_ids) \
                    .execute()

                like_counts = {}
                for like in (like_counts_response.data or []):
                    blog_id = like['blog_id']
                    like_counts[blog_id] = like_counts.get(blog_id, 0) + 1

                # Enhance each blog bookmark with additional data
                for bookmark in blog_bookmarks:
                    blog_id = bookmark['id']
                    blog_data = blogs_data.get(blog_id, {})

                    enhanced_blog = bookmark.copy()

                    # Add data from blog_posts table
                    enhanced_blog['title'] = blog_data.get('title', bookmark.get('title', 'Untitled Article'))
                    enhanced_blog['description'] = blog_data.get('description', bookmark.get('description', ''))
                    enhanced_blog['content'] = blog_data.get('content', '')
                    enhanced_blog['image'] = blog_data.get('image', '/static/images/default-blog.jpg')
                    enhanced_blog['author'] = blog_data.get('author', 'CareerMaker Team')
                    enhanced_blog['read_time'] = blog_data.get('read_time', '5 min read')
                    enhanced_blog['categories'] = blog_data.get('categories', ['Career'])
                    enhanced_blog['is_bookmarked'] = True

                    # Add view and like counts
                    enhanced_blog['views'] = view_counts.get(blog_id, 0)
                    enhanced_blog['like_count'] = like_counts.get(blog_id, 0)

                    enhanced_blogs.append(enhanced_blog)

            except Exception as e:
                logger.error(f"Error enhancing blog data: {str(e)}")
                for bookmark in blog_bookmarks:
                    enhanced_blog = bookmark.copy()
                    enhanced_blog['image'] = '/static/images/default-blog.jpg'
                    enhanced_blog['views'] = 0
                    enhanced_blog['like_count'] = 0
                    enhanced_blog['read_time'] = '5 min read'
                    enhanced_blog['categories'] = ['Career']
                    enhanced_blogs.append(enhanced_blog)

        # NEW: Get user testimonials - REMOVED APPROVAL SYSTEM
        user_testimonials = []
        try:
            # Assuming testimonials are stored in a 'testimonials' table
            testimonials_response = supabase_admin.table('testimonials') \
                .select('*') \
                .eq('user_id', user_id) \
                .eq('is_active', True) \
                .order('created_at', desc=True) \
                .execute()

            user_testimonials = testimonials_response.data or []
            logger.info(f"Retrieved {len(user_testimonials)} testimonials for user {user_id}")

        except Exception as e:
            logger.error(f"Error fetching user testimonials: {str(e)}")
            user_testimonials = []

        logger.info(
            f"Dashboard breakdown - Courses: {len(enhanced_courses)}, Jobs: {len(enhanced_jobs)}, Internships: {len(enhanced_internships)}, Blogs: {len(enhanced_blogs)}, Testimonials: {len(user_testimonials)}")

        return render_template('user-dashboard.html',
                               username=user.get('username'),
                               email=user.get('email'),
                               avatar_url=avatar_url,
                               courses=enhanced_courses,
                               jobs=enhanced_jobs,
                               internships=enhanced_internships,
                               blogs=enhanced_blogs,
                               testimonials=user_testimonials)

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
    """Get all bookmarks for a user with complete content details - FIXED VERSION"""
    try:
        # Get all bookmarks for the user using admin client to bypass RLS
        bookmarks_response = supabase_admin.table('bookmarks').select('*').eq('user_id', user_id).execute()

        if not bookmarks_response.data:
            return []

        bookmarks = bookmarks_response.data
        logger.info(f"Found {len(bookmarks)} bookmarks for user {user_id}")

        # Group by content type
        content_map = {
            'course': [],
            'job': [],
            'internship': [],
            'blog': []
        }

        for b in bookmarks:
            if b['item_type'] in content_map:
                content_map[b['item_type']].append(b['item_id'])

        results = []

        # Fetch course bookmarks with enhanced data
        if content_map['course']:
            try:
                courses_response = supabase_admin.table('courses') \
                    .select('*') \
                    .in_('id', content_map['course']) \
                    .execute()

                if courses_response.data:
                    for course in courses_response.data:
                        course['content_type'] = 'course'
                        # Ensure all required fields are present with proper fallbacks
                        course.setdefault('image', None)
                        course.setdefault('company_logo', None)
                        course.setdefault('description', course.get('description') or 'No description available')
                        course.setdefault('price', course.get('price') or 'Free')
                        course.setdefault('level', course.get('level') or 'All Levels')
                        course.setdefault('company', course.get('company') or 'Unknown Provider')
                        course.setdefault('category', course.get('category') or 'General')
                        course.setdefault('instructor', course.get('instructor') or 'Unknown Instructor')

                        # COURSE-SPECIFIC LOGO FIX: Use the same logic as main page
                        # If course has company data, try to get logo, otherwise use default course image
                        if course.get('company'):
                            try:
                                enhanced_course = enhance_content_with_logo(course, 'course', course['id'])
                                if enhanced_course.get('company_logo'):
                                    course['company_logo'] = enhanced_course['company_logo']
                                else:
                                    # If no company logo found, use default course image
                                    course['company_logo'] = url_for('static', filename='images/default-course.jpg')
                            except Exception as logo_error:
                                logger.warning(f"Could not enhance course logo: {str(logo_error)}")
                                course['company_logo'] = url_for('static', filename='images/default-course.jpg')
                        else:
                            # No company, use default course image
                            course['company_logo'] = url_for('static', filename='images/default-course.jpg')

                        # Ensure the image field also has a proper value for backward compatibility
                        if not course.get('image'):
                            course['image'] = course['company_logo']

                        results.append(course)
                        logger.info(f"Added course: {course.get('title')} with logo: {course.get('company_logo')}")
            except Exception as e:
                logger.error(f"Error fetching course bookmarks: {str(e)}")

        # Fetch job bookmarks with enhanced data
        if content_map['job']:
            try:
                jobs_response = supabase_admin.table('jobs') \
                    .select('*') \
                    .in_('id', content_map['job']) \
                    .execute()

                if jobs_response.data:
                    for job in jobs_response.data:
                        job['content_type'] = 'job'
                        # Ensure all required fields are present with proper fallbacks
                        job.setdefault('image', None)
                        job.setdefault('company_logo', None)
                        job.setdefault('description', job.get('description') or 'No description available')
                        job.setdefault('company', job.get('company') or 'Unknown Company')
                        job.setdefault('location', job.get('location') or 'Location not specified')
                        job.setdefault('salary', job.get('salary') or 'Not Specified')
                        job.setdefault('type', job.get('type') or 'Full-time')
                        job.setdefault('application_link', job.get('application_link') or '#')

                        # Enhance with logo if company exists but no logo
                        if job.get('company') and not job.get('company_logo'):
                            try:
                                enhanced_job = enhance_content_with_logo(job, 'job', job['id'])
                                if enhanced_job.get('company_logo'):
                                    job['company_logo'] = enhanced_job['company_logo']
                            except Exception as logo_error:
                                logger.warning(f"Could not enhance job logo: {str(logo_error)}")

                        results.append(job)
                        logger.info(f"Added job: {job.get('title')} with logo: {job.get('company_logo')}")
            except Exception as e:
                logger.error(f"Error fetching job bookmarks: {str(e)}")

        # Fetch internship bookmarks with enhanced data
        if content_map['internship']:
            try:
                internships_response = supabase_admin.table('internships') \
                    .select('*') \
                    .in_('id', content_map['internship']) \
                    .execute()

                if internships_response.data:
                    for internship in internships_response.data:
                        internship['content_type'] = 'internship'
                        # Ensure all required fields are present with proper fallbacks
                        internship.setdefault('image', None)
                        internship.setdefault('company_logo', None)
                        internship.setdefault('description',
                                              internship.get('description') or 'No description available')
                        internship.setdefault('company', internship.get('company') or 'Unknown Company')
                        internship.setdefault('location', internship.get('location') or 'Location not specified')
                        internship.setdefault('stipend', internship.get('stipend') or 'Unpaid')
                        internship.setdefault('duration', internship.get('duration') or 'Flexible')
                        internship.setdefault('application_link', internship.get('application_link') or '#')

                        # Enhance with logo if company exists but no logo
                        if internship.get('company') and not internship.get('company_logo'):
                            try:
                                enhanced_internship = enhance_content_with_logo(internship, 'internship',
                                                                                internship['id'])
                                if enhanced_internship.get('company_logo'):
                                    internship['company_logo'] = enhanced_internship['company_logo']
                            except Exception as logo_error:
                                logger.warning(f"Could not enhance internship logo: {str(logo_error)}")

                        results.append(internship)
                        logger.info(
                            f"Added internship: {internship.get('title')} with logo: {internship.get('company_logo')}")
            except Exception as e:
                logger.error(f"Error fetching internship bookmarks: {str(e)}")

        # Fetch blog bookmarks with enhanced data
        if content_map['blog']:
            try:
                blogs_response = supabase_admin.table('blog_posts') \
                    .select('*') \
                    .in_('id', content_map['blog']) \
                    .execute()

                if blogs_response.data:
                    for blog in blogs_response.data:
                        blog['content_type'] = 'blog'
                        # Ensure all required fields are present with proper fallbacks
                        blog.setdefault('image', blog.get('image') or '/static/images/default-blog.jpg')
                        blog.setdefault('description', blog.get('description') or 'No description available')
                        blog.setdefault('content', blog.get('content') or '')
                        blog.setdefault('author', blog.get('author') or 'CareerMaker Team')
                        blog.setdefault('read_time', blog.get('read_time') or '5 min read')
                        blog.setdefault('categories', blog.get('categories') or ['Career'])
                        blog.setdefault('published_at', blog.get('published_at') or blog.get('created_at'))

                        # Get view counts for blogs
                        try:
                            view_counts_response = supabase_admin.table('blog_views') \
                                .select('id', count='exact') \
                                .eq('blog_id', blog['id']) \
                                .execute()
                            blog['views'] = view_counts_response.count or 0
                        except Exception as view_error:
                            logger.warning(f"Could not get view count for blog {blog['id']}: {str(view_error)}")
                            blog['views'] = 0

                        # Get like counts for blogs
                        try:
                            like_counts_response = supabase_admin.table('blog_likes') \
                                .select('id', count='exact') \
                                .eq('blog_id', blog['id']) \
                                .execute()
                            blog['like_count'] = like_counts_response.count or 0
                        except Exception as like_error:
                            logger.warning(f"Could not get like count for blog {blog['id']}: {str(like_error)}")
                            blog['like_count'] = 0

                        # Check if user liked this blog
                        try:
                            user_like_response = supabase_admin.table('blog_likes') \
                                .select('id') \
                                .eq('user_id', user_id) \
                                .eq('blog_id', blog['id']) \
                                .execute()
                            blog['is_liked'] = len(user_like_response.data or []) > 0
                        except Exception as user_like_error:
                            logger.warning(f"Could not check user like for blog {blog['id']}: {str(user_like_error)}")
                            blog['is_liked'] = False

                        results.append(blog)
                        logger.info(f"Added blog: {blog.get('title')} with {blog.get('views')} views")
            except Exception as e:
                logger.error(f"Error fetching blog bookmarks: {str(e)}")

        logger.info(f"Total results prepared for dashboard: {len(results)}")

        # Sort by creation date (most recent first) with proper fallback
        return sorted(results, key=lambda x: x.get('created_at', ''), reverse=True)

    except Exception as e:
        logger.error(f"Error getting user bookmarks: {str(e)}", exc_info=True)
        return []


# Content logo routes
@app.route('/api/company-logo/preview')
def company_logo_preview():
    """
    Optimized API endpoint for real-time logo preview
    """
    company_name = request.args.get('company', '').strip()
    if not company_name:
        return jsonify({'success': False, 'error': 'Company name required'}), 400

    try:
        # Use the optimized logo fetching
        logo_url = fetch_company_logo(company_name)

        if logo_url:
            return jsonify({
                'success': True,
                'company_name': company_name,
                'logo_url': logo_url,
                'is_preview': True,
                'source': 'optimized'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No logo found for this company',
                'company_name': company_name,
                'suggestion': 'The company might not have a publicly available logo'
            })

    except Exception as e:
        logger.error(f"Error in optimized logo preview for {company_name}: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Error fetching logo',
            'company_name': company_name
        })


@app.route('/api/company-logo/refresh/<string:content_type>/<string:content_id>')
@admin_required
def refresh_company_logo(content_type, content_id):
    """
    Force refresh of company logo for specific content
    """
    try:
        # Get content to extract company name
        table_map = {
            'job': 'jobs',
            'internship': 'internships',
            'course': 'courses'
        }

        if content_type not in table_map:
            return jsonify({'success': False, 'error': 'Invalid content type'})

        content = supabase.table(table_map[content_type]) \
            .select('company, title') \
            .eq('id', content_id) \
            .single() \
            .execute()

        if not content.data:
            return jsonify({'success': False, 'error': 'Content not found'})

        company_name = content.data.get('company')
        if not company_name:
            return jsonify({'success': False, 'error': 'No company name found'})

        # Force fetch new logo
        logo_url = get_or_fetch_logo(company_name, content_type, content_id)

        if logo_url:
            # Update content with new logo
            supabase.table(table_map[content_type]) \
                .update({'company_logo': logo_url}) \
                .eq('id', content_id) \
                .execute()

            return jsonify({
                'success': True,
                'message': 'Logo refreshed successfully',
                'logo_url': logo_url
            })
        else:
            return jsonify({'success': False, 'error': 'Could not fetch new logo'})

    except Exception as e:
        logger.error(f"Error refreshing logo: {str(e)}")
        return jsonify({'success': False, 'error': 'Error refreshing logo'})


# =============================================
# Context Processor - Makes logged_in available to ALL templates
# =============================================
@app.context_processor
def inject_user():
    """Inject logged_in status and username into all templates automatically"""
    try:
        logged_in = 'user_id' in session
        username = session.get('username') if logged_in else None
        user_id = session.get('user_id') if logged_in else None

        return {
            'logged_in': logged_in,
            'username': username,
            'user_id': user_id
        }
    except Exception as e:
        logger.error(f"Error in context processor: {str(e)}")
        return {
            'logged_in': False,
            'username': None,
            'user_id': None
        }

# Content Routes
@app.route('/courses')
def courses():
    search = request.args.get('search', '').strip().lower()
    category = request.args.get('category', '').strip()

    print("\n" + "=" * 50)
    print(f"COURSES PAGE LOADED - MANUAL FILTERING MODE")
    print(f"Search parameter from URL: '{search}'")
    print(f"Category parameter from URL: '{category}'")
    print("=" * 50)

    try:
        user_id = session.get('user_id')

        # Get current time in UTC for expiration comparison
        current_time = get_current_utc_time()
        current_time_iso = current_time.isoformat()
        logger.info(f"🕐 Current time for courses page: {current_time_iso}")

        # Define course categories
        course_categories = [
            'Programming', 'Web Development', 'Mobile Development', 'Data Science',
            'AI & Machine Learning', 'Cloud Computing', 'Cybersecurity', 'Design',
            'Business', 'Marketing', 'MS Office', 'Finance', 'Photography', 'Music', 'Health & Fitness'
        ]

        # ===== STEP 1: GET ALL ACTIVE COURSES =====
        logger.info("📚 Fetching all active courses from database...")

        query = supabase.table('courses') \
            .select('*') \
            .eq('is_active', True) \
            .or_(f'expiration_date.is.null,expiration_date.gt.{current_time_iso}')

        all_courses = query.order('created_at', desc=True).execute().data or []
        logger.info(f"📊 Total active courses in database: {len(all_courses)}")

        # Debug: Print all course titles
        if all_courses:
            logger.info("All active course titles:")
            for course in all_courses:
                logger.info(f"  - {course.get('title')}")

        # ===== STEP 2: FILTER COURSES IN PYTHON =====
        filtered_courses = []

        for course in all_courses:
            title = course.get('title', '').lower()

            # Apply search filter (case-insensitive partial match)
            if search:
                if search not in title:
                    continue  # Skip if search term not in title

            # Apply category filter
            if category:
                if course.get('category') != category:
                    continue  # Skip if category doesn't match

            # If we get here, the course passed all filters
            filtered_courses.append(course)

        logger.info(
            f"🔍 After filtering: {len(filtered_courses)} courses match search '{search}' and category '{category}'")

        # Debug: Print filtered course titles
        if filtered_courses:
            logger.info("Filtered course titles:")
            for course in filtered_courses:
                logger.info(f"  - {course.get('title')} (Category: {course.get('category')})")
        else:
            logger.warning("⚠️ No courses found matching the filters")

        # ===== STEP 3: ENHANCE COURSES WITH LOGOS =====
        enhanced_courses = []

        for course in filtered_courses:
            try:
                # Ensure all required fields have defaults
                course.setdefault('image', None)
                course.setdefault('company_logo', None)
                course.setdefault('description', 'No description available')
                course.setdefault('price', 'Free')
                course.setdefault('level', 'All Levels')
                course.setdefault('duration', 'Not specified')
                course.setdefault('language', 'Not specified')
                course.setdefault('instructor', 'Not specified')
                course.setdefault('company', 'Unknown Provider')
                course.setdefault('category', 'General')
                course.setdefault('application_link', None)
                course.setdefault('enrollment_count', 0)
                course.setdefault('views', 0)
                course.setdefault('expiration_date', None)

                # Enhance with company logo if available
                if course.get('company'):
                    try:
                        enhanced = enhance_content_with_logo(course, 'course', course.get('id'))
                        if enhanced.get('company_logo'):
                            course['company_logo'] = enhanced['company_logo']
                    except Exception as e:
                        logger.warning(f"Could not enhance course logo for {course.get('id')}: {str(e)}")
                        if not course.get('company_logo'):
                            course['company_logo'] = '/static/images/default-course.png'
                else:
                    course['company_logo'] = '/static/images/default-course.png'

                enhanced_courses.append(course)

            except Exception as e:
                logger.error(f"Error enhancing course {course.get('id')}: {str(e)}")
                # Add course with defaults rather than failing
                course['company_logo'] = '/static/images/default-course.png'
                enhanced_courses.append(course)

        logger.info(f"✅ Enhanced {len(enhanced_courses)} courses with logos")

        # ===== STEP 4: ADD BOOKMARK STATUS IF USER IS LOGGED IN =====
        if user_id:
            try:
                # Get all bookmarks for the user
                logger.info(f"🔖 Fetching bookmarks for user {user_id}")
                user_bookmarks = get_user_bookmarks(user_id)

                # Create a map of (content_type, id) -> True for faster lookup
                bookmark_map = {}
                for item in user_bookmarks:
                    content_type = item.get('content_type')
                    item_id = item.get('id')
                    if content_type and item_id:
                        bookmark_map[(content_type, item_id)] = True

                logger.info(f"📋 User has {len(user_bookmarks)} total bookmarks")

                # Add bookmark status to each course
                bookmarked_count = 0
                for course in enhanced_courses:
                    course_id = course.get('id')
                    is_bookmarked = bookmark_map.get(('course', course_id), False)
                    course['is_bookmarked'] = is_bookmarked
                    if is_bookmarked:
                        bookmarked_count += 1

                logger.info(f"⭐ {bookmarked_count} out of {len(enhanced_courses)} courses are bookmarked by user")

            except Exception as e:
                logger.error(f"Error adding bookmark status: {str(e)}")
                # Set default bookmark status to False for all courses
                for course in enhanced_courses:
                    course['is_bookmarked'] = False
        else:
            # User not logged in, no bookmarks
            logger.info("👤 User not logged in - no bookmark status added")
            for course in enhanced_courses:
                course['is_bookmarked'] = False

        # ===== STEP 5: LOG FINAL SUMMARY =====
        logger.info(f"🏁 FINAL: Returning {len(enhanced_courses)} courses to template")
        logger.info(f"   - Search term: '{search}'")
        logger.info(f"   - Category: '{category}'")
        logger.info(f"   - User logged in: {bool(user_id)}")

    except Exception as e:
        logger.error(f"❌ CRITICAL ERROR loading courses: {str(e)}", exc_info=True)
        enhanced_courses = []
        # Fallback categories in case of error
        course_categories = ['Programming', 'Design', 'Business', 'Marketing', 'Data Science']
        flash('Error loading courses. Please try again.', 'error')

    # Always return the template, even with empty courses list
    return render_template('courses.html',
                           courses=enhanced_courses,
                           search=search,
                           category=category,
                           course_categories=course_categories,
                           now=current_time)


@app.route('/courses/<course_id>/enroll', methods=['POST'])
@login_required
def enroll_course(course_id):
    try:
        # Check if course is active and not expired using UTC
        current_time = get_current_utc_time().isoformat()
        course = supabase.table('courses').select('application_link').eq('id', course_id).eq('is_published', True).eq(
            'is_active', True).or_(f'expiration_date.is.null,expiration_date.gt.{current_time}').single().execute().data

        if not course or not course.get('application_link'):
            flash('This course is not currently available for enrollment or has expired', 'danger')
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

@app.route('/api/admin/courses/upload-image', methods=['POST'])
@admin_required
def upload_course_image():
    """Upload course image"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type. Only JPG, PNG, GIF allowed.'}), 400

        # Read file data
        file_data = file.read()

        # Extract extension
        ext = file.filename.rsplit('.', 1)[1].lower()

        # ❌ WRONG: course-images/<filename>
        # unique_name = f"course-images/{uuid.uuid4().hex}.{ext}"

        # ✅ CORRECT: only folder inside bucket (optional)
        unique_name = f"courses/{uuid.uuid4().hex}.{ext}"

        # Upload into bucket "course-images"
        upload_response = supabase_admin.storage.from_("course-images").upload(
            unique_name,
            file_data,
            {"content-type": file.content_type}
        )

        if isinstance(upload_response, dict) and upload_response.get("error"):
            logger.error(f"Supabase upload error: {upload_response}")
            return jsonify({'success': False, 'error': 'Failed to upload image'}), 500

        # Get public URL
        image_url = supabase_admin.storage.from_("course-images").get_public_url(unique_name)

        return jsonify({
            'success': True,
            'image_url': image_url,
            'message': 'Image uploaded successfully'
        })

    except Exception as e:
        logger.error(f"Error uploading course image: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to upload image'}), 500


@app.route('/api/course/<string:course_id>')
def get_course_details(course_id):
    """API endpoint to get complete course details for modal - with view count increment"""
    try:
        logger.info(f"📡 API call to /api/course/{course_id}")

        # Validate UUID format
        uuid_pattern = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
        if not uuid_pattern.match(course_id):
            logger.warning(f"Invalid UUID format: {course_id}")
            return jsonify({
                'success': False,
                'error': 'Invalid course ID format'
            }), 400

        # Get current time for expiration check
        current_time = get_current_utc_time().isoformat()

        # Get course from database - only if active and not expired
        course_response = supabase.table('courses') \
            .select('*') \
            .eq('id', course_id) \
            .eq('is_active', True) \
            .or_(f'expiration_date.is.null,expiration_date.gt.{current_time}') \
            .execute()

        logger.info(f"Database response: {course_response}")

        if not course_response.data or len(course_response.data) == 0:
            logger.warning(f"Course {course_id} not found, inactive, or expired")
            return jsonify({
                'success': False,
                'error': 'Course not found or has expired'
            }), 404

        course = course_response.data[0]
        logger.info(f"Found course: {course.get('title')}")

        # INCREMENT VIEW COUNT - Use admin client to bypass RLS
        try:
            current_views = course.get('views', 0) or 0
            new_views = current_views + 1

            update_result = supabase_admin.table('courses') \
                .update({'views': new_views}) \
                .eq('id', course_id) \
                .execute()

            if update_result.data:
                course['views'] = new_views
                logger.info(f"👀 View count incremented for course {course_id}: {current_views} → {new_views}")
            else:
                logger.warning(f"Could not increment view count for course {course_id}")
        except Exception as view_error:
            logger.warning(f"View count increment failed: {str(view_error)}")
            # Continue anyway - don't fail the request

        # Enhance course with logo if available
        if course.get('company'):
            try:
                enhanced_course = enhance_content_with_logo(course, 'course', course_id)
                if enhanced_course.get('company_logo'):
                    course['company_logo'] = enhanced_course['company_logo']
            except Exception as e:
                logger.warning(f"Could not enhance course logo: {str(e)}")

        # Ensure all required fields have defaults
        course_data = {
            'id': course.get('id'),
            'title': course.get('title', 'Untitled Course'),
            'description': course.get('description', 'No description available'),
            'category': course.get('category', 'General'),
            'level': course.get('level', 'All Levels'),
            'price': course.get('price', 'Free'),
            'duration': course.get('duration', 'Not specified'),
            'language': course.get('language', 'Not specified'),
            'instructor': course.get('instructor', 'Not specified'),
            'company': course.get('company', 'Unknown Provider'),
            'company_logo': course.get('company_logo', None),
            'image': course.get('image', None),
            'views': course.get('views', 0),
            'application_link': course.get('application_link', None),
            'expiration_date': course.get('expiration_date', None),
            'curriculum': [],
            'requirements': [],
            'certificate': course.get('certificate'),
            'prerequisites': course.get('prerequisites'),
            'topics': course.get('topics'),
            'format': course.get('format')
        }

        # Parse curriculum if stored as text
        if course.get('curriculum'):
            if isinstance(course['curriculum'], str):
                course_data['curriculum'] = [line.strip() for line in course['curriculum'].split('\n') if line.strip()]
            elif isinstance(course['curriculum'], list):
                course_data['curriculum'] = course['curriculum']

        # Parse requirements if stored as text
        if course.get('requirements'):
            if isinstance(course['requirements'], str):
                course_data['requirements'] = [line.strip() for line in course['requirements'].split('\n') if
                                               line.strip()]
            elif isinstance(course['requirements'], list):
                course_data['requirements'] = course['requirements']

        # Add bookmark status if user is logged in
        if 'user_id' in session:
            try:
                user_id = session['user_id']
                # Check if this course is bookmarked by the user
                bookmark_response = supabase_admin.table('bookmarks') \
                    .select('id') \
                    .eq('user_id', user_id) \
                    .eq('item_type', 'course') \
                    .eq('item_id', course_id) \
                    .execute()

                course_data['is_bookmarked'] = len(bookmark_response.data or []) > 0
            except Exception as e:
                logger.warning(f"Could not get bookmark status: {str(e)}")
                course_data['is_bookmarked'] = False
        else:
            course_data['is_bookmarked'] = False

        logger.info(f"✅ Successfully returning course data for {course_id} with {course_data['views']} views")

        response = jsonify({
            'success': True,
            'course': course_data
        })
        response.headers['Content-Type'] = 'application/json'
        return response

    except Exception as e:
        logger.error(f"❌ Error fetching course details for ID {course_id}: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'Failed to load course details. Please try again.'
        }), 500


@app.route('/jobs')
def jobs():
    search = request.args.get('search', '').strip().lower()
    location = request.args.get('location', '').strip()
    job_type = request.args.get('type', '').strip()

    print("\n" + "=" * 50)
    print(f"JOBS PAGE LOADED - MANUAL FILTERING MODE")
    print(f"Search parameter: '{search}'")
    print(f"Location parameter: '{location}'")
    print(f"Type parameter: '{job_type}'")
    print("=" * 50)

    try:
        user_id = session.get('user_id')

        # Get current time in UTC for expiration comparison
        current_time = get_current_utc_time()
        current_time_iso = current_time.isoformat()
        logger.info(f"🕐 Current time for jobs page: {current_time_iso}")

        # ===== STEP 1: GET ALL ACTIVE JOBS =====
        logger.info("📚 Fetching all active jobs from database...")

        query = supabase.table('jobs') \
            .select('*') \
            .eq('is_active', True) \
            .or_(f'expiration_date.is.null,expiration_date.gt.{current_time_iso}')

        all_jobs = query.order('created_at', desc=True).execute().data or []
        logger.info(f"📊 Total active jobs in database: {len(all_jobs)}")

        # Debug: Print all job titles
        if all_jobs:
            logger.info("All active job titles:")
            for job in all_jobs:
                logger.info(f"  - {job.get('title')} (Company: {job.get('company')})")

        # ===== STEP 2: FILTER JOBS IN PYTHON =====
        filtered_jobs = []

        for job in all_jobs:
            title = job.get('title', '').lower()
            job_location = job.get('location', '').lower()
            job_type_value = job.get('type', '')

            # Apply search filter (case-insensitive partial match on title only)
            if search:
                if search not in title:
                    continue  # Skip if search term not in title

            # Apply location filter
            if location:
                if location.lower() not in job_location:
                    continue  # Skip if location doesn't match

            # Apply type filter
            if job_type:
                if job_type != job_type_value:
                    continue  # Skip if type doesn't match

            # If we get here, the job passed all filters
            filtered_jobs.append(job)

        logger.info(f"🔍 After filtering: {len(filtered_jobs)} jobs match criteria")

        # Debug: Print filtered job titles
        if filtered_jobs:
            logger.info("Filtered job titles:")
            for job in filtered_jobs:
                logger.info(f"  - {job.get('title')} (Location: {job.get('location')}, Type: {job.get('type')})")
        else:
            logger.warning("⚠️ No jobs found matching the filters")

        # ===== STEP 3: ENHANCE JOBS WITH LOGOS =====
        enhanced_jobs = []

        for job in filtered_jobs:
            try:
                # Ensure all required fields have defaults
                job.setdefault('image', None)
                job.setdefault('company_logo', None)
                job.setdefault('description', 'No description available')
                job.setdefault('company', 'Unknown Company')
                job.setdefault('location', 'Location not specified')
                job.setdefault('salary', 'Not Specified')
                job.setdefault('type', 'Full-time')
                job.setdefault('application_link', None)
                job.setdefault('expiration_date', None)
                job.setdefault('remote', False)
                job.setdefault('required_skills', [])
                job.setdefault('experience_level', '')
                job.setdefault('posted_date', None)

                # Enhance with company logo if available
                if job.get('company'):
                    try:
                        enhanced = enhance_content_with_logo(job, 'job', job.get('id'))
                        if enhanced.get('company_logo'):
                            job['company_logo'] = enhanced['company_logo']
                    except Exception as e:
                        logger.warning(f"Could not enhance job logo for {job.get('id')}: {str(e)}")
                        if not job.get('company_logo'):
                            job['company_logo'] = '/static/images/default-job.png'
                else:
                    job['company_logo'] = '/static/images/default-job.png'

                enhanced_jobs.append(job)

            except Exception as e:
                logger.error(f"Error enhancing job {job.get('id')}: {str(e)}")
                # Add job with defaults rather than failing
                job['company_logo'] = '/static/images/default-job.png'
                enhanced_jobs.append(job)

        logger.info(f"✅ Enhanced {len(enhanced_jobs)} jobs with logos")

        # ===== STEP 4: ADD BOOKMARK STATUS IF USER IS LOGGED IN =====
        if user_id:
            try:
                # Get all bookmarks for the user
                logger.info(f"🔖 Fetching bookmarks for user {user_id}")
                user_bookmarks = get_user_bookmarks(user_id)

                # Create a map of (content_type, id) -> True for faster lookup
                bookmark_map = {}
                for item in user_bookmarks:
                    content_type = item.get('content_type')
                    item_id = item.get('id')
                    if content_type and item_id:
                        bookmark_map[(content_type, item_id)] = True

                logger.info(f"📋 User has {len(user_bookmarks)} total bookmarks")

                # Add bookmark status to each job
                bookmarked_count = 0
                for job in enhanced_jobs:
                    job_id = job.get('id')
                    is_bookmarked = bookmark_map.get(('job', job_id), False)
                    job['is_bookmarked'] = is_bookmarked
                    if is_bookmarked:
                        bookmarked_count += 1

                logger.info(f"⭐ {bookmarked_count} out of {len(enhanced_jobs)} jobs are bookmarked by user")

            except Exception as e:
                logger.error(f"Error adding bookmark status: {str(e)}")
                # Set default bookmark status to False for all jobs
                for job in enhanced_jobs:
                    job['is_bookmarked'] = False
        else:
            # User not logged in, no bookmarks
            logger.info("👤 User not logged in - no bookmark status added")
            for job in enhanced_jobs:
                job['is_bookmarked'] = False

        # ===== STEP 5: LOG FINAL SUMMARY =====
        logger.info(f"🏁 FINAL: Returning {len(enhanced_jobs)} jobs to template")
        logger.info(f"   - Search term: '{search}'")
        logger.info(f"   - Location: '{location}'")
        logger.info(f"   - Type: '{job_type}'")
        logger.info(f"   - User logged in: {bool(user_id)}")

    except Exception as e:
        logger.error(f"❌ CRITICAL ERROR loading jobs: {str(e)}", exc_info=True)
        enhanced_jobs = []
        flash('Error loading jobs. Please try again.', 'error')

    return render_template('jobs.html',
                           jobs=enhanced_jobs,
                           search=search,
                           location=location,
                           job_type=job_type,
                           now=current_time)


@app.route('/jobs/<job_id>/apply')
@login_required
def apply_job(job_id):
    try:
        # Check if job is active (expired jobs are auto-deactivated)
        job = supabase.table('jobs').select('application_link').eq('id', job_id).eq('is_active',
                                                                                    True).single().execute().data

        if not job or not job.get('application_link'):
            flash('Job not found or has expired', 'danger')
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
    search = request.args.get('search', '').strip().lower()
    location = request.args.get('location', '').strip()
    internship_type = request.args.get('type', '').strip()

    print("\n" + "=" * 50)
    print(f"INTERNSHIPS PAGE LOADED - MANUAL FILTERING MODE")
    print(f"Search parameter: '{search}'")
    print(f"Location parameter: '{location}'")
    print(f"Type parameter: '{internship_type}'")
    print("=" * 50)

    try:
        user_id = session.get('user_id')

        # Get current time in UTC for expiration comparison
        current_time = get_current_utc_time()
        current_time_iso = current_time.isoformat()
        logger.info(f"🕐 Current time for internships page: {current_time_iso}")

        # ===== STEP 1: GET ALL ACTIVE INTERNSHIPS =====
        logger.info("📚 Fetching all active internships from database...")

        query = supabase.table('internships') \
            .select('*') \
            .eq('is_active', True) \
            .or_(f'expiration_date.is.null,expiration_date.gt.{current_time_iso}')

        all_internships = query.order('created_at', desc=True).execute().data or []
        logger.info(f"📊 Total active internships in database: {len(all_internships)}")

        # Debug: Print all internship titles
        if all_internships:
            logger.info("All active internship titles:")
            for internship in all_internships:
                logger.info(f"  - {internship.get('title')} (Company: {internship.get('company')})")

        # ===== STEP 2: FILTER INTERNSHIPS IN PYTHON =====
        filtered_internships = []

        for internship in all_internships:
            title = internship.get('title', '').lower()
            intern_location = internship.get('location', '').lower()
            intern_type = internship.get('type', '')

            # Apply search filter (case-insensitive partial match on title only)
            if search:
                if search not in title:
                    continue  # Skip if search term not in title

            # Apply location filter
            if location:
                if location.lower() not in intern_location:
                    continue  # Skip if location doesn't match

            # Apply type filter
            if internship_type:
                if internship_type != intern_type:
                    continue  # Skip if type doesn't match

            # If we get here, the internship passed all filters
            filtered_internships.append(internship)

        logger.info(f"🔍 After filtering: {len(filtered_internships)} internships match criteria")

        # Debug: Print filtered internship titles
        if filtered_internships:
            logger.info("Filtered internship titles:")
            for internship in filtered_internships:
                logger.info(
                    f"  - {internship.get('title')} (Location: {internship.get('location')}, Type: {internship.get('type')})")
        else:
            logger.warning("⚠️ No internships found matching the filters")

        # ===== STEP 3: ENHANCE INTERNSHIPS WITH LOGOS =====
        enhanced_internships = []

        for internship in filtered_internships:
            try:
                # Ensure all required fields have defaults
                internship.setdefault('image', None)
                internship.setdefault('company_logo', None)
                internship.setdefault('description', 'No description available')
                internship.setdefault('company', 'Unknown Company')
                internship.setdefault('location', 'Location not specified')
                internship.setdefault('stipend', 'Unpaid')
                internship.setdefault('duration', 'Flexible')
                internship.setdefault('type', 'Internship')
                internship.setdefault('application_link', None)
                internship.setdefault('expiration_date', None)
                internship.setdefault('required_skills', [])
                internship.setdefault('qualifications', '')
                internship.setdefault('start_date', None)

                # Enhance with company logo if available
                if internship.get('company'):
                    try:
                        enhanced = enhance_content_with_logo(internship, 'internship', internship.get('id'))
                        if enhanced.get('company_logo'):
                            internship['company_logo'] = enhanced['company_logo']
                    except Exception as e:
                        logger.warning(f"Could not enhance internship logo for {internship.get('id')}: {str(e)}")
                        if not internship.get('company_logo'):
                            internship['company_logo'] = '/static/images/default-internship.png'
                else:
                    internship['company_logo'] = '/static/images/default-internship.png'

                enhanced_internships.append(internship)

            except Exception as e:
                logger.error(f"Error enhancing internship {internship.get('id')}: {str(e)}")
                # Add internship with defaults rather than failing
                internship['company_logo'] = '/static/images/default-internship.png'
                enhanced_internships.append(internship)

        logger.info(f"✅ Enhanced {len(enhanced_internships)} internships with logos")

        # ===== STEP 4: ADD BOOKMARK STATUS IF USER IS LOGGED IN =====
        if user_id:
            try:
                # Get all bookmarks for the user
                logger.info(f"🔖 Fetching bookmarks for user {user_id}")
                user_bookmarks = get_user_bookmarks(user_id)

                # Create a map of (content_type, id) -> True for faster lookup
                bookmark_map = {}
                for item in user_bookmarks:
                    content_type = item.get('content_type')
                    item_id = item.get('id')
                    if content_type and item_id:
                        bookmark_map[(content_type, item_id)] = True

                logger.info(f"📋 User has {len(user_bookmarks)} total bookmarks")

                # Add bookmark status to each internship
                bookmarked_count = 0
                for internship in enhanced_internships:
                    internship_id = internship.get('id')
                    is_bookmarked = bookmark_map.get(('internship', internship_id), False)
                    internship['is_bookmarked'] = is_bookmarked
                    if is_bookmarked:
                        bookmarked_count += 1

                logger.info(
                    f"⭐ {bookmarked_count} out of {len(enhanced_internships)} internships are bookmarked by user")

            except Exception as e:
                logger.error(f"Error adding bookmark status: {str(e)}")
                # Set default bookmark status to False for all internships
                for internship in enhanced_internships:
                    internship['is_bookmarked'] = False
        else:
            # User not logged in, no bookmarks
            logger.info("👤 User not logged in - no bookmark status added")
            for internship in enhanced_internships:
                internship['is_bookmarked'] = False

        # ===== STEP 5: LOG FINAL SUMMARY =====
        logger.info(f"🏁 FINAL: Returning {len(enhanced_internships)} internships to template")
        logger.info(f"   - Search term: '{search}'")
        logger.info(f"   - Location: '{location}'")
        logger.info(f"   - Type: '{internship_type}'")
        logger.info(f"   - User logged in: {bool(user_id)}")

    except Exception as e:
        logger.error(f"❌ CRITICAL ERROR loading internships: {str(e)}", exc_info=True)
        enhanced_internships = []
        flash('Error loading internships. Please try again.', 'error')

    return render_template('internships.html',
                           internships=enhanced_internships,
                           search=search,
                           location=location,
                           internship_type=internship_type,
                           now=current_time)


@app.route('/internships/<internship_id>/apply')
@login_required
def apply_internship(internship_id):
    try:
        # Check if internship is active (expired internships are auto-deactivated)
        internship = supabase.table('internships').select('application_link').eq('id', internship_id).eq('is_active',
                                                                                                         True).single().execute().data

        if not internship or not internship.get('application_link'):
            flash('Internship not found or has expired', 'danger')
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

# ===== Expiration date filter =====
@app.template_filter('days_until')
def days_until_filter(date_str):
    """Calculate days until a date"""
    if not date_str:
        return None
    try:
        if isinstance(date_str, str):
            # Parse ISO format date
            exp_date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        else:
            exp_date = date_str
        # Ensure timezone awareness
        if exp_date.tzinfo is None:
            exp_date = exp_date.replace(tzinfo=timezone.utc)

        now = get_current_utc_time()
        delta = exp_date - now
        return delta.days
    except Exception as e:
        logger.error(f"Error calculating days until: {str(e)}")
        return None

@app.route('/blog')
@app.route('/blogs.html')
def blog():
    """Main blog page - show all blogs"""
    try:
        # Get user_id from session
        user_id = session.get('user_id')

        # Get ALL active blog posts for the view all page
        posts_response = supabase.table('blog_posts') \
            .select('*') \
            .eq('is_active', True) \
            .order('published_at', desc=True) \
            .execute()

        posts = posts_response.data or []

        # Debug logging
        print(f"📝 Found {len(posts)} blog posts")
        for post in posts:
            print(f"  - {post.get('title')} (ID: {post.get('id')})")

        # Early return if no posts
        if not posts:
            print("ℹ️ No blog posts found")
            return render_template('blogs.html', posts=[])

        # Get all blog IDs for batch operations
        blog_ids = [post['id'] for post in posts]

        # Batch get bookmarks for logged-in users
        if user_id:
            try:
                user_bookmarks_response = supabase_admin.table('bookmarks') \
                    .select('item_type, item_id') \
                    .eq('user_id', user_id) \
                    .eq('item_type', 'blog') \
                    .in_('item_id', blog_ids) \
                    .execute()

                bookmarked_blog_ids = {bookmark['item_id'] for bookmark in (user_bookmarks_response.data or [])}

                # Batch get user likes
                user_likes_response = supabase_admin.table('blog_likes') \
                    .select('blog_id') \
                    .eq('user_id', user_id) \
                    .in_('blog_id', blog_ids) \
                    .execute()

                liked_blog_ids = {like['blog_id'] for like in (user_likes_response.data or [])}

            except Exception as e:
                print(f"❌ Error loading user data: {str(e)}")
                bookmarked_blog_ids = set()
                liked_blog_ids = set()
        else:
            bookmarked_blog_ids = set()
            liked_blog_ids = set()

        # Batch get like counts for all posts
        try:
            like_counts_response = supabase_admin.table('blog_likes') \
                .select('blog_id, id') \
                .in_('blog_id', blog_ids) \
                .execute()

            # Count likes per blog
            like_counts = {}
            for like in (like_counts_response.data or []):
                blog_id = like['blog_id']
                like_counts[blog_id] = like_counts.get(blog_id, 0) + 1

        except Exception as e:
            print(f"❌ Error loading like counts: {str(e)}")
            like_counts = {}

        # Batch get view counts for all posts
        try:
            view_counts_response = supabase_admin.table('blog_views') \
                .select('blog_id, id') \
                .in_('blog_id', blog_ids) \
                .execute()

            # Count views per blog
            view_counts = {}
            for view in (view_counts_response.data or []):
                blog_id = view['blog_id']
                view_counts[blog_id] = view_counts.get(blog_id, 0) + 1

        except Exception as e:
            print(f"❌ Error loading view counts: {str(e)}")
            view_counts = {}

        # Add all computed data to posts
        for post in posts:
            post_id = post['id']

            # Bookmark status
            post['is_bookmarked'] = post_id in bookmarked_blog_ids

            # Like status and count
            post['like_count'] = like_counts.get(post_id, 0)
            post['is_liked'] = post_id in liked_blog_ids

            # View count
            post['views'] = view_counts.get(post_id, 0)

            # Ensure required fields have defaults
            post.setdefault('read_time', '5 min read')
            post.setdefault('author_avatar', None)
            post.setdefault('categories', ['Career'])
            post.setdefault('description', '')
            post.setdefault('content', '')

        print(f"✅ Successfully loaded {len(posts)} blog posts with all metadata")

    except Exception as e:
        logger.error(f"Error loading blog posts: {str(e)}")
        print(f"❌ Critical error loading blog posts: {str(e)}")
        posts = []

    return render_template('blogs.html', posts=posts)


# =============================================
# FIXED TESTIMONIAL ROUTES - PROPER PROFILE PICTURES
# =============================================

@app.route('/api/testimonial/auth-check')
def testimonial_auth_check():
    """Check if user can post testimonial"""
    try:
        if 'user_id' in session:
            user = supabase_admin.table('users').select('username, profile_pic').eq('id', session[
                'user_id']).single().execute()
            if user.data:
                return jsonify({
                    'can_post': True,
                    'username': user.data['username'],
                    'user_id': session['user_id']
                })
        return jsonify({'can_post': False})
    except Exception as e:
        logger.error(f"Auth check error: {str(e)}")
        return jsonify({'can_post': False})


@app.route('/api/testimonial/list')
def testimonial_list():
    """Get all testimonials with profile pictures - EXCLUDE SOFT DELETED"""
    try:
        # Get testimonials - ONLY ACTIVE AND NOT DELETED
        response = supabase_admin.table('testimonials') \
            .select('*') \
            .eq('is_active', True) \
            .eq('is_deleted', False) \
            .order('created_at', desc=True) \
            .limit(12) \
            .execute()

        current_user_id = session.get('user_id')
        testimonials_data = []

        for testimonial in response.data:
            item = dict(testimonial)

            # Check if current user owns this testimonial
            item['can_edit'] = current_user_id and str(current_user_id) == str(item.get('user_id'))

            # Get username
            username = item.get('username', 'Anonymous')

            # Get profile picture
            profile_pic_path = item.get('profile_pic')

            if profile_pic_path:
                item['profile_pic_url'] = generate_profile_pic_url(profile_pic_path)
            else:
                user_id = item.get('user_id')
                if user_id:
                    user_profile_pic = get_user_profile_pic_from_users_table(user_id)
                    if user_profile_pic:
                        item['profile_pic_url'] = generate_profile_pic_url(user_profile_pic)
                    else:
                        item[
                            'profile_pic_url'] = f"https://ui-avatars.com/api/?name={username}&background=10b981&color=fff&bold=true"
                else:
                    item[
                        'profile_pic_url'] = f"https://ui-avatars.com/api/?name={username}&background=10b981&color=fff&bold=true"

            testimonials_data.append(item)

        return jsonify({
            'testimonials': testimonials_data,
            'current_user_id': current_user_id
        })

    except Exception as e:
        logger.error(f"Testimonial list error: {str(e)}")
        return jsonify({'testimonials': [], 'current_user_id': None})


def generate_profile_pic_url(profile_pic_path):
    """Generate profile picture URL for profile-pictures bucket"""
    try:
        # Extract project reference from your supabase_url
        project_ref = supabase_url.split('//')[1].split('.')[0]

        # Construct the direct URL to the profile-pictures bucket
        profile_pic_url = f"https://{project_ref}.supabase.co/storage/v1/object/public/profile-pictures/{profile_pic_path}"

        return profile_pic_url
    except Exception as e:
        logger.error(f"Error generating profile pic URL: {str(e)}")
        return None


def get_user_profile_pic_from_users_table(user_id):
    """Get profile picture path from users table"""
    try:
        user_response = supabase_admin.table('users') \
            .select('profile_pic') \
            .eq('id', user_id) \
            .execute()

        if user_response.data and len(user_response.data) > 0:
            return user_response.data[0].get('profile_pic')
        return None
    except Exception as e:
        logger.error(f"Error getting user profile pic: {str(e)}")
        return None


@app.route('/api/testimonial/submit', methods=['POST'])
def testimonial_submit():
    """Submit a testimonial - FIXED to store current profile picture"""
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Please login first'}), 401

        data = request.get_json()
        content = data.get('content', '').strip()
        rating = data.get('rating', 5)

        if not content:
            return jsonify({'success': False, 'message': 'Please share your experience'}), 400

        # Get user info with CURRENT profile picture
        user_id = session['user_id']
        user = supabase_admin.table('users').select('username, profile_pic').eq('id', user_id).single().execute()

        if not user.data:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Save testimonial with CURRENT profile picture path
        testimonial_data = {
            'user_id': user_id,
            'username': user.data['username'],
            'profile_pic': user.data.get('profile_pic'),  # Store the current profile picture path
            'content': content,
            'rating': rating,
            'is_active': True,
            'created_at': get_current_utc_time().isoformat()
        }

        result = supabase_admin.table('testimonials').insert(testimonial_data).execute()

        if result.data:
            return jsonify({
                'success': True,
                'message': 'Thank you for sharing your experience!'
            })
        else:
            logger.error(f"Testimonial insert failed: {result}")
            return jsonify({'success': False, 'message': 'Failed to save testimonial'}), 500

    except Exception as e:
        logger.error(f"Testimonial submit error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error'}), 500


@app.route('/api/testimonial/update/<testimonial_id>', methods=['PUT'])
def update_testimonial(testimonial_id):
    """Update a testimonial"""
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Please login first'}), 401

        data = request.get_json()
        content = data.get('content', '').strip()
        rating = data.get('rating', 5)

        if not content:
            return jsonify({'success': False, 'message': 'Content is required'}), 400

        # Verify ownership
        testimonial = supabase_admin.table('testimonials') \
            .select('user_id') \
            .eq('id', testimonial_id) \
            .single() \
            .execute()

        if not testimonial.data:
            return jsonify({'success': False, 'message': 'Testimonial not found'}), 404

        if str(testimonial.data['user_id']) != str(session['user_id']):
            return jsonify({'success': False, 'message': 'Not authorized'}), 403

        # Update testimonial
        result = supabase_admin.table('testimonials') \
            .update({
            'content': content,
            'rating': rating,
            'updated_at': get_current_utc_time().isoformat()
        }) \
            .eq('id', testimonial_id) \
            .execute()

        if result.data:
            return jsonify({'success': True, 'message': 'Testimonial updated successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to update testimonial'}), 500

    except Exception as e:
        logger.error(f"Update testimonial error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error'}), 500


@app.route('/api/testimonial/delete/<testimonial_id>', methods=['DELETE'])
@login_required
def delete_testimonial(testimonial_id):
    """Delete a testimonial - Soft delete for user testimonials"""
    try:
        if 'user_id' not in session:
            return jsonify({'success': False, 'message': 'Please login first'}), 401

        user_id = session['user_id']

        # Verify ownership
        testimonial = supabase_admin.table('testimonials') \
            .select('user_id') \
            .eq('id', testimonial_id) \
            .single() \
            .execute()

        if not testimonial.data:
            return jsonify({'success': False, 'message': 'Testimonial not found'}), 404

        if str(testimonial.data['user_id']) != str(user_id):
            return jsonify({'success': False, 'message': 'Not authorized'}), 403

        # Soft delete - mark as deleted and inactive but keep in database
        update_data = {
            'is_deleted': True,
            'is_active': False,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        result = supabase_admin.table('testimonials') \
            .update(update_data) \
            .eq('id', testimonial_id) \
            .execute()

        if result.data:
            logger.info(f"✅ User {user_id} deleted testimonial {testimonial_id}")
            return jsonify({
                'success': True,
                'message': 'Testimonial deleted successfully'
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to delete testimonial'}), 500

    except Exception as e:
        logger.error(f"Delete testimonial error: {str(e)}")
        return jsonify({'success': False, 'message': 'Server error'}), 500


@app.route('/api/testimonials/<testimonial_id>')
@login_required
def get_testimonial(testimonial_id):
    try:
        user_id = session.get('user_id')

        # Get testimonial with user verification
        testimonial_response = supabase_admin.table('testimonials') \
            .select('*') \
            .eq('id', testimonial_id) \
            .eq('user_id', user_id) \
            .execute()

        if not testimonial_response.data:
            return jsonify({'success': False, 'error': 'Testimonial not found'}), 404

        return jsonify({
            'success': True,
            'testimonial': testimonial_response.data[0]
        })

    except Exception as e:
        logger.error(f"Error fetching testimonial: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


# ===== BOOKMARK ENDPOINT FIX =====

# Simple retry decorator without external library
def retry_db_operation(max_retries=3, delay=1):
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_error = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (httpx.RemoteProtocolError, httpx.ReadTimeout, httpx.ConnectTimeout) as e:
                    last_error = e
                    if attempt < max_retries - 1:
                        time.sleep(delay * (2 ** attempt))  # Exponential backoff
                        continue
                    raise
            raise last_error

        return wrapper

    return decorator


@app.route('/api/bookmark/<content_type>/<content_id>', methods=['POST'])
def bookmark_content(content_type, content_id):
    """Toggle bookmark for content"""
    try:
        # Check authentication first
        if 'user_id' not in session:
            return jsonify({
                'success': False,
                'error': 'Please login to bookmark items',
                'requires_login': True
            }), 401

        valid_types = ['course', 'job', 'internship', 'blog']
        if content_type not in valid_types:
            return jsonify({'success': False, 'error': 'Invalid content type'}), 400

        user_id = session['user_id']

        # Check if content exists with retry
        table_map = {
            'course': 'courses',
            'job': 'jobs',
            'internship': 'internships',
            'blog': 'blog_posts'
        }

        @retry_db_operation(max_retries=3)
        def check_content_exists():
            return supabase_admin.table(table_map[content_type]) \
                .select('id') \
                .eq('id', content_id) \
                .execute()

        content_check = check_content_exists()

        if not content_check.data:
            return jsonify({'success': False, 'error': 'Content not found'}), 404

        # Check for existing bookmark with retry
        @retry_db_operation(max_retries=3)
        def check_existing_bookmark():
            return supabase_admin.table('bookmarks') \
                .select('id') \
                .eq('user_id', user_id) \
                .eq('item_type', content_type) \
                .eq('item_id', content_id) \
                .execute()

        existing_check = check_existing_bookmark()
        existing_bookmarks = existing_check.data if hasattr(existing_check, 'data') else []

        if existing_bookmarks:
            # Remove bookmark - don't check return value
            @retry_db_operation(max_retries=3)
            def delete_bookmark():
                return supabase_admin.table('bookmarks') \
                    .delete() \
                    .eq('id', existing_bookmarks[0]['id']) \
                    .execute()

            delete_bookmark()

            return jsonify({
                'success': True,
                'status': 'removed',
                'message': 'Bookmark removed successfully'
            })
        else:
            # Add bookmark
            bookmark_data = {
                'user_id': user_id,
                'item_type': content_type,
                'item_id': content_id,
                'created_at': get_current_utc_time().isoformat()
            }

            @retry_db_operation(max_retries=3)
            def add_bookmark():
                return supabase_admin.table('bookmarks') \
                    .insert(bookmark_data) \
                    .execute()

            add_bookmark()

            return jsonify({
                'success': True,
                'status': 'added',
                'message': 'Bookmark added successfully'
            })

    except (httpx.RemoteProtocolError, httpx.ReadTimeout, httpx.ConnectTimeout) as e:
        logger.error(f"Database connection error in bookmark: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Network issue. Please try again.',
            'retry': True
        }), 503
    except Exception as e:
        logger.error(f"Bookmark error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': 'An unexpected error occurred. Please try again.'
        }), 500

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


@app.route('/api/check-bookmark/<content_type>/<content_id>')
@login_required
def check_bookmark_status(content_type, content_id):
    """Check if current user has bookmarked specific content"""
    try:
        if 'user_id' not in session:
            return jsonify({'is_bookmarked': False})

        user_id = session['user_id']

        # Check if bookmark exists
        existing_response = supabase_admin.table('bookmarks').select('id') \
            .eq('user_id', user_id) \
            .eq('item_type', content_type) \
            .eq('item_id', content_id) \
            .execute()

        is_bookmarked = bool(existing_response.data and len(existing_response.data) > 0)

        return jsonify({
            'is_bookmarked': is_bookmarked,
            'content_type': content_type,
            'content_id': content_id
        })

    except Exception as e:
        logger.error(f"Error checking bookmark status: {str(e)}")
        return jsonify({'is_bookmarked': False})


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

        # Check if content is active (expired content is auto-deactivated)
        table_map = {
            'course': 'courses',
            'job': 'jobs',
            'internship': 'internships'
        }

        item_response = supabase.table(table_map[content_type]).select('application_link').eq('id', content_id).eq(
            'is_active', True).single().execute()

        if not item_response.data or not item_response.data.get('application_link'):
            return jsonify({'error': 'Content not found or has expired'}), 404

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

        return jsonify({'application_link': item_response.data['application_link']})

    except Exception as e:
        logger.error(f"Error getting application link: {str(e)}")
        return jsonify({'error': 'Failed to get application link'}), 500


# Share Route
@app.route('/share/<content_type>/<content_id>')
def share_content(content_type, content_id):
    try:
        table_map = {
            'course': ('courses', 'title', 'description', 'application_link'),
            'job': ('jobs', 'title', 'company', 'application_link'),
            'internship': ('internships', 'title', 'company', 'application_link'),
            'blog': ('blog_posts', 'title', 'description', 'application_link')
        }

        if content_type not in table_map:
            return jsonify({'error': 'Invalid content type'}), 400

        table, title_field, desc_field, link_field = table_map[content_type]

        content = supabase.table(table).select(f'id, {title_field}, {desc_field}, {link_field}') \
            .eq('id', content_id).single().execute().data

        if not content:
            return jsonify({'error': 'Content not found'}), 404

        # Use application_link as the primary share URL
        share_url = content.get(link_field) or request.host_url.rstrip('/') + url_for('index')

        # Return JSON data for the modal
        return jsonify({
            'success': True,
            'content_type': content_type,
            'content_id': content_id,
            'title': content[title_field],
            'description': content.get(desc_field, ''),
            'share_url': share_url,
            'direct_link': share_url  # This is the application link
        })

    except Exception as e:
        logger.error(f"Share error: {str(e)}")
        return jsonify({'error': 'Failed to generate share data'}), 500


# Contact and newsletter subscribe routes
@app.route('/api/contact', methods=['POST'])
def contact():
    try:
        # Get form data
        data = request.form.to_dict()
        required_fields = ['name', 'email', 'subject', 'message']

        if not all(data.get(field) for field in required_fields):
            return jsonify({'status': 'error', 'message': 'All fields are required'}), 400

        # Save message to database USING ADMIN CLIENT (bypasses RLS)
        message_data = {
            'name': data['name'],
            'email': data['email'],
            'subject': data['subject'],
            'message': data['message'],
            'created_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        # Use admin client for both operations
        response = supabase_admin.table('contact_messages').insert(message_data).execute()

        if not response.data:
            raise Exception('Failed to save message')

        # Create notification using ADMIN CLIENT
        notification_data = {
            'type': 'message',
            'title': 'New Contact Message',
            'message': f'New message from {data["name"]} ({data["email"]}) about {data["subject"]}',
            'related_id': response.data[0]['id'],
            'created_at': get_current_utc_time().isoformat()
        }

        supabase_admin.table('admin_notifications').insert(notification_data).execute()

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


# ===============  SUBSCRIBE ===============
# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============== EMAIL HELPERS ===============
def send_newsletter_welcome(email):
    """Send professional welcome email with unsubscribe button"""
    try:
        subject = "🎉 Welcome to CareerMaker Newsletter!"

        # Create unsubscribe URL
        unsubscribe_url = f"{request.host_url.rstrip('/')}/unsubscribe?email={email}"

        # Plain text version
        plain_text = f"""Welcome to CareerMaker Newsletter! 🎉

Hello!

Thank you for subscribing to the CareerMaker Newsletter. We're excited to have you onboard!

WHAT YOU'LL RECEIVE:
✓ Course Updates - New learning opportunities
✓ Job Alerts - Latest career opportunities  
✓ Career Tips - Industry insights and advice
✓ Exclusive Content - Subscriber-only resources

Ready to boost your career? Visit: {request.host_url}

---
You received this email because you subscribed to CareerMaker Newsletter.
If you no longer wish to receive these emails, unsubscribe here:
{unsubscribe_url}

Stay Connected:
Facebook: https://facebook.com/careermaker
Twitter: https://twitter.com/careermaker
LinkedIn: https://linkedin.com/company/careermaker

CareerMaker • 123 Career Street • Tech City
© {datetime.now().year} CareerMaker. All rights reserved.
Privacy Policy: {request.host_url.rstrip('/')}/privacy
Terms of Service: {request.host_url.rstrip('/')}/terms
"""

        # HTML version
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to CareerMaker Newsletter</title>
    <style>
        /* Email styles */
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; }}
        .email-container {{ max-width: 600px; margin: 0 auto; background: white; }}
        .email-header {{ background: linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%); padding: 40px 20px; text-align: center; color: white; }}
        .logo {{ font-size: 36px; font-weight: bold; margin-bottom: 10px; }}
        .content-section {{ padding: 30px; border-bottom: 1px solid #eee; }}
        .section-title {{ color: #4361ee; margin-bottom: 20px; font-size: 22px; }}
        .benefit-item {{ display: flex; align-items: center; gap: 10px; margin: 10px 0; }}
        .benefit-icon {{ width: 40px; height: 40px; background: #4361ee; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }}
        .cta-section {{ text-align: center; padding: 40px 30px; background: #f8f9fa; }}
        .cta-button {{ display: inline-block; background: #4361ee; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
        .email-footer {{ padding: 30px; background: #f1f3f5; text-align: center; }}
        .unsubscribe-button {{ display: inline-block; background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin: 15px 0; }}
        @media (max-width: 600px) {{ .content-section {{ padding: 20px; }} }}
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="email-header">
            <div class="logo">🎓 CareerMaker</div>
            <h1>Welcome Aboard!</h1>
            <p>Your career journey just got better</p>
        </div>

        <!-- Welcome Message -->
        <div class="content-section">
            <h2 class="section-title">Hello Future Leader!</h2>
            <p>We're thrilled to have you join the CareerMaker community! Get ready for regular updates packed with career-boosting resources.</p>
        </div>

        <!-- What You'll Get -->
        <div class="content-section">
            <h2 class="section-title">What You'll Receive</h2>
            <div class="benefit-item">
                <div class="benefit-icon">📚</div>
                <div><strong>Course Updates</strong><br>New learning opportunities</div>
            </div>
            <div class="benefit-item">
                <div class="benefit-icon">💼</div>
                <div><strong>Job Alerts</strong><br>Latest opportunities</div>
            </div>
            <div class="benefit-item">
                <div class="benefit-icon">📈</div>
                <div><strong>Career Tips</strong><br>Industry insights</div>
            </div>
            <div class="benefit-item">
                <div class="benefit-icon">⭐</div>
                <div><strong>Exclusive Content</strong><br>Subscriber-only resources</div>
            </div>
        </div>

        <!-- CTA Section -->
        <div class="cta-section">
            <h2>Ready to Boost Your Career?</h2>
            <p>Explore our platform and discover amazing opportunities waiting for you.</p>
            <a href="{request.host_url}" class="cta-button">🚀 Explore CareerMaker</a>
        </div>

        <!-- Footer with Unsubscribe -->
        <div class="email-footer">
            <p>You received this email because you subscribed to CareerMaker Newsletter.</p>
            <p>If you no longer wish to receive these emails:</p>
            <a href="{unsubscribe_url}" class="unsubscribe-button">✋ Unsubscribe</a>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
                © {datetime.now().year} CareerMaker. All rights reserved.<br>
                <a href="{request.host_url.rstrip('/')}/privacy" style="color: #666;">Privacy Policy</a> • 
                <a href="{request.host_url.rstrip('/')}/terms" style="color: #666;">Terms of Service</a>
            </p>
        </div>
    </div>
</body>
</html>"""

        return send_email_smtp(email, subject, plain_text, html_content)
    except Exception as e:
        logger.error(f"❌ Failed to send welcome email to {email}: {str(e)}")
        return False


def send_newsletter_goodbye(email):
    """Send goodbye email with both plain text and HTML"""
    try:
        subject = "👋 You've unsubscribed from CareerMaker Newsletter"

        # Plain text version
        plain_text = f"""You've been unsubscribed

Hello,

We're sorry to see you go! You have been unsubscribed from the CareerMaker Newsletter.

If this was a mistake, you can subscribe again anytime on our website.

Thank you for being with us.

Best regards,
CareerMaker Team

---
If you have any questions, please contact us at support@careermaker.tech
"""

        # HTML version
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Unsubscribed from CareerMaker</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; }}
        .email-container {{ max-width: 600px; margin: 0 auto; background: white; }}
        .email-header {{ background: #6c757d; padding: 30px 20px; text-align: center; color: white; }}
        .content {{ padding: 40px; text-align: center; }}
        .goodbye-icon {{ font-size: 48px; margin-bottom: 20px; color: #6c757d; }}
        .resubscribe-btn {{ display: inline-block; background: #4361ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
        .footer {{ padding: 20px; background: #f1f3f5; text-align: center; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>👋 Goodbye</h1>
        </div>
        <div class="content">
            <div class="goodbye-icon">💔</div>
            <h2>You've been unsubscribed</h2>
            <p>We're sorry to see you go! You have been unsubscribed from the CareerMaker Newsletter.</p>
            <p>If this was a mistake, you can subscribe again anytime:</p>
            <a href="{request.host_url}" class="resubscribe-btn">Subscribe Again</a>
            <p>Thank you for being with us.</p>
            <p><strong>CareerMaker Team</strong></p>
        </div>
        <div class="footer">
            <p>© {datetime.now().year} CareerMaker. All rights reserved.</p>
            <p>If you have any questions, contact us at support@careermaker.com</p>
        </div>
    </div>
</body>
</html>"""

        return send_email_smtp(email, subject, plain_text, html_content)
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
            "subscribed_at": get_current_utc_time().isoformat(),
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


@app.route('/api/unsubscribe', methods=['GET', 'POST'])
def unsubscribe_newsletter():
    email = None
    try:
        # Extract email from different sources
        if request.method == 'GET':
            email = request.args.get('email')
        elif request.is_json:
            data = request.get_json(silent=True) or {}
            email = data.get("email")
        else:
            email = request.form.get("email")

        # Validate email
        if not email or "@" not in email:
            return jsonify({
                "status": "error",
                "message": "Please provide a valid email address"
            }), 400

        # Check if subscriber exists
        existing = supabase_admin.table("newsletter_subscribers") \
            .select("email", "is_active") \
            .eq("email", email) \
            .maybe_single().execute()

        if not existing or not existing.data:
            return jsonify({
                "status": "error",
                "message": "Email not found in our subscription list"
            }), 404

        if not existing.data.get("is_active", True):
            return jsonify({
                "status": "success",
                "message": "You are already unsubscribed"
            })

        # Mark as unsubscribed
        supabase_admin.table("newsletter_subscribers") \
            .update({"is_active": False, "unsubscribed_at": get_current_utc_time().isoformat()}) \
            .eq("email", email).execute()

        # Send goodbye email
        send_newsletter_goodbye(email)

        return jsonify({
            "status": "success",
            "message": "You have been successfully unsubscribed from CareerMaker newsletter!"
        })

    except Exception as e:
        logger.error(f"❌ Newsletter unsubscribe error for {email}: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Failed to unsubscribe. Please try again."
        }), 500


@app.route('/unsubscribe', methods=['GET', 'POST'])
def unsubscribe_page():
    """Render unsubscribe page"""
    try:
        if request.method == 'POST':
            # Handle form submission - let the API route handle it
            email = request.form.get('email', '').strip()
            if not email or "@" not in email:
                flash('Please provide a valid email address', 'error')
                return redirect(url_for('unsubscribe_page', email=email))

            # The actual unsubscription is handled by /api/unsubscribe
            # This route just redirects to show the form
            return redirect(url_for('unsubscribe_page', email=email))

        # GET request - show unsubscribe form
        email = request.args.get('email', '')
        return render_template('unsubscribe.html', email=email)

    except Exception as e:
        logger.error(f"❌ Unsubscribe page error: {str(e)}")
        flash('An error occurred. Please try again later.', 'error')
        return redirect(url_for('unsubscribe_page'))


@app.after_request
def after_request(response):
    """Ensure API endpoints return JSON with proper headers"""
    # Only apply to API routes
    if request.path.startswith('/api/'):
        # Ensure content type is JSON
        if 'application/json' not in response.headers.get('Content-Type', ''):
            response.headers['Content-Type'] = 'application/json; charset=utf-8'

        # Add CORS headers for mobile
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')

    return response


@app.errorhandler(500)
def handle_500_error(error):
    """Handle 500 errors with JSON response for API routes"""
    if request.path.startswith('/api/'):
        return jsonify({
            'status': 'error',
            'message': 'Internal server error. Please try again later.'
        }), 500
    return error


@app.errorhandler(404)
def handle_404_error(error):
    """Handle 404 errors with JSON response for API routes"""
    if request.path.startswith('/api/'):
        return jsonify({
            'status': 'error',
            'message': 'Endpoint not found.'
        }), 404
    return error


# ===== ADMIN ROUTES =====

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    # Check for logout message
    message = request.args.get('message')
    if message == 'logout_success':
        flash('Logged out successfully', 'success')

    session.pop('admin_logout_initiated', None)

    if request.method == 'GET':
        return render_template('admin/admin-login.html')

    # POST request handling
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')

    # Check if AJAX request
    is_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

    # Validation 1: Check if username is empty
    if not username:
        if is_ajax:
            return jsonify({'success': False, 'error': 'Username is required'})
        flash('Username is required', 'danger')
        return render_template('admin/admin-login.html')

    # Validation 2: Check if password is empty
    if not password:
        if is_ajax:
            return jsonify({'success': False, 'error': 'Password is required'})
        flash('Password is required', 'danger')
        return render_template('admin/admin-login.html')

    try:
        # Query admin from database
        response = supabase_admin.table('admins') \
            .select('*') \
            .eq('username', username) \
            .maybe_single() \
            .execute()

        # FIXED: Check if response is None or response.data is None/empty
        # SINGLE VALIDATION for both wrong username AND wrong password
        admin = None
        password_valid = False

        # Check if admin exists
        if response and response.data:
            admin = response.data
            # Verify password only if admin exists
            if verify_password(admin['password_hash'], password):
                password_valid = True

        # SINGLE VALIDATION: If admin doesn't exist OR password is wrong
        if not admin or not password_valid:
            if is_ajax:
                return jsonify({'success': False, 'error': 'Invalid username or password'})
            flash('Invalid username or password', 'danger')
            return render_template('admin/admin-login.html')

        # Check if admin is active
        if not admin.get('is_active', True):
            if is_ajax:
                return jsonify({'success': False, 'error': 'Account is deactivated. Contact administrator.'})
            flash('Account is deactivated. Contact administrator.', 'danger')
            return render_template('admin/admin-login.html')

        # Check if admin is deleted
        if admin.get('is_deleted', False):
            if is_ajax:
                return jsonify({'success': False, 'error': 'Account is deleted. Contact administrator.'})
            flash('Account is deleted. Contact administrator.', 'danger')
            return render_template('admin/admin-login.html')

        # All validations passed - Login successful
        # Update last login time
        try:
            current_time = get_current_utc_time().isoformat()
            supabase_admin.table('admins') \
                .update({'last_login': current_time}) \
                .eq('id', admin['id']) \
                .execute()
        except Exception as e:
            logger.warning(f"Could not update last login time: {str(e)}")

        # Set session variables
        session.update({
            'admin_id': str(admin['id']),
            'admin_username': admin['username'],
            'admin_email': admin.get('email', ''),
            'admin_full_name': admin.get('full_name', admin['username']),
            'is_superadmin': bool(admin.get('is_superadmin', False)),
            'admin_logged_in': True
        })

        # Log successful login
        logger.info(f"Admin login successful: {username}")

        # Return success response
        if is_ajax:
            return jsonify({
                'success': True,
                'message': 'Login successful!',
                'redirect': url_for('admin_dashboard')
            })

        flash('Login successful!', 'success')
        return redirect(url_for('admin_dashboard'))

    except Exception as e:
        logger.error(f"Admin login error: {str(e)}", exc_info=True)
        if is_ajax:
            return jsonify({'success': False, 'error': 'An error occurred. Please try again.'})
        flash('An error occurred. Please try again.', 'danger')
        return render_template('admin/admin-login.html')

@app.route('/admin/logout')
def admin_logout():
    # Clear all admin session variables
    admin_vars = ['admin_id', 'admin_username', 'admin_email', 'admin_full_name', 'is_superadmin', 'admin_logged_in']
    for var in admin_vars:
        session.pop(var, None)

    # Redirect to admin login with message in URL parameter
    return redirect(url_for('admin_login', message='logout_success'))


@app.route('/api/admin/check-session')
def check_admin_session():
    try:
        # Check if admin is logged in
        if not session.get('admin_logged_in'):
            return jsonify({
                'logged_in': False,
                'message': 'Admin access required. Please login.',
                'requires_login': True,
                'redirect_url': '/admin/login'
            }), 401

        # Verify the session is still valid by checking with database
        admin_id = session.get('admin_id')
        if admin_id:
            # Use admin client to verify admin still exists (bypasses RLS)
            admin = supabase_admin.table('admins') \
                .select('id, username, is_active') \
                .eq('id', admin_id) \
                .maybe_single() \
                .execute()

            if not admin.data or not admin.data.get('is_active', True):
                # Admin doesn't exist or is inactive - clear session
                session.clear()
                return jsonify({
                    'logged_in': False,
                    'message': 'Admin account no longer active',
                    'requires_login': True,
                    'redirect_url': '/admin/login'
                }), 401

        return jsonify({
            'logged_in': True,
            'username': session.get('admin_username'),
            'is_superadmin': session.get('is_superadmin', False)
        })

    except Exception as e:
        logger.error(f"Error checking admin session: {str(e)}")
        return jsonify({
            'logged_in': False,
            'message': 'Error checking session status',
            'requires_login': True,
            'redirect_url': '/admin/login'
        }), 500


@app.route('/admin/dashboard')
def admin_dashboard():
    # Check if admin is logged in
    if not session.get('admin_logged_in'):
        flash('Please login to access the dashboard', 'warning')
        return redirect(url_for('admin_login'))

    try:
        # Check if it's an AJAX request for data only
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return admin_dashboard_stats()

        # Get statistics using admin client
        with ThreadPoolExecutor() as executor:
            users_future = executor.submit(
                supabase_admin.table('users').select('id', count='exact').eq('is_deleted', False).execute
            )
            courses_future = executor.submit(
                supabase_admin.table('courses').select('id', count='exact').eq('is_active', True).eq('is_deleted',
                                                                                                     False).execute
            )
            jobs_future = executor.submit(
                supabase_admin.table('jobs').select('id', count='exact').eq('is_active', True).eq('is_deleted',
                                                                                                  False).execute
            )
            internships_future = executor.submit(
                supabase_admin.table('internships').select('id', count='exact').eq('is_active', True).eq('is_deleted',
                                                                                                         False).execute
            )
            messages_future = executor.submit(
                supabase_admin.table('contact_messages').select('id', count='exact').eq('is_deleted', False).execute
            )
            unread_future = executor.submit(
                supabase_admin.table('contact_messages').select('id', count='exact').eq('status', 'unread').eq(
                    'is_deleted', False).execute
            )
            subscribers_future = executor.submit(
                supabase_admin.table('newsletter_subscribers').select('id', count='exact').eq('is_active', True).eq(
                    'is_deleted', False).execute
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

        # Get recent activities
        recent_messages = supabase_admin.table('contact_messages') \
                              .select('id, name, email, created_at') \
                              .eq('is_deleted', False) \
                              .order('created_at', desc=True) \
                              .limit(5) \
                              .execute().data or []

        recent_users = supabase_admin.table('users') \
                           .select('id, email, username, created_at') \
                           .eq('is_deleted', False) \
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
            admin_name=session.get('admin_full_name', session.get('admin_username', 'Admin')),
            admin_id=session.get('admin_id'),
            admin_username=session.get('admin_username'),
            is_superadmin=session.get('is_superadmin', False)  # ← IMPORTANT: Pass to template
        )

    except Exception as e:
        logger.error(f"Dashboard error: {str(e)}", exc_info=True)
        flash('Failed to load dashboard data. Please try again.', 'danger')
        return redirect(url_for('admin_login'))


# ===== ADMIN DATA FETCHING ROUTES =====

@app.route('/api/admin/dashboard-stats')
@admin_required
def admin_dashboard_stats():
    """Get dashboard statistics with activities - SIMPLIFIED"""
    try:
        stats = {
            'users': 0,
            'courses': 0,
            'jobs': 0,
            'internships': 0,
            'messages': 0,
            'unread_messages': 0,
            'subscribers': 0,
            'testimonials': 0,
            'blog_posts': 0,
            'total_expired': 0
        }

        # Test database connection first
        try:
            test_response = supabase_admin.table('users').select('id').limit(1).execute()
            logger.info("✅ Database connection test successful")
        except Exception as db_error:
            logger.error(f"❌ Database connection failed: {str(db_error)}")
            return jsonify(stats)

        # Get all stats with individual error handling
        try:
            # USERS COUNT - Only regular users from users table, NOT admins
            # Exclude soft-deleted users
            users_response = supabase_admin.table('users') \
                .select('id', count='exact') \
                .eq('is_deleted', False) \
                .execute()
            stats['users'] = getattr(users_response, 'count', 0) or 0
            logger.info(f"✅ Regular users count: {stats['users']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting users count: {str(e)}")
            stats['users'] = 0

        # Get admins count separately (for admin management, not for dashboard card)
        try:
            admins_response = supabase_admin.table('admins') \
                .select('id', count='exact') \
                .eq('is_deleted', False) \
                .execute()
            stats['admins'] = getattr(admins_response, 'count', 0) or 0
            logger.info(f"✅ Admins count: {stats['admins']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting admins count: {str(e)}")
            stats['admins'] = 0

        try:
            # Active courses count (not deleted)
            courses_response = supabase_admin.table('courses') \
                .select('id', count='exact') \
                .eq('is_active', True) \
                .eq('is_deleted', False) \
                .execute()
            stats['courses'] = getattr(courses_response, 'count', 0) or 0
            logger.info(f"✅ Courses count: {stats['courses']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting courses count: {str(e)}")
            stats['courses'] = 0

        try:
            # Active jobs count (not deleted)
            jobs_response = supabase_admin.table('jobs') \
                .select('id', count='exact') \
                .eq('is_active', True) \
                .eq('is_deleted', False) \
                .execute()
            stats['jobs'] = getattr(jobs_response, 'count', 0) or 0
            logger.info(f"✅ Jobs count: {stats['jobs']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting jobs count: {str(e)}")
            stats['jobs'] = 0

        try:
            # Active internships count (not deleted)
            internships_response = supabase_admin.table('internships') \
                .select('id', count='exact') \
                .eq('is_active', True) \
                .eq('is_deleted', False) \
                .execute()
            stats['internships'] = getattr(internships_response, 'count', 0) or 0
            logger.info(f"✅ Internships count: {stats['internships']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting internships count: {str(e)}")
            stats['internships'] = 0

        try:
            # Total messages count (not deleted)
            messages_response = supabase_admin.table('contact_messages') \
                .select('id', count='exact') \
                .eq('is_deleted', False) \
                .execute()
            stats['messages'] = getattr(messages_response, 'count', 0) or 0
            logger.info(f"✅ Messages count: {stats['messages']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting messages count: {str(e)}")
            stats['messages'] = 0

        try:
            # Unread messages count (not deleted)
            unread_response = supabase_admin.table('contact_messages') \
                .select('id', count='exact') \
                .eq('status', 'unread') \
                .eq('is_deleted', False) \
                .execute()
            stats['unread_messages'] = getattr(unread_response, 'count', 0) or 0
            logger.info(f"✅ Unread messages: {stats['unread_messages']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting unread messages: {str(e)}")
            stats['unread_messages'] = 0

        try:
            # Active subscribers count (not deleted)
            subscribers_response = supabase_admin.table('newsletter_subscribers') \
                .select('id', count='exact') \
                .eq('is_active', True) \
                .eq('is_deleted', False) \
                .execute()
            stats['subscribers'] = getattr(subscribers_response, 'count', 0) or 0
            logger.info(f"✅ Subscribers count: {stats['subscribers']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting subscribers count: {str(e)}")
            stats['subscribers'] = 0

        try:
            # Active testimonials count (not deleted)
            testimonials_response = supabase_admin.table('testimonials') \
                .select('id', count='exact') \
                .eq('is_active', True) \
                .eq('is_deleted', False) \
                .execute()
            stats['testimonials'] = getattr(testimonials_response, 'count', 0) or 0
            logger.info(f"✅ Testimonials count: {stats['testimonials']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting testimonials count: {str(e)}")
            stats['testimonials'] = 0

        try:
            # Blog posts count (not deleted)
            blog_posts_response = supabase_admin.table('blog_posts') \
                .select('id', count='exact') \
                .eq('is_deleted', False) \
                .execute()
            stats['blog_posts'] = getattr(blog_posts_response, 'count', 0) or 0
            logger.info(f"✅ Blog posts count: {stats['blog_posts']}")
        except Exception as e:
            logger.warning(f"⚠️ Error getting blog posts count: {str(e)}")
            stats['blog_posts'] = 0

        try:
            # Expired content count (content that is inactive but not deleted)
            expired_courses = supabase_admin.table('courses') \
                .select('id', count='exact') \
                .eq('is_active', False) \
                .eq('is_deleted', False) \
                .execute()
            expired_jobs = supabase_admin.table('jobs') \
                .select('id', count='exact') \
                .eq('is_active', False) \
                .eq('is_deleted', False) \
                .execute()
            expired_internships = supabase_admin.table('internships') \
                .select('id', count='exact') \
                .eq('is_active', False) \
                .eq('is_deleted', False) \
                .execute()

            expired_courses_count = getattr(expired_courses, 'count', 0) or 0
            expired_jobs_count = getattr(expired_jobs, 'count', 0) or 0
            expired_internships_count = getattr(expired_internships, 'count', 0) or 0

            stats['total_expired'] = expired_courses_count + expired_jobs_count + expired_internships_count
            logger.info(f"✅ Expired content: {stats['total_expired']} (Courses: {expired_courses_count}, Jobs: {expired_jobs_count}, Internships: {expired_internships_count})")
        except Exception as e:
            logger.warning(f"⚠️ Error getting expired content count: {str(e)}")
            stats['total_expired'] = 0

        logger.info(f"🎯 Final dashboard stats: {stats}")

        # ========== SIMPLE ACTIVITIES FETCHING ==========
        activities = []

        try:
            # 1. Get 3 most recent regular users (not admins)
            recent_users = supabase_admin.table('users') \
                .select('id, username, email, created_at') \
                .eq('is_deleted', False) \
                .order('created_at', desc=True) \
                .limit(3) \
                .execute().data or []

            for user in recent_users:
                activities.append({
                    'type': 'user',
                    'icon': 'user-plus',
                    'message': f"New user registered: {user.get('username', 'Unknown')}",
                    'time': user.get('created_at', '')
                })
        except Exception as e:
            print(f"Error getting users for activities: {str(e)}")

        try:
            # 2. Get 3 most recent jobs (active, not deleted)
            recent_jobs = supabase_admin.table('jobs') \
                .select('id, title, company, created_at, is_active') \
                .eq('is_deleted', False) \
                .order('created_at', desc=True) \
                .limit(3) \
                .execute().data or []

            for job in recent_jobs:
                if job.get('is_active', False):
                    activities.append({
                        'type': 'job',
                        'icon': 'briefcase',
                        'message': f"New job: {job.get('title', 'Unknown')} at {job.get('company', 'Unknown')}",
                        'time': job.get('created_at', '')
                    })
        except Exception as e:
            print(f"Error getting jobs for activities: {str(e)}")

        try:
            # 3. Get 3 most recent messages (not deleted)
            recent_messages = supabase_admin.table('contact_messages') \
                .select('id, name, email, created_at, status') \
                .eq('is_deleted', False) \
                .order('created_at', desc=True) \
                .limit(3) \
                .execute().data or []

            for msg in recent_messages:
                activities.append({
                    'type': 'message',
                    'icon': 'envelope',
                    'message': f"New message from {msg.get('name', 'Unknown')}",
                    'time': msg.get('created_at', '')
                })
        except Exception as e:
            print(f"Error getting messages for activities: {str(e)}")

        # Sort activities by time (newest first)
        activities.sort(key=lambda x: x.get('time', ''), reverse=True)

        # Keep only last 5 activities
        stats['activities'] = activities[:5]
        # ========== END ACTIVITIES ==========

        print(f"✅ Dashboard stats with {len(stats.get('activities', []))} activities")

        return jsonify(stats)

    except Exception as e:
        logger.error(f"❌ Critical error in dashboard stats: {str(e)}", exc_info=True)
        # Return default stats on critical error
        return jsonify({
            'users': 0,
            'courses': 0,
            'jobs': 0,
            'internships': 0,
            'messages': 0,
            'unread_messages': 0,
            'subscribers': 0,
            'testimonials': 0,
            'blog_posts': 0,
            'total_expired': 0,
            'activities': []
        })


# ===== CREATE/UPDATE ROUTES =====

@app.route('/api/admin/<string:resource>', methods=['POST'])
@admin_required
def create_admin_resource(resource):
    try:
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users']
        if resource not in valid_resources:
            return jsonify({'success': False, 'message': 'Invalid resource type'}), 400

        data = request.get_json()

        # Handle categories data for blog posts
        if resource == 'blog' and 'categories' in data:
            data = handle_categories_data(data)

        # Handle expiration date conversion for courses, jobs, and internships
        if resource in ['courses', 'jobs', 'internships'] and 'expiration_date' in data:
            if data['expiration_date']:
                try:
                    # Convert datetime-local string to ISO format
                    expiration_date = datetime.fromisoformat(data['expiration_date'].replace('Z', '+00:00'))
                    data['expiration_date'] = expiration_date.isoformat()
                    logger.info(f"Set expiration date for {resource}: {data['expiration_date']}")
                except ValueError as e:
                    # If invalid date, set to None
                    data['expiration_date'] = None
                    logger.warning(f"Invalid expiration date format for {resource}: {str(e)}")
            else:
                # If empty string, set to None
                data['expiration_date'] = None
                logger.info(f"No expiration date set for {resource}")

        # Validate required fields
        required_fields = {
            'courses': ['title', 'category', 'instructor', 'application_link'],
            'jobs': ['title', 'company', 'location', 'application_link'],
            'internships': ['title', 'company', 'location', 'application_link'],
            'blog': ['title', 'author', 'content', 'categories']
        }

        if resource in required_fields:
            for field in required_fields[resource]:
                if not data.get(field):
                    return jsonify({'success': False, 'message': f'{field.replace("_", " ").title()} is required'}), 400

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts'
        }
        table_name = table_map.get(resource, resource)

        # Add created_at timestamp
        data['created_at'] = get_current_utc_time().isoformat()
        data['updated_at'] = get_current_utc_time().isoformat()

        # Set proper defaults for new content
        if resource in ['courses', 'jobs', 'internships', 'blog']:
            data['is_featured'] = data.get('is_featured', False)  # Default to not featured
            data['is_active'] = data.get('is_active', True)  # Default to active

        # For courses, jobs, internships, and blog, sync featured state with active state
        if resource in ['courses', 'jobs', 'internships', 'blog']:
            data['is_featured'] = data.get('is_active', True)

        # Enhance data with company logo for relevant resources
        if resource in ['jobs', 'internships', 'courses'] and data.get('company'):
            try:
                enhanced_data = enhance_content_with_logo(data, resource, None)
                if enhanced_data.get('company_logo'):
                    data['company_logo'] = enhanced_data['company_logo']
                    logger.info(f"Auto-fetched company logo for {data.get('company')}")
            except Exception as logo_error:
                logger.warning(f"Could not fetch company logo for {data.get('company')}: {str(logo_error)}")
                # Continue without logo if fetching fails

        # Insert into database
        response = supabase_admin.table(table_name).insert(data).execute()

        if not response.data:
            return jsonify({'success': False, 'message': f'Failed to create {resource[:-1]}'}), 500

        created_item = response.data[0]
        logger.info(f"✅ Successfully created {resource[:-1]}: {created_item.get('title', 'Unknown')}")

        # If creation was successful and we have a company but no logo, try to fetch it asynchronously
        if resource in ['jobs', 'internships', 'courses'] and data.get('company') and not data.get('company_logo'):
            try:
                content_id = created_item['id']
                # Run logo fetching in background
                from threading import Thread
                def fetch_logo_async():
                    try:
                        logo_url = get_or_fetch_logo(data['company'], resource, content_id)
                        if logo_url:
                            # Update the content with the fetched logo
                            supabase_admin.table(table_name).update({
                                'company_logo': logo_url,
                                'updated_at': get_current_utc_time().isoformat()
                            }).eq('id', content_id).execute()
                            logger.info(f"✅ Successfully added logo to {resource} {content_id}")
                    except Exception as e:
                        logger.error(f"Background logo fetch failed: {str(e)}")

                thread = Thread(target=fetch_logo_async)
                thread.start()
            except Exception as async_error:
                logger.error(f"Failed to start background logo fetch: {str(async_error)}")

        return jsonify({
            'success': True,
            'message': f'{resource[:-1].title()} created successfully',
            'data': created_item
        })

    except Exception as e:
        logger.error(f"❌ Error creating {resource}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to create {resource[:-1]}'}), 500


@app.route('/api/admin/<string:resource>/<string:id>', methods=['PUT'])
@admin_required
def update_admin_resource(resource, id):
    try:
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users']
        if resource not in valid_resources:
            return jsonify({'success': False, 'message': 'Invalid resource type'}), 400

        data = request.get_json()

        # Handle categories data for blog posts
        if resource == 'blog' and 'categories' in data:
            data = handle_categories_data(data)

        # Handle expiration date conversion for courses, jobs, and internships
        if resource in ['courses', 'jobs', 'internships'] and 'expiration_date' in data:
            expiration_date = data.get('expiration_date')

            # Handle empty string or null - set to None (remove expiration)
            if not expiration_date or expiration_date == '':
                data['expiration_date'] = None
                logger.info(f"Cleared expiration date for {resource} {id}")
            else:
                try:
                    # Convert datetime-local string to ISO format
                    expiration_date = datetime.fromisoformat(expiration_date.replace('Z', '+00:00'))
                    data['expiration_date'] = expiration_date.isoformat()
                    logger.info(f"Updated expiration date for {resource} {id}: {data['expiration_date']}")
                except ValueError as e:
                    # If invalid date, set to None
                    data['expiration_date'] = None
                    logger.warning(f"Invalid expiration date format for {resource} {id}: {str(e)}")

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts'
        }
        table_name = table_map.get(resource, resource)

        # Check if resource exists
        existing_response = supabase_admin.table(table_name).select(
            'id, company, company_logo, expiration_date, is_active').eq('id', id).execute()
        if not existing_response.data:
            return jsonify({'success': False, 'message': f'{resource[:-1].title()} not found'}), 404

        existing_data = existing_response.data[0]
        logger.info(f"Updating {resource} {id}: {existing_data.get('title', 'Unknown')}")

        # Add updated_at timestamp
        data['updated_at'] = get_current_utc_time().isoformat()

        # Enhance data with company logo if company name changed
        if resource in ['jobs', 'internships', 'courses']:
            current_company = existing_data.get('company')
            new_company = data.get('company')

            # If company changed or no logo exists, try to fetch new logo
            if new_company and (new_company != current_company or not existing_data.get('company_logo')):
                try:
                    enhanced_data = enhance_content_with_logo(data, resource, id)
                    if enhanced_data.get('company_logo'):
                        data['company_logo'] = enhanced_data['company_logo']
                        logger.info(f"✅ Auto-updated company logo for {new_company}")
                    elif new_company != current_company:
                        # Company changed but no logo found, clear existing logo
                        data['company_logo'] = None
                        logger.info(f"Cleared company logo for changed company: {new_company}")
                except Exception as logo_error:
                    logger.warning(f"Could not update company logo for {new_company}: {str(logo_error)}")
                    # Keep existing logo if fetching fails
                    if existing_data.get('company_logo') and new_company == current_company:
                        data['company_logo'] = existing_data['company_logo']

        # For courses, jobs, internships, and blog, sync featured state with active state
        if resource in ['courses', 'jobs', 'internships', 'blog']:
            if 'is_active' in data:
                data['is_featured'] = data['is_active']
                logger.info(f"Synced featured status with active status for {resource} {id}")

        # Update in database
        response = supabase_admin.table(table_name).update(data).eq('id', id).execute()

        if not response.data:
            return jsonify({'success': False, 'message': f'Failed to update {resource[:-1]}'}), 500

        updated_item = response.data[0]
        logger.info(f"✅ Successfully updated {resource[:-1]}: {updated_item.get('title', 'Unknown')}")

        # If update was successful and company changed but no logo was fetched, try background fetch
        if (resource in ['jobs', 'internships', 'courses'] and
                data.get('company') and
                data.get('company') != existing_data.get('company') and
                not data.get('company_logo')):

            try:
                from threading import Thread
                def fetch_logo_async():
                    try:
                        logo_url = get_or_fetch_logo(data['company'], resource, id)
                        if logo_url:
                            # Update the content with the fetched logo
                            supabase_admin.table(table_name).update({
                                'company_logo': logo_url,
                                'updated_at': get_current_utc_time().isoformat()
                            }).eq('id', id).execute()
                            logger.info(f"✅ Successfully updated logo for {resource} {id}")
                    except Exception as e:
                        logger.error(f"Background logo update failed: {str(e)}")

                thread = Thread(target=fetch_logo_async)
                thread.start()
            except Exception as async_error:
                logger.error(f"Failed to start background logo update: {str(async_error)}")

        return jsonify({
            'success': True,
            'message': f'{resource[:-1].title()} updated successfully',
            'data': updated_item
        })

    except Exception as e:
        logger.error(f"❌ Error updating {resource}: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'Failed to update {resource[:-1]}'}), 500


# Filters for jobs and internhsips
@app.route('/api/jobs/filters')
def get_job_filters():
    """API endpoint to get available job filters"""
    try:
        # Get unique locations
        locations_result = supabase.table('jobs') \
            .select('location') \
            .eq('is_active', True) \
            .execute()

        # Get unique companies
        companies_result = supabase.table('jobs') \
            .select('company') \
            .eq('is_active', True) \
            .execute()

        # Get unique job types
        types_result = supabase.table('jobs') \
            .select('type') \
            .eq('is_active', True) \
            .execute()

        filters = {
            'locations': sorted(set([item['location'] for item in locations_result.data if item.get('location')])),
            'companies': sorted(set([item['company'] for item in companies_result.data if item.get('company')])),
            'types': sorted(set([item['type'] for item in types_result.data if item.get('type')]))
        }

        return jsonify({'success': True, 'filters': filters})

    except Exception as e:
        logger.error(f"Error getting job filters: {str(e)}")
        return jsonify({'success': False, 'filters': {}})


@app.route('/api/internships/filters')
def get_internship_filters():
    """API endpoint to get available internship filters"""
    try:
        # Get unique locations
        locations_result = supabase.table('internships') \
            .select('location') \
            .eq('is_active', True) \
            .execute()

        # Get unique companies
        companies_result = supabase.table('internships') \
            .select('company') \
            .eq('is_active', True) \
            .execute()

        # Get unique types
        types_result = supabase.table('internships') \
            .select('type') \
            .eq('is_active', True) \
            .execute()

        # Get unique durations
        durations_result = supabase.table('internships') \
            .select('duration') \
            .eq('is_active', True) \
            .execute()

        filters = {
            'locations': sorted(set([item['location'] for item in locations_result.data if item.get('location')])),
            'companies': sorted(set([item['company'] for item in companies_result.data if item.get('company')])),
            'types': sorted(set([item['type'] for item in types_result.data if item.get('type')])),
            'durations': sorted(set([item['duration'] for item in durations_result.data if item.get('duration')]))
        }

        return jsonify({'success': True, 'filters': filters})

    except Exception as e:
        logger.error(f"Error getting internship filters: {str(e)}")
        return jsonify({'success': False, 'filters': {}})


# ===== STATUS TOGGLE ROUTES =====

@app.route('/api/admin/<string:resource>/<string:id>/status', methods=['PUT'])
@admin_required
def toggle_resource_status(resource, id):
    try:
        # DEBUG: Log the incoming request
        logger.info(f"🔄 Status update request received - Resource: {resource}, ID: {id}")

        data = request.get_json()
        logger.info(f"📊 Request data: {data}")

        if not data:
            logger.error("❌ No JSON data in request")
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        is_active = data.get('is_active')
        logger.info(f"🔧 is_active value: {is_active}")

        if is_active is None:
            logger.error("❌ is_active parameter is missing")
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog_posts', 'users', 'newsletter_subscribers']
        if resource not in valid_resources:
            logger.error(f"❌ Invalid resource type: {resource}")
            return jsonify({'success': False, 'message': f'Invalid resource type: {resource}'}), 400

        # Map resource to table name (some resources use different table names)
        table_map = {
            'blog_posts': 'blog_posts',
            'newsletter_subscribers': 'newsletter_subscribers'
        }
        table_name = table_map.get(resource, resource)

        logger.info(f"🗃️ Using table: {table_name} for resource: {resource}")

        # Check if resource exists
        existing_response = supabase_admin.table(table_name).select('id').eq('id', id).execute()
        if not existing_response.data:
            logger.error(f"❌ Resource not found: {table_name} with ID: {id}")
            return jsonify({'success': False, 'message': f'{resource.replace("_", " ").title()} not found'}), 404

        # Update status in database
        update_data = {
            'is_active': bool(is_active),
            'updated_at': get_current_utc_time().isoformat()
        }

        # For blog posts, courses, jobs, internships - sync featured status with active status
        if resource in ['blog_posts', 'courses', 'jobs', 'internships']:
            update_data['is_featured'] = bool(is_active)
            logger.info(f"⭐ Syncing featured status to: {is_active}")

        logger.info(f"📝 Update data: {update_data}")

        # Perform the update
        response = supabase_admin.table(table_name).update(update_data).eq('id', id).execute()

        if not response.data:
            logger.error(f"❌ No data returned from update for {resource} {id}")
            return jsonify({'success': False, 'message': f'Failed to update {resource.replace("_", " ")} status'}), 500

        logger.info(f"✅ Successfully updated {resource} {id} status to: {is_active}")

        # Format the resource name for the response message
        resource_name = resource.replace('_', ' ').title().rstrip('s')
        return jsonify({
            'success': True,
            'message': f'{resource_name} status updated successfully'
        })

    except Exception as e:
        logger.error(f"❌ Error updating {resource} status: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to update status'}), 500


# ===== FEATURED TOGGLE ROUTES =====

@app.route('/api/admin/<string:resource>/<string:id>/featured', methods=['PUT'])
@admin_required
def toggle_resource_featured(resource, id):
    try:
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog']
        if resource not in valid_resources:
            return jsonify({'success': False, 'message': 'Invalid resource type'}), 400

        data = request.get_json()
        is_featured = data.get('is_featured')

        if is_featured is None:
            return jsonify({'success': False, 'message': 'is_featured parameter is required'}), 400

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts'
        }
        table_name = table_map.get(resource, resource)

        # Update featured status in database
        update_data = {'is_featured': is_featured, 'updated_at': get_current_utc_time().isoformat()}

        response = supabase_admin.table(table_name).update(update_data).eq('id', id).execute()

        if not response.data:
            return jsonify({'success': False, 'message': f'{resource[:-1]} not found'}), 404

        return jsonify({'success': True, 'message': f'{resource[:-1]} featured status updated successfully'})

    except Exception as e:
        logger.error(f"Error updating {resource} featured status: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update featured status'}), 500


# ===== BULK OPERATION ROUTES =====

@app.route('/api/admin/<string:resource>/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_resources(resource):
    try:
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter', 'testimonials', 'admins']
        if resource not in valid_resources:
            return jsonify({'success': False, 'message': 'Invalid resource type'}), 400

        data = request.get_json()
        ids = data.get('ids', [])

        if not ids:
            return jsonify({'success': False, 'message': 'No items selected'}), 400

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts',
            'messages': 'contact_messages',
            'newsletter': 'newsletter_subscribers',
            'testimonials': 'testimonials',
            'admins': 'admins'
        }
        table_name = table_map.get(resource, resource)

        # For content that should go to trash, soft delete
        trash_tables = ['courses', 'jobs', 'internships', 'blog_posts', 'testimonials', 'users', 'contact_messages', 'newsletter_subscribers', 'admins']

        if table_name in trash_tables:
            # Soft delete - move to trash and set is_active to False
            update_data = {
                'is_deleted': True,
                'is_active': False,  # CRITICAL: Set to inactive when deleted
                'deleted_at': get_current_utc_time().isoformat(),
                'updated_at': get_current_utc_time().isoformat()
            }

            # For content that has is_featured (courses, jobs, internships, blog), also set to False
            if resource in ['courses', 'jobs', 'internships', 'blog']:
                update_data['is_featured'] = False

            response = supabase_admin.table(table_name).update(update_data).in_('id', ids).execute()
            updated_count = len(response.data) if response.data else 0

            return jsonify({
                'success': True,
                'message': f'{updated_count} {resource} moved to trash and deactivated',
                'moved_to_trash': True,
                'deactivated': True,
                'deleted_count': updated_count
            })
        else:
            # For other tables, permanent delete
            response = supabase_admin.table(table_name).delete().in_('id', ids).execute()
            return jsonify({
                'success': True,
                'message': f'{len(response.data) if response.data else 0} {resource} deleted successfully'
            })

    except Exception as e:
        logger.error(f"Error bulk deleting {resource}: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete items'}), 500


@app.route('/api/admin/<string:resource>/bulk-status', methods=['POST'])
@admin_required
def bulk_update_resource_status(resource):
    try:
        # DEBUG: Log the incoming request
        logger.info(f"🔄 Bulk status update request received - Resource: {resource}")

        data = request.get_json()
        logger.info(f"📊 Bulk request data: {data}")

        if not data:
            logger.error("❌ No JSON data in bulk request")
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        ids = data.get('ids', [])
        is_active = data.get('is_active')

        if not ids:
            logger.error("❌ No IDs provided in bulk request")
            return jsonify({'success': False, 'message': 'No items selected'}), 400

        if is_active is None:
            logger.error("❌ is_active parameter is missing in bulk request")
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog_posts', 'users', 'newsletter_subscribers']
        if resource not in valid_resources:
            return jsonify({'success': False, 'message': f'Invalid resource type: {resource}'}), 400

        # Map resource to table name
        table_map = {
            'blog_posts': 'blog_posts',
            'newsletter_subscribers': 'newsletter_subscribers'
        }
        table_name = table_map.get(resource, resource)

        logger.info(f"🗃️ Bulk update using table: {table_name} for resource: {resource}")
        logger.info(f"🔧 Updating {len(ids)} items with is_active: {is_active}")

        # Update status in database
        update_data = {
            'is_active': bool(is_active),
            'updated_at': get_current_utc_time().isoformat()
        }

        # For blog posts, courses, jobs, internships - sync featured status
        if resource in ['blog_posts', 'courses', 'jobs', 'internships']:
            update_data['is_featured'] = bool(is_active)
            logger.info(f"⭐ Bulk syncing featured status to: {is_active}")

        response = supabase_admin.table(table_name).update(update_data).in_('id', ids).execute()

        updated_count = len(response.data) if response.data else 0
        logger.info(f"✅ Bulk update completed: {updated_count} items updated")

        # Format the resource name for the response message
        resource_name = resource.replace('_', ' ').title().rstrip('s')
        return jsonify({
            'success': True,
            'message': f'{updated_count} {resource_name} status updated successfully'
        })

    except Exception as e:
        logger.error(f"❌ Error bulk updating {resource} status: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to update status'}), 500


# ===== DATA FETCHING ROUTES =====

@app.route('/api/admin/<string:resource>')
@admin_required
def get_admin_resources(resource):
    try:
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter', 'testimonials']
        if resource not in valid_resources:
            return jsonify({'error': 'Invalid resource type'}), 400

        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')

        # Get filter parameters
        category_filter = request.args.get('category', '')
        type_filter = request.args.get('type', '')
        role_filter = request.args.get('role', '')
        status_filter = request.args.get('status', '')

        # Map resources to table names
        table_map = {
            'blog': 'blog_posts',
            'messages': 'contact_messages',
            'newsletter': 'newsletter_subscribers',
            'testimonials': 'testimonials'
        }
        table_name = table_map.get(resource, resource)

        # Build base query - EXCLUDE soft-deleted items
        query = supabase_admin.table(table_name).select('*')

        # Add is_deleted = False filter for all tables that support soft delete
        tables_with_soft_delete = ['courses', 'jobs', 'internships', 'blog_posts', 'testimonials', 'users',
                                   'contact_messages', 'newsletter_subscribers']
        if table_name in tables_with_soft_delete:
            query = query.eq('is_deleted', False)

        # Apply filters based on resource
        if resource == 'courses' and category_filter:
            query = query.eq('category', category_filter)

        if resource == 'jobs' and type_filter:
            query = query.eq('type', type_filter)

        if resource == 'internships' and type_filter:
            query = query.eq('type', type_filter)

        #  Blog category filter - handle array column
        if resource == 'blog' and category_filter:
            # For PostgreSQL array column, use the contains operator @>
            # This checks if the array contains the specified value
            query = query.contains('categories', [category_filter])

        # Users section uses status filter (active/inactive)
        if resource == 'users' and status_filter:
            if status_filter == 'active':
                query = query.eq('is_active', True)
            elif status_filter == 'inactive':
                query = query.eq('is_active', False)

        if resource == 'messages' and status_filter:
            query = query.eq('status', status_filter)

        if resource == 'newsletter' and status_filter:
            if status_filter == 'active':
                query = query.eq('is_active', True)
            elif status_filter == 'inactive':
                query = query.eq('is_active', False)

        if resource == 'testimonials' and status_filter:
            if status_filter == 'active':
                query = query.eq('is_active', True)
            elif status_filter == 'inactive':
                query = query.eq('is_active', False)

        # Apply search filters
        if search:
            if resource == 'courses':
                query = query.or_(f"title.ilike.%{search}%,category.ilike.%{search}%,instructor.ilike.%{search}%")
            elif resource == 'jobs':
                query = query.or_(f"title.ilike.%{search}%,company.ilike.%{search}%,location.ilike.%{search}%")
            elif resource == 'internships':
                query = query.or_(f"title.ilike.%{search}%,company.ilike.%{search}%,location.ilike.%{search}%")
            elif resource == 'blog':
                query = query.or_(f"title.ilike.%{search}%,author.ilike.%{search}%,categories.ilike.%{search}%")
            elif resource == 'users':
                query = query.or_(f"username.ilike.%{search}%,email.ilike.%{search}%,role.ilike.%{search}%")
            elif resource == 'messages':
                query = query.or_(f"name.ilike.%{search}%,email.ilike.%{search}%,subject.ilike.%{search}%")
            elif resource == 'newsletter':
                # Use Python filtering for newsletter to avoid errors
                pass
            elif resource == 'testimonials':
                query = query.or_(f"username.ilike.%{search}%,content.ilike.%{search}%")

        # Apply ordering
        if resource == 'messages':
            query = query.order('created_at', desc=True)
        elif resource == 'newsletter':
            query = query.order('created_at', desc=True)
        else:
            query = query.order('created_at', desc=True)

        # For newsletter, handle search and pagination in Python
        if resource == 'newsletter' and search:
            # Execute query without search filter
            all_response = query.execute()
            all_data = all_response.data or []

            # Filter in Python
            filtered_data = []
            search_lower = search.lower()
            for item in all_data:
                email = item.get('email', '').lower()
                if search_lower in email:
                    filtered_data.append(item)

            total_count = len(filtered_data)

            # Paginate
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page
            paginated_data = filtered_data[start_idx:end_idx]

            return jsonify({
                'data': paginated_data,
                'count': total_count,
                'per_page': per_page
            })
        else:
            # Paginate normally
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page - 1
            data_response = query.range(start_idx, end_idx).execute()

            # Count query - EXCLUDE soft-deleted items
            count_query = supabase_admin.table(table_name).select('id', count='exact')

            if table_name in tables_with_soft_delete:
                count_query = count_query.eq('is_deleted', False)

            # Apply filters to count query
            if resource == 'courses' and category_filter:
                count_query = count_query.eq('category', category_filter)
            if resource == 'jobs' and type_filter:
                count_query = count_query.eq('type', type_filter)
            if resource == 'internships' and type_filter:
                count_query = count_query.eq('type', type_filter)
            # FIXED: Blog category filter for count query
            if resource == 'blog' and category_filter:
                count_query = count_query.contains('categories', [category_filter])
            if resource == 'users' and role_filter:
                count_query = count_query.eq('role', role_filter)
            if resource == 'messages' and status_filter:
                count_query = count_query.eq('status', status_filter)
            if resource == 'newsletter' and status_filter:
                if status_filter == 'active':
                    count_query = count_query.eq('is_active', True)
                elif status_filter == 'inactive':
                    count_query = count_query.eq('is_active', False)
            if resource == 'testimonials' and status_filter:
                if status_filter == 'active':
                    count_query = count_query.eq('is_active', True)
                elif status_filter == 'inactive':
                    count_query = count_query.eq('is_active', False)

            if search and resource != 'newsletter':
                if resource == 'courses':
                    count_query = count_query.or_(
                        f"title.ilike.%{search}%,category.ilike.%{search}%,instructor.ilike.%{search}%")
                elif resource == 'jobs':
                    count_query = count_query.or_(
                        f"title.ilike.%{search}%,company.ilike.%{search}%,location.ilike.%{search}%")
                elif resource == 'internships':
                    count_query = count_query.or_(
                        f"title.ilike.%{search}%,company.ilike.%{search}%,location.ilike.%{search}%")
                elif resource == 'blog':
                    count_query = count_query.or_(
                        f"title.ilike.%{search}%,author.ilike.%{search}%,categories.ilike.%{search}%")
                elif resource == 'users':
                    count_query = count_query.or_(
                        f"username.ilike.%{search}%,email.ilike.%{search}%,role.ilike.%{search}%")
                elif resource == 'messages':
                    count_query = count_query.or_(
                        f"name.ilike.%{search}%,email.ilike.%{search}%,subject.ilike.%{search}%")
                elif resource == 'testimonials':
                    count_query = count_query.or_(f"username.ilike.%{search}%,content.ilike.%{search}%")

            count_response = count_query.execute()
            total_count = count_response.count or 0

            return jsonify({
                'data': data_response.data,
                'count': total_count,
                'per_page': per_page
            })

    except Exception as e:
        logger.error(f"Error loading {resource}: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ===== SINGLE ITEM ROUTES =====

@app.route('/api/admin/<string:resource>/<string:id>')
@admin_required
def get_admin_resource(resource, id):
    try:
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter']
        if resource not in valid_resources:
            return jsonify({'error': 'Invalid resource type'}), 400

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts',
            'messages': 'contact_messages',
            'newsletter': 'newsletter_subscribers'
        }
        table_name = table_map.get(resource, resource)

        # Get item from database
        response = supabase_admin.table(table_name).select('*').eq('id', id).execute()

        if not response.data:
            return jsonify({'error': f'{resource[:-1]} not found'}), 404

        return jsonify(response.data[0])

    except Exception as e:
        logger.error(f"Error loading {resource}: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/<string:resource>/<string:id>', methods=['DELETE'])
@admin_required
def delete_admin_resource(resource, id):
    try:
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter', 'testimonials', 'admins']
        if resource not in valid_resources:
            return jsonify({'error': 'Invalid resource type'}), 400

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts',
            'messages': 'contact_messages',
            'newsletter': 'newsletter_subscribers',
            'testimonials': 'testimonials',
            'admins': 'admins'
        }

        if resource in ['courses', 'jobs', 'internships', 'users']:
            table_name = resource
        else:
            table_name = table_map.get(resource, resource)

        logger.info(f"Delete request - Resource: {resource}, Table: {table_name}, ID: {id}")

        # Check if item exists
        existing = supabase_admin.table(table_name).select('*').eq('id', id).execute()
        if not existing.data:
            return jsonify({'error': f'{resource} not found'}), 404

        # For content that should go to trash, soft delete
        trash_tables = ['courses', 'jobs', 'internships', 'blog_posts', 'testimonials', 'users', 'contact_messages', 'newsletter_subscribers', 'admins']

        if table_name in trash_tables:
            # Soft delete - move to trash and set is_active to False
            update_data = {
                'is_deleted': True,
                'is_active': False,  # CRITICAL: Set to inactive when deleted
                'deleted_at': get_current_utc_time().isoformat(),
                'updated_at': get_current_utc_time().isoformat()
            }

            # For content that has is_featured (courses, jobs, internships, blog), also set to False
            if resource in ['courses', 'jobs', 'internships', 'blog']:
                update_data['is_featured'] = False

            response = supabase_admin.table(table_name).update(update_data).eq('id', id).execute()

            if response.data:
                logger.info(f"✅ Moved {resource} {id} to trash and deactivated")
                return jsonify({
                    'success': True,
                    'message': f'{resource} moved to trash and deactivated',
                    'moved_to_trash': True,
                    'deactivated': True
                })
            else:
                return jsonify({'error': f'Failed to delete {resource}'}), 500
        else:
            # For other tables, permanent delete
            response = supabase_admin.table(table_name).delete().eq('id', id).execute()
            if response.data:
                return jsonify({'success': True, 'message': f'{resource} deleted successfully'})
            else:
                return jsonify({'error': f'Failed to delete {resource}'}), 500

    except Exception as e:
        logger.error(f"Error deleting {resource}: {str(e)}")
        return jsonify({'error': str(e)}), 500


# ===== BLOG ROUTES =====

@app.route('/api/blog/<blog_id>')
def get_blog_detail(blog_id):
    """Get detailed blog post for modal"""
    try:
        # Get blog post with admin client to bypass RLS
        blog_response = supabase_admin.table('blog_posts') \
            .select('*') \
            .eq('id', blog_id) \
            .eq('is_active', True) \
            .single() \
            .execute()

        if not blog_response.data:
            return jsonify({'success': False, 'error': 'Blog post not found'}), 404

        blog = blog_response.data

        # Add bookmark status if user is logged in
        if 'user_id' in session:
            user_bookmarks = get_user_bookmarks(session['user_id'])
            bookmark_map = {(item.get('content_type'), item.get('id')): True for item in user_bookmarks}
            blog['is_bookmarked'] = bookmark_map.get(('blog', blog.get('id')), False)
        else:
            blog['is_bookmarked'] = False

        # Add like status and count
        like_count_response = supabase_admin.table('blog_likes') \
            .select('id', count='exact') \
            .eq('blog_id', blog_id) \
            .execute()

        blog['like_count'] = like_count_response.count or 0

        # Check if user liked this post (REQUIRES LOGIN)
        if 'user_id' in session:
            user_like_response = supabase_admin.table('blog_likes') \
                .select('id') \
                .eq('user_id', session['user_id']) \
                .eq('blog_id', blog_id) \
                .execute()
            blog['is_liked'] = len(user_like_response.data or []) > 0
        else:
            blog['is_liked'] = False

        # Get view count from database
        view_count_response = supabase_admin.table('blog_views') \
            .select('id', count='exact') \
            .eq('blog_id', blog_id) \
            .execute()

        blog['views'] = view_count_response.count or 0

        # Ensure all required fields are present
        blog.setdefault('read_time', '5 min read')
        blog.setdefault('author_avatar', None)
        blog.setdefault('categories', ['Career'])
        blog.setdefault('views', 0)

        return jsonify({
            'success': True,
            'blog': blog
        })

    except Exception as e:
        logger.error(f"Error getting blog detail: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to load blog post'}), 500


@app.route('/blog/<blog_id>')
def blog_detail(blog_id):
    """Blog detail page"""
    try:
        # Get blog post
        blog_response = supabase.table('blog_posts') \
            .select('*') \
            .eq('id', blog_id) \
            .eq('is_active', True) \
            .single() \
            .execute()

        if not blog_response.data:
            flash('Blog post not found', 'danger')
            return redirect(url_for('blog'))

        blog = blog_response.data

        # Add bookmark status if user is logged in
        if 'user_id' in session:
            user_bookmarks = get_user_bookmarks(session['user_id'])
            bookmark_map = {(item.get('content_type'), item.get('id')): True for item in user_bookmarks}
            blog['is_bookmarked'] = bookmark_map.get(('blog', blog.get('id')), False)
        else:
            blog['is_bookmarked'] = False

        # Get view count
        view_count_response = supabase_admin.table('blog_views') \
            .select('id', count='exact') \
            .eq('blog_id', blog_id) \
            .execute()

        blog['views'] = view_count_response.count or 0

        # Get related posts (same category)
        categories = blog.get('categories', [])
        related_posts = []

        if categories:
            related_response = supabase.table('blog_posts') \
                .select('*') \
                .eq('is_active', True) \
                .neq('id', blog_id) \
                .overlaps('categories', categories) \
                .limit(3) \
                .execute()

            related_posts = related_response.data or []

        return render_template('blog-detail.html',
                               blog=blog,
                               related_posts=related_posts)

    except Exception as e:
        logger.error(f"Error loading blog detail: {str(e)}")
        flash('Error loading blog post', 'danger')
        return redirect(url_for('blog'))


@app.route('/api/blog/<blog_id>/bookmark', methods=['POST'])
@login_required
def bookmark_blog(blog_id):
    """Bookmark a blog post"""
    try:
        # Check if blog exists
        blog_check = supabase_admin.table('blog_posts') \
            .select('id') \
            .eq('id', blog_id) \
            .eq('is_active', True) \
            .execute()

        if not blog_check.data:
            return jsonify({'success': False, 'error': 'Blog post not found'}), 404

        user_id = session['user_id']

        # Check for existing bookmark
        existing_check = supabase_admin.table('bookmarks') \
            .select('id') \
            .eq('user_id', user_id) \
            .eq('item_type', 'blog') \
            .eq('item_id', blog_id) \
            .execute()

        existing_bookmarks = existing_check.data if hasattr(existing_check, 'data') else []

        if existing_bookmarks:
            # Remove bookmark
            delete_result = supabase_admin.table('bookmarks') \
                .delete() \
                .eq('id', existing_bookmarks[0]['id']) \
                .execute()

            if hasattr(delete_result, 'data') and delete_result.data:
                return jsonify({
                    'success': True,
                    'status': 'removed',
                    'message': 'Blog removed from bookmarks'
                })
            else:
                return jsonify({'success': False, 'error': 'Failed to remove bookmark'}), 500
        else:
            # Add bookmark
            bookmark_data = {
                'user_id': user_id,
                'item_type': 'blog',
                'item_id': blog_id,
                'created_at': get_current_utc_time().isoformat()
            }

            insert_result = supabase_admin.table('bookmarks') \
                .insert(bookmark_data) \
                .execute()

            if hasattr(insert_result, 'data') and insert_result.data:
                return jsonify({
                    'success': True,
                    'status': 'added',
                    'message': 'Blog added to bookmarks'
                })
            else:
                return jsonify({'success': False, 'error': 'Failed to add bookmark'}), 500

    except Exception as e:
        logger.error(f"Blog bookmark error: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': 'An unexpected error occurred'}), 500


@app.route('/api/blog/categories')
def get_blog_categories():
    """Get all blog categories"""
    try:
        # Get all blog posts and extract categories
        blogs_response = supabase.table('blog_posts') \
            .select('categories') \
            .eq('is_active', True) \
            .execute()

        categories = set()
        for blog in blogs_response.data or []:
            if blog.get('categories'):
                for category in blog['categories']:
                    categories.add(category)

        return jsonify({
            'success': True,
            'categories': sorted(list(categories))
        })

    except Exception as e:
        logger.error(f"Error getting blog categories: {str(e)}")
        return jsonify({'success': False, 'categories': []})


@app.route('/api/blog/search')
def search_blogs():
    """Search blogs by query"""
    try:
        query = request.args.get('q', '')
        category = request.args.get('category', '')
        page = request.args.get('page', 1, type=int)
        per_page = 12

        # Build query
        blog_query = supabase.table('blog_posts') \
            .select('*') \
            .eq('is_active', True)

        if query:
            blog_query = blog_query.or_(f"title.ilike.%{query}%,content.ilike.%{query}%,author.ilike.%{query}%")

        if category:
            blog_query = blog_query.overlaps('categories', [category])

        # Paginate
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page - 1
        blogs_response = blog_query.order('published_at', desc=True).range(start_idx, end_idx).execute()

        # Count
        count_query = supabase.table('blog_posts').select('id', count='exact').eq('is_active', True)
        if query:
            count_query = count_query.or_(f"title.ilike.%{query}%,content.ilike.%{query}%,author.ilike.%{query}%")
        if category:
            count_query = count_query.overlaps('categories', [category])

        count_response = count_query.execute()
        total_count = count_response.count or 0

        # Add bookmark status if user is logged in
        blogs = blogs_response.data or []
        if 'user_id' in session:
            user_bookmarks = get_user_bookmarks(session['user_id'])
            bookmark_map = {(item.get('content_type'), item.get('id')): True for item in user_bookmarks}

            for blog in blogs:
                blog['is_bookmarked'] = bookmark_map.get(('blog', blog.get('id')), False)

        return jsonify({
            'success': True,
            'blogs': blogs,
            'total_count': total_count,
            'per_page': per_page,
            'page': page
        })

    except Exception as e:
        logger.error(f"Error searching blogs: {str(e)}")
        return jsonify({'success': False, 'blogs': [], 'total_count': 0})


# ===== BLOG ADMIN ROUTES =====

@app.route('/admin/blog')
@admin_required
def admin_blog():
    """Admin blog management page"""
    return render_template('admin/admin-blog.html')


@app.route('/api/admin/blog/stats')
@admin_required
def admin_blog_stats():
    """Get blog statistics for admin"""
    try:
        # Total blog posts
        total_response = supabase_admin.table('blog_posts').select('id', count='exact').execute()

        # Active blog posts
        active_response = supabase_admin.table('blog_posts').select('id', count='exact').eq('is_active', True).execute()

        # Featured blog posts
        featured_response = supabase_admin.table('blog_posts').select('id', count='exact').eq('is_featured',
                                                                                              True).execute()

        # Recent blog posts (last 7 days)
        week_ago = (get_current_utc_time() - timedelta(days=7)).isoformat()
        recent_response = supabase_admin.table('blog_posts').select('id', count='exact').gte('created_at',
                                                                                             week_ago).execute()

        stats = {
            'total': total_response.count or 0,
            'active': active_response.count or 0,
            'featured': featured_response.count or 0,
            'recent': recent_response.count or 0
        }

        return jsonify({'success': True, 'stats': stats})

    except Exception as e:
        logger.error(f"Error getting blog stats: {str(e)}")
        return jsonify({'success': False, 'stats': {}})


@app.route('/api/admin/blog/upload-image', methods=['POST'])
@admin_required
def upload_blog_image():
    """Upload blog post image"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400

        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'Invalid file type. Only JPG, PNG, GIF allowed.'}), 400

        # Read file data
        file_data = file.read()

        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_name = f"blog-images/{uuid.uuid4().hex}.{ext}"

        # Upload to Supabase Storage
        upload_response = supabase_admin.storage.from_("blog-images").upload(
            unique_name,
            file_data,
            {"content-type": file.content_type}
        )

        if not upload_response:
            return jsonify({'success': False, 'error': 'Failed to upload image'}), 500

        # Get public URL
        image_url = supabase.storage.from_("blog-images").get_public_url(unique_name)

        return jsonify({
            'success': True,
            'image_url': image_url,
            'message': 'Image uploaded successfully'
        })

    except Exception as e:
        logger.error(f"Error uploading blog image: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to upload image'}), 500


@app.route('/api/admin/blog/generate-slug', methods=['POST'])
@admin_required
def generate_blog_slug():
    """Generate URL slug from blog title"""
    try:
        data = request.get_json()
        title = data.get('title', '').strip()

        if not title:
            return jsonify({'success': False, 'error': 'Title is required'}), 400

        # Generate slug from title
        slug = generate_slug(title)

        # Check if slug already exists
        existing_response = supabase_admin.table('blog_posts') \
            .select('id') \
            .eq('slug', slug) \
            .execute()

        # If slug exists, add counter
        counter = 1
        original_slug = slug
        while existing_response.data:
            slug = f"{original_slug}-{counter}"
            existing_response = supabase_admin.table('blog_posts') \
                .select('id') \
                .eq('slug', slug) \
                .execute()
            counter += 1

        return jsonify({
            'success': True,
            'slug': slug
        })

    except Exception as e:
        logger.error(f"Error generating slug: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to generate slug'}), 500


# ===== HELPER FUNCTIONS =====

def generate_slug(title):
    """Generate URL-friendly slug from title"""
    # Convert to lowercase
    slug = title.lower()

    # Remove special characters
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)

    # Replace spaces with hyphens
    slug = re.sub(r'[\s]+', '-', slug)

    # Remove consecutive hyphens
    slug = re.sub(r'-+', '-', slug)

    # Trim hyphens from start and end
    slug = slug.strip('-')

    return slug


def calculate_read_time(content):
    """Calculate estimated read time for blog content"""
    # Average reading speed (words per minute)
    WORDS_PER_MINUTE = 200

    # Count words in content
    words = len(content.split())

    # Calculate minutes
    minutes = max(1, round(words / WORDS_PER_MINUTE))

    return f"{minutes} min read"


def validate_blog_data(data):
    """Validate blog post data"""
    errors = []

    if not data.get('title', '').strip():
        errors.append('Title is required')

    if not data.get('content', '').strip():
        errors.append('Content is required')

    if not data.get('author', '').strip():
        errors.append('Author is required')

    if not data.get('categories') or not isinstance(data['categories'], list):
        errors.append('At least one category is required')

    return errors


# ===== BLOG CONTEXT PROCESSOR =====

@app.context_processor
def inject_blog_categories():
    """Inject blog categories into all templates"""
    try:
        categories_response = supabase.table('blog_posts') \
            .select('categories') \
            .eq('is_active', True) \
            .execute()

        categories = set()
        for blog in categories_response.data or []:
            if blog.get('categories'):
                for category in blog['categories']:
                    categories.add(category)

        return {
            'blog_categories': sorted(list(categories))
        }
    except Exception as e:
        logger.error(f"Error loading blog categories: {str(e)}")
        return {'blog_categories': []}


# ===== BLOG MODAL ROUTES =====

@app.route('/api/blog/modal/<blog_id>')
def get_blog_modal_data(blog_id):
    """Get blog data specifically for modal display"""
    try:
        # Get blog post with admin client
        blog_response = supabase_admin.table('blog_posts') \
            .select('*') \
            .eq('id', blog_id) \
            .eq('is_active', True) \
            .single() \
            .execute()

        if not blog_response.data:
            return jsonify({'success': False, 'error': 'Blog post not found'}), 404

        blog = blog_response.data

        # Add bookmark status
        if 'user_id' in session:
            user_bookmarks = get_user_bookmarks(session['user_id'])
            bookmark_map = {(item.get('content_type'), item.get('id')): True for item in user_bookmarks}
            blog['is_bookmarked'] = bookmark_map.get(('blog', blog.get('id')), False)
        else:
            blog['is_bookmarked'] = False

        # Format data for modal
        modal_data = {
            'id': blog['id'],
            'title': blog.get('title', ''),
            'content': blog.get('content', ''),
            'author': blog.get('author', 'CareerMaker Team'),
            'author_avatar': blog.get('author_avatar'),
            'published_at': blog.get('published_at') or blog.get('created_at'),
            'categories': blog.get('categories', ['Career']),
            'read_time': blog.get('read_time', '5 min read'),
            'image': blog.get('image', '/static/images/default-blog.jpg'),
            'is_bookmarked': blog.get('is_bookmarked', False)
        }

        return jsonify({
            'success': True,
            'blog': modal_data
        })

    except Exception as e:
        logger.error(f"Error getting blog modal data: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to load blog data'}), 500


@app.route('/api/blog/<blog_id>/view', methods=['POST'])
def track_blog_view(blog_id):
    """Track blog post views - NO LOGIN REQUIRED"""
    try:
        # Check if blog exists
        blog_check = supabase_admin.table('blog_posts') \
            .select('id') \
            .eq('id', blog_id) \
            .eq('is_active', True) \
            .execute()

        if not blog_check.data:
            return jsonify({'success': False, 'error': 'Blog post not found'}), 404

        # Use session ID for anonymous tracking
        session_id = session.get('session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            session['session_id'] = session_id

        # Check if this session already viewed this post (to avoid duplicate counts)
        existing_view = supabase_admin.table('blog_views') \
            .select('id') \
            .eq('blog_id', blog_id) \
            .eq('session_id', session_id) \
            .execute()

        if not existing_view.data:
            # Record the view
            view_data = {
                'blog_id': blog_id,
                'session_id': session_id,
                'user_id': session.get('user_id'),  # Include user_id if logged in
                'created_at': get_current_utc_time().isoformat()
            }

            supabase_admin.table('blog_views') \
                .insert(view_data) \
                .execute()

        # Get updated view count
        view_count_response = supabase_admin.table('blog_views') \
            .select('id', count='exact') \
            .eq('blog_id', blog_id) \
            .execute()

        total_views = view_count_response.count or 0

        return jsonify({
            'success': True,
            'views': total_views
        })

    except Exception as e:
        logger.error(f"Error tracking blog view: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to track view'}), 500


@app.route('/api/blog/<blog_id>/like', methods=['POST'])
def like_blog(blog_id):
    """Like/unlike a blog post - REQUIRES LOGIN"""
    try:
        # Check if user is logged in
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'Please login to like articles'}), 401

        # Check if blog exists
        blog_check = supabase_admin.table('blog_posts') \
            .select('id') \
            .eq('id', blog_id) \
            .eq('is_active', True) \
            .execute()

        if not blog_check.data:
            return jsonify({'success': False, 'error': 'Blog post not found'}), 404

        user_id = session['user_id']

        # Check if already liked
        existing_like = supabase_admin.table('blog_likes') \
            .select('id') \
            .eq('user_id', user_id) \
            .eq('blog_id', blog_id) \
            .execute()

        if existing_like.data:
            # Unlike
            supabase_admin.table('blog_likes') \
                .delete() \
                .eq('user_id', user_id) \
                .eq('blog_id', blog_id) \
                .execute()

            # Get updated like count
            like_count_response = supabase_admin.table('blog_likes') \
                .select('id', count='exact') \
                .eq('blog_id', blog_id) \
                .execute()

            like_count = like_count_response.count or 0

            return jsonify({
                'success': True,
                'action': 'unliked',
                'like_count': like_count,
                'message': 'Blog unliked'
            })
        else:
            # Like
            like_data = {
                'user_id': user_id,
                'blog_id': blog_id,
                'created_at': get_current_utc_time().isoformat()
            }

            supabase_admin.table('blog_likes') \
                .insert(like_data) \
                .execute()

            # Get updated like count
            like_count_response = supabase_admin.table('blog_likes') \
                .select('id', count='exact') \
                .eq('blog_id', blog_id) \
                .execute()

            like_count = like_count_response.count or 0

            return jsonify({
                'success': True,
                'action': 'liked',
                'like_count': like_count,
                'message': 'Blog liked'
            })

    except Exception as e:
        logger.error(f"Error liking blog: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to like blog'}), 500


@app.template_filter('format_date')
def format_date_filter(value, format='%b %d, %Y'):
    """Custom filter to format dates safely"""
    if not value:
        return 'Unknown date'

    # If it's already a datetime object
    if isinstance(value, datetime):
        return value.strftime(format)

    # If it's a string, try to parse it
    try:
        # Handle ISO format strings (from Supabase)
        if 'T' in str(value):
            dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
            return dt.strftime(format)
        else:
            # Try other common formats
            dt = datetime.strptime(str(value), '%Y-%m-%d %H:%M:%S')
            return dt.strftime(format)
    except (ValueError, TypeError, AttributeError):
        # If parsing fails, return the original value truncated
        return str(value)[:10] if value else 'Unknown date'


# ===== TESTIMONIAL ADMIN ROUTES - FIXED =====

@app.route('/api/admin/testimonials/stats')
@admin_required
def get_testimonial_stats():
    """Get testimonial statistics for admin dashboard - SIMPLIFIED"""
    try:
        # Get all testimonials
        response = supabase_admin.table('testimonials').select('*').execute()

        if not hasattr(response, 'data'):
            return jsonify({'success': True, 'stats': {
                'total': 0, 'active': 0, 'inactive': 0, 'recent': 0
            }})

        all_testimonials = response.data
        total_count = len(all_testimonials)

        # Count active testimonials
        active_count = len([t for t in all_testimonials if t.get('is_active', True)])

        # Count recent testimonials (last 7 days)
        week_ago = (get_current_utc_time() - timedelta(days=7)).isoformat()
        recent_count = len([t for t in all_testimonials if t.get('created_at', '') >= week_ago])

        stats = {
            'total': total_count,
            'active': active_count,
            'inactive': total_count - active_count,
            'recent': recent_count
        }

        return jsonify({'success': True, 'stats': stats})

    except Exception as e:
        logger.error(f"Error getting testimonial stats: {str(e)}")
        return jsonify({'success': False, 'stats': {}})


@app.route('/api/admin/testimonials')
@admin_required
def get_admin_testimonials():
    """Get all testimonials for admin management - EXCLUDE SOFT DELETED by default"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        status = request.args.get('status', '')  # active, inactive, all
        show_deleted = request.args.get('show_deleted', 'false')  # For trash view

        logger.info(
            f"Fetching testimonials - page: {page}, search: '{search}', status: '{status}', show_deleted: {show_deleted}")

        # Base query
        query = supabase_admin.table('testimonials').select('*')

        # Filter out deleted items unless specifically requested (for trash)
        if show_deleted != 'true':
            query = query.eq('is_deleted', False)

        # Apply status filter
        if status == 'active':
            query = query.eq('is_active', True)
        elif status == 'inactive':
            query = query.eq('is_active', False)

        # Apply search
        if search:
            query = query.or_(f"username.ilike.%{search}%,content.ilike.%{search}%")

        # Get total count
        count_response = query.execute()
        all_testimonials = count_response.data
        total_count = len(all_testimonials)

        # Sort by created_at (newest first)
        all_testimonials.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        # Manual pagination
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_testimonials = all_testimonials[start_idx:end_idx]

        # Enhance testimonials with additional data
        enhanced_testimonials = []
        for testimonial in paginated_testimonials:
            enhanced = dict(testimonial)

            # Get user details if user_id exists
            if testimonial.get('user_id'):
                try:
                    user_response = supabase_admin.table('users') \
                        .select('email, created_at, is_active') \
                        .eq('id', testimonial['user_id']) \
                        .execute()

                    if user_response.data:
                        user_data = user_response.data[0]
                        enhanced['user_email'] = user_data.get('email')
                        enhanced['user_created_at'] = user_data.get('created_at')
                        enhanced['user_active'] = user_data.get('is_active', True)
                except Exception as e:
                    logger.warning(f"Could not fetch user data for testimonial {testimonial['id']}: {str(e)}")
                    enhanced['user_email'] = None
                    enhanced['user_active'] = True

            # Generate profile picture URL
            profile_pic_path = testimonial.get('profile_pic')
            if profile_pic_path:
                try:
                    project_ref = supabase_url.split('//')[1].split('.')[0]
                    enhanced[
                        'profile_pic_url'] = f"https://{project_ref}.supabase.co/storage/v1/object/public/profile-pictures/{profile_pic_path}"
                except Exception as e:
                    logger.warning(f"Could not generate profile pic URL: {str(e)}")
                    enhanced[
                        'profile_pic_url'] = f"https://ui-avatars.com/api/?name={testimonial.get('username', 'User')}&background=10b981&color=fff&bold=true"
            else:
                enhanced[
                    'profile_pic_url'] = f"https://ui-avatars.com/api/?name={testimonial.get('username', 'User')}&background=10b981&color=fff&bold=true"

            enhanced_testimonials.append(enhanced)

        return jsonify({
            'success': True,
            'testimonials': enhanced_testimonials,
            'total_count': total_count,
            'per_page': per_page,
            'page': page
        })

    except Exception as e:
        logger.error(f"Error getting admin testimonials: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 500


@app.route('/api/admin/testimonials/<testimonial_id>')
@admin_required
def get_admin_testimonial(testimonial_id):
    """Get single testimonial for admin"""
    try:
        testimonial = supabase_admin.table('testimonials') \
            .select('*') \
            .eq('id', testimonial_id) \
            .single() \
            .execute()

        if not testimonial.data:
            return jsonify({'success': False, 'error': 'Testimonial not found'}), 404

        return jsonify({'success': True, 'testimonial': testimonial.data})

    except Exception as e:
        logger.error(f"Error getting testimonial: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/testimonials/<testimonial_id>/status', methods=['PUT'])
@admin_required
def update_testimonial_status(testimonial_id):
    """Update testimonial status"""
    try:
        data = request.get_json()
        is_active = data.get('is_active')

        if is_active is None:
            return jsonify({'success': False, 'error': 'is_active parameter is required'}), 400

        # Update testimonial status
        result = supabase_admin.table('testimonials') \
            .update({
            'is_active': bool(is_active),
            'updated_at': get_current_utc_time().isoformat()
        }) \
            .eq('id', testimonial_id) \
            .execute()

        if result.data:
            status_text = "activated" if is_active else "deactivated"
            return jsonify({
                'success': True,
                'message': f'Testimonial {status_text} successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Testimonial not found'}), 404

    except Exception as e:
        logger.error(f"Error updating testimonial status: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to update testimonial status'}), 500


@app.route('/api/admin/testimonials/<testimonial_id>', methods=['DELETE'])
@admin_required
def delete_admin_testimonial(testimonial_id):
    """Admin delete testimonial - Soft delete (move to trash)"""
    try:
        # Check if testimonial exists
        testimonial = supabase_admin.table('testimonials') \
            .select('*') \
            .eq('id', testimonial_id) \
            .single() \
            .execute()

        if not testimonial.data:
            return jsonify({'success': False, 'error': 'Testimonial not found'}), 404

        # Soft delete - mark as deleted but keep in database
        update_data = {
            'is_deleted': True,
            'is_active': False,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        result = supabase_admin.table('testimonials') \
            .update(update_data) \
            .eq('id', testimonial_id) \
            .execute()

        if result.data:
            logger.info(f"✅ Admin deleted testimonial {testimonial_id} (soft delete)")
            return jsonify({
                'success': True,
                'message': 'Testimonial moved to trash',
                'moved_to_trash': True
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to delete testimonial'}), 500

    except Exception as e:
        logger.error(f"Error deleting testimonial: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/testimonials/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_testimonials():
    """Bulk soft delete testimonials"""
    try:
        data = request.get_json()
        testimonial_ids = data.get('ids', [])

        if not testimonial_ids:
            return jsonify({'success': False, 'error': 'No testimonials selected'}), 400

        # Soft delete testimonials (mark as deleted)
        update_data = {
            'is_deleted': True,
            'is_active': False,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        result = supabase_admin.table('testimonials') \
            .update(update_data) \
            .in_('id', testimonial_ids) \
            .execute()

        deleted_count = len(result.data) if result.data else 0

        return jsonify({
            'success': True,
            'message': f'{deleted_count} testimonials moved to trash',
            'deleted_count': deleted_count,
            'moved_to_trash': True
        })

    except Exception as e:
        logger.error(f"Error bulk deleting testimonials: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to delete testimonials'}), 500


@app.route('/api/admin/testimonials/bulk-status', methods=['POST'])
@admin_required
def bulk_update_testimonial_status():
    """Bulk update testimonial status"""
    try:
        data = request.get_json()
        testimonial_ids = data.get('ids', [])
        is_active = data.get('is_active')

        if not testimonial_ids:
            return jsonify({'success': False, 'error': 'No testimonials selected'}), 400

        if is_active is None:
            return jsonify({'success': False, 'error': 'is_active parameter is required'}), 400

        # Update testimonial status in bulk
        result = supabase_admin.table('testimonials') \
            .update({
            'is_active': bool(is_active),
            'updated_at': get_current_utc_time().isoformat()
        }) \
            .in_('id', testimonial_ids) \
            .execute()

        updated_count = len(result.data) if result.data else 0

        status_text = "activated" if is_active else "deactivated"
        return jsonify({
            'success': True,
            'message': f'{updated_count} testimonials {status_text} successfully',
            'updated_count': updated_count
        })

    except Exception as e:
        logger.error(f"Error bulk updating testimonial status: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to update testimonial status'}), 500


# ===== MESSAGE SPECIFIC ROUTES =====

@app.route('/api/admin/messages/<string:id>/status', methods=['PUT'])
@admin_required
def update_message_status(id):
    try:
        data = request.get_json()
        status = data.get('status')

        if status not in ['unread', 'read', 'replied']:
            return jsonify({'error': 'Invalid status'}), 400

        # Update message status
        response = supabase_admin.table('contact_messages').update({
            'status': status,
            'updated_at': get_current_utc_time().isoformat()
        }).eq('id', id).execute()

        if not response.data:
            return jsonify({'error': 'Message not found'}), 404

        return jsonify({'success': True, 'message': 'Message status updated successfully'})

    except Exception as e:
        logger.error(f"Error updating message status: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/messages/bulk-status', methods=['POST'])
@admin_required
def bulk_update_message_status():
    try:
        data = request.get_json()
        ids = data.get('ids', [])
        status = data.get('status')

        if not ids:
            return jsonify({'success': False, 'message': 'No items selected'}), 400

        if status not in ['unread', 'read', 'replied']:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400

        # Update status in database
        update_data = {'status': status, 'updated_at': get_current_utc_time().isoformat()}
        response = supabase_admin.table('contact_messages').update(update_data).in_('id', ids).execute()

        return jsonify({
            'success': True,
            'message': f'{len(response.data) if response.data else 0} messages status updated successfully'
        })

    except Exception as e:
        logger.error(f"Error bulk updating message status: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update status'}), 500


@app.route('/api/admin/messages/reply', methods=['POST'])
@admin_required
def admin_message_reply():
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['message_id', 'email', 'subject', 'message']
        if not all(field in data for field in required_fields):
            return jsonify({'success': False, 'message': 'All fields are required'}), 400

        # Send email
        email_sent = send_email_smtp(
            data['email'],
            data['subject'],
            data['message']
        )

        if email_sent:
            # Update message status to replied
            supabase_admin.table('contact_messages').update({
                'status': 'replied',
                'updated_at': get_current_utc_time().isoformat()
            }).eq('id', data['message_id']).execute()

            return jsonify({'success': True, 'message': 'Reply sent successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to send email'}), 500

    except Exception as e:
        logger.error(f"Error sending message reply: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to send reply'}), 500

    @app.route('/api/admin/messages/<string:id>', methods=['DELETE'])
    @admin_required
    def delete_admin_message(id):
        try:
            # Check if message exists
            existing = supabase_admin.table('contact_messages').select('*').eq('id', id).execute()

            if not existing.data:
                return jsonify({'success': False, 'message': 'Message not found'}), 404

            # Soft delete - mark as deleted and move to trash
            update_data = {
                'is_deleted': True,
                'deleted_at': get_current_utc_time().isoformat(),
                'updated_at': get_current_utc_time().isoformat()
            }

            response = supabase_admin.table('contact_messages').update(update_data).eq('id', id).execute()

            if response.data:
                logger.info(f"✅ Message {id} moved to trash")
                return jsonify({
                    'success': True,
                    'message': 'Message moved to trash',
                    'moved_to_trash': True
                })
            else:
                return jsonify({'success': False, 'message': 'Failed to delete message'}), 500

        except Exception as e:
            logger.error(f"Error deleting message: {str(e)}")
            return jsonify({'success': False, 'message': 'Failed to delete message'}), 500


@app.route('/api/admin/messages/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_messages():
    try:
        data = request.get_json()
        ids = data.get('ids', [])

        if not ids:
            return jsonify({'success': False, 'message': 'No messages selected'}), 400

        # Soft delete messages
        deleted_count = 0
        update_data = {
            'is_deleted': True,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table('contact_messages').update(update_data).in_('id', ids).execute()
        deleted_count = len(response.data) if response.data else 0

        logger.info(f"✅ Bulk soft deleted {deleted_count} messages")

        return jsonify({
            'success': True,
            'message': f'{deleted_count} message(s) moved to trash',
            'deleted_count': deleted_count,
            'moved_to_trash': True
        })

    except Exception as e:
        logger.error(f"Error bulk deleting messages: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete messages'}), 500

# ===== NOTIFICATION ROUTES =====

@app.route('/api/admin/notifications')
@admin_required
def get_notifications():
    try:
        # Test database connection first
        try:
            test_connection = supabase_admin.table('admin_notifications').select('id').limit(1).execute()
        except Exception as db_error:
            logger.error(f"Database connection failed for notifications: {str(db_error)}")
            return jsonify([])

        # Get notifications
        response = supabase_admin.table('admin_notifications') \
            .select('*') \
            .order('created_at', desc=True) \
            .limit(10) \
            .execute()

        return jsonify(response.data or [])

    except Exception as e:
        logger.error(f"Error loading notifications: {str(e)}")
        return jsonify([])


@app.route('/api/admin/notifications/mark-all-read', methods=['POST'])
@admin_required
def mark_all_notifications_read():
    try:
        # Mark all notifications as read
        supabase_admin.table('admin_notifications') \
            .update({'is_read': True}) \
            .eq('is_read', False) \
            .execute()

        return jsonify({'success': True, 'message': 'All notifications marked as read'})

    except Exception as e:
        logger.error(f"Error marking notifications as read: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to mark notifications as read'}), 500


# ===== NEWSLETTER ROUTES =====

@app.route('/api/admin/newsletter', methods=['GET'])
@admin_required
def get_newsletter_subscribers():
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        search = request.args.get('search', '').strip()
        status_filter = request.args.get('status', '')

        logger.info(f"📧 Newsletter query - page: {page}, search: '{search}', status: '{status_filter}'")

        # Get ALL subscribers (excluding deleted ones) - like users and messages
        query = supabase_admin.table('newsletter_subscribers').select('*').eq('is_deleted', False)

        # Apply status filter if provided
        if status_filter and status_filter != '':
            if status_filter == 'active':
                query = query.eq('is_active', True)
            elif status_filter == 'inactive':
                query = query.eq('is_active', False)

        # Execute query to get all matching records (like users section)
        all_response = query.execute()
        all_subscribers = all_response.data or []

        logger.info(f"📊 Total newsletter subscribers before filter: {len(all_subscribers)}")

        # Apply search filter in Python (like users and messages section)
        filtered_subscribers = []
        if search and search != '':
            search_lower = search.lower()
            for sub in all_subscribers:
                email = sub.get('email', '').lower()
                if search_lower in email:
                    filtered_subscribers.append(sub)
            logger.info(f"🔍 After search filter: {len(filtered_subscribers)} subscribers match '{search}'")
        else:
            filtered_subscribers = all_subscribers

        # Sort by created_at (newest first) - like other sections
        filtered_subscribers.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        # Get total count
        total_count = len(filtered_subscribers)

        # Apply pagination
        start = (page - 1) * per_page
        end = start + per_page
        paginated_subscribers = filtered_subscribers[start:end]

        # Format response exactly like other sections
        subscribers = []
        for sub in paginated_subscribers:
            subscribers.append({
                'id': sub.get('id'),
                'email': sub.get('email'),
                'is_active': sub.get('is_active', True),
                'subscribed_at': sub.get('created_at'),
                'unsubscribed_at': sub.get('unsubscribed_at'),
                'updated_at': sub.get('updated_at')
            })

        logger.info(f"✅ Newsletter query successful - total: {total_count}, showing: {len(subscribers)}")

        return jsonify({
            'success': True,
            'data': subscribers,
            'count': total_count,
            'page': page,
            'per_page': per_page
        })

    except Exception as e:
        logger.error(f"❌ Error fetching newsletter subscribers: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to fetch subscribers',
            'error': str(e)
        }), 500


@app.route('/api/admin/newsletter/<string:id>/status', methods=['PUT'])
@admin_required
def toggle_newsletter_status(id):
    try:
        data = request.get_json()
        is_active = data.get('is_active')

        if is_active is None:
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        # Check if subscriber exists and is not deleted
        existing = supabase_admin.table('newsletter_subscribers') \
            .select('*') \
            .eq('id', id) \
            .eq('is_deleted', False) \
            .execute()

        if not existing.data:
            return jsonify({'success': False, 'message': 'Subscriber not found'}), 404

        current_time = get_current_utc_time().isoformat()

        # Prepare update data
        update_data = {
            'is_active': is_active,
            'updated_at': current_time
        }

        # If setting to inactive, record unsubscribed time
        if not is_active:
            update_data['unsubscribed_at'] = current_time
        else:
            # If reactivating, clear unsubscribed time
            update_data['unsubscribed_at'] = None

        # Update status in database
        response = supabase_admin.table('newsletter_subscribers').update(update_data).eq('id', id).execute()

        return jsonify({
            'success': True,
            'message': f'Subscriber {"activated" if is_active else "deactivated"} successfully',
            'is_active': is_active
        })

    except Exception as e:
        logger.error(f"Error updating newsletter status: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update status'}), 500


@app.route('/api/admin/newsletter/bulk-status', methods=['POST'])
@admin_required
def bulk_update_newsletter_status():
    try:
        data = request.get_json()
        ids = data.get('ids', [])
        is_active = data.get('is_active')

        if not ids:
            return jsonify({'success': False, 'message': 'No subscribers selected'}), 400

        if is_active is None:
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        current_time = get_current_utc_time().isoformat()

        # Update status for each subscriber
        updated_count = 0
        for subscriber_id in ids:
            update_data = {
                'is_active': is_active,
                'updated_at': current_time
            }

            # If setting to inactive, record unsubscribed time
            if not is_active:
                update_data['unsubscribed_at'] = current_time
            else:
                # If reactivating, clear unsubscribed time
                update_data['unsubscribed_at'] = None

            response = supabase_admin.table('newsletter_subscribers').update(update_data).eq('id',
                                                                                             subscriber_id).execute()

            if response.data:
                updated_count += 1

        return jsonify({
            'success': True,
            'message': f'{updated_count} subscriber(s) {"activated" if is_active else "deactivated"} successfully',
            'updated_count': updated_count
        })

    except Exception as e:
        logger.error(f"Error bulk updating newsletter status: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update subscribers'}), 500


@app.route('/api/admin/newsletter/<string:id>', methods=['DELETE'])
@admin_required
def delete_newsletter_subscriber(id):
    try:
        # Check if subscriber exists
        existing = supabase_admin.table('newsletter_subscribers').select('*').eq('id', id).execute()

        if not existing.data:
            return jsonify({'success': False, 'message': 'Subscriber not found'}), 404

        # Soft delete - mark as deleted and move to trash
        update_data = {
            'is_deleted': True,
            'is_active': False,  # Deactivate as well
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table('newsletter_subscribers').update(update_data).eq('id', id).execute()

        if response.data:
            logger.info(f"✅ Newsletter subscriber {id} moved to trash")
            return jsonify({
                'success': True,
                'message': 'Subscriber moved to trash',
                'moved_to_trash': True
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to delete subscriber'}), 500

    except Exception as e:
        logger.error(f"Error deleting newsletter subscriber: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete subscriber'}), 500


@app.route('/api/admin/newsletter/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_newsletter():
    try:
        data = request.get_json()
        ids = data.get('ids', [])

        if not ids:
            return jsonify({'success': False, 'message': 'No subscribers selected'}), 400

        # Soft delete subscribers - move to trash
        deleted_count = 0
        update_data = {
            'is_deleted': True,
            'is_active': False,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        for subscriber_id in ids:
            response = supabase_admin.table('newsletter_subscribers').update(update_data).eq('id',
                                                                                             subscriber_id).execute()
            if response.data:
                deleted_count += 1

        logger.info(f"✅ Bulk soft deleted {deleted_count} newsletter subscribers")

        return jsonify({
            'success': True,
            'message': f'{deleted_count} subscriber(s) moved to trash',
            'deleted_count': deleted_count,
            'moved_to_trash': True
        })

    except Exception as e:
        logger.error(f"Error bulk deleting newsletter subscribers: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete subscribers'}), 500


# Content expiration routes
@app.route('/api/admin/expired-content-stats')
@admin_required
def expired_content_stats():
    """Get count of content that has been marked as expired (is_active=False)"""
    try:
        # Count content that is marked as expired (is_active=False)
        expired_courses_count = 0
        expired_jobs_count = 0
        expired_internships_count = 0

        try:
            expired_courses = supabase_admin.table('courses').select('id', count='exact').eq('is_active',
                                                                                             False).execute()
            expired_courses_count = expired_courses.count or 0
        except Exception as e:
            logger.warning(f"Error counting expired courses: {str(e)}")

        try:
            expired_jobs = supabase_admin.table('jobs').select('id', count='exact').eq('is_active', False).execute()
            expired_jobs_count = expired_jobs.count or 0
        except Exception as e:
            logger.warning(f"Error counting expired jobs: {str(e)}")

        try:
            expired_internships = supabase_admin.table('internships').select('id', count='exact').eq('is_active',
                                                                                                     False).execute()
            expired_internships_count = expired_internships.count or 0
        except Exception as e:
            logger.warning(f"Error counting expired internships: {str(e)}")

        total_expired = expired_courses_count + expired_jobs_count + expired_internships_count

        logger.info(
            f"Expired content stats - Total: {total_expired}, Courses: {expired_courses_count}, Jobs: {expired_jobs_count}, Internships: {expired_internships_count}")

        return jsonify({
            'success': True,
            'total_expired': total_expired,
            'courses': expired_courses_count,
            'jobs': expired_jobs_count,
            'internships': expired_internships_count
        })

    except Exception as e:
        logger.error(f"Error getting expired content stats: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/admin/expired-content')
@admin_required
def get_expired_content():
    """Get all inactive content (content that needs manual reactivation)"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        content_type = request.args.get('type', '')

        # Build queries for each content type - ALL inactive content
        all_expired_content = []

        # Courses
        if not content_type or content_type == 'courses':
            courses_query = supabase_admin.table('courses').select(
                'id, title, company, expiration_date, created_at, is_active, is_featured')
            courses_query = courses_query.eq('is_active', False)  # Only inactive content
            if search:
                courses_query = courses_query.or_(f"title.ilike.%{search}%,company.ilike.%{search}%")
            expired_courses = courses_query.execute().data or []
            for course in expired_courses:
                all_expired_content.append({
                    'id': course['id'],
                    'content_type': 'courses',
                    'title': course['title'],
                    'company': course.get('company', 'N/A'),
                    'expiration_date': course['expiration_date'],
                    'created_at': course['created_at'],
                    'is_active': course['is_active'],
                    'is_featured': course.get('is_featured', False)
                })

        # Jobs
        if not content_type or content_type == 'jobs':
            jobs_query = supabase_admin.table('jobs').select(
                'id, title, company, expiration_date, created_at, is_active, is_featured')
            jobs_query = jobs_query.eq('is_active', False)  # Only inactive content
            if search:
                jobs_query = jobs_query.or_(f"title.ilike.%{search}%,company.ilike.%{search}%")
            expired_jobs = jobs_query.execute().data or []
            for job in expired_jobs:
                all_expired_content.append({
                    'id': job['id'],
                    'content_type': 'jobs',
                    'title': job['title'],
                    'company': job.get('company', 'N/A'),
                    'expiration_date': job['expiration_date'],
                    'created_at': job['created_at'],
                    'is_active': job['is_active'],
                    'is_featured': job.get('is_featured', False)
                })

        # Internships
        if not content_type or content_type == 'internships':
            internships_query = supabase_admin.table('internships').select(
                'id, title, company, expiration_date, created_at, is_active, is_featured')
            internships_query = internships_query.eq('is_active', False)  # Only inactive content
            if search:
                internships_query = internships_query.or_(f"title.ilike.%{search}%,company.ilike.%{search}%")
            expired_internships = internships_query.execute().data or []
            for internship in expired_internships:
                all_expired_content.append({
                    'id': internship['id'],
                    'content_type': 'internships',
                    'title': internship['title'],
                    'company': internship.get('company', 'N/A'),
                    'expiration_date': internship['expiration_date'],
                    'created_at': internship['created_at'],
                    'is_active': internship['is_active'],
                    'is_featured': internship.get('is_featured', False)
                })

        # Sort by creation date (most recent first)
        all_expired_content.sort(key=lambda x: x['created_at'], reverse=True)

        # Pagination
        total_count = len(all_expired_content)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_content = all_expired_content[start_idx:end_idx]

        logger.info(f"Found {total_count} inactive content items (showing {len(paginated_content)})")

        return jsonify({
            'success': True,
            'data': paginated_content,
            'count': total_count,
            'per_page': per_page,
            'page': page
        })

    except Exception as e:
        logger.error(f"Error getting expired content: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/expired-content/reactivate-all', methods=['POST'])
@admin_required
def reactivate_all_expired_content():
    """Reactivate all expired content"""
    try:
        current_time = get_current_utc_time().isoformat()
        reactivated_count = 0

        # Reactivate expired courses
        courses_result = supabase_admin.table('courses').update({
            'is_active': True,
            'expiration_date': None,
            'updated_at': get_current_utc_time().isoformat()
        }).lt('expiration_date', current_time).eq('is_active', False).execute()
        reactivated_count += len(courses_result.data) if courses_result.data else 0

        # Reactivate expired jobs
        jobs_result = supabase_admin.table('jobs').update({
            'is_active': True,
            'expiration_date': None,
            'updated_at': get_current_utc_time().isoformat()
        }).lt('expiration_date', current_time).eq('is_active', False).execute()
        reactivated_count += len(jobs_result.data) if jobs_result.data else 0

        # Reactivate expired internships
        internships_result = supabase_admin.table('internships').update({
            'is_active': True,
            'expiration_date': None,
            'updated_at': get_current_utc_time().isoformat()
        }).lt('expiration_date', current_time).eq('is_active', False).execute()
        reactivated_count += len(internships_result.data) if internships_result.data else 0

        logger.info(f"Reactivated all expired content: {reactivated_count} items")

        return jsonify({
            'success': True,
            'reactivated_count': reactivated_count,
            'message': f'Reactivated {reactivated_count} expired items'
        })

    except Exception as e:
        logger.error(f"Error reactivating all expired content: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to reactivate all content'}), 500


@app.route('/api/admin/<string:content_type>/<string:content_id>', methods=['PUT'])
@admin_required
def update_content(content_type, content_id):
    """Update content - don't auto-reactivate when updating expiration date"""
    try:
        data = request.get_json()

        # Remove fields that shouldn't be updated directly
        update_data = {k: v for k, v in data.items() if k not in ['id', 'created_at']}

        # Add updated timestamp
        update_data['updated_at'] = get_current_utc_time().isoformat()

        # Update the content
        response = supabase_admin.table(content_type).update(update_data).eq('id', content_id).execute()

        if response.data:
            logger.info(f"✅ Updated {content_type} {content_id}")
            return jsonify({
                'success': True,
                'message': f'{content_type[:-1].title()} updated successfully'
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to update content'}), 500

    except Exception as e:
        logger.error(f"Error updating {content_type}: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to update {content_type}'}), 500


@app.route('/api/admin/<string:content_type>/<string:content_id>/reactivate', methods=['PUT'])
@admin_required
def reactivate_content(content_type, content_id):
    """Reactivate expired content - set as active and featured"""
    try:
        current_time = get_current_utc_time().isoformat()

        # Get current content data
        content_response = supabase_admin.table(content_type).select('expiration_date, is_active').eq('id',
                                                                                                      content_id).execute()

        if not content_response.data:
            return jsonify({'success': False, 'message': 'Content not found'}), 404

        content = content_response.data[0]
        expiration_date = content.get('expiration_date')

        # Check if expiration date is still in past
        if expiration_date and expiration_date <= current_time:
            return jsonify({
                'success': False,
                'message': 'Cannot reactivate content with past expiration date. Please update the expiration date first.',
                'requires_date_update': True
            }), 400

        # Reactivate and set as featured
        update_data = {
            'is_active': True,
            'is_featured': True,  # Set as featured when reactivating
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table(content_type).update(update_data).eq('id', content_id).execute()

        if response.data:
            logger.info(f"✅ Reactivated {content_type} {content_id} with featured status")
            return jsonify({
                'success': True,
                'message': 'Content reactivated successfully and set as featured'
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to reactivate content'}), 500

    except Exception as e:
        logger.error(f"Error reactivating content: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to reactivate content'}), 500


@app.route('/api/admin/check-expired-content', methods=['POST'])
@admin_required
def check_expired_content_api():
    """API endpoint to manually check and deactivate expired content - ENHANCED"""
    try:
        result = check_expired_content()

        if result['success']:
            return jsonify({
                'success': True,
                'message': f"Expired content check completed. Deactivated {result['total_deactivated']} items.",
                'deactivated_count': result['total_deactivated'],
                'timestamp': result['timestamp']
            })
        else:
            return jsonify({
                'success': False,
                'message': f"Error checking expired content: {result['error']}"
            }), 500

    except Exception as e:
        logger.error(f"Error in expired content check API: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Error checking expired content'
        }), 500


@app.route('/api/admin/expired-content/bulk-reactivate', methods=['POST'])
@admin_required
def bulk_reactivate_expired_content():
    """Bulk reactivate expired content with validation"""
    try:
        data = request.get_json()
        items = data.get('items', [])

        if not items:
            return jsonify({'success': False, 'message': 'No items selected for reactivation'}), 400

        current_time = get_current_utc_time().isoformat()
        results = {
            'successful': [],
            'failed': []
        }

        for item in items:
            content_type = item.get('content_type')
            content_id = item.get('content_id')

            if not content_type or not content_id:
                results['failed'].append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'reason': 'Missing content type or ID'
                })
                continue

            # Check expiration date
            content_response = supabase_admin.table(content_type).select(
                'expiration_date, title, company, is_active').eq('id', content_id).execute()

            if not content_response.data:
                results['failed'].append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'reason': 'Content not found'
                })
                continue

            content = content_response.data[0]
            expiration_date = content.get('expiration_date')

            # Validate expiration date is in future
            if expiration_date and expiration_date <= current_time:
                results['failed'].append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'title': content.get('title', 'Unknown'),
                    'company': content.get('company', 'N/A'),
                    'reason': 'Expiration date is still in past. Please update the date first.'
                })
                continue

            # Reactivate with featured status
            update_data = {
                'is_active': True,
                'is_featured': True,  # Set as featured when reactivating
                'updated_at': get_current_utc_time().isoformat()
            }

            response = supabase_admin.table(content_type).update(update_data).eq('id', content_id).execute()

            if response.data:
                results['successful'].append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'title': content.get('title', 'Unknown'),
                    'company': content.get('company', 'N/A')
                })
                logger.info(f"✅ Reactivated {content_type} {content_id} as featured")
            else:
                results['failed'].append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'title': content.get('title', 'Unknown'),
                    'company': content.get('company', 'N/A'),
                    'reason': 'Update failed'
                })

        total_successful = len(results['successful'])
        total_failed = len(results['failed'])

        message = f"Reactivated {total_successful} items successfully as featured"
        if total_failed > 0:
            message += f", {total_failed} items failed (update expiration dates first)"

        return jsonify({
            'success': total_failed == 0 or total_successful > 0,
            'message': message,
            'results': results
        })

    except Exception as e:
        logger.error(f"Error in bulk reactivate: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to reactivate items'}), 500


@app.route('/api/admin/expired-content/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_expired_content():
    """Bulk delete expired content permanently"""
    try:
        data = request.get_json()
        items = data.get('items', [])

        if not items:
            return jsonify({'success': False, 'message': 'No items selected for deletion'}), 400

        deleted_count = 0
        failed_items = []

        for item in items:
            content_type = item.get('content_type')
            content_id = item.get('content_id')

            if not content_type or not content_id:
                failed_items.append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'reason': 'Missing content type or ID'
                })
                continue

            try:
                # Delete the content permanently
                response = supabase_admin.table(content_type).delete().eq('id', content_id).execute()
                if response.data:
                    deleted_count += 1
                    logger.info(f"✅ Deleted expired {content_type} {content_id}")
                else:
                    failed_items.append({
                        'content_type': content_type,
                        'content_id': content_id,
                        'reason': 'Delete failed'
                    })
            except Exception as e:
                failed_items.append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'reason': str(e)
                })

        message = f"Permanently deleted {deleted_count} expired items"
        if failed_items:
            message += f", {len(failed_items)} items failed to delete"

        return jsonify({
            'success': len(failed_items) == 0,
            'message': message,
            'deleted_count': deleted_count,
            'failed_items': failed_items
        })

    except Exception as e:
        logger.error(f"Error in bulk delete expired content: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete items'}), 500

# ===== USER MANAGEMENT ROUTES =====
@app.route('/api/admin/users/<string:id>', methods=['DELETE'])
@admin_required
def delete_admin_user(id):
    try:
        # Check if user exists
        existing = supabase_admin.table('users').select('*').eq('id', id).execute()

        if not existing.data:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        # Soft delete - mark as deleted and deactivate
        update_data = {
            'is_deleted': True,
            'is_active': False,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table('users').update(update_data).eq('id', id).execute()

        if response.data:
            logger.info(f"✅ User {id} moved to trash")
            return jsonify({
                'success': True,
                'message': 'User moved to trash',
                'moved_to_trash': True
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to delete user'}), 500

    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete user'}), 500


@app.route('/api/admin/users/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_users():
    try:
        data = request.get_json()
        ids = data.get('ids', [])

        if not ids:
            return jsonify({'success': False, 'message': 'No users selected'}), 400

        # Soft delete users
        update_data = {
            'is_deleted': True,
            'is_active': False,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table('users').update(update_data).in_('id', ids).execute()
        deleted_count = len(response.data) if response.data else 0

        logger.info(f"✅ Bulk soft deleted {deleted_count} users")

        return jsonify({
            'success': True,
            'message': f'{deleted_count} user(s) moved to trash',
            'deleted_count': deleted_count,
            'moved_to_trash': True
        })

    except Exception as e:
        logger.error(f"Error bulk deleting users: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to delete users'}), 500

# ===== ADMIN MANAGEMENT ROUTES =====

@app.route('/api/admin/admins/list', methods=['GET'])
@admin_required
def get_admins_list():
    """Get list of all admin users"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        search = request.args.get('search', '').strip()
        status_filter = request.args.get('status', '')

        logger.info(f"📋 Fetching admins - page: {page}, search: '{search}', status: '{status_filter}'")

        # Build query - include all fields
        query = supabase_admin.table('admins').select('*').eq('is_deleted', False)

        # Apply status filter
        if status_filter == 'active':
            query = query.eq('is_active', True)
        elif status_filter == 'inactive':
            query = query.eq('is_active', False)

        # Apply search filter
        if search:
            query = query.or_(f"username.ilike.%{search}%,email.ilike.%{search}%,full_name.ilike.%{search}%")

        # Get total count
        count_response = query.execute()
        total_count = len(count_response.data) if count_response.data else 0

        # Apply pagination and ordering
        start = (page - 1) * per_page
        end = start + per_page - 1
        data_response = query.range(start, end).order('created_at', desc=True).execute()

        # Format response - ensure is_superadmin is included
        admins = []
        for admin in (data_response.data or []):
            admins.append({
                'id': admin.get('id'),
                'username': admin.get('username'),
                'email': admin.get('email'),
                'full_name': admin.get('full_name', admin.get('username')),
                'is_superadmin': admin.get('is_superadmin', False),  # CRITICAL: Include this
                'is_active': admin.get('is_active', True),
                'is_deleted': admin.get('is_deleted', False),
                'created_at': admin.get('created_at'),
                'last_login': admin.get('last_login'),
                'updated_at': admin.get('updated_at')
            })

        logger.info(f"✅ Found {total_count} admins, returning {len(admins)}")
        logger.info(f"Admin data sample: {admins[0] if admins else 'None'}")

        return jsonify({
            'success': True,
            'data': admins,
            'count': total_count,
            'page': page,
            'per_page': per_page
        })

    except Exception as e:
        logger.error(f"❌ Error fetching admins: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to fetch admins'}), 500


@app.route('/api/admin/admins/<string:id>', methods=['GET'])
@admin_required
def get_admin_details(id):
    """Get single admin details"""
    try:
        # Get admin by ID
        response = supabase_admin.table('admins').select('*').eq('id', id).eq('is_deleted', False).execute()

        if not response.data:
            return jsonify({'success': False, 'message': 'Admin not found'}), 404

        admin = response.data[0]

        return jsonify({
            'success': True,
            'admin': {
                'id': admin.get('id'),
                'username': admin.get('username'),
                'email': admin.get('email'),
                'full_name': admin.get('full_name', admin.get('username')),
                'is_superadmin': admin.get('is_superadmin', False),
                'is_active': admin.get('is_active', True),
                'created_at': admin.get('created_at'),
                'last_login': admin.get('last_login')
            }
        })

    except Exception as e:
        logger.error(f"❌ Error fetching admin details: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to fetch admin details'}), 500


@app.route('/api/admin/admins', methods=['POST'])
@admin_required
def create_new_admin():
    """Create a new admin user"""
    try:
        data = request.get_json()

        # Log the received data for debugging
        logger.info(f"📝 Create admin request received: {data}")

        # Validate required fields
        full_name = data.get('full_name', '').strip()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        is_superadmin = data.get('is_superadmin', False)

        # Check if current user is superadmin to create superadmin
        current_is_superadmin = session.get('is_superadmin', False)
        if is_superadmin and not current_is_superadmin:
            return jsonify({'success': False, 'message': 'Only super admins can create super admin accounts'}), 403

        if not full_name or not username or not email or not password:
            return jsonify({'success': False, 'message': 'Full name, username, email, and password are required'}), 400

        # Validate email format
        if '@' not in email:
            return jsonify({'success': False, 'message': 'Invalid email format'}), 400

        # Validate username format
        import re
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify(
                {'success': False, 'message': 'Username can only contain letters, numbers, and underscore'}), 400

        # Validate password strength
        if len(password) < 8:
            return jsonify({'success': False, 'message': 'Password must be at least 8 characters'}), 400

        # Check if email already exists
        existing_email = supabase_admin.table('admins').select('id').eq('email', email).execute()
        if existing_email.data:
            return jsonify({'success': False, 'message': 'Email already exists'}), 400

        # Check if username already exists
        existing_username = supabase_admin.table('admins').select('id').eq('username', username).execute()
        if existing_username.data:
            return jsonify({'success': False, 'message': 'Username already exists'}), 400

        # Create admin
        now_iso = get_current_utc_time().isoformat()
        admin_data = {
            'full_name': full_name,
            'username': username,
            'email': email,
            'password_hash': hash_password(password),
            'is_superadmin': is_superadmin,
            'is_active': True,
            'is_deleted': False,
            'created_at': now_iso,
            'updated_at': now_iso
        }

        logger.info(f"📝 Inserting admin: {admin_data}")

        response = supabase_admin.table('admins').insert(admin_data).execute()

        if response.data:
            logger.info(f"✅ New admin created: {username} ({email}) - Superadmin: {is_superadmin}")
            return jsonify({
                'success': True,
                'message': 'Admin created successfully',
                'admin': {
                    'id': response.data[0]['id'],
                    'full_name': full_name,
                    'username': username,
                    'email': email,
                    'is_superadmin': is_superadmin,
                    'created_at': now_iso
                }
            })
        else:
            logger.error(f"❌ No data returned from insert: {response}")
            return jsonify({'success': False, 'message': 'Failed to create admin'}), 500

    except Exception as e:
        logger.error(f"❌ Error creating admin: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': f'Error: {str(e)}'}), 500


@app.route('/api/admin/admins/<string:id>/status', methods=['PUT'])
@admin_required
def update_admin_status(id):
    """Update admin status (activate/deactivate)"""
    try:
        data = request.get_json()
        is_active = data.get('is_active')

        if is_active is None:
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        # Check if trying to deactivate self
        current_admin_id = session.get('admin_id')
        if str(current_admin_id) == str(id) and not is_active:
            return jsonify({'success': False, 'message': 'You cannot deactivate your own account'}), 400

        # Update status
        update_data = {
            'is_active': bool(is_active),
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table('admins').update(update_data).eq('id', id).execute()

        if not response.data:
            return jsonify({'success': False, 'message': 'Admin not found'}), 404

        logger.info(f"✅ Admin {id} status updated to: {is_active}")

        return jsonify({
            'success': True,
            'message': f'Admin {"activated" if is_active else "deactivated"} successfully'
        })

    except Exception as e:
        logger.error(f"❌ Error updating admin status: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to update status'}), 500


@app.route('/api/admin/admins/<string:id>', methods=['PUT'])
@admin_required
def update_admin(id):
    """Update admin details - with permission checks"""
    try:
        data = request.get_json()

        # Check if trying to update self
        current_admin_id = session.get('admin_id')
        is_current_user = str(current_admin_id) == str(id)
        current_is_superadmin = session.get('is_superadmin', False)

        # If not superadmin and not updating self, deny
        if not current_is_superadmin and not is_current_user:
            return jsonify({'success': False, 'message': 'You can only update your own profile'}), 403

        # Build update data (only allowed fields)
        update_data = {
            'full_name': data.get('full_name'),
            'username': data.get('username'),
            'email': data.get('email'),
            'updated_at': get_current_utc_time().isoformat()
        }

        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}

        # Only superadmin can change these fields
        if current_is_superadmin:
            if 'is_superadmin' in data:
                update_data['is_superadmin'] = data.get('is_superadmin')
            if 'is_active' in data:
                update_data['is_active'] = data.get('is_active')

        # Update password if provided
        if data.get('password'):
            update_data['password_hash'] = hash_password(data.get('password'))

        # Check if username already exists (for other users)
        if 'username' in update_data:
            existing = supabase_admin.table('admins').select('id').eq('username', update_data['username']).execute()
            if existing.data and existing.data[0]['id'] != id:
                return jsonify({'success': False, 'message': 'Username already exists'}), 400

        # Check if email already exists
        if 'email' in update_data:
            existing = supabase_admin.table('admins').select('id').eq('email', update_data['email']).execute()
            if existing.data and existing.data[0]['id'] != id:
                return jsonify({'success': False, 'message': 'Email already exists'}), 400

        # Update in database
        response = supabase_admin.table('admins').update(update_data).eq('id', id).execute()

        if not response.data:
            return jsonify({'success': False, 'message': 'Admin not found'}), 404

        logger.info(f"✅ Admin {id} updated successfully")

        # If updating self, update session
        if is_current_user and 'full_name' in update_data:
            session['admin_full_name'] = update_data['full_name']
        if is_current_user and 'username' in update_data:
            session['admin_username'] = update_data['username']

        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'admin': response.data[0]
        })

    except Exception as e:
        logger.error(f"❌ Error updating admin: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to update profile'}), 500


@app.route('/api/admin/admins/bulk-status', methods=['POST'])
@admin_required
def bulk_update_admin_status():
    """Bulk update admin status"""
    try:
        data = request.get_json()
        ids = data.get('ids', [])
        is_active = data.get('is_active')

        if not ids:
            return jsonify({'success': False, 'message': 'No admins selected'}), 400

        if is_active is None:
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        # Remove current admin from list if trying to deactivate self
        current_admin_id = session.get('admin_id')
        if not is_active and current_admin_id in ids:
            ids.remove(current_admin_id)
            if not ids:
                return jsonify({'success': False, 'message': 'Cannot deactivate your own account'}), 400

        # Update status
        update_data = {
            'is_active': bool(is_active),
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table('admins').update(update_data).in_('id', ids).execute()
        updated_count = len(response.data) if response.data else 0

        logger.info(f"✅ Bulk updated {updated_count} admins status to: {is_active}")

        return jsonify({
            'success': True,
            'message': f'{updated_count} admin(s) {"activated" if is_active else "deactivated"} successfully',
            'updated_count': updated_count
        })

    except Exception as e:
        logger.error(f"❌ Error bulk updating admin status: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to update admins'}), 500


@app.route('/api/admin/admins/<string:id>', methods=['DELETE'])
@admin_required
def delete_admin(id):
    try:
        # Check if trying to delete self
        current_admin_id = session.get('admin_id')
        if str(current_admin_id) == str(id):
            return jsonify({'success': False, 'message': 'You cannot delete your own account'}), 400

        # Check if admin exists
        existing = supabase_admin.table('admins').select('*').eq('id', id).execute()
        if not existing.data:
            return jsonify({'success': False, 'message': 'Admin not found'}), 404

        # Soft delete - move to trash
        update_data = {
            'is_deleted': True,
            'is_active': False,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table('admins').update(update_data).eq('id', id).execute()

        if response.data:
            logger.info(f"✅ Admin {id} moved to trash")
            return jsonify({
                'success': True,
                'message': 'Admin moved to trash',
                'moved_to_trash': True
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to delete admin'}), 500

    except Exception as e:
        logger.error(f"Error deleting admin: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to delete admin'}), 500


@app.route('/api/admin/admins/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_admins():
    """Bulk delete admins (soft delete - move to trash)"""
    try:
        data = request.get_json()
        ids = data.get('ids', [])

        if not ids:
            return jsonify({'success': False, 'message': 'No admins selected'}), 400

        # Remove current admin from list
        current_admin_id = session.get('admin_id')
        if current_admin_id in ids:
            ids.remove(current_admin_id)
            if not ids:
                return jsonify({'success': False, 'message': 'Cannot delete your own account'}), 400

        # Soft delete - move to trash
        update_data = {
            'is_deleted': True,
            'is_active': False,
            'deleted_at': get_current_utc_time().isoformat(),
            'updated_at': get_current_utc_time().isoformat()
        }

        response = supabase_admin.table('admins').update(update_data).in_('id', ids).execute()
        deleted_count = len(response.data) if response.data else 0

        logger.info(f"✅ Bulk moved {deleted_count} admins to trash")

        return jsonify({
            'success': True,
            'message': f'{deleted_count} admin(s) moved to trash',
            'deleted_count': deleted_count,
            'moved_to_trash': True
        })

    except Exception as e:
        logger.error(f"Error bulk deleting admins: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'message': 'Failed to delete admins'}), 500

# ===== TRASH MANAGEMENT ROUTES =====

@app.route('/api/admin/trash/stats')
@admin_required
def trash_stats():
    """Get statistics of items in trash - EXCLUDE HIDDEN ITEMS"""
    try:
        stats = {
            'courses': 0,
            'jobs': 0,
            'internships': 0,
            'blog_posts': 0,
            'testimonials': 0,
            'users': 0,
            'messages': 0,
            'newsletter': 0,
            'admins': 0,  # Added admins
            'total': 0
        }

        # Get count of soft-deleted items that are NOT hidden from trash
        try:
            courses = supabase_admin.table('courses') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['courses'] = courses.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted courses: {str(e)}")

        try:
            jobs = supabase_admin.table('jobs') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['jobs'] = jobs.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted jobs: {str(e)}")

        try:
            internships = supabase_admin.table('internships') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['internships'] = internships.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted internships: {str(e)}")

        try:
            blog_posts = supabase_admin.table('blog_posts') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['blog_posts'] = blog_posts.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted blog posts: {str(e)}")

        try:
            testimonials = supabase_admin.table('testimonials') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['testimonials'] = testimonials.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted testimonials: {str(e)}")

        # Add users count
        try:
            users = supabase_admin.table('users') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['users'] = users.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted users: {str(e)}")

        # Add messages count
        try:
            messages = supabase_admin.table('contact_messages') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['messages'] = messages.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted messages: {str(e)}")

        # Add newsletter subscribers count
        try:
            newsletter = supabase_admin.table('newsletter_subscribers') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['newsletter'] = newsletter.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted newsletter subscribers: {str(e)}")

        # Add admins count
        try:
            admins = supabase_admin.table('admins') \
                .select('id', count='exact') \
                .eq('is_deleted', True) \
                .eq('hidden_from_trash', False) \
                .execute()
            stats['admins'] = admins.count or 0
        except Exception as e:
            logger.warning(f"Error counting deleted admins: {str(e)}")

        stats['total'] = (stats['courses'] + stats['jobs'] + stats['internships'] +
                          stats['blog_posts'] + stats['testimonials'] + stats['users'] +
                          stats['messages'] + stats['newsletter'] + stats['admins'])

        return jsonify({
            'success': True,
            'stats': stats
        })

    except Exception as e:
        logger.error(f"Error getting trash stats: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/trash')
@admin_required
def get_trash_items():
    """Get all items in trash with pagination - EXCLUDE HIDDEN ITEMS"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')
        content_type = request.args.get('type', '')

        all_trash_items = []

        # Get trash items from each table - INCLUDING admins
        tables = [
            ('courses', 'course', ['title', 'company']),
            ('jobs', 'job', ['title', 'company']),
            ('internships', 'internship', ['title', 'company']),
            ('blog_posts', 'blog', ['title', 'author']),
            ('testimonials', 'testimonial', ['content', 'username']),
            ('users', 'user', ['username', 'email']),
            ('contact_messages', 'message', ['subject', 'email', 'name']),
            ('newsletter_subscribers', 'newsletter', ['email']),
            ('admins', 'admin', ['username', 'email', 'full_name'])
        ]

        for table, type_name, search_fields in tables:
            # Skip if type filter is specified and doesn't match
            if content_type != 'all' and content_type != '':
                # Map content_type to type_name
                if content_type == 'users' and type_name != 'user':
                    continue
                if content_type == 'messages' and type_name != 'message':
                    continue
                if content_type == 'newsletter' and type_name != 'newsletter':
                    continue
                if content_type == 'admins' and type_name != 'admin':
                    continue
                if content_type == 'courses' and type_name != 'course':
                    continue
                if content_type == 'jobs' and type_name != 'job':
                    continue
                if content_type == 'internships' and type_name != 'internship':
                    continue
                if content_type == 'blog' and type_name != 'blog':
                    continue
                if content_type == 'testimonials' and type_name != 'testimonial':
                    continue

            try:
                # Only get items that are deleted AND NOT hidden from trash
                query = supabase_admin.table(table) \
                    .select('*') \
                    .eq('is_deleted', True) \
                    .eq('hidden_from_trash', False)

                if search:
                    if table == 'newsletter_subscribers':
                        query = query.ilike('email', f'%{search}%')
                    elif table == 'contact_messages':
                        query = query.or_(f"subject.ilike.%{search}%,email.ilike.%{search}%,name.ilike.%{search}%")
                    elif table == 'users':
                        query = query.or_(f"username.ilike.%{search}%,email.ilike.%{search}%")
                    elif table == 'admins':
                        query = query.or_(
                            f"username.ilike.%{search}%,email.ilike.%{search}%,full_name.ilike.%{search}%")
                    elif table == 'testimonials':
                        query = query.or_(f"content.ilike.%{search}%,username.ilike.%{search}%")
                    elif table == 'blog_posts':
                        query = query.or_(f"title.ilike.%{search}%,author.ilike.%{search}%")
                    else:
                        query = query.or_(f"title.ilike.%{search}%,company.ilike.%{search}%")

                items = query.order('deleted_at', desc=True).execute().data or []

                for item in items:
                    # Handle different field names for each table
                    if table == 'newsletter_subscribers':
                        title = item.get('email', 'Unknown')
                        subtitle = item.get('email', 'Unknown')
                    elif table == 'contact_messages':
                        title = item.get('subject', 'No Subject')
                        subtitle = item.get('email', 'Unknown')
                    elif table == 'users':
                        title = item.get('username', 'Unknown')
                        subtitle = item.get('email', 'Unknown')
                    elif table == 'admins':
                        title = item.get('full_name') or item.get('username', 'Unknown')
                        subtitle = item.get('email', 'Unknown')
                    elif table == 'testimonials':
                        title = item.get('username', 'Anonymous')[:50]
                        subtitle = item.get('content', '')[:50]
                    else:
                        title = item.get('title', 'Untitled')[:100]
                        subtitle = item.get('company') or item.get('author') or item.get('username', 'Unknown')

                    all_trash_items.append({
                        'id': item['id'],
                        'content_type': type_name,
                        'table_name': table,
                        'title': title,
                        'subtitle': subtitle,
                        'deleted_at': item.get('deleted_at'),
                        'created_at': item.get('created_at'),
                        'data': item
                    })
            except Exception as e:
                logger.warning(f"Error fetching {table} trash: {str(e)}")

        # Sort by deletion date (newest first)
        all_trash_items.sort(key=lambda x: x['deleted_at'] or '', reverse=True)

        # Pagination
        total_count = len(all_trash_items)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_items = all_trash_items[start_idx:end_idx]

        return jsonify({
            'success': True,
            'data': paginated_items,
            'count': total_count,
            'per_page': per_page,
            'page': page
        })

    except Exception as e:
        logger.error(f"Error getting trash items: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/trash/restore/<string:content_type>/<string:content_id>', methods=['POST'])
@admin_required
def restore_trash_item(content_type, content_id):
    """Restore a single item from trash - keep current is_active state"""
    try:
        # Map content_type to table name
        table_map = {
            'course': 'courses',
            'job': 'jobs',
            'internship': 'internships',
            'blog': 'blog_posts',
            'testimonial': 'testimonials',
            'user': 'users',
            'message': 'contact_messages',
            'newsletter': 'newsletter_subscribers',
            'admin': 'admins'
        }

        if content_type not in table_map:
            return jsonify({'success': False, 'error': f'Invalid content type: {content_type}'}), 400

        table_name = table_map[content_type]

        # Check if item exists and is deleted
        item = supabase_admin.table(table_name).select('*').eq('id', content_id).eq('is_deleted', True).execute()

        if not item.data:
            return jsonify({'success': False, 'error': 'Item not found in trash'}), 404

        current_item = item.data[0]
        current_active = current_item.get('is_active', False)
        current_featured = current_item.get('is_featured', False)

        # Prepare restore data - KEEP current is_active and is_featured values
        update_data = {
            'is_deleted': False,
            'deleted_at': None,
            'updated_at': get_current_utc_time().isoformat()
            # DO NOT change is_active or is_featured - keep their current values
        }

        result = supabase_admin.table(table_name).update(update_data).eq('id', content_id).execute()

        if result.data:
            logger.info(f"✅ Restored {content_type} {content_id} from trash (is_active: {current_active}, is_featured: {current_featured})")
            return jsonify({
                'success': True,
                'message': f'{content_type.title()} restored from trash',
                'is_active': current_active,
                'is_featured': current_featured,
                'remains_inactive': not current_active
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to restore item'}), 500

    except Exception as e:
        logger.error(f"Error restoring trash item: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/trash/bulk-restore', methods=['POST'])
@admin_required
def bulk_restore_trash_items():
    """Bulk restore multiple items from trash"""
    try:
        data = request.get_json()
        items = data.get('items', [])

        if not items:
            return jsonify({'success': False, 'error': 'No items selected'}), 400

        # Map content_type to table name
        table_map = {
            'course': 'courses',
            'job': 'jobs',
            'internship': 'internships',
            'blog': 'blog_posts',
            'testimonial': 'testimonials',
            'user': 'users',
            'message': 'contact_messages',
            'newsletter': 'newsletter_subscribers',
            'admin': 'admins'
        }

        results = {
            'successful': [],
            'failed': []
        }

        for item in items:
            content_type = item.get('content_type')
            content_id = item.get('content_id')
            table_name = item.get('table_name') or table_map.get(content_type)

            if not content_type or not content_id or not table_name:
                results['failed'].append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'reason': 'Missing required data'
                })
                continue

            try:
                # Get current item state before restore
                current_item = supabase_admin.table(table_name).select('is_active, is_featured').eq('id',
                                                                                                    content_id).execute()

                if not current_item.data:
                    results['failed'].append({
                        'content_type': content_type,
                        'content_id': content_id,
                        'reason': 'Item not found'
                    })
                    continue

                # Restore the item (just set is_deleted to False, keep is_active as is)
                update_data = {
                    'is_deleted': False,
                    'deleted_at': None,
                    'updated_at': get_current_utc_time().isoformat()
                }

                result = supabase_admin.table(table_name).update(update_data).eq('id', content_id).execute()

                if result.data:
                    results['successful'].append({
                        'content_type': content_type,
                        'content_id': content_id,
                        'is_active': current_item.data[0].get('is_active', False)
                    })
                else:
                    results['failed'].append({
                        'content_type': content_type,
                        'content_id': content_id,
                        'reason': 'Update failed'
                    })

            except Exception as e:
                logger.error(f"Error restoring {content_type} {content_id}: {str(e)}")
                results['failed'].append({
                    'content_type': content_type,
                    'content_id': content_id,
                    'reason': str(e)
                })

        restored_count = len(results['successful'])
        failed_count = len(results['failed'])

        return jsonify({
            'success': True,
            'message': f'Restored {restored_count} items from trash',
            'restored_count': restored_count,
            'failed_count': failed_count,
            'results': results
        })

    except Exception as e:
        logger.error(f"Error bulk restoring trash items: {str(e)}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/admin/trash/empty', methods=['POST'])
@admin_required
def empty_trash():
    """Permanently delete all items in trash"""
    try:
        data = request.get_json()
        content_type = data.get('type', 'all')  # 'all' or specific type

        deleted_counts = {}
        tables_to_empty = []

        if content_type == 'all':
            tables_to_empty = [
                ('courses', 'course'),
                ('jobs', 'job'),
                ('internships', 'internship'),
                ('blog_posts', 'blog'),
                ('testimonials', 'testimonial')
            ]
        else:
            table_map = {
                'courses': ('courses', 'course'),
                'jobs': ('jobs', 'job'),
                'internships': ('internships', 'internship'),
                'blog_posts': ('blog_posts', 'blog'),
                'testimonials': ('testimonials', 'testimonial')
            }
            if content_type in table_map:
                tables_to_empty.append(table_map[content_type])

        for table_name, type_name in tables_to_empty:
            try:
                # Delete all items marked as deleted
                result = supabase_admin.table(table_name).delete().eq('is_deleted', True).execute()
                deleted_counts[type_name] = len(result.data) if result.data else 0
            except Exception as e:
                logger.warning(f"Error emptying {table_name} trash: {str(e)}")
                deleted_counts[type_name] = 0

        total_deleted = sum(deleted_counts.values())

        return jsonify({
            'success': True,
            'message': f'Permanently deleted {total_deleted} items from trash',
            'deleted_counts': deleted_counts
        })

    except Exception as e:
        logger.error(f"Error emptying trash: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/trash/clear-old', methods=['POST'])
@admin_required
def clear_old_trash_items():
    """Permanently delete trash items older than specified days"""
    try:
        data = request.get_json()
        days = data.get('days', 30)  # Default: delete items older than 30 days

        cutoff_date = (get_current_utc_time() - timedelta(days=days)).isoformat()

        tables = ['courses', 'jobs', 'internships', 'blog_posts', 'testimonials']
        deleted_counts = {}

        for table_name in tables:
            try:
                result = supabase_admin.table(table_name).delete().eq('is_deleted', True).lt('deleted_at',
                                                                                             cutoff_date).execute()
                deleted_counts[table_name] = len(result.data) if result.data else 0
            except Exception as e:
                logger.warning(f"Error clearing old {table_name} trash: {str(e)}")
                deleted_counts[table_name] = 0

        total_deleted = sum(deleted_counts.values())

        return jsonify({
            'success': True,
            'message': f'Permanently deleted {total_deleted} items older than {days} days',
            'deleted_counts': deleted_counts
        })

    except Exception as e:
        logger.error(f"Error clearing old trash: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/admin/trash/hide-permanently', methods=['POST'])
@admin_required
def hide_trash_items_permanently():
    """Hide items from trash permanently (mark as hidden)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400

        items = data.get('items', [])

        if not items:
            return jsonify({'success': False, 'error': 'No items provided'}), 400

        results = {
            'successful': [],
            'failed': []
        }

        for item in items:
            content_type = item.get('content_type')
            content_id = item.get('content_id')
            table_name = item.get('table_name')

            if not content_type or not content_id or not table_name:
                results['failed'].append({
                    'content_id': content_id,
                    'reason': 'Missing required data'
                })
                continue

            try:
                # Mark as hidden from trash (but keep in database)
                update_data = {
                    'hidden_from_trash': True,
                    'updated_at': get_current_utc_time().isoformat()
                }

                result = supabase_admin.table(table_name).update(update_data).eq('id', content_id).execute()

                if result.data:
                    results['successful'].append({
                        'content_type': content_type,
                        'content_id': content_id
                    })
                    logger.info(f"✅ Item {content_id} hidden from trash")
                else:
                    results['failed'].append({
                        'content_id': content_id,
                        'reason': 'Update failed - no data returned'
                    })
            except Exception as e:
                logger.error(f"Error hiding item {content_id}: {str(e)}")
                results['failed'].append({
                    'content_id': content_id,
                    'reason': str(e)
                })

        return jsonify({
            'success': len(results['failed']) == 0 or len(results['successful']) > 0,
            'message': f"Hidden {len(results['successful'])} items from trash",
            'results': results
        })

    except Exception as e:
        logger.error(f"Error hiding trash items: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ===== VISITOR TRACKING FUNCTIONS =====

def get_visitor_fingerprint():
    """Create a unique fingerprint for each visitor"""
    try:
        # Get IP address (handles proxies)
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip:
            ip = ip.split(',')[0].strip()

        # Get user agent
        user_agent = request.headers.get('User-Agent', '')

        # Create fingerprint using IP + User Agent
        fingerprint = f"{ip}|{user_agent}"
        visitor_id = hashlib.sha256(fingerprint.encode()).hexdigest()[:32]

        return visitor_id
    except Exception as e:
        logger.error(f"Error creating visitor fingerprint: {str(e)}")
        return None


def parse_user_agent_details(user_agent_string):
    """Parse user agent for device details"""
    try:
        ua = user_agents.parse(user_agent_string)

        # Determine device type
        device_type = 'desktop'
        if ua.is_mobile:
            device_type = 'mobile'
        elif ua.is_tablet:
            device_type = 'tablet'
        elif ua.is_bot or ua.is_touch_capable is False:
            device_type = 'bot'

        return {
            'device_type': device_type,
            'browser': ua.browser.family if ua.browser else 'Unknown',
            'browser_version': ua.browser.version_string if ua.browser else '',
            'os': ua.os.family if ua.os else 'Unknown',
            'os_version': ua.os.version_string if ua.os else '',
            'is_bot': ua.is_bot
        }
    except Exception as e:
        logger.warning(f"Error parsing user agent: {str(e)}")
        return {
            'device_type': 'unknown',
            'browser': 'Unknown',
            'os': 'Unknown',
            'is_bot': False
        }


def get_geo_location(ip):
    """Get location from IP using free API (optional)"""
    # Skip for localhost
    if ip in ['127.0.0.1', 'localhost', '::1']:
        return {'country': 'Local', 'city': 'Local'}

    try:
        # Using ip-api.com (free, no API key needed)
        response = requests.get(f'http://ip-api.com/json/{ip}', timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                return {
                    'country': data.get('country', 'Unknown'),
                    'city': data.get('city', 'Unknown'),
                    'region': data.get('regionName', 'Unknown'),
                    'lat': data.get('lat'),
                    'lon': data.get('lon')
                }
    except Exception as e:
        logger.warning(f"Error getting geolocation: {str(e)}")

    return {'country': 'Unknown', 'city': 'Unknown'}


def is_bot(user_agent):
    """Check if visitor is a bot"""
    bot_keywords = ['bot', 'crawler', 'spider', 'scraper', 'headless',
                    'selenium', 'puppeteer', 'googlebot', 'bingbot',
                    'yandex', 'baidu', 'facebookexternalhit']
    user_agent_lower = user_agent.lower()
    return any(keyword in user_agent_lower for keyword in bot_keywords)


def track_visitor(page_url, page_title):
    """Main tracking function - called on every page view"""
    try:
        # Skip tracking for static files and API
        skip_extensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp']
        if any(page_url.endswith(ext) for ext in skip_extensions):
            return

        # Get visitor ID
        visitor_id = get_visitor_fingerprint()
        if not visitor_id:
            return

        # Get request details
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip:
            ip = ip.split(',')[0].strip()

        user_agent_string = request.headers.get('User-Agent', '')
        referrer = request.headers.get('Referer', '')
        session_id = request.cookies.get('session_id') or visitor_id

        # Parse user agent
        ua_info = parse_user_agent_details(user_agent_string)

        # Skip bots
        if ua_info['is_bot'] or is_bot(user_agent_string):
            return

        # Get location
        location = get_geo_location(ip)

        current_time = get_current_utc_time()
        today_date = current_time.date()

        # Use admin client to bypass RLS
        supabase_track = supabase_admin

        # Check if visitor exists
        existing_visitor = supabase_track.table('visitors') \
            .select('*') \
            .eq('visitor_id', visitor_id) \
            .execute()

        is_new_visitor_today = True

        if existing_visitor.data:
            # Update existing visitor
            visitor = existing_visitor.data[0]
            supabase_track.table('visitors') \
                .update({
                'last_visit': current_time.isoformat(),
                'visit_count': visitor['visit_count'] + 1,
                'user_agent': user_agent_string,
                'referrer': referrer
            }) \
                .eq('visitor_id', visitor_id) \
                .execute()

            # Check if visitor has visited today
            last_visit_date = visitor['last_visit']
            if isinstance(last_visit_date, str):
                last_visit_date = datetime.fromisoformat(last_visit_date.replace('Z', '+00:00')).date()
            else:
                last_visit_date = last_visit_date.date() if hasattr(last_visit_date, 'date') else last_visit_date

            is_new_visitor_today = last_visit_date != today_date
        else:
            # Create new visitor
            supabase_track.table('visitors').insert({
                'visitor_id': visitor_id,
                'ip_address': ip,
                'user_agent': user_agent_string,
                'referrer': referrer,
                'first_visit': current_time.isoformat(),
                'last_visit': current_time.isoformat(),
                'visit_count': 1,
                'device_type': ua_info['device_type'],
                'browser': ua_info['browser'],
                'os': ua_info['os'],
                'country': location.get('country'),
                'city': location.get('city')
            }).execute()

        # Track page view
        supabase_track.table('page_views').insert({
            'visitor_id': visitor_id,
            'page_url': page_url[:500],  # Limit URL length
            'page_title': page_title[:200] if page_title else None,
            'referrer': referrer[:500] if referrer else None,
            'session_id': session_id[:100]
        }).execute()

        # Update daily analytics
        update_daily_analytics(today_date, page_url, visitor_id, is_new_visitor_today, ua_info['device_type'])

    except Exception as e:
        logger.error(f"Error tracking visitor: {str(e)}", exc_info=True)


def update_daily_analytics(today_date, page_url, visitor_id, is_new_visitor, device_type):
    """Update aggregated daily analytics"""
    try:
        date_str = today_date.isoformat()
        supabase_track = supabase_admin

        # Get existing daily stats
        existing = supabase_track.table('daily_analytics') \
            .select('*') \
            .eq('date', date_str) \
            .execute()

        if existing.data:
            stats = existing.data[0]
            page_views = stats.get('page_views', {}) or {}
            devices = stats.get('devices', {}) or {}

            # Update page views
            page_views[page_url] = page_views.get(page_url, 0) + 1

            # Update device stats
            devices[device_type] = devices.get(device_type, 0) + 1

            # Prepare update data
            update_data = {
                'total_views': stats['total_views'] + 1,
                'page_views': page_views,
                'devices': devices
            }

            # Update unique visitors if this is a new visitor today
            if is_new_visitor:
                update_data['unique_visitors'] = stats['unique_visitors'] + 1

            supabase_track.table('daily_analytics') \
                .update(update_data) \
                .eq('date', date_str) \
                .execute()
        else:
            # Create new daily stats
            supabase_track.table('daily_analytics').insert({
                'date': date_str,
                'unique_visitors': 1,
                'total_views': 1,
                'page_views': {page_url: 1},
                'devices': {device_type: 1}
            }).execute()

    except Exception as e:
        logger.error(f"Error updating daily analytics: {str(e)}")


# ===== TRACKING MIDDLEWARE =====

@app.before_request
def track_page_views_simple():
    """Simple tracking middleware that won't break the site"""
    # Skip tracking for admin routes, static files, and API
    skip_paths = ['/static/', '/favicon.ico', '/api/admin/']
    if any(request.path.startswith(path) for path in skip_paths):
        return

    # Skip if it's an API request
    if request.path.startswith('/api/'):
        return

    # Only track main pages (optional - can be disabled if causing issues)
    # For now, just log that tracking would happen
    pass


# ===== ANALYTICS API ENDPOINTS =====

@app.route('/api/admin/analytics/summary')
@admin_required
def get_analytics_summary():
    """Get analytics summary for dashboard"""
    try:
        # Get total unique visitors (all time)
        total_visitors = 0
        try:
            visitors_response = supabase_admin.table('visitors') \
                .select('id', count='exact') \
                .execute()
            total_visitors = visitors_response.count or 0
        except Exception as e:
            logger.warning(f"Could not get visitors count: {str(e)}")

        # Get total page views (all time)
        total_views = 0
        try:
            views_response = supabase_admin.table('page_views') \
                .select('id', count='exact') \
                .execute()
            total_views = views_response.count or 0
        except Exception as e:
            logger.warning(f"Could not get page views count: {str(e)}")

        # Get last 7 days stats
        weekly_visitors = 0
        weekly_views = 0
        try:
            week_ago = (get_current_utc_time() - timedelta(days=7)).date()
            weekly_stats = supabase_admin.table('daily_analytics') \
                .select('unique_visitors, total_views') \
                .gte('date', week_ago.isoformat()) \
                .execute()

            for stat in (weekly_stats.data or []):
                weekly_visitors += stat.get('unique_visitors', 0)
                weekly_views += stat.get('total_views', 0)
        except Exception as e:
            logger.warning(f"Could not get weekly stats: {str(e)}")

        # Get today's stats
        today_visitors = 0
        today_views = 0
        try:
            today = get_current_utc_time().date().isoformat()
            today_stats = supabase_admin.table('daily_analytics') \
                .select('unique_visitors, total_views') \
                .eq('date', today) \
                .execute()

            if today_stats.data:
                today_visitors = today_stats.data[0].get('unique_visitors', 0)
                today_views = today_stats.data[0].get('total_views', 0)
        except Exception as e:
            logger.warning(f"Could not get today's stats: {str(e)}")

        return jsonify({
            'success': True,
            'total_visitors': total_visitors,
            'total_views': total_views,
            'weekly_visitors': weekly_visitors,
            'weekly_views': weekly_views,
            'today_visitors': today_visitors,
            'today_views': today_views
        })

    except Exception as e:
        logger.error(f"Error getting analytics summary: {str(e)}", exc_info=True)
        return jsonify({
            'success': True,  # Return success even on error with zeros
            'total_visitors': 0,
            'total_views': 0,
            'weekly_visitors': 0,
            'weekly_views': 0,
            'today_visitors': 0,
            'today_views': 0
        })


@app.route('/api/admin/analytics/daily')
@admin_required
def get_daily_analytics():
    """Get daily analytics for charts"""
    try:
        days = request.args.get('days', 30, type=int)
        days = min(days, 365)  # Limit to 365 days max

        # Calculate date range
        end_date = get_current_utc_time().date()
        start_date = end_date - timedelta(days=days)

        # Get daily stats
        daily_data = []
        try:
            stats_response = supabase_admin.table('daily_analytics') \
                .select('date, unique_visitors, total_views') \
                .gte('date', start_date.isoformat()) \
                .lte('date', end_date.isoformat()) \
                .order('date', asc=True) \
                .execute()

            # Fill in missing dates with zeros
            stats_dict = {stat['date']: stat for stat in (stats_response.data or [])}

            current_date = start_date
            while current_date <= end_date:
                date_str = current_date.isoformat()
                if date_str in stats_dict:
                    daily_data.append({
                        'date': date_str,
                        'unique_visitors': stats_dict[date_str].get('unique_visitors', 0),
                        'total_views': stats_dict[date_str].get('total_views', 0)
                    })
                else:
                    daily_data.append({
                        'date': date_str,
                        'unique_visitors': 0,
                        'total_views': 0
                    })
                current_date += timedelta(days=1)

        except Exception as e:
            logger.warning(f"Could not get daily analytics: {str(e)}")
            # Generate sample data for demo if no data exists
            daily_data = generate_sample_daily_data(start_date, end_date)

        return jsonify({
            'success': True,
            'daily_data': daily_data,
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            }
        })

    except Exception as e:
        logger.error(f"Error getting daily analytics: {str(e)}", exc_info=True)
        # Return sample data on error
        end_date = get_current_utc_time().date()
        start_date = end_date - timedelta(days=30)
        return jsonify({
            'success': True,
            'daily_data': generate_sample_daily_data(start_date, end_date),
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            }
        })


def generate_sample_daily_data(start_date, end_date):
    """Generate sample daily data for demo when no real data exists"""
    daily_data = []
    current_date = start_date

    # Generate some realistic-looking sample data
    import random
    base_visitors = 50
    base_views = 150

    while current_date <= end_date:
        # Add some randomness and a slight upward trend
        day_offset = (current_date - start_date).days
        trend_factor = 1 + (day_offset / max(1, (end_date - start_date).days)) * 0.5

        daily_data.append({
            'date': current_date.isoformat(),
            'unique_visitors': int(base_visitors * trend_factor + random.randint(-20, 30)),
            'total_views': int(base_views * trend_factor + random.randint(-50, 80))
        })
        current_date += timedelta(days=1)

    return daily_data


@app.route('/api/admin/analytics/popular-pages')
@admin_required
def get_popular_pages():
    """Get most viewed pages"""
    try:
        days = request.args.get('days', 30, type=int)
        limit = request.args.get('limit', 20, type=int)
        limit = min(limit, 50)  # Limit to 50 max

        # Calculate date range
        start_date = (get_current_utc_time() - timedelta(days=days)).isoformat()

        # Get page views from last X days
        page_stats = {}
        try:
            views_response = supabase_admin.table('page_views') \
                .select('page_url, page_title') \
                .gte('created_at', start_date) \
                .execute()

            # Aggregate by page
            for view in (views_response.data or []):
                url = view.get('page_url', '/')
                title = view.get('page_title') or url

                # Clean up URL (remove query parameters for grouping)
                clean_url = url.split('?')[0]

                if clean_url not in page_stats:
                    page_stats[clean_url] = {
                        'url': clean_url,
                        'title': title,
                        'views': 0
                    }
                page_stats[clean_url]['views'] += 1

        except Exception as e:
            logger.warning(f"Could not get page views: {str(e)}")

        # Convert to list and sort
        pages_list = list(page_stats.values())
        pages_list.sort(key=lambda x: x['views'], reverse=True)

        # If no data, return sample data
        if not pages_list:
            pages_list = [
                {'url': '/', 'title': 'Homepage', 'views': 1250},
                {'url': '/courses', 'title': 'Courses', 'views': 890},
                {'url': '/jobs', 'title': 'Jobs', 'views': 756},
                {'url': '/internships', 'title': 'Internships', 'views': 543},
                {'url': '/blog', 'title': 'Blog', 'views': 432},
            ]

        return jsonify({
            'success': True,
            'pages': pages_list[:limit]
        })

    except Exception as e:
        logger.error(f"Error getting popular pages: {str(e)}", exc_info=True)
        return jsonify({
            'success': True,
            'pages': []
        })


@app.route('/api/admin/analytics/devices')
@admin_required
def get_device_analytics():
    """Get device and browser statistics"""
    try:
        days = request.args.get('days', 30, type=int)

        # Calculate date range
        start_date = (get_current_utc_time() - timedelta(days=days)).date()

        # Initialize device stats
        device_stats = {
            'desktop': 0,
            'mobile': 0,
            'tablet': 0
        }
        browser_stats = {}

        try:
            # Try to get from daily_analytics first
            stats_response = supabase_admin.table('daily_analytics') \
                .select('devices') \
                .gte('date', start_date.isoformat()) \
                .execute()

            for stat in (stats_response.data or []):
                devices = stat.get('devices', {})
                for device, count in devices.items():
                    if device in device_stats:
                        device_stats[device] += count
                    elif device == 'bot':
                        pass  # Skip bots
                    else:
                        device_stats['desktop'] += count  # Default to desktop

            # Get browser stats from visitors table
            visitors_response = supabase_admin.table('visitors') \
                .select('browser') \
                .gte('last_visit', start_date.isoformat()) \
                .execute()

            for visitor in (visitors_response.data or []):
                browser = visitor.get('browser', 'Unknown')
                if browser and browser != 'Unknown':
                    browser_stats[browser] = browser_stats.get(browser, 0) + 1

        except Exception as e:
            logger.warning(f"Could not get device stats: {str(e)}")
            # Return sample data
            device_stats = {'desktop': 1250, 'mobile': 890, 'tablet': 234}
            browser_stats = {'Chrome': 1200, 'Firefox': 450, 'Safari': 380, 'Edge': 200, 'Other': 144}

        # If no browser data, provide sample
        if not browser_stats:
            browser_stats = {'Chrome': 0, 'Firefox': 0, 'Safari': 0, 'Edge': 0}

        return jsonify({
            'success': True,
            'device_stats': device_stats,
            'browser_stats': browser_stats
        })

    except Exception as e:
        logger.error(f"Error getting device analytics: {str(e)}", exc_info=True)
        return jsonify({
            'success': True,
            'device_stats': {'desktop': 0, 'mobile': 0, 'tablet': 0},
            'browser_stats': {}
        })

# Terms and condition routes
@app.route('/privacy')
def privacy():
    return render_template('privacy.html')


@app.route('/terms')
def terms():
    return render_template('terms.html')


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

    if __name__ == "__main__":
        app.run()
