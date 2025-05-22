from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_bcrypt import Bcrypt

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'  # Replace with a strong secret key
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'  # Using SQLite for simplicity

db = SQLAlchemy(app)
migrate = Migrate(app, db)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'auth.login'  # 'auth' is the blueprint name, 'login' is the route
login_manager.login_message_category = 'info'

# Import blueprints after app initialization to avoid circular imports
from views import auth_bp, main_bp, ticket_bp, kb_bp, chatbot_bp # Added chatbot_bp
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(main_bp)
app.register_blueprint(ticket_bp, url_prefix='/ticket')
app.register_blueprint(kb_bp, url_prefix='/kb')
app.register_blueprint(chatbot_bp, url_prefix='/chatbot') # Register chatbot_bp

if __name__ == '__main__':
    app.run(debug=True)
