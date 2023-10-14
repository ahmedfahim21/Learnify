from flask import Flask

app = Flask(__name__)

# Import the routes for GET and POST requests
from getGlimpse import getGlimpse
# from server2 import post_routes
from getTopics import get_Modules
from getArticle import get_Article
from getQuiz import get_Quiz
from chatBot import chatBot

# Register the blueprints
app.register_blueprint(getGlimpse)
# app.register_blueprint(post_routes)
app.register_blueprint(get_Modules)
app.register_blueprint(get_Article)
app.register_blueprint(get_Quiz)
app.register_blueprint(chatBot)

# @app.route('/', methods=['GET'])
# def test():
#     return 'The server is running!'

if __name__ == '__main__':
    app.run(debug=True,host='0.0.0.0')
