import os
import requests
import threading
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv() # This is the magic line that loads your .env file!

app = Flask(__name__)
CORS(app)

API_KEY = os.getenv('API_KEY')

# ── Limits ────────────────────────────────────────
GLOBAL_LIMIT = 1000   # total API calls allowed per day across all users
IP_LIMIT     = 100    # max calls one IP can make per day

# ── Counters (live in RAM, reset at midnight) ─────
daily_total    = 0          # how many real API calls made today (global)
request_counts = {}         # { "ip_address": count, ... }

# ── Midnight reset ────────────────────────────────
def reset_counts():
    global daily_total, request_counts
    daily_total    = 0       # wipe the global counter
    request_counts = {}      # wipe every IP's counter
    # Schedule this same function to run again in 24 hours
    threading.Timer(86400, reset_counts).start()

# Only start the timer in the real server process.
# Flask debug mode spawns two processes — a file watcher (parent)
# and the actual server (child). WERKZEUG_RUN_MAIN is only set
# in the child. Without this check the timer starts twice and
# throws a socket error on Windows when the parent shuts down.
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
    reset_counts()

# ── Rate limit checker ────────────────────────────
# Returns a dict with 'blocked' True/False and a message.
# Checks global first, then per-IP.
def check_limits(ip):
    global daily_total
    # 1. Check global
    if daily_total >= GLOBAL_LIMIT:
        return {
            'blocked': True,
            'error': f'This app has reached its daily limit of {GLOBAL_LIMIT} requests. Come back tomorrow.'
        }

    # 2. Check per-IP
    ip_count = request_counts.get(ip, 0)
    if ip_count >= IP_LIMIT:
        return {
            'blocked': True,
            'error': f'You have reached your daily limit of {IP_LIMIT} requests. Come back tomorrow.'
        }

    # 3. Not blocked — increment both counters
    daily_total += 1
    request_counts[ip] = ip_count + 1

    return { 'blocked': False }

# ── Helper: get real IP (works on Render too) ─────
def get_ip():
    return request.headers.get('X-Forwarded-For', request.remote_addr)

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

# ── Endpoint: usage stats ─────────────────────────
# Your frontend can call this to show users how many
# requests are left today.
# Example: GET /status
@app.route('/status')
def status():
    ip       = get_ip()
    ip_count = request_counts.get(ip, 0)
    return jsonify({
        'global_used':      daily_total,
        'global_remaining': max(0, GLOBAL_LIMIT - daily_total),
        'your_used':        ip_count,
        'your_remaining':   max(0, IP_LIMIT - ip_count)
    })

# ── Endpoint 1: search by city name ──────────────
@app.route('/weather')
def get_weather():
    ip     = get_ip()
    limit  = check_limits(ip)

    if limit['blocked']:
        return jsonify({ 'error': limit['error'] }), 429

    city = request.args.get('city', '').strip()
    if not city:
        return jsonify({ 'error': 'No city provided' }), 400

    url      = f'https://api.openweathermap.org/data/2.5/weather?q={city}&appid={API_KEY}&units=metric'
    response = requests.get(url)

    if response.status_code != 200:
        # THIS WILL PRINT THE REAL ERROR IN YOUR TERMINAL
        print("🚨 REAL OWM ERROR:", response.text) 
        return jsonify({ 'error': 'City not found' }), 404

    if response.status_code != 200:
        return jsonify({ 'error': 'City not found. Check the spelling and try again.' }), 404

    return jsonify(format_weather(response.json()))

# ── Endpoint 2: search by coordinates ────────────
@app.route('/weather-by-coords')
def get_weather_by_coords():
    ip    = get_ip()
    limit = check_limits(ip)

    if limit['blocked']:
        return jsonify({ 'error': limit['error'] }), 429

    lat = request.args.get('lat', '').strip()
    lon = request.args.get('lon', '').strip()

    if not lat or not lon:
        return jsonify({ 'error': 'No coordinates provided' }), 400

    url      = f'https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={API_KEY}&units=metric'
    response = requests.get(url)

    if response.status_code != 200:
        return jsonify({ 'error': 'Location not found.' }), 404

    return jsonify(format_weather(response.json()))

# ── Start the server ──────────────────────────────
if __name__ == '__main__':
    app.run(debug=True)