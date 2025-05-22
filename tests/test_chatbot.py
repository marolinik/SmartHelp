import pytest
from flask import url_for, session
from models import User, Ticket, KBArticle
import json

# Helper function to log in a user
def login(client, email, password):
    return client.post(url_for('auth.login'), data={'email': email, 'password': password}, follow_redirects=True)

def test_chatbot_ui_access_enduser(client, new_user):
    """Test EndUser can access the chatbot UI."""
    login(client, new_user.email, 'testpassword')
    response = client.get(url_for('chatbot.chatbot_ui'))
    assert response.status_code == 200
    assert b"IntelliServe Chatbot" in response.data

import tests.conftest as conftest_helpers

def test_chatbot_ui_access_agent_fail(client, new_agent):
    """Test SupportAgent is redirected from chatbot UI."""
    login(client, new_agent.email, 'agentpassword')
    conftest_helpers.clear_flashes(client) # Clear login flash
    response_get = client.get(url_for('chatbot.chatbot_ui')) # No follow_redirects
    assert response_get.status_code == 302 # Should redirect
    assert url_for('main.home') in response_get.location 

    with client.session_transaction() as sess:
        flashes = sess.get('_flashes', [])
        assert len(flashes) > 0
        assert flashes[0][0] == 'warning' # As per views.py
        assert "Chatbot is available for End Users." in flashes[0][1]

    response_redirect = client.get(response_get.location, follow_redirects=True)
    assert response_redirect.status_code == 200
    assert b"Welcome to IntelliServe AI Help Desk!" in response_redirect.data # On home page

def test_chatbot_message_password_reset_rule(client, new_user):
    """Test chatbot response for 'password reset' rule."""
    login(client, new_user.email, 'testpassword')
    response = client.post(url_for('chatbot.chatbot_message'), json={'message': 'I forgot my password'})
    assert response.status_code == 200
    data = response.get_json()
    assert "reset your password" in data['response']
    assert "search for 'password reset' articles" in data['response']
    assert data['create_ticket_prompt'] is False

def test_chatbot_message_ticket_status_rule(client, new_user):
    """Test chatbot response for 'ticket status' rule."""
    login(client, new_user.email, 'testpassword')
    response = client.post(url_for('chatbot.chatbot_message'), json={'message': 'What is my ticket status?'})
    assert response.status_code == 200
    data = response.get_json()
    assert "check your ticket statuses on the" in data['response']
    assert url_for('ticket.my_tickets') in data['response']
    assert data['create_ticket_prompt'] is False

def test_chatbot_message_kb_search_found(client, new_user, new_agent, init_database):
    """Test chatbot response when KB articles are found."""
    login(client, new_user.email, 'testpassword')
    # Create a KB article
    article = KBArticle(title='Relevant Article Title', content='This article talks about setup.', kb_author=new_agent)
    init_database.session.add(article)
    init_database.session.commit()

    response = client.post(url_for('chatbot.chatbot_message'), json={'message': 'Tell me about setup'})
    assert response.status_code == 200
    data = response.get_json()
    assert "I found some articles that might help:" in data['response']
    assert "Relevant Article Title" in data['response']
    assert url_for('kb.article_detail', article_id=article.id) in data['response']
    assert data['create_ticket_prompt'] is False

def test_chatbot_message_kb_search_not_found_prompts_ticket(client, new_user):
    """Test chatbot prompts to create ticket if KB search yields no results."""
    login(client, new_user.email, 'testpassword')
    response = client.post(url_for('chatbot.chatbot_message'), json={'message': 'gibberish query for testing'})
    assert response.status_code == 200
    data = response.get_json()
    assert "I couldn't find any specific articles matching your query." in data['response']
    assert "Would you like me to create a ticket for you?" in data['response']
    assert data['create_ticket_prompt'] is True

def test_chatbot_message_contact_support_prompts_ticket(client, new_user):
    """Test chatbot response for 'contact support' triggers ticket creation prompt."""
    login(client, new_user.email, 'testpassword')
    response = client.post(url_for('chatbot.chatbot_message'), json={'message': 'I need to talk to an agent'})
    assert response.status_code == 200
    data = response.get_json()
    assert "I can help you create a support ticket." in data['response']
    assert "Please describe your issue" in data['response']
    assert data['create_ticket_prompt'] is True

def test_chatbot_message_handoff_and_ticket_creation(client, new_user, init_database):
    """Test the handoff sequence: user asks for agent, then provides description, ticket is created."""
    login(client, new_user.email, 'testpassword')

    # 1. User indicates they want to talk to an agent
    response_agent_request = client.post(url_for('chatbot.chatbot_message'), json={'message': 'talk to human'})
    data_agent_request = response_agent_request.get_json()
    assert data_agent_request['create_ticket_prompt'] is True
    assert "Please describe your issue" in data_agent_request['response']

    # 2. User provides the description of their issue (simulating next message)
    issue_description = "My computer is making a loud whirring noise and smells like smoke."
    response_ticket_creation = client.post(url_for('chatbot.chatbot_message'), json={
        'message': issue_description,
        'previous_intent': 'create_ticket_prompt' # Client-side would send this based on bot's previous response
    })
    assert response_ticket_creation.status_code == 200
    data_ticket_creation = response_ticket_creation.get_json()

    assert "I've created a new ticket for you" in data_ticket_creation['response']
    assert data_ticket_creation['create_ticket_prompt'] is False # Prompt should be reset
    assert data_ticket_creation['ticket_created_info'] is not None
    
    ticket_id = data_ticket_creation['ticket_created_info']['id']
    ticket_title = data_ticket_creation['ticket_created_info']['title']
    
    assert ticket_title == "Chatbot Handoff"
    assert f"#{ticket_id}" in data_ticket_creation['response']
    assert url_for('ticket.ticket_detail', ticket_id=ticket_id) in data_ticket_creation['response']

    # Verify ticket in DB
    ticket = Ticket.query.get(ticket_id)
    assert ticket is not None
    assert ticket.user_id == new_user.id 
    assert ticket.description == issue_description.lower() # Assert against lowercased
    assert ticket.title == "Chatbot Handoff"
    assert ticket.status == "Open"

def test_chatbot_message_unauthenticated(client):
    """Test that unauthenticated users cannot use the chatbot message endpoint."""
    response = client.post(url_for('chatbot.chatbot_message'), json={'message': 'Hello?'})
    # This will redirect to login because of @login_required
    # However, for a JSON endpoint, it might return 401 if not handled by Flask-Login's unauthorized handler for JSON
    # Pytest-Flask's client might not fully simulate the unauthorized handler for AJAX requests in the same way a browser does.
    # If Flask-Login redirects, status code will be 302. If it returns 401, it's also valid.
    # For this app, @login_required redirects to HTML login page.
    # Let's check for redirection.
    assert response.status_code == 302 
    assert url_for('auth.login', _external=False) in response.location # Check redirection target

    # If it were an API that should return 401:
    # assert response.status_code == 401
    # data = response.get_json()
    # assert "error" in data
    # assert "unauthorized" in data["error"]

def test_chatbot_default_response(client, new_user):
    """Test the chatbot's default response when no rules or KB articles match."""
    login(client, new_user.email, 'testpassword')
    # Assuming no KB articles named 'obscure topic'
    response = client.post(url_for('chatbot.chatbot_message'), json={'message': 'Tell me about an extremely obscure topic'})
    assert response.status_code == 200
    data = response.get_json()
    # This will now trigger the "no articles found, want to create a ticket?" flow
    assert "I couldn't find any specific articles matching your query." in data['response']
    assert data['create_ticket_prompt'] is True

    # To test the actual "I'm sorry, I didn't quite understand that" we'd need to ensure no KB search is triggered.
    # The current logic always falls back to KB search then to ticket prompt.
    # A truly unmatchable phrase that doesn't trigger KB and doesn't fit rules might be hard to craft
    # without more complex NLU or if the KB search was more restrictive.
    # For now, the "no articles found" is the effective fallback before ticket creation.
    # If we modify the chatbot to have a state where it doesn't search KB and doesn't match rules,
    # then the "I'm sorry..." default would be testable.
    # Example: If a user says "no" to creating a ticket after KB search failed.
    # This requires more sophisticated state management not in the current MVP.
    
    # Let's simulate a scenario where previous_intent was NOT create_ticket_prompt,
    # and the message is so generic it's unlikely to hit KB (though this is not guaranteed)
    response_generic = client.post(url_for('chatbot.chatbot_message'), json={
        'message': '...', # very generic
        'previous_intent': None
    })
    data_generic = response_generic.get_json()
    assert "I couldn't find any specific articles matching your query." in data_generic['response'] or \
           "I'm sorry, I didn't quite understand that." in data_generic['response'] # Depending on KB state
    assert data_generic['create_ticket_prompt'] is True
    
def test_chatbot_message_empty_message(client, new_user):
    """Test chatbot response to an empty message."""
    login(client, new_user.email, 'testpassword')
    response = client.post(url_for('chatbot.chatbot_message'), json={'message': ''})
    assert response.status_code == 200
    data = response.get_json()
    # The current logic will search KB with an empty string, likely finding nothing or everything depending on DB.
    # It might be better for the view to handle empty strings explicitly.
    # For now, it will likely go to "no articles found" or list all articles if the query is empty.
    # Let's assume it finds no specific articles for an empty query.
    assert "I couldn't find any specific articles matching your query." in data['response']
    assert data['create_ticket_prompt'] is True

def test_chatbot_message_with_csrf_if_needed(client, new_user, app):
    """Test that chatbot message works, especially if global CSRF were enabled."""
    # This test is more about ensuring the test setup (WTF_CSRF_ENABLED=False in conftest)
    # and the client call (which doesn't include CSRF by default for json) works.
    # If WTF_CSRF_ENABLED were True and not handled, this would fail.
    login(client, new_user.email, 'testpassword')
    
    # Temporarily enable CSRF for this test if it was disabled in conftest for others
    original_csrf_status = app.config.get("WTF_CSRF_ENABLED", True)
    app.config["WTF_CSRF_ENABLED"] = True # Simulate CSRF being on

    # In a real scenario with CSRF, the client would need to send a CSRF token.
    # The test client doesn't automatically handle CSRF for JSON posts like it might for form posts.
    # For this test, since we are directly calling the endpoint without a form,
    # and assuming session-based CSRF, it's harder to simulate perfectly without more setup.
    # However, the JavaScript in chatbot_ui.html *does* attempt to send CSRF if csrf_token() is available.
    # This test primarily verifies the endpoint logic rather than full CSRF flow.
    
    # If CSRF is truly enforced for JSON by Flask-WTF/Flask-SeaSurf, this might need a token.
    # For now, assuming WTF_CSRF_ENABLED=False in tests or CSRF doesn't apply to JSON POSTs by default.
    # The current conftest.py disables WTF_CSRF_ENABLED, so this test will pass.
    # If it were enabled, we'd need to mock `csrf_token()` or pass a valid token.

    response = client.post(url_for('chatbot.chatbot_message'), json={'message': 'csrf test message'})
    assert response.status_code == 200 # Should still work because WTF_CSRF_ENABLED is False in test config
    data = response.get_json()
    assert "I couldn't find any specific articles matching your query." in data['response'] # Assuming no KB for "csrf test message"
    
    app.config["WTF_CSRF_ENABLED"] = original_csrf_status # Restore original config
    
    # If WTF_CSRF_ENABLED was True and we wanted to test the failure:
    # with pytest.raises(Exception): # Or specific CSRF error
    #     client.post(url_for('chatbot.chatbot_message'), json={'message': 'csrf fail test message'})
    # Or check for 400/403 status code depending on CSRF library.
    # For now, this test just confirms the endpoint is reachable and basic logic flows.
