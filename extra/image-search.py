
# ==================== COURSE IMAGE FUNCTIONS ====================

def fetch_course_image(course_title, course_category=None):
    """
    Main function to fetch course image using multiple APIs with fallback strategy
    """
    if not course_title or len(course_title.strip()) < 3:
        return None

    try:
        clean_title = course_title.strip().lower()
        logger.info(f"🔍 Fetching course image for: '{clean_title}' (Category: {course_category})")

        # Strategy 1: Try Unsplash API first (highest quality)
        image_url = try_unsplash_api(clean_title, course_category)
        if image_url:
            logger.info(f"✅ Found via Unsplash: {image_url}")
            return image_url

        # Strategy 2: Try Pexels API as secondary option
        image_url = try_pexels_api(clean_title, course_category)
        if image_url:
            logger.info(f"✅ Found via Pexels: {image_url}")
            return image_url

        # Strategy 3: Try Google Custom Search API as tertiary option
        image_url = try_google_images(clean_title, course_category)
        if image_url:
            logger.info(f"✅ Found via Google: {image_url}")
            return image_url

        # Strategy 4: Fallback to category-based default images
        default_image = get_category_default_image(course_category)
        logger.info(f"ℹ️ Using category default image: {default_image}")
        return default_image

    except Exception as e:
        logger.error(f"❌ Error fetching course image for '{course_title}': {str(e)}")
        return get_category_default_image(course_category)


def try_unsplash_api(course_title, category=None):
    """
    Try Unsplash API for high-quality course images
    """
    try:
        unsplash_key = os.getenv('UNSPLASH_ACCESS_KEY')
        if not unsplash_key:
            logger.debug("UNSPLASH_ACCESS_KEY not configured")
            return None

        query = build_course_image_query(course_title, category)

        url = "https://api.unsplash.com/search/photos"
        headers = {
            'Authorization': f'Client-ID {unsplash_key}'
        }
        params = {
            'query': query,
            'orientation': 'landscape',
            'per_page': 3,
            'content_filter': 'high'
        }

        response = requests.get(url, headers=headers, params=params, timeout=8)

        if response.status_code == 200:
            data = response.json()
            if data.get('results'):
                # Return the first high-quality photo
                photo = data['results'][0]
                return photo.get('urls', {}).get('regular')

        elif response.status_code == 403:
            logger.warning("⚠️ Unsplash API rate limit exceeded")
        else:
            logger.warning(f"⚠️ Unsplash API error: {response.status_code}")

    except requests.exceptions.Timeout:
        logger.warning("⏰ Unsplash API request timed out")
    except Exception as e:
        logger.warning(f"⚠️ Unsplash API error: {str(e)}")

    return None


def try_pexels_api(course_title, category=None):
    """
    Try Pexels API for course-related images
    """
    try:
        pexels_key = os.getenv('PEXELS_API_KEY')
        if not pexels_key:
            logger.debug("PEXELS_API_KEY not configured")
            return None

        query = build_course_image_query(course_title, category)

        url = "https://api.pexels.com/v1/search"
        headers = {
            'Authorization': pexels_key
        }
        params = {
            'query': query,
            'orientation': 'landscape',
            'per_page': 3,
            'size': 'medium'
        }

        response = requests.get(url, headers=headers, params=params, timeout=8)

        if response.status_code == 200:
            data = response.json()
            if data.get('photos'):
                photo = data['photos'][0]
                return photo.get('src', {}).get('large')

        elif response.status_code == 429:
            logger.warning("⚠️ Pexels API rate limit exceeded")
        else:
            logger.warning(f"⚠️ Pexels API error: {response.status_code}")

    except requests.exceptions.Timeout:
        logger.warning("⏰ Pexels API request timed out")
    except Exception as e:
        logger.warning(f"⚠️ Pexels API error: {str(e)}")

    return None


def try_google_images(course_title, category=None):
    """
    Try Google Custom Search API for course images
    """
    try:
        google_api_key = os.getenv('GOOGLE_API_KEY')
        google_cse_id = os.getenv('GOOGLE_CSE_ID')

        if not google_api_key or not google_cse_id:
            logger.debug("Google API keys not configured")
            return None

        query = build_course_image_query(course_title, category)

        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            'key': google_api_key,
            'cx': google_cse_id,
            'q': query,
            'searchType': 'image',
            'fileType': 'jpg,png',
            'imgSize': 'medium',
            'imgType': 'photo',
            'safe': 'active',
            'num': 3
        }

        response = requests.get(url, params=params, timeout=8)

        if response.status_code == 200:
            data = response.json()
            if data.get('items'):
                for item in data['items']:
                    image_url = item.get('link')
                    if image_url and is_valid_image_url(image_url):
                        return image_url

        elif response.status_code == 403:
            logger.warning("⚠️ Google API quota exceeded")
        else:
            logger.warning(f"⚠️ Google API error: {response.status_code}")

    except requests.exceptions.Timeout:
        logger.warning("⏰ Google API request timed out")
    except Exception as e:
        logger.warning(f"⚠️ Google Images API error: {str(e)}")

    return None


def build_course_image_query(course_title, category=None):
    """
    Build optimized search query for course images with category priority
    """
    query_parts = []

    # Add category-specific keywords first for better relevance
    if category:
        category_keywords = get_category_search_keywords(category)
        query_parts.extend(category_keywords[:2])  # Add top 2 category keywords

    # Add course title
    query_parts.append(course_title)

    # Add educational context
    educational_terms = ['online course', 'education', 'learning', 'tutorial', 'training']
    query_parts.extend(educational_terms)

    # Remove duplicates and limit length
    unique_parts = []
    for part in query_parts:
        if part and part not in unique_parts:
            unique_parts.append(part)

    return ' '.join(unique_parts[:6])  # Limit to 6 terms


def get_category_search_keywords(category):
    """
    Get relevant search keywords for each course category
    """
    if not category:
        return []

    category = category.lower()
    keywords_map = {
        'programming': ['programming', 'coding', 'software development', 'computer science', 'web development'],
        'design': ['design', 'graphic design', 'ui ux', 'creative', 'digital design'],
        'business': ['business', 'entrepreneurship', 'management', 'marketing', 'finance'],
        'marketing': ['marketing', 'digital marketing', 'social media', 'advertising', 'branding'],
        'data science': ['data science', 'data analysis', 'machine learning', 'analytics', 'big data'],
        'artificial intelligence': ['ai', 'artificial intelligence', 'machine learning', 'deep learning',
                                    'neural networks'],
        'web development': ['web development', 'frontend', 'backend', 'full stack', 'javascript'],
        'mobile development': ['mobile development', 'android', 'ios', 'react native', 'flutter'],
        'cloud computing': ['cloud computing', 'aws', 'azure', 'google cloud', 'devops'],
        'cybersecurity': ['cybersecurity', 'information security', 'network security', 'ethical hacking'],
        'digital marketing': ['digital marketing', 'online marketing', 'social media marketing', 'content marketing'],
        'finance': ['finance', 'investment', 'banking', 'financial analysis', 'accounting'],
        'healthcare': ['healthcare', 'medical', 'health sciences', 'public health', 'medicine'],
        'education': ['education', 'teaching', 'learning', 'educational technology', 'online learning']
    }

    return keywords_map.get(category, [category])


def get_category_default_image(category):
    """
    Get default image based on course category
    """
    if not category:
        return '/static/images/courses/default.jpg'

    category = category.lower()
    default_images = {
        'programming': '/static/images/courses/programming.jpg',
        'design': '/static/images/courses/design.jpg',
        'business': '/static/images/courses/business.jpg',
        'marketing': '/static/images/courses/marketing.jpg',
        'data science': '/static/images/courses/data-science.jpg',
        'artificial intelligence': '/static/images/courses/ai.jpg',
        'web development': '/static/images/courses/web-dev.jpg',
        'mobile development': '/static/images/courses/mobile-dev.jpg',
        'cloud computing': '/static/images/courses/cloud.jpg',
        'cybersecurity': '/static/images/courses/cybersecurity.jpg',
        'digital marketing': '/static/images/courses/digital-marketing.jpg',
        'finance': '/static/images/courses/finance.jpg',
        'healthcare': '/static/images/courses/healthcare.jpg',
        'education': '/static/images/courses/education.jpg'
    }

    return default_images.get(category, '/static/images/courses/default.jpg')


def is_valid_image_url(url):
    """
    Validate if URL points to a real image
    """
    try:
        if not url or not url.startswith('http'):
            return False

        # Quick extension check
        valid_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
        if not any(ext in url.lower() for ext in valid_extensions):
            # Might be a CDN URL without extension, continue checking
            pass

        # Quick HEAD request to check content type
        response = requests.head(url, timeout=3, allow_redirects=True)
        content_type = response.headers.get('content-type', '').lower()

        return response.status_code == 200 and 'image' in content_type

    except Exception:
        return False


def get_or_fetch_course_image(course_title, course_category, course_id):
    """
    Get existing course image from database or fetch new one
    """
    try:
        # Check if we already have an image for this course
        existing_image = supabase.table('course_images') \
            .select('*') \
            .ilike('course_title', f"%{course_title}%") \
            .order('created_at', desc=True) \
            .limit(1) \
            .execute()

        if existing_image.data and existing_image.data[0].get('image_url'):
            logger.info(f"✅ Found existing course image in database")
            return existing_image.data[0]['image_url']

        # Fetch new image
        image_url = fetch_course_image(course_title, course_category)
        if not image_url:
            logger.warning(f"❌ No image found for '{course_title}'")
            return get_category_default_image(course_category)

        # Store the image
        stored_url = download_and_store_course_image(image_url, course_title, course_id)
        if stored_url:
            # Save to database for future use
            image_data = {
                'course_title': course_title.lower(),
                'course_category': course_category,
                'course_id': course_id,
                'original_image_url': image_url,
                'image_url': stored_url,
                'created_at': get_current_time().isoformat()
            }
            supabase.table('course_images').insert(image_data).execute()
            logger.info(f"✅ Course image stored successfully")
            return stored_url
        else:
            return image_url  # Return original URL if storage fails

    except Exception as e:
        logger.error(f"❌ Error in get_or_fetch_course_image: {str(e)}")
        return get_category_default_image(course_category)


def download_and_store_course_image(image_url, course_title, course_id):
    """
    Download and store course image in Supabase storage
    """
    try:
        response = requests.get(image_url, timeout=10)
        if response.status_code != 200:
            return None

        # Validate image
        try:
            image = Image.open(io.BytesIO(response.content))
            image.verify()

            # Re-open for dimension check
            image = Image.open(io.BytesIO(response.content))
            width, height = image.size
            if width < 200 or height < 150:
                logger.warning(f"⚠️ Image too small: {width}x{height}")
                return None

        except Exception as e:
            logger.warning(f"⚠️ Invalid image: {str(e)}")
            return None

        # Determine file extension
        content_type = response.headers.get('content-type', '')
        if 'png' in content_type:
            file_extension = 'png'
        elif 'jpeg' in content_type or 'jpg' in content_type:
            file_extension = 'jpg'
        elif 'webp' in content_type:
            file_extension = 'webp'
        else:
            file_extension = 'jpg'  # Default

        # Create safe filename
        safe_title = "".join(c for c in course_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_title = safe_title.replace(' ', '-').lower()[:40]
        unique_filename = f"course-images/{safe_title}-{course_id}.{file_extension}"

        # Upload to Supabase Storage
        upload_response = supabase_admin.storage.from_("course-images").upload(
            unique_filename,
            response.content,
            {"content-type": f"image/{file_extension}"}
        )

        if upload_response:
            public_url = supabase.storage.from_("course-images").get_public_url(unique_filename)
            return public_url

        return None

    except Exception as e:
        logger.error(f"❌ Error storing course image: {str(e)}")
        return None

# ==================== COURSE IMAGE API ROUTES ====================

@app.route('/api/course-image/preview')
def course_image_preview():
    """
    API endpoint for real-time course image preview
    """
    course_title = request.args.get('title', '').strip()
    category = request.args.get('category', '').strip()

    if not course_title:
        return jsonify({'success': False, 'error': 'Course title is required'}), 400

    try:
        # Fetch course image
        image_url = fetch_course_image(course_title, category)

        if image_url:
            return jsonify({
                'success': True,
                'course_title': course_title,
                'image_url': image_url,
                'is_preview': True,
                'source': 'external_api'
            })
        else:
            default_image = get_category_default_image(category)
            return jsonify({
                'success': True,
                'course_title': course_title,
                'image_url': default_image,
                'is_preview': True,
                'source': 'default'
            })

    except Exception as e:
        logger.error(f"❌ Course image preview error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Error fetching course image'
        })


@app.route('/api/course-image/search')
def course_image_search():
    """
    Enhanced API endpoint for course image search with multiple options
    """
    course_title = request.args.get('title', '').strip()
    category = request.args.get('category', '').strip()
    page = request.args.get('page', 1, type=int)

    if not course_title:
        return jsonify({'success': False, 'error': 'Course title is required'}), 400

    try:
        images = []

        # Try multiple APIs to get different options
        unsplash_images = search_unsplash_images(course_title, category, page)
        pexels_images = search_pexels_images(course_title, category, page)

        # Combine results
        all_images = unsplash_images + pexels_images

        # Remove duplicates
        seen_urls = set()
        for img in all_images:
            if img['url'] not in seen_urls and is_valid_image_url(img['url']):
                images.append(img)
                seen_urls.add(img['url'])

        # Limit results
        images = images[:10]

        return jsonify({
            'success': True,
            'images': images,
            'total_results': len(images),
            'has_more': len(images) >= 10
        })

    except Exception as e:
        logger.error(f"❌ Course image search error: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Error searching for course images'
        })


def search_unsplash_images(course_title, category, page=1):
    """Search Unsplash for course images"""
    try:
        unsplash_key = os.getenv('UNSPLASH_ACCESS_KEY')
        if not unsplash_key:
            return []

        query = build_course_image_query(course_title, category)
        url = "https://api.unsplash.com/search/photos"
        headers = {'Authorization': f'Client-ID {unsplash_key}'}
        params = {
            'query': query,
            'orientation': 'landscape',
            'per_page': 5,
            'page': page
        }

        response = requests.get(url, headers=headers, params=params, timeout=8)

        if response.status_code == 200:
            data = response.json()
            return [{
                'url': photo['urls']['regular'],
                'source': 'unsplash',
                'title': photo.get('description', query),
                'photographer': photo['user']['name'],
                'profile_url': photo['user']['links']['html']
            } for photo in data.get('results', [])]

    except Exception as e:
        logger.warning(f"⚠️ Unsplash search error: {str(e)}")

    return []


def search_pexels_images(course_title, category, page=1):
    """Search Pexels for course images"""
    try:
        pexels_key = os.getenv('PEXELS_API_KEY')
        if not pexels_key:
            return []

        query = build_course_image_query(course_title, category)
        url = "https://api.pexels.com/v1/search"
        headers = {'Authorization': pexels_key}
        params = {
            'query': query,
            'orientation': 'landscape',
            'per_page': 5,
            'page': page
        }

        response = requests.get(url, headers=headers, params=params, timeout=8)

        if response.status_code == 200:
            data = response.json()
            return [{
                'url': photo['src']['large'],
                'source': 'pexels',
                'title': query,
                'photographer': photo['photographer'],
                'profile_url': photo['url']
            } for photo in data.get('photos', [])]

    except Exception as e:
        logger.warning(f"⚠️ Pexels search error: {str(e)}")

    return []

# For course image refresh when update course
@app.route('/api/admin/courses/<string:course_id>/refresh-image', methods=['POST'])
@admin_required
def refresh_course_image(course_id):
    """
    Manually refresh course image
    """
    try:
        # Get course details
        course = supabase_admin.table('courses').select('title, category, image').eq('id', course_id).single().execute()
        if not course.data:
            return jsonify({'success': False, 'message': 'Course not found'}), 404

        course_data = course.data
        course_title = course_data['title']
        course_category = course_data.get('category')

        # Fetch new image
        new_image_url = get_or_fetch_course_image(course_title, course_category, course_id)

        if new_image_url:
            # Update course with new image
            supabase_admin.table('courses').update({
                'image': new_image_url,
                'updated_at': get_current_time().isoformat()
            }).eq('id', course_id).execute()

            return jsonify({
                'success': True,
                'message': 'Course image refreshed successfully',
                'image_url': new_image_url
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Could not fetch new course image'
            }), 400

    except Exception as e:
        logger.error(f"Error refreshing course image: {str(e)}")
        return jsonify({'success': False, 'message': 'Failed to refresh course image'}), 500

# Filters for jobs ans internhsips
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


