import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv() # This is the magic line that loads your .env file!

app = Flask(__name__)

#CORS(app)
CORS(app, resources={r"/*": {"origins": "*"}})

API_KEY = os.getenv('API_KEY')

# ── Helper: shape the raw API response ───────────
def format_weather(data):
    return {
        'city':      data['name'],
        'country':   data['sys']['country'],
        'temp':      round(data['main']['temp']),
        'feels':     round(data['main']['feels_like']),
        'humidity':  data['main']['humidity'],
        'wind':      round(data['wind']['speed'] * 3.6),
        'high':      round(data['main']['temp_max']),
        'low':       round(data['main']['temp_min']),
        'condition': data['weather'][0]['description'].capitalize()
    }

# ── Endpoint 1: search by city name ──────────────
@app.route('/weather')
def get_weather():
    city = request.args.get('city', '').strip()
    if not city:
        return jsonify({ 'error': 'No city provided' }), 400

    url      = f'https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric'
    response = requests.get(url)

    if response.status_code == 429:
        return jsonify({ 'error': 'Daily limit reached. Come back tomorrow.' }), 429
    if response.status_code != 200:
        return jsonify({ 'error': 'City not found. Check the spelling.' }), 404

    return jsonify(format_weather(response.json()))

# ── Endpoint 2: search by coordinates ────────────
@app.route('/weather-by-coords')
def get_weather_by_coords():
    lat = request.args.get('lat', '').strip()
    lon = request.args.get('lon', '').strip()

    if not lat or not lon:
        return jsonify({ 'error': 'No coordinates provided' }), 400

    url      = f'https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric'
    response = requests.get(url)

    if response.status_code == 429:
        return jsonify({ 'error': 'Daily limit reached. Come back tomorrow.' }), 429
    if response.status_code != 200:
        return jsonify({ 'error': 'City not found. Check the spelling.' }), 404
    
    return jsonify(format_weather(response.json()))

#New routes for health and /
@app.route("/")
def home():
    return "Backend is running 🚀"

@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# ── Start the server ──────────────────────────────
if __name__ == '__main__':
    app.run()