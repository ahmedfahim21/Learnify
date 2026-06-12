from flask import Flask , jsonify, Blueprint, request
import openai
from dotenv import load_dotenv
import os

load_dotenv()

os.environ['OPENAI_API'] = os.getenv('OPEN_AI_API')



app = Flask(__name__)
chatBot = Blueprint('chatBot', __name__)


# ==== Helper Functions ====
@chatBot.route('/chatBot',methods=['POST'])
def talkToGPT():

    openai.api_key = os.environ['OPENAI_API']

    # Call the OpenAI API to generate a response
    context = request.get_json()['userInput']
    # print(context)

    response = openai.ChatCompletion.create(

        model="gpt-3.5-turbo",

        messages=[{

            "role": "system",

            "content": "You are a fun yet knowledgable assistant."

        }] + context,

        temperature=0.6,

        max_tokens=1000)
    
    res = response.choices[0].message.content
    
    return res


@chatBot.route('/chatBot2',methods=['POST'])
def chatBot2():
    openai.api_key = os.environ['OPENAI_API']
    model = request.get_json()['model']
    messages = request.get_json()['messages']
    response =  openai.ChatCompletion.create(

        model=model,

        messages=messages,

        temperature=0.6,

        max_tokens=1000)
    return response



