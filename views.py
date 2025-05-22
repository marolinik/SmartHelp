from flask import Blueprint, render_template, redirect, url_for, flash, request, abort, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from app import db, bcrypt
from models import User, Ticket, KBArticle
from forms import RegistrationForm, LoginForm, TicketForm, TicketUpdateForm, KBArticleForm

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.home'))  # 'main' will be another blueprint for general routes
    form = RegistrationForm()
    if form.validate_on_submit():
        hashed_password = bcrypt.generate_password_hash(form.password.data).decode('utf-8')
        user = User(username=form.username.data, email=form.email.data, password_hash=hashed_password, role=form.role.data)
        db.session.add(user)
        db.session.commit()
        flash('Your account has been created! You are now able to log in', 'success')
        return redirect(url_for('auth.login'))
    return render_template('auth/register.html', title='Register', form=form)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.home')) # 'main' will be another blueprint for general routes
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and bcrypt.check_password_hash(user.password_hash, form.password.data):
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next')
            flash('Login Successful!', 'success')
            return redirect(next_page) if next_page else redirect(url_for('main.home')) # 'main' will be another blueprint
        else:
            flash('Login Unsuccessful. Please check email and password', 'danger')
    return render_template('auth/login.html', title='Login', form=form)

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))

# Placeholder for a main blueprint and home route (to be created in a separate file if app grows)
main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def home():
    return "Welcome to IntelliServe AI Help Desk!"

# Register main_bp in app.py as well
# from views import main_bp
# app.register_blueprint(main_bp)

ticket_bp = Blueprint('ticket', __name__)

@ticket_bp.route('/create-ticket', methods=['GET', 'POST'])
@login_required
def create_ticket():
    if current_user.role != 'EndUser':
        flash('Only End Users can create tickets.', 'danger')
        return redirect(url_for('main.home'))
    form = TicketForm()
    if form.validate_on_submit():
        ticket = Ticket(title=form.title.data,
                        description=form.description.data,
                        author=current_user)
        db.session.add(ticket)
        db.session.commit()
        flash('Your ticket has been created!', 'success')
        return redirect(url_for('ticket.my_tickets'))
    return render_template('tickets/create_ticket.html', title='Create Ticket', form=form)

@ticket_bp.route('/my-tickets')
@login_required
def my_tickets():
    if current_user.role != 'EndUser':
        flash('Only End Users can view their tickets.', 'danger')
        return redirect(url_for('main.home'))
    tickets = Ticket.query.filter_by(author=current_user).order_by(Ticket.created_at.desc()).all()
    return render_template('tickets/my_tickets.html', title='My Tickets', tickets=tickets)

@ticket_bp.route('/all-tickets')
@login_required
def all_tickets():
    if current_user.role != 'SupportAgent':
        flash('Only Support Agents can view all tickets.', 'danger')
        return redirect(url_for('main.home'))
    tickets = Ticket.query.order_by(Ticket.created_at.desc()).all()
    return render_template('tickets/all_tickets.html', title='All Tickets', tickets=tickets)

@ticket_bp.route('/ticket/<int:ticket_id>', methods=['GET', 'POST'])
@login_required
def ticket_detail(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    form = None

    # Authorization: EndUser can only see their own tickets
    if current_user.role == 'EndUser' and ticket.author != current_user:
        abort(403) # Forbidden

    if current_user.role == 'SupportAgent':
        form = TicketUpdateForm()
        if form.validate_on_submit():
            # Assign to self if not already assigned or assigned to someone else
            if not ticket.agent_id or (request.form.get('assign_to_me') and ticket.agent_id != current_user.id) :
                 ticket.agent_id = current_user.id
                 flash('Ticket assigned to you.', 'success')

            if ticket.status != form.status.data: # Check if status actually changed
                ticket.status = form.status.data
                flash('Ticket status updated.', 'success')
            
            db.session.commit()
            return redirect(url_for('ticket.ticket_detail', ticket_id=ticket.id))
        # Pre-fill form for GET request
        form.status.data = ticket.status


    return render_template('tickets/ticket_detail.html', title=f'Ticket #{ticket.id}', ticket=ticket, form=form)

kb_bp = Blueprint('kb', __name__)

@kb_bp.route('/create-article', methods=['GET', 'POST'])
@login_required
def create_kb_article():
    if current_user.role != 'SupportAgent': # Assuming SupportAgent can manage KB
        flash('You are not authorized to create knowledge base articles.', 'danger')
        return redirect(url_for('main.home'))
    form = KBArticleForm()
    if form.validate_on_submit():
        article = KBArticle(title=form.title.data,
                            content=form.content.data,
                            category=form.category.data,
                            kb_author=current_user)
        db.session.add(article)
        db.session.commit()
        flash('Knowledge base article created successfully!', 'success')
        return redirect(url_for('kb.manage_kb_articles'))
    return render_template('kb/create_article.html', title='Create KB Article', form=form)

@kb_bp.route('/edit-article/<int:article_id>', methods=['GET', 'POST'])
@login_required
def edit_kb_article(article_id):
    article = KBArticle.query.get_or_404(article_id)
    if current_user.role != 'SupportAgent': # Or check if current_user is the author
        flash('You are not authorized to edit this article.', 'danger')
        return redirect(url_for('kb.article_list')) # Or 'kb.article_detail'

    form = KBArticleForm(obj=article) # Pre-populate form with article data
    if form.validate_on_submit():
        article.title = form.title.data
        article.content = form.content.data
        article.category = form.category.data
        db.session.commit()
        flash('Knowledge base article updated successfully!', 'success')
        return redirect(url_for('kb.manage_kb_articles'))
    return render_template('kb/edit_article.html', title='Edit KB Article', form=form, article=article)

@kb_bp.route('/manage-articles')
@login_required
def manage_kb_articles():
    if current_user.role != 'SupportAgent':
        flash('You are not authorized to manage knowledge base articles.', 'danger')
        return redirect(url_for('main.home'))
    articles = KBArticle.query.order_by(KBArticle.created_at.desc()).all()
    return render_template('kb/manage_articles.html', title='Manage KB Articles', articles=articles)

@kb_bp.route('/articles')
@login_required
def article_list():
    query = request.args.get('query', '')
    if query:
        articles = KBArticle.query.filter(
            db.or_(
                KBArticle.title.ilike(f'%{query}%'),
                KBArticle.content.ilike(f'%{query}%')
            )
        ).order_by(KBArticle.created_at.desc()).all()
    else:
        articles = KBArticle.query.order_by(KBArticle.created_at.desc()).all()
    return render_template('kb/article_list.html', title='Knowledge Base', articles=articles, query=query)

@kb_bp.route('/article/<int:article_id>')
@login_required
def article_detail(article_id):
    article = KBArticle.query.get_or_404(article_id)
    return render_template('kb/article_detail.html', title=article.title, article=article)

chatbot_bp = Blueprint('chatbot', __name__)

@chatbot_bp.route('/', methods=['GET'])
@login_required
def chatbot_ui():
    if current_user.role != 'EndUser':
        flash('Chatbot is available for End Users.', 'warning')
        return redirect(url_for('main.home'))
    return render_template('chatbot/chatbot_ui.html', title='Chatbot')

@chatbot_bp.route('/message', methods=['POST'])
@login_required
def chatbot_message():
    data = request.get_json()
    user_message = data.get('message', '').strip().lower()
    bot_response = "I'm sorry, I didn't quite understand that. Could you rephrase or ask something else?"
    create_ticket_prompt = False
    ticket_created_info = None

    if not user_message:
        bot_response = "Please type a message so I can help you."
    elif data.get('previous_intent') == 'create_ticket_prompt':
        ticket_title = "Chatbot Handoff"
        ticket_description = user_message 
        new_ticket = Ticket(title=ticket_title,
                            description=ticket_description,
                            author=current_user,
                            status="Open")
        db.session.add(new_ticket)
        db.session.commit()
        ticket_created_info = {'id': new_ticket.id, 'title': new_ticket.title}
        bot_response = f"I've created a new ticket for you: #{new_ticket.id} - '{new_ticket.title}'. A support agent will get back to you soon. You can view it <a href='{url_for('ticket.ticket_detail', ticket_id=new_ticket.id)}'>here</a>."
    elif "password reset" in user_message or "forgot password" in user_message:
        bot_response = "If you need to reset your password, you can find instructions in our knowledge base. Would you like me to search for 'password reset' articles, or would you like a direct link if available?"
    elif "ticket status" in user_message or "my ticket" in user_message:
        bot_response = f"You can check your ticket statuses on the <a href='{url_for('ticket.my_tickets')}'>My Tickets</a> page. If you have a specific ticket ID, please provide it, and I can try to look it up for you."
    elif "contact support" in user_message or "talk to agent" in user_message or "human" in user_message:
        bot_response = "I can help you create a support ticket. Please describe your issue, and I'll create a ticket for you."
        create_ticket_prompt = True
    else: # No specific rule matched, try KB
        articles = KBArticle.query.filter(
            db.or_(
                KBArticle.title.ilike(f'%{user_message}%'),
                KBArticle.content.ilike(f'%{user_message}%')
            )
        ).limit(2).all()

        if articles:
            response_parts = ["I found some articles that might help:"]
            for article in articles:
                response_parts.append(f"<br>- <a href='{url_for('kb.article_detail', article_id=article.id)}'>{article.title}</a>")
            bot_response = "".join(response_parts)
        else:
            # Fallback if no rules matched and no KB articles found
            bot_response = "I couldn't find any specific information matching your query. Would you like me to create a ticket for you so a support agent can assist?"
            create_ticket_prompt = True
    
    return jsonify({'response': bot_response, 'create_ticket_prompt': create_ticket_prompt, 'ticket_created_info': ticket_created_info})
