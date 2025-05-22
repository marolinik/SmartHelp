import pytest
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app, db, bcrypt as app_bcrypt # Import bcrypt directly
from models import User, Ticket, KBArticle # Import all models

@pytest.fixture(scope='session')
def app():
    """Session-wide test Flask application."""
    flask_app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:", # Use in-memory SQLite for tests
        "WTF_CSRF_ENABLED": False, # Disable CSRF for easier testing of forms
        "LOGIN_DISABLED": False # Ensure login is enabled for testing auth
    })

    with flask_app.app_context():
        db.create_all() # Create database tables
        yield flask_app # Provide the app object
        db.session.remove() # Clean up session
        db.drop_all() # Drop all tables after tests are done

@pytest.fixture()
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture()
def runner(app, client):
    """A test CLI runner."""
    return app.test_cli_runner()

@pytest.fixture(scope='function')
def init_database(app):
    """Fixture to clean and initialize the database for each test function."""
    with app.app_context():
        db.session.remove()
        db.drop_all()
        db.create_all()
        yield db

@pytest.fixture(scope='function')
def new_user(init_database):
    """Fixture to create a new user and add to the database."""
    user = User(username='testuser', email='test@example.com', role='EndUser')
    user.password_hash = app_bcrypt.generate_password_hash('testpassword').decode('utf-8') # Use imported bcrypt
    db.session.add(user)
    db.session.commit()
    return user

@pytest.fixture(scope='function')
def new_agent(init_database):
    """Fixture to create a new support agent and add to the database."""
    agent = User(username='testagent', email='agent@example.com', role='SupportAgent')
    agent.password_hash = app_bcrypt.generate_password_hash('agentpassword').decode('utf-8') # Use imported bcrypt
    db.session.add(agent)
    db.session.commit()
    return agent

def clear_flashes(client):
    """Helper to clear any pending flash messages in the session."""
    with client.session_transaction() as sess:
        sess['_flashes'] = []
