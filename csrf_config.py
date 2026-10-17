# csrf_config.py - NEW FILE
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask import request, jsonify, session

csrf = CSRFProtect()


def init_csrf(app):
    """Initialize CSRF protection for the app"""
    csrf.init_app(app)

    # Generate CSRF token for all responses
    @app.after_request
    def inject_csrf_token(response):
        if 'text/html' in response.content_type:
            # Generate token if not already generated
            token = generate_csrf()
            session['csrf_token'] = token
            # Response will have token in session
        return response

    # Error handler for CSRF failures
    @app.errorhandler(400)
    def csrf_error_handler(e):
        if 'CSRF' in str(e):
            return jsonify({
                'success': False,
                'error': 'CSRF token missing or invalid',
                'code': 'csrf_error'
            }), 400

        # Handle other 400 errors
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400

    return csrf


def get_csrf_token():
    """Get CSRF token for forms"""
    return generate_csrf()