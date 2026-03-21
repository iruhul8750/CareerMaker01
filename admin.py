# create_first_admin.py
import os
import sys
import getpass
import secrets
import hashlib
import base64
import binascii
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configuration
PBKDF2_ITERATIONS = 100000
HASH_NAME = "sha256"
SALT_LENGTH = 16
HASH_LENGTH = 64


def get_current_utc_time():
    """Get current time in UTC"""
    return datetime.now(timezone.utc)


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


def validate_password(password):
    """Validate password strength"""
    if len(password) < 8:
        return False, 'Password must be at least 8 characters long'
    if not any(c.isupper() for c in password):
        return False, 'Password must contain at least one uppercase letter'
    if not any(c.isdigit() for c in password):
        return False, 'Password must contain at least one number'
    if not any(c in '!@#$%^&*(),.?":{}|<>' for c in password):
        return False, 'Password must contain at least one special character'
    return True, ''


def create_super_admin():
    """Create the first super admin user"""
    try:
        # Initialize Supabase client with service role key
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

        if not supabase_url or not supabase_service_key:
            print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file")
            return False

        # Create admin client (bypasses RLS)
        supabase_admin = create_client(supabase_url, supabase_service_key)
        print("✅ Supabase client initialized")

        # Check if any admin exists
        existing_admins = supabase_admin.table('admins').select('id').limit(1).execute()

        if existing_admins.data:
            print(f"⚠️ Admin(s) already exist in the database.")
            print(f"   Found {len(existing_admins.data)} admin(s).")
            print("   Skipping creation of first super admin.")
            return False

        print("📝 No existing admins found. Creating first super admin...")
        print("\n" + "=" * 50)
        print("SUPER ADMIN CREATION")
        print("=" * 50)

        # Get admin details
        while True:
            full_name = input("Full Name: ").strip()
            if full_name:
                break
            print("❌ Full name is required")

        while True:
            username = input("Username: ").strip()
            if not username:
                print("❌ Username is required")
                continue
            # Check username format
            import re
            if not re.match(r'^[a-zA-Z0-9_]+$', username):
                print("❌ Username can only contain letters, numbers, and underscore")
                continue
            break

        while True:
            email = input("Email: ").strip().lower()
            if not email:
                print("❌ Email is required")
                continue
            if '@' not in email:
                print("❌ Invalid email format")
                continue
            break

        while True:
            password = getpass.getpass("Password: ")
            if not password:
                print("❌ Password is required")
                continue

            # Validate password strength
            is_valid, message = validate_password(password)
            if not is_valid:
                print(f"❌ {message}")
                continue

            confirm_password = getpass.getpass("Confirm Password: ")
            if password != confirm_password:
                print("❌ Passwords do not match")
                continue

            break

        print("\n" + "=" * 50)
        print("Creating super admin...")
        print("=" * 50)

        # Prepare admin data
        now_iso = get_current_utc_time().isoformat()
        admin_data = {
            'full_name': full_name,
            'username': username,
            'email': email,
            'password_hash': hash_password(password),
            'is_superadmin': True,
            'is_active': True,
            'is_deleted': False,
            'created_at': now_iso,
            'updated_at': now_iso
        }

        # Insert into database
        response = supabase_admin.table('admins').insert(admin_data).execute()

        if response.data:
            print("\n✅ SUPER ADMIN CREATED SUCCESSFULLY!")
            print("=" * 50)
            print(f"   Full Name: {full_name}")
            print(f"   Username: {username}")
            print(f"   Email: {email}")
            print(f"   Role: Super Admin")
            print("=" * 50)
            print("\n🔐 You can now login at: http://localhost:5000/admin/login")
            return True
        else:
            print("❌ Failed to create super admin")
            return False

    except Exception as e:
        print(f"❌ Error creating super admin: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def add_column_if_not_exists(supabase_admin, table_name, column_name, column_type, default_value=None):
    """Add column to table if it doesn't exist"""
    try:
        # Check if column exists by trying to select it
        try:
            test_query = supabase_admin.table(table_name).select(column_name).limit(1).execute()
            print(f"✅ Column '{column_name}' already exists")
            return True
        except Exception:
            # Column doesn't exist, try to add it
            print(f"📝 Adding column '{column_name}' to {table_name}...")

            # Build ALTER TABLE statement
            alter_sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
            if default_value is not None:
                if column_type == 'BOOLEAN':
                    alter_sql += f" DEFAULT {str(default_value).lower()}"
                elif column_type == 'TIMESTAMP WITH TIME ZONE':
                    alter_sql += f" DEFAULT {default_value}"
                else:
                    alter_sql += f" DEFAULT '{default_value}'"

            # Execute via raw SQL (needs to be run in Supabase SQL editor)
            print(f"⚠️ Please run this SQL in Supabase SQL editor:")
            print(f"   {alter_sql}")
            return False

    except Exception as e:
        print(f"⚠️ Error checking column: {str(e)}")
        return False


def ensure_table_columns():
    """Ensure all required columns exist"""
    try:
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_service_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        supabase_admin = create_client(supabase_url, supabase_service_key)

        print("\n" + "=" * 50)
        print("CHECKING TABLE STRUCTURE")
        print("=" * 50)

        columns_to_check = [
            ('full_name', 'VARCHAR(255)', None),
            ('is_superadmin', 'BOOLEAN', False),
            ('is_active', 'BOOLEAN', True),
            ('is_deleted', 'BOOLEAN', False),
            ('last_login', 'TIMESTAMP WITH TIME ZONE', None),
            ('deleted_at', 'TIMESTAMP WITH TIME ZONE', None),
            ('updated_at', 'TIMESTAMP WITH TIME ZONE', 'NOW()')
        ]

        for column_name, column_type, default_value in columns_to_check:
            add_column_if_not_exists(supabase_admin, 'admins', column_name, column_type, default_value)

        print("=" * 50)

    except Exception as e:
        print(f"⚠️ Error checking table structure: {str(e)}")


if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("FIRST SUPER ADMIN CREATION SCRIPT")
    print("=" * 50)
    print()

    # First, check and ensure table structure
    ensure_table_columns()

    print()

    # Create super admin
    create_super_admin()