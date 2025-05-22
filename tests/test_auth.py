import pytest
from flask import url_for, session
from models import User

def test_register_user_success(client, init_database):
    """Test successful user registration."""
    response_post = client.post(url_for('auth.register'), data={
        'username': 'newuser',
        'email': 'newuser@example.com',
        'password': 'password123',
        'confirm_password': 'password123',
        'role': 'EndUser'
    })
    assert response_post.status_code == 302 # Should redirect
    with client.session_transaction() as sess:
        flashes = sess.get('_flashes', [])
        assert len(flashes) > 0
        assert flashes[0][0] == 'success' # category
        assert "Your account has been created!" in flashes[0][1] # message

    user = User.query.filter_by(email='newuser@example.com').first()
    assert user is not None
    assert user.username == 'newuser'

def test_register_user_duplicate_username(client, new_user):
    """Test registration with a duplicate username."""
    response = client.post(url_for('auth.register'), data={
        'username': new_user.username, # using existing username
        'email': 'another@example.com',
        'password': 'password123',
        'confirm_password': 'password123',
        'role': 'EndUser'
    }, follow_redirects=True)
    assert response.status_code == 200 # Stays on registration page
    assert b"That username is taken." in response.data

def test_register_user_duplicate_email(client, new_user):
    """Test registration with a duplicate email."""
    response = client.post(url_for('auth.register'), data={
        'username': 'anotheruser',
        'email': new_user.email, # using existing email
        'password': 'password123',
        'confirm_password': 'password123',
        'role': 'EndUser'
    }, follow_redirects=True)
    assert response.status_code == 200
    assert b"That email is taken." in response.data

def test_login_user_success(client, new_user):
    """Test successful user login."""
    response_post = client.post(url_for('auth.login'), data={
        'email': new_user.email,
        'password': 'testpassword' # Password for new_user fixture
    })
    assert response_post.status_code == 302 # Redirects
    with client.session_transaction() as sess:
        flashes = sess.get('_flashes', [])
        assert len(flashes) > 0
        assert flashes[0][0] == 'success'
        assert "Login Successful!" in flashes[0][1]
        assert sess['_user_id'] == str(new_user.id)
    
    # Check if redirected to home
    response_redirect = client.get(response_post.location)
    assert response_redirect.status_code == 200
    assert b"Welcome to IntelliServe AI Help Desk!" in response_redirect.data

def test_login_user_invalid_email(client, new_user):
    """Test login with an invalid email."""
    response_post = client.post(url_for('auth.login'), data={
        'email': 'wrong@example.com',
        'password': 'testpassword'
    })
    assert response_post.status_code == 200 # Stays on login page, no redirect on fail
    assert b"Login Unsuccessful. Please check email and password" in response_post.data

def test_login_user_invalid_password(client, new_user):
    """Test login with an invalid password."""
    response_post = client.post(url_for('auth.login'), data={
        'email': new_user.email,
        'password': 'wrongpassword'
    })
    assert response_post.status_code == 200 # Stays on login page
    assert b"Login Unsuccessful. Please check email and password" in response_post.data

def test_logout_user(client, new_user):
    """Test user logout."""
    # First, log in the user
    client.post(url_for('auth.login'), data={
        'email': new_user.email,
        'password': 'testpassword'
    }, follow_redirects=True)

    # Clear any existing flashes from login before testing logout flash
    with client.session_transaction() as sess:
        sess['_flashes'] = []

    # Then, test logout
    response_logout = client.get(url_for('auth.logout'))
    assert response_logout.status_code == 302 # Redirects
    with client.session_transaction() as sess:
        flashes = sess.get('_flashes', [])
        assert len(flashes) > 0
        assert flashes[0][0] == 'info' # Should be 'info' as per views.py
        assert "You have been logged out." in flashes[0][1]
        assert '_user_id' not in sess

    response_redirect = client.get(response_logout.location)
    assert response_redirect.status_code == 200
    assert url_for('auth.login') in response_redirect.request.path

def test_access_protected_route_unauthenticated(client):
    """Test accessing a protected route (e.g., create ticket) when unauthenticated."""
    response_get = client.get(url_for('ticket.create_ticket')) # No follow_redirects
    assert response_get.status_code == 302 # Should redirect to login
    assert url_for('auth.login') in response_get.location

    response_redirect = client.get(response_get.location, follow_redirects=True)
    assert response_redirect.status_code == 200
    assert b"Please log in to access this page." in response_redirect.data # Default flash message from Flask-Login

def test_authenticated_user_access_login_page(client, new_user):
    """Test that an already authenticated user is redirected from login/register pages."""
    client.post(url_for('auth.login'), data={'email': new_user.email, 'password': 'testpassword'}, follow_redirects=True)
    
    response_login = client.get(url_for('auth.login'), follow_redirects=True)
    assert response_login.status_code == 200
    assert url_for('main.home') in response_login.request.path # Redirects to home

    response_register = client.get(url_for('auth.register'), follow_redirects=True)
    assert response_register.status_code == 200
    assert url_for('main.home') in response_register.request.path # Redirects to home
