from main import supabase_admin, hash_password, get_current_utc_time, logger
from postgrest.exceptions import APIError
import traceback

class AdminCreationError(Exception):
    """Custom exception for admin creation errors"""
    pass

def create_admin(username, email, password, is_superadmin=False):
    """
    Create an admin user if the username and email do not already exist.
    Returns the inserted admin data on success, or None if skipped.
    """
    try:
        # -----------------------------
        # 1. Validate inputs
        # -----------------------------
        if not username or not email or not password:
            raise AdminCreationError("Username, email, and password are required")

        # -----------------------------
        # 2. Check if email already exists
        # -----------------------------
        email_check = (
            supabase_admin.table("admins")
            .select("id")
            .eq("email", email)
            .limit(1)
            .execute()
        )
        if email_check.data:
            logger.warning(f"⚠️ Admin with email '{email}' already exists")
            return None

        # -----------------------------
        # 3. Check if username already exists
        # -----------------------------
        username_check = (
            supabase_admin.table("admins")
            .select("id")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        if username_check.data:
            logger.warning(f"⚠️ Admin with username '{username}' already exists")
            return None

        # -----------------------------
        # 4. Prepare admin data
        # -----------------------------
        now_iso = get_current_utc_time().isoformat()
        admin_data = {
            "username": username,
            "email": email,
            "password_hash": hash_password(password),
            "is_superadmin": is_superadmin,
            "is_active": True,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        # -----------------------------
        # 5. Insert admin
        # -----------------------------
        insert_response = supabase_admin.table("admins").insert(admin_data).execute()

        if insert_response.data:
            logger.info(f"✅ Admin '{username}' created successfully")
            return insert_response.data[0]
        else:
            raise AdminCreationError(f"Admin insert failed. Supabase response: {insert_response}")

    # -----------------------------
    # Known API errors (e.g., unique constraint violations)
    # -----------------------------
    except APIError as e:
        if e.code == "23505":  # Unique constraint violation
            # Extract which key caused it from e.message
            if "username" in e.message:
                logger.warning(f"⚠️ Admin with username '{username}' already exists")
            elif "email" in e.message:
                logger.warning(f"⚠️ Admin with email '{email}' already exists")
            else:
                logger.warning(f"⚠️ Duplicate key error: {e.message}")
            return None
        else:
            logger.error(f"❌ Supabase API error: {e.message}")
            return None

    # -----------------------------
    # Unexpected errors
    # -----------------------------
    except AdminCreationError as e:
        logger.warning(f"⚠️ Admin creation blocked: {str(e)}")
        return None

    except Exception:
        logger.error("❌ Unexpected error during admin creation")
        logger.error(traceback.format_exc())
        return None


# -----------------------------
# Example: create multiple admins
# -----------------------------
if __name__ == "__main__":
    # Admin 1
    create_admin(
        username="abc",
        email="abc@careermaker.com",
        password="abc",
        is_superadmin=True
    )
