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
import re
import requests
from fuzzywuzzy import fuzz
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
import requests
from PIL import Image
import io
import base64
import re

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
        try:
            if not session.get('admin_logged_in'):
                return jsonify({
                    'success': False,
                    'message': 'Admin access required. Please login.',
                    'requires_login': True,
                    'redirect_url': '/admin/login'
                }), 401

            # Additional verification that admin still exists and is active
            admin_id = session.get('admin_id')
            if admin_id:
                admin = supabase_admin.table('admins') \
                    .select('id, is_active') \
                    .eq('id', admin_id) \
                    .maybe_single() \
                    .execute()

                if not admin.data or not admin.data.get('is_active', True):
                    session.clear()
                    return jsonify({
                        'success': False,
                        'message': 'Admin account no longer active',
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
                'created_at': get_current_time().isoformat()
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
    Enhanced content data with company logo - optimized version
    """
    try:
        if not content_data:
            return content_data

        # Extract and clean company name
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
    Optimized version of logo fetching with better caching
    """
    try:
        # First, check if we already have a logo for this company (fuzzy match)
        existing_logo = find_similar_company_logo(company_name)
        if existing_logo:
            return existing_logo

        # If no existing logo, fetch new one with optimized method
        logo_url = fetch_company_logo(company_name)
        if not logo_url:
            return None

        # Download and store the logo
        stored_logo_url = download_and_store_logo(logo_url, company_name, content_type, content_id)
        if not stored_logo_url:
            return None

        # Store logo reference in database
        try:
            logo_data = {
                'company_name': company_name.lower(),
                'original_logo_url': logo_url,
                'logo_url': stored_logo_url,
                'content_type': content_type,
                'content_id': content_id,
                'created_at': get_current_time().isoformat()
            }

            supabase.table('company_logos').insert(logo_data).execute()
            logger.info(f"✅ Logo stored in database for {company_name}")

            return stored_logo_url

        except Exception as e:
            logger.error(f"Error storing logo in database for {company_name}: {str(e)}")
            return stored_logo_url  # Still return the URL even if DB storage fails

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

# Routes
@app.route('/')
def index():
    try:
        logged_in = 'user_id' in session
        username = session.get('username') if logged_in else None

        # Fetch featured content from database
        courses = supabase.table('courses').select('*').eq('is_featured', True).eq('is_published', True).limit(4).execute().data or []
        jobs = supabase.table('jobs').select('*').eq('is_featured', True).eq('is_active', True).limit(4).execute().data or []
        internships = supabase.table('internships').select('*').eq('is_featured', True).eq('is_active', True).limit(4).execute().data or []
        blogs = supabase.table('blog_posts').select('*').eq('is_featured', True).eq('is_published', True).limit(3).execute().data or []

        # Enhance content with logos
        enhanced_courses = [enhance_content_with_logo(course, 'course', course.get('id')) for course in courses]
        enhanced_jobs = [enhance_content_with_logo(job, 'job', job.get('id')) for job in jobs]
        enhanced_internships = [enhance_content_with_logo(internship, 'internship', internship.get('id')) for internship in internships]

        # Fetch testimonials
        testimonials = supabase.table('blog_posts').select('id, title, author, description, image').eq('is_featured', True).eq('is_published', True).limit(3).execute().data or []

    except Exception as e:
        logger.error(f"Error loading index: {str(e)}")
        enhanced_courses, enhanced_jobs, enhanced_internships, blogs, testimonials = [], [], [], [], []

    return render_template('index.html',
                           courses=enhanced_courses,
                           jobs=enhanced_jobs,
                           internships=enhanced_internships,
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
        courses_data = query.order('created_at', desc=True).execute().data or []

        # Enhance courses with logos
        enhanced_courses = [enhance_content_with_logo(course, 'course', course.get('id')) for course in courses_data]

    except Exception as e:
        logger.error(f"Error loading courses: {str(e)}")
        enhanced_courses = []

    return render_template('courses.html',
                           courses=enhanced_courses,
                           search=search,
                           category=category,
                           course_categories=['Programming', 'Design', 'Business', 'Marketing'])


@app.route('/courses/<course_id>')
def course_detail(course_id):
    try:
        course = supabase.table('courses').select('*').eq('id', course_id).eq('is_published', True).eq('is_active', True).single().execute().data

        if not course:
            flash('Course not found', 'danger')
            return redirect(url_for('courses'))

        # Enhance course with logo
        enhanced_course = enhance_content_with_logo(course, 'course', course_id)

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
                               course=enhanced_course,
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
        jobs_data = query.order('created_at', desc=True).execute().data or []

        # Enhance jobs with logos
        enhanced_jobs = [enhance_content_with_logo(job, 'job', job.get('id')) for job in jobs_data]

    except Exception as e:
        logger.error(f"Error loading jobs: {str(e)}")
        enhanced_jobs = []

    return render_template('jobs.html',
                           jobs=enhanced_jobs,
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
        internships_data = query.order('created_at', desc=True).execute().data or []

        # Enhance internships with logos
        enhanced_internships = [enhance_content_with_logo(internship, 'internship', internship.get('id')) for internship
                                in internships_data]

    except Exception as e:
        logger.error(f"Error loading internships: {str(e)}")
        enhanced_internships = []

    return render_template('internships.html',
                           internships=enhanced_internships,
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
            item_response = supabase.table('internships').select('application_link').eq('id',
                                                                                        content_id).single().execute()

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

        # Save message to database USING ADMIN CLIENT (bypasses RLS)
        message_data = {
            'name': data['name'],
            'email': data['email'],
            'subject': data['subject'],
            'message': data['message'],
            'created_at': get_current_time().isoformat(),
            'updated_at': get_current_time().isoformat()
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
            'created_at': get_current_time().isoformat()
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
    # Check for logout message and display it only once
    message = request.args.get('message')
    if message == 'logout_success':
        flash('Logged out successfully', 'success')

    # Clear any logout flags
    session.pop('admin_logout_initiated', None)

    if request.method == 'GET':
        return render_template('admin/admin-login.html')

    # POST request handling
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')

    if not username or not password:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Both username and password are required'})
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
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'error': 'Invalid credentials'})
            flash('Invalid credentials', 'danger')
            return render_template('admin/admin-login.html')

        admin = response.data

        if not verify_password(admin['password_hash'], password):
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'error': 'Invalid credentials'})
            flash('Invalid credentials', 'danger')
            return render_template('admin/admin-login.html')

        session.update({
            'admin_id': str(admin['id']),
            'admin_username': admin['username'],
            'admin_email': admin.get('email', ''),
            'is_superadmin': bool(admin.get('is_superadmin', False)),
            'admin_logged_in': True
        })

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({
                'success': True,
                'message': 'Login successful!',
                'redirect': url_for('admin_dashboard')
            })

        return redirect(url_for('admin_dashboard'))

    except Exception as e:
        print(f"ADMIN LOGIN ERROR: {str(e)}")
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'An error occurred. Please try again.'})
        flash('An error occurred. Please try again.', 'danger')
        return render_template('admin/admin-login.html')


@app.route('/admin/logout')
def admin_logout():
    # Clear all admin session variables
    admin_vars = ['admin_id', 'admin_username', 'admin_email', 'is_superadmin', 'admin_logged_in']
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
        flash('Failed to load dashboard data. Please try again.', 'danger')
        return redirect(url_for('admin_login'))

# ===== ADMIN DATA FETCHING ROUTES =====

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
                    return jsonify({'success': False, 'message': f'{field.replace("_", " ")} is required'}), 400

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts'
        }
        table_name = table_map.get(resource, resource)

        # Add created_at timestamp
        data['created_at'] = get_current_time().isoformat()
        data['updated_at'] = get_current_time().isoformat()

        # Set default featured status for new items
        if resource in ['courses', 'jobs', 'internships', 'blog']:
            data['is_featured'] = data.get('is_featured', True)
            data['is_active'] = data.get('is_active', True)

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

        # If creation was successful and we have a company but no logo, try to fetch it asynchronously
        if resource in ['jobs', 'internships', 'courses'] and data.get('company') and not data.get('company_logo'):
            try:
                content_id = response.data[0]['id']
                # Run logo fetching in background
                from threading import Thread
                def fetch_logo_async():
                    try:
                        logo_url = get_or_fetch_logo(data['company'], resource, content_id)
                        if logo_url:
                            # Update the content with the fetched logo
                            supabase_admin.table(table_name).update({
                                'company_logo': logo_url,
                                'updated_at': get_current_time().isoformat()
                            }).eq('id', content_id).execute()
                            logger.info(f"Successfully added logo to {resource} {content_id}")
                    except Exception as e:
                        logger.error(f"Background logo fetch failed: {str(e)}")

                thread = Thread(target=fetch_logo_async)
                thread.start()
            except Exception as async_error:
                logger.error(f"Failed to start background logo fetch: {str(async_error)}")

        return jsonify({
            'success': True,
            'message': f'{resource[:-1]} created successfully',
            'data': response.data[0]
        })

    except Exception as e:
        logger.error(f"Error creating {resource}: {str(e)}", exc_info=True)
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

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts'
        }
        table_name = table_map.get(resource, resource)

        # Check if resource exists
        existing_response = supabase_admin.table(table_name).select('id, company, company_logo').eq('id', id).execute()
        if not existing_response.data:
            return jsonify({'success': False, 'message': f'{resource[:-1]} not found'}), 404

        existing_data = existing_response.data[0]

        # Add updated_at timestamp
        data['updated_at'] = get_current_time().isoformat()

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
                        logger.info(f"Auto-updated company logo for {new_company}")
                    elif new_company != current_company:
                        # Company changed but no logo found, clear existing logo
                        data['company_logo'] = None
                        logger.info(f"Cleared company logo for changed company: {new_company}")
                except Exception as logo_error:
                    logger.warning(f"Could not update company logo for {new_company}: {str(logo_error)}")
                    # Keep existing logo if fetching fails
                    if existing_data.get('company_logo') and new_company == current_company:
                        data['company_logo'] = existing_data['company_logo']

        # Update in database
        response = supabase_admin.table(table_name).update(data).eq('id', id).execute()

        if not response.data:
            return jsonify({'success': False, 'message': f'Failed to update {resource[:-1]}'}), 500

        # If update was successful and company changed but no logo was fetched, try background fetch
        if (resource in ['jobs', 'internships', 'courses'] and
                data.get('company') and
                data.get('company') != current_company and
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
                                'updated_at': get_current_time().isoformat()
                            }).eq('id', id).execute()
                            logger.info(f"Successfully updated logo for {resource} {id}")
                    except Exception as e:
                        logger.error(f"Background logo update failed: {str(e)}")

                thread = Thread(target=fetch_logo_async)
                thread.start()
            except Exception as async_error:
                logger.error(f"Failed to start background logo update: {str(async_error)}")

        return jsonify({
            'success': True,
            'message': f'{resource[:-1]} updated successfully',
            'data': response.data[0]
        })

    except Exception as e:
        logger.error(f"Error updating {resource}: {str(e)}", exc_info=True)
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
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users', 'newsletter']
        if resource not in valid_resources:
            return jsonify({'success': False, 'message': 'Invalid resource type'}), 400

        data = request.get_json()
        is_active = data.get('is_active')

        if is_active is None:
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts',
            'newsletter': 'newsletter_subscribers'
        }
        table_name = table_map.get(resource, resource)

        # Update status in database
        update_data = {'is_active': is_active, 'updated_at': get_current_time().isoformat()}

        response = supabase_admin.table(table_name).update(update_data).eq('id', id).execute()

        if not response.data:
            return jsonify({'success': False, 'message': f'{resource[:-1]} not found'}), 404

        return jsonify({'success': True, 'message': f'{resource[:-1]} status updated successfully'})

    except Exception as e:
        logger.error(f"Error updating {resource} status: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update status'}), 500

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
        update_data = {'is_featured': is_featured, 'updated_at': get_current_time().isoformat()}

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
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter']
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
            'newsletter': 'newsletter_subscribers'
        }
        table_name = table_map.get(resource, resource)

        # Delete items from database
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
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users', 'newsletter']
        if resource not in valid_resources:
            return jsonify({'success': False, 'message': 'Invalid resource type'}), 400

        data = request.get_json()
        ids = data.get('ids', [])
        is_active = data.get('is_active')

        if not ids:
            return jsonify({'success': False, 'message': 'No items selected'}), 400

        if is_active is None:
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        # Determine the correct table name
        table_map = {
            'blog': 'blog_posts',
            'newsletter': 'newsletter_subscribers'
        }
        table_name = table_map.get(resource, resource)

        # Update status in database
        update_data = {'is_active': is_active, 'updated_at': get_current_time().isoformat()}

        response = supabase_admin.table(table_name).update(update_data).in_('id', ids).execute()

        return jsonify({
            'success': True,
            'message': f'{len(response.data) if response.data else 0} {resource} status updated successfully'
        })

    except Exception as e:
        logger.error(f"Error bulk updating {resource} status: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update status'}), 500


# ===== DATA FETCHING ROUTES =====

@app.route('/api/admin/<string:resource>')
@admin_required
def get_admin_resources(resource):
    try:
        # Validate resource type
        valid_resources = ['courses', 'jobs', 'internships', 'blog', 'users', 'messages', 'newsletter']
        if resource not in valid_resources:
            return jsonify({'error': 'Invalid resource type'}), 400

        page = request.args.get('page', 1, type=int)
        per_page = 10
        search = request.args.get('search', '')

        # Map resources to table names
        table_map = {
            'blog': 'blog_posts',
            'messages': 'contact_messages',
            'newsletter': 'newsletter_subscribers'
        }
        table_name = table_map.get(resource, resource)

        # Build base query
        query = supabase_admin.table(table_name).select('*')

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
                query = query.ilike('email', f'%{search}%')

        # Apply ordering
        if resource == 'messages':
            query = query.order('created_at', desc=True)
        elif resource == 'newsletter':
            query = query.order('subscribed_at', desc=True)
        else:
            query = query.order('created_at', desc=True)

        # Paginate
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page - 1
        data_response = query.range(start_idx, end_idx).execute()

        # Count query
        count_query = supabase_admin.table(table_name).select('id', count='exact')
        if search:
            if resource == 'courses':
                count_query = count_query.or_(f"title.ilike.%{search}%,category.ilike.%{search}%,instructor.ilike.%{search}%")
            elif resource == 'jobs':
                count_query = count_query.or_(f"title.ilike.%{search}%,company.ilike.%{search}%,location.ilike.%{search}%")
            elif resource == 'internships':
                count_query = count_query.or_(f"title.ilike.%{search}%,company.ilike.%{search}%,location.ilike.%{search}%")
            elif resource == 'blog':
                count_query = count_query.or_(f"title.ilike.%{search}%,author.ilike.%{search}%,categories.ilike.%{search}%")
            elif resource == 'users':
                count_query = count_query.or_(f"username.ilike.%{search}%,email.ilike.%{search}%,role.ilike.%{search}%")
            elif resource == 'messages':
                count_query = count_query.or_(f"name.ilike.%{search}%,email.ilike.%{search}%,subject.ilike.%{search}%")
            elif resource == 'newsletter':
                count_query = count_query.ilike('email', f'%{search}%')

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

        # Delete item from database
        response = supabase_admin.table(table_name).delete().eq('id', id).execute()

        if not response.data:
            return jsonify({'error': f'{resource[:-1]} not found'}), 404

        return jsonify({'success': True, 'message': f'{resource[:-1]} deleted successfully'})

    except Exception as e:
        logger.error(f"Error deleting {resource}: {str(e)}")
        return jsonify({'error': str(e)}), 500


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
            'updated_at': get_current_time().isoformat()
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
        update_data = {'status': status, 'updated_at': get_current_time().isoformat()}
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
                'updated_at': get_current_time().isoformat()
            }).eq('id', data['message_id']).execute()

            return jsonify({'success': True, 'message': 'Reply sent successfully'})
        else:
            return jsonify({'success': False, 'message': 'Failed to send email'}), 500

    except Exception as e:
        logger.error(f"Error sending message reply: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to send reply'}), 500

# ===== NOTIFICATION ROUTES =====

@app.route('/api/admin/notifications')
@admin_required
def get_notifications():
    try:
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

@app.route('/api/admin/newsletter/send', methods=['POST'])
@admin_required
def send_newsletter():
    try:
        data = request.get_json()
        subject = data.get('subject')
        content = data.get('content')
        recipients_type = data.get('recipients', 'all')
        test_mode = data.get('test_mode', False)

        if not subject or not content:
            return jsonify({'success': False, 'message': 'Subject and content are required'}), 400

        # Prepare subscriber list before background thread
        subscribers = []
        if not test_mode:
            if recipients_type == 'all':
                subscribers = supabase_admin.table('newsletter_subscribers') \
                                .select('*') \
                                .eq('is_active', True) \
                                .execute().data or []
            elif recipients_type == 'active':
                subscribers = supabase_admin.table('newsletter_subscribers') \
                                .select('*') \
                                .eq('is_active', True) \
                                .execute().data or []
            else:
                subscriber_ids = data.get('subscriber_ids', [])
                if not subscriber_ids:
                    return jsonify({'success': False, 'message': 'No subscribers selected'}), 400

                subscribers = supabase_admin.table('newsletter_subscribers') \
                                .select('*') \
                                .in_('id', subscriber_ids) \
                                .eq('is_active', True) \
                                .execute().data or []

        # Run in background
        from threading import Thread
        def send_newsletter_async(subscribers, subject, content, test_mode):
            try:
                if test_mode:
                    # Send test email only to admin
                    send_email_smtp(
                        session.get('admin_email', 'admin@careermaker.com'),
                        f"[TEST] {subject}",
                        content
                    )
                    logger.info("Test newsletter sent to admin")
                else:
                    # Send to subscribers
                    success_count = 0
                    for subscriber in subscribers:
                        email_sent = send_email_smtp(subscriber['email'], subject, content)
                        if email_sent:
                            success_count += 1

                    logger.info(f"Newsletter sent to {success_count} out of {len(subscribers)} subscribers")

            except Exception as e:
                logger.error(f"Error in async newsletter sending: {str(e)}")

        # Start thread
        thread = Thread(target=send_newsletter_async, args=(subscribers, subject, content, test_mode))
        thread.start()

        # Return immediate response
        return jsonify({
            'success': True,
            'message': 'Newsletter is being sent in the background. You will receive a notification when complete.'
        })

    except Exception as e:
        logger.error(f"Error sending newsletter: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to send newsletter'}), 500


@app.route('/api/admin/newsletter/<string:id>/status', methods=['PUT'])
@admin_required
def toggle_newsletter_status(id):
    try:
        data = request.get_json()
        is_active = data.get('is_active')

        if is_active is None:
            return jsonify({'success': False, 'message': 'is_active parameter is required'}), 400

        # Update status in database
        response = supabase_admin.table('newsletter_subscribers').update({
            'is_active': is_active,
            'updated_at': get_current_time().isoformat()
        }).eq('id', id).execute()

        if not response.data:
            return jsonify({'success': False, 'message': 'Subscriber not found'}), 404

        return jsonify({'success': True, 'message': 'Subscriber status updated successfully'})

    except Exception as e:
        logger.error(f"Error updating newsletter status: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to update status'}), 500

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