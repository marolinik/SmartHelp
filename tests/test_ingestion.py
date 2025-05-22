import pytest
from flask import url_for, jsonify
from models import User, Ticket
from unittest.mock import patch # For mocking spaCy

# Helper to simulate NLP processing if spaCy is mocked
def mock_nlp_process(body_text):
    # Simple keyword extraction: split, lower, unique
    keywords = sorted(list(set(token.lower().strip(".,!?;:") for token in body_text.split() if len(token) > 3)))
    if keywords:
        return "Keywords: " + ", ".join(keywords)
    return body_text


@pytest.fixture(autouse=True) # Apply this to all tests in this module
def mock_spacy_load(monkeypatch):
    """Mocks spacy.load and the nlp object's methods for all tests in this file."""
    
    class MockSpacyDoc:
        def __init__(self, text):
            self.text = text
            # Simulate basic tokenization and lemmatization for keyword extraction
            self.tokens = [MockSpacyToken(token.lower().strip(".,!?;:")) for token in text.split()]
            self.ents = [] # Keep ents simple for this mock, or add mock entities if needed for specific tests

            # Simulate PERSON entity extraction for "Mentioned Persons"
            if "John Doe" in text:
                self.ents.append(MockSpacyEntity("John Doe", "PERSON"))


        def __iter__(self): # To allow iteration like `for token in doc:`
            return iter(self.tokens)

    class MockSpacyToken:
        def __init__(self, text):
            self.lemma_ = text # Simple mock: lemma is same as text
            self.pos_ = "NOUN" # Assume all are nouns for simplicity in mock

    class MockSpacyEntity:
        def __init__(self, text, label_):
            self.text = text
            self.label_ = label_

    class MockSpacyNLP:
        def __init__(self, model_name):
            pass # Model name not used in mock

        def __call__(self, text):
            return MockSpacyDoc(text)

    def mock_load(model_name):
        return MockSpacyNLP(model_name)

    # This will mock spacy.load wherever it's called from views.py (get_nlp_model)
    monkeypatch.setattr("views.spacy.load", mock_load)
    # Also ensure get_nlp_model doesn't return "unavailable" due to import/OS errors in test
    monkeypatch.setattr("views.nlp_model", None) # Reset to ensure it tries to load via mock


def test_ingest_email_existing_user(client, init_database, new_user):
    """Test email ingestion when the sender is an existing user."""
    user_email = new_user.email
    subject = "Existing User Test Subject"
    body = "This is a test email body from an existing user. Problem with login."

    with client: # Maintain session context if any login were involved (not here, but good practice)
        response = client.post(url_for('ingestion.ingest_email'), json={
            "sender_email": user_email,
            "subject": subject,
            "body": body
        })

    assert response.status_code == 201
    json_data = response.get_json()
    assert json_data["message"] == "Ticket created successfully"
    assert "ticket_id" in json_data

    ticket = Ticket.query.get(json_data["ticket_id"])
    assert ticket is not None
    assert ticket.user_id == new_user.id
    assert ticket.title == subject
    
    # Check based on mock_nlp_process logic (or a simplified version of it)
    # The mocked spacy.load will lead to views.py's NLP processing.
    # Our mock extracts keywords and appends "Mentioned Persons" if "John Doe" is present.
    assert "Keywords:" in ticket.description 
    assert "login" in ticket.description
    assert "problem" in ticket.description
    assert "user" in ticket.description # from "existing user"
    assert "body" in ticket.description # from "email body"

def test_ingest_email_new_user(client, init_database):
    """Test email ingestion when the sender is a new user."""
    new_email = "new_sender@example.com"
    subject = "New User Test Subject"
    body = "This is an email from a brand new user regarding a billing issue."

    with client:
        response = client.post(url_for('ingestion.ingest_email'), json={
            "sender_email": new_email,
            "subject": subject,
            "body": body
        })

    assert response.status_code == 201
    json_data = response.get_json()
    assert json_data["message"] == "Ticket created successfully"
    assert "ticket_id" in json_data

    # Check if new user was created
    user = User.query.filter_by(email=new_email).first()
    assert user is not None
    assert user.role == "EndUser"
    assert user.username == "new_sender" # Based on generate_unique_username logic

    ticket = Ticket.query.get(json_data["ticket_id"])
    assert ticket is not None
    assert ticket.user_id == user.id
    assert ticket.title == subject
    assert "Keywords:" in ticket.description
    assert "billing" in ticket.description
    assert "issue" in ticket.description


def test_ingest_email_nlp_keywords_and_entities(client, init_database):
    """Test NLP keyword and entity extraction (using the mock)."""
    new_email = "nlp_user@example.com"
    subject = "NLP Test - John Doe mentioned"
    body = "My login is broken and the screen is frozen. John Doe is also having issues."

    with client:
        response = client.post(url_for('ingestion.ingest_email'), json={
            "sender_email": new_email,
            "subject": subject,
            "body": body
        })
    
    assert response.status_code == 201
    json_data = response.get_json()
    ticket_id = json_data["ticket_id"]
    ticket = Ticket.query.get(ticket_id)
    assert ticket is not None
    
    # Assertions based on the mocked NLP behavior in conftest
    assert "Keywords:" in ticket.description
    assert "login" in ticket.description.lower() # Mock lemmas are lowercase
    assert "broken" in ticket.description.lower()
    assert "screen" in ticket.description.lower()
    assert "frozen" in ticket.description.lower()
    assert "john" not in ticket.description.lower().split("keywords:")[1] # Ensure "John Doe" is not among keywords due to PERSON entity
    
    assert "Mentioned Persons: John Doe" in ticket.description


def test_ingest_email_missing_fields(client):
    """Test request with missing fields."""
    response = client.post(url_for('ingestion.ingest_email'), json={
        "sender_email": "test@example.com",
        "subject": "Test Subject"
        # Missing "body"
    })
    assert response.status_code == 400
    json_data = response.get_json()
    assert "Missing sender_email, subject, or body" in json_data["error"]

def test_ingest_email_invalid_payload(client):
    """Test request with invalid (non-JSON) payload."""
    response = client.post(url_for('ingestion.ingest_email'), data="this is not json")
    assert response.status_code == 400 # Werkzeug/Flask should return 400 for malformed JSON
    json_data = response.get_json()
    assert "Invalid JSON payload" in json_data.get("error", "") or "Failed to decode JSON" in json_data.get("error", "") # Exact message might vary

def test_ingest_email_username_uniqueness(client, init_database):
    """Test that new users get unique usernames if their email prefix clashes."""
    # Create a user that would cause a clash with the first auto-generated username
    User.query.filter_by(email="test_user@example.com").delete() # Clean if exists
    db.session.commit()
    
    clashing_user = User(username="test_user", email="clash@example.net", role="EndUser", password_hash="test")
    db.session.add(clashing_user)
    db.session.commit()

    new_email = "test.user@example.com" # This would normally generate "test_user"
    subject = "Username Uniqueness Test"
    body = "Testing username generation for clashing email prefix."

    with client:
        response = client.post(url_for('ingestion.ingest_email'), json={
            "sender_email": new_email,
            "subject": subject,
            "body": body
        })
    
    assert response.status_code == 201
    newly_created_user = User.query.filter_by(email=new_email).first()
    assert newly_created_user is not None
    assert newly_created_user.username != "test_user" # Should have a suffix
    assert "test_user_" in newly_created_user.username # Check for the prefix and underscore

    # Ensure the original clashing user still exists and is different
    original_clasher = User.query.filter_by(email="clash@example.net").first()
    assert original_clasher is not None
    assert original_clasher.id != newly_created_user.id
    assert original_clasher.username == "test_user"

# Test to ensure the mocked NLP is actually used
def test_nlp_mock_is_active(client, init_database):
    """Verifies that the NLP mock is active and processes description as expected by mock."""
    user_email = "mockcheck@example.com"
    subject = "Mock NLP Check"
    body = "This is a simple test body." # Mock will produce "Keywords: body, simple, test, this"

    with client:
        response = client.post(url_for('ingestion.ingest_email'), json={
            "sender_email": user_email,
            "subject": subject,
            "body": body
        })

    assert response.status_code == 201
    json_data = response.get_json()
    ticket = Ticket.query.get(json_data["ticket_id"])
    assert ticket is not None
    # Our specific mock logic for keywords:
    # Keywords: body, simple, test, this (sorted, lowercased, len > 3, unique)
    # The mock in conftest.py does:
    # self.tokens = [MockSpacyToken(token.lower().strip(".,!?;:")) for token in text.split()]
    # self.lemma_ = text (so no actual lemmatization, just lowercased token)
    # keywords = [token.lemma_ for token in doc if token.pos_ in ["NOUN", "VERB", "ADJ"]] (all are NOUN in mock)
    # processed_description = "Keywords: " + ", ".join(keywords)
    # "This is a simple test body." -> "this", "is", "a", "simple", "test", "body."
    # MockSpacyToken strips punctuation: "this", "is", "a", "simple", "test", "body"
    # Keywords (all NOUN): "this", "is", "a", "simple", "test", "body"
    # Joined: "Keywords: this, is, a, simple, test, body"
    
    # The view's NLP processing:
    # keywords = [token.lemma_ for token in doc if token.pos_ in ["NOUN", "VERB", "ADJ"]]
    # if keywords: processed_description = "Keywords: " + ", ".join(keywords)
    
    # So, for "This is a simple test body.", the mock doc.tokens will be MockSpacyToken objects
    # with .lemma_ as "this", "is", "a", "simple", "test", "body". All have .pos_ "NOUN".
    # So, keywords list will be ["this", "is", "a", "simple", "test", "body"].
    # The description should be "Keywords: this, is, a, simple, test, body"
    assert "Keywords: this, is, a, simple, test, body" in ticket.description
    assert "Mentioned Persons:" not in ticket.description # No "John Doe"
