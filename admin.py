from main import supabase_admin, hash_password, get_current_utc_time, logger


def create_initial_admin():
    """Create initial admin user if none exists"""
    try:
        # Check if any admin exists
        admins = supabase_admin.table('admins').select('id').execute().data

        if not admins:
            # Create default admin
            admin_data = {
                'username': 'admin1',
                'email': 'admin@careermaker.com',
                'password_hash': hash_password('admin1234'),  # Change this in production!
                'is_superadmin': True,
                'is_active': True,
                'created_at': get_current_utc_time().isoformat(),
                'updated_at': get_current_utc_time().isoformat()
            }

            supabase_admin.table('admins').insert(admin_data).execute()
            logger.info("Default admin user created")

    except Exception as e:
        logger.error(f"Error creating initial admin: {str(e)}")


# Call this function when the app starts
create_initial_admin()