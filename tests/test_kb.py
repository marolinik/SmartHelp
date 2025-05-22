import pytest
from flask import url_for
from models import User, KBArticle

# Helper function to log in a user (can be moved to conftest if used across more test files)
def login(client, email, password):
    return client.post(url_for('auth.login'), data={'email': email, 'password': password}, follow_redirects=True)

def test_create_kb_article_agent_success(client, new_agent):
    """Test successful KB article creation by a SupportAgent."""
    login(client, new_agent.email, 'agentpassword')
    response = client.post(url_for('kb.create_kb_article'), data={
        'title': 'Test KB Article',
        'content': 'This is the content of the test KB article.',
        'category': 'Testing'
    }, follow_redirects=True)
    assert response.status_code == 200
    assert b"Knowledge base article created successfully!" in response.data
    article = KBArticle.query.filter_by(title='Test KB Article').first()
    assert article is not None
    assert article.kb_author == new_agent
    assert article.category == 'Testing'

def test_create_kb_article_enduser_fail(client, new_user):
    """Test that an EndUser cannot create a KB article."""
    login(client, new_user.email, 'testpassword')
    response_post = client.post(url_for('kb.create_kb_article'), data={
        'title': 'EndUser KB Article',
        'content': 'Content by EndUser.'
    }) # No follow_redirects
    assert response_post.status_code == 302 # Should redirect
    assert url_for('main.home') in response_post.location

    with client.session_transaction() as sess:
        flashes = sess.get('_flashes', [])
        assert len(flashes) > 0
        assert flashes[0][0] == 'danger'
        assert "You are not authorized to create knowledge base articles." in flashes[0][1]

    article = KBArticle.query.filter_by(title='EndUser KB Article').first()
    assert article is None

import tests.conftest as conftest_helpers # Import conftest

def test_edit_kb_article_agent_success(client, new_agent, init_database):
    """Test successful KB article editing by a SupportAgent."""
    login(client, new_agent.email, 'agentpassword')
    # Create an article first
    article = KBArticle(title='Original Title', content='Original content', category='General', kb_author=new_agent)
    init_database.session.add(article)
    init_database.session.commit()

    response = client.post(url_for('kb.edit_kb_article', article_id=article.id), data={
        'title': 'Updated Title',
        'content': 'Updated content of the article.',
        'category': 'UpdatedCategory'
    }, follow_redirects=True)
    assert response.status_code == 200
    assert b"Knowledge base article updated successfully!" in response.data
    updated_article = KBArticle.query.get(article.id)
    assert updated_article.title == 'Updated Title'
    assert updated_article.content == 'Updated content of the article.'
    assert updated_article.category == 'UpdatedCategory'

def test_edit_kb_article_enduser_fail(client, new_user, new_agent, init_database):
    """Test that an EndUser cannot edit a KB article."""
    # Create an article by an agent
    article = KBArticle(title='Agent Article for Edit Test', content='Content', kb_author=new_agent)
    init_database.session.add(article)
    init_database.session.commit()

    login(client, new_user.email, 'testpassword') # Log in as EndUser
    conftest_helpers.clear_flashes(client)
    response_post = client.post(url_for('kb.edit_kb_article', article_id=article.id), data={
        'title': 'Attempted Edit by EndUser',
        'content': 'New content.'
    }) # No follow_redirects
    assert response_post.status_code == 302 # Should redirect
    assert url_for('kb.article_list') in response_post.location


    with client.session_transaction() as sess:
        flashes = sess.get('_flashes', [])
        assert len(flashes) > 0
        assert flashes[0][0] == 'danger' # As per views.py
        assert "You are not authorized to edit this article." in flashes[0][1]

    original_article = KBArticle.query.get(article.id)
    assert original_article.title == 'Agent Article for Edit Test' # Title should not change

def test_manage_kb_articles_agent_view(client, new_agent, init_database):
    """Test SupportAgent can view the 'manage KB articles' page."""
    login(client, new_agent.email, 'agentpassword')
    article = KBArticle(title='Manage Me', content='Content', kb_author=new_agent)
    init_database.session.add(article)
    init_database.session.commit()

    response = client.get(url_for('kb.manage_kb_articles'))
    assert response.status_code == 200
    assert b"Manage Knowledge Base Articles" in response.data
    assert b"Manage Me" in response.data

def test_manage_kb_articles_enduser_fail(client, new_user):
    """Test EndUser cannot access 'manage KB articles' page."""
    login(client, new_user.email, 'testpassword')
    conftest_helpers.clear_flashes(client)
    response_get = client.get(url_for('kb.manage_kb_articles')) # No follow_redirects
    assert response_get.status_code == 302 # Should redirect
    assert url_for('main.home') in response_get.location

    with client.session_transaction() as sess:
        flashes = sess.get('_flashes', [])
        assert len(flashes) > 0
        assert flashes[0][0] == 'danger' # As per views.py
        assert "You are not authorized to manage knowledge base articles." in flashes[0][1]

def test_view_kb_article_list_authenticated_user(client, new_user, new_agent, init_database):
    """Test any authenticated user can view the list of KB articles."""
    # Create some articles
    article1 = KBArticle(title='KB Article 1', content='Content 1', kb_author=new_agent)
    article1 = KBArticle(title='KB Article 1', content='Content 1', kb_author=new_agent)
    article2 = KBArticle(title='KB Article 2', content='Content 2', kb_author=new_agent)
    init_database.session.add_all([article1, article2])
    init_database.session.commit()

    with client: # Ensure session persistence
        login(client, new_user.email, 'testpassword') # Log in as EndUser
        response = client.get(url_for('kb.article_list'))
    assert response.status_code == 200
    assert b"Knowledge Base" in response.data
    assert b"KB Article 1" in response.data
    assert b"KB Article 2" in response.data

def test_view_kb_article_detail_authenticated_user(client, new_user, new_agent, init_database):
    """Test any authenticated user can view a single KB article's detail."""
    article = KBArticle(title='Detail View Article', content='Detailed content here.', kb_author=new_agent)
    init_database.session.add(article)
    init_database.session.commit()

    with client: # Ensure session persistence
        login(client, new_user.email, 'testpassword')
        response = client.get(url_for('kb.article_detail', article_id=article.id))
    assert response.status_code == 200
    assert b"Detail View Article" in response.data
    assert b"Detailed content here." in response.data

def test_kb_article_search_found(client, new_user, new_agent, init_database):
    """Test KB article search when articles are found."""
    article_alpha = KBArticle(title='Searchable Alpha Article', content='Unique keyword content for alpha.', kb_author=new_agent)
    article_beta = KBArticle(title='Another Beta Article', content='Common words here.', kb_author=new_agent)
    init_database.session.add_all([article_alpha, article_beta])
    init_database.session.commit()

    with client: # Ensure session persistence
        login(client, new_user.email, 'testpassword')
        response = client.get(url_for('kb.article_list', query='Unique keyword'))
    assert response.status_code == 200
    assert b"Searchable Alpha Article" in response.data
    assert b"Unique keyword content for alpha" in response.data
    assert b"Another Beta Article" not in response.data

    response_title_search = client.get(url_for('kb.article_list', query='Alpha Article'))
    assert response_title_search.status_code == 200
    assert b"Searchable Alpha Article" in response_title_search.data


def test_kb_article_search_not_found(client, new_user, new_agent, init_database):
    """Test KB article search when no articles match."""
    article_existing = KBArticle(title='Existing Article', content='Some content.', kb_author=new_agent)
    init_database.session.add(article_existing)
    init_database.session.commit()

    with client: # Ensure session persistence
        login(client, new_user.email, 'testpassword')
        response = client.get(url_for('kb.article_list', query='NonExistentXYZ'))
    assert response.status_code == 200
    assert b"No knowledge base articles found matching your search criteria" in response.data
    assert b"Existing Article" not in response.data # Make sure it doesn't list all

def test_unauthenticated_access_to_kb_routes(client):
    """Test unauthenticated access to various KB routes."""
    # Create Article Page (Agent only)
    response_create = client.get(url_for('kb.create_kb_article'), follow_redirects=True)
    assert url_for('auth.login') in response_create.request.path
    assert b"Please log in to access this page." in response_create.data

    # Edit Article Page (Agent only, assuming article ID 1)
    response_edit = client.get(url_for('kb.edit_kb_article', article_id=1)) # No follow_redirects
    assert response_edit.status_code == 302
    assert url_for('auth.login') in response_edit.location


    # Manage Articles Page (Agent only)
    response_manage = client.get(url_for('kb.manage_kb_articles')) # No follow_redirects
    assert response_manage.status_code == 302
    assert url_for('auth.login') in response_manage.location


    # Article List Page (Authenticated users)
    response_list = client.get(url_for('kb.article_list')) # No follow_redirects
    assert response_list.status_code == 302
    assert url_for('auth.login') in response_list.location


    # Article Detail Page (Authenticated users, assuming article ID 1)
    response_detail = client.get(url_for('kb.article_detail', article_id=1)) # No follow_redirects
    assert response_detail.status_code == 302
    assert url_for('auth.login') in response_detail.location
