from flask import Flask, jsonify, render_template, request, redirect, url_for, session
import csv
import os
import shutil
import json
import argparse
from flask_dance.contrib.github import make_github_blueprint, github
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin
from waitress import serve
from extensions import db
from models import User, PokemonProgress
from db_helpers import *

load_dotenv() 

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "supersekrit")
app.config["GITHUB_OAUTH_CLIENT_ID"] = os.environ.get("GITHUB_OAUTH_CLIENT_ID")
app.config["GITHUB_OAUTH_CLIENT_SECRET"] = os.environ.get("GITHUB_OAUTH_CLIENT_SECRET")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///uxie.db"
# Default unrestricted mode from env; CLI flag can override in __main__
app.config["UNRESTRICTED_MODE"] = str(os.environ.get("UNRESTRICTED_MODE", "")).lower() in ("1", "true", "yes", "on")
db.init_app(app)

github_blueprint = make_github_blueprint(
    client_id=app.config["GITHUB_OAUTH_CLIENT_ID"],
    client_secret=app.config["GITHUB_OAUTH_CLIENT_SECRET"],
)
# github_blueprint = make_github_blueprint(client_id="Ov23liK6z1gyjZR9MY73", client_secret=app.secret_key)
app.register_blueprint(github_blueprint, url_prefix="/login")

cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

generationShinyEncounterMethods = {
    1: [],
    2: ["Coin Case Glitch"],
    3: ["Gen 3 Wild RNG", "Gen 3 Stationary RNG", "Glitzer Popping", "Other RNG (bonus disc, etc)"],
    4: ["Gen 4 Wild RNG", "Gen 4 Stationary RNG", "Gen 4 Egg RNG", "Cute Charm" , "Other RNG (Roaming, etc)", "Prev Gen Evo"],
    5: ["Gen 5 Wild RNG", "Gen 5 Stationary RNG", "Gen 5 Egg RNG"],
    6: ["Prev Gen Evo"],
    7: ["Gen 7 Wild RNG", "Gen 7 Stationary/Gift RNG", "Gen 7 Egg RNG"],
    8: ["Raid RNG", "Dynamax Adventure", "Full Odds", "BDSP Blink RNG", "PLA RNG", "Prev Gen Evo"],
    9: ["Masuda Method", "Mass Outbreak", "Sandwich (No Outbreak)", "Prev Gen Evo"],
    0: ["Community Day"] # Pokemon Go
}

ignore_methods = {"Community Day", "Prev Gen Evo"}


def load_pokemon():
    pokemons = {}
    with open('pokeapi/data/v2/csv/pokemon_species.csv', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if int(row['id']) < 10000:
                pokemons[row['identifier']] = row
    
    return pokemons

#auth helpers
def get_current_user():
    if not github.authorized:
        return None
    resp = github.get("/user")
    if not resp.ok:
        return None
    info = resp.json()
    user = get_or_create_user(info["id"], info["login"])
    return user

def is_logged_in():
    return get_current_user() is not None

pokemons = load_pokemon()

def build_tracker_context(user):
    save_data = get_progress_dict(user.id) if user else {}
    
    pokemon_list = []
    total_shiny_locked = 0
    total_caught = 0
    total_processing = 0
    total_pokemon = 0
    method_stats = {}
    with open('pokeapi/data/v2/csv/pokemon_species.csv', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if int(row['id']) < 10000:
                #row['image_url'] = f"static/sprites/{row['id']}.png"
                row['sprite_id'] = "sprite-" + row['id']
                total_pokemon += 1

                if(row['identifier'] in save_data):

                    # Get if caught
                    caught = save_data[row['identifier']].get('caught', False)
                    row['caught'] = caught
                    if(caught):
                        total_caught += 1

                    # Get if still processing
                    processing = save_data[row['identifier']].get('processing', False)
                    row['processing'] = processing
                    if(processing):
                        total_processing += 1

                    # Get if shiny locked
                    shinyLocked = save_data[row['identifier']].get('shinyLocked', False)
                    row['shinyLocked'] = shinyLocked
                    if(shinyLocked):
                        total_shiny_locked += 1

                    # Get last updated date
                    last_updatedProcessing = save_data[row['identifier']].get('lastUpdatedProcessing', None)
                    if(last_updatedProcessing):
                        row['lastUpdatedProcessing'] = last_updatedProcessing
                    else:
                        row['lastUpdatedProcessing'] = ""
                    
                    last_updated_caught = save_data[row['identifier']].get('lastUpdatedCaught', None)
                    if(last_updated_caught):
                        row['lastUpdatedCaught'] = last_updated_caught
                    else:
                        row['lastUpdatedCaught'] = ""

                    attempts = int(save_data[row['identifier']].get('attempts', 0))
                    if (attempts > 0):
                        row['attempts'] = attempts
                    else:
                        row['attempts'] = 0

                    

                    # Get if method and calc method stats
                    hunt_method = save_data[row['identifier']].get('huntMethod', "")
                    row['method'] = True if not hunt_method == "" else False
                    row['huntMethod'] = hunt_method
                    row['catchGeneration'] = save_data[row['identifier']].get('catchGeneration', 0)
                    if(hunt_method and not shinyLocked and hunt_method not in ignore_methods):
                        if hunt_method not in method_stats:
                            method_stats[hunt_method] = {
                                'caught': 0,
                                'processing': 0,
                                'total': 0,
                                'sum_attempts': 0,
                                'count_attempts': 0
                            }
                        
                        method_stats[hunt_method]['total'] += 1
                        if caught:
                            method_stats[hunt_method]['caught'] += 1
                        elif processing:
                            method_stats[hunt_method]['processing'] += 1
                        
                        attempts = int(save_data[row['identifier']].get('attempts', 0))
                        if attempts > 0:
                            method_stats[hunt_method]['sum_attempts'] += attempts
                            method_stats[hunt_method]['count_attempts'] += 1

                else:
                    row['caught'] = False
                    row['processing'] = False
                    row['shinyLocked'] = False
                    row['method'] = False
                    row['attempts'] = 0

                pokemon_list.append(row)

        for method, stats in method_stats.items():
            if stats['count_attempts'] > 0:
                avg_attempts = stats['sum_attempts'] / stats['count_attempts']
            else:
                avg_attempts = 0
            
            for gen, methods in generationShinyEncounterMethods.items():
                if method in methods:
                    stats['catchGeneration'] = gen
                    break
            stats['average_attempts'] = avg_attempts
            stats.pop('sum_attempts')

        stats = {
            "total_caught": total_caught,
            "total_processing": total_processing,
            "total_shiny_locked": total_shiny_locked,
            "total_pokemon": total_pokemon,
            "method_stats": method_stats
        }

    return pokemon_list, stats

def render_tracker(profile_user, viewer):
    pokemon_list, stats = build_tracker_context(profile_user)
    can_edit = (
        viewer is not None
        and profile_user is not None
        and viewer.id == profile_user.id
    )
    return render_template(
        "index.html",
        pokemons=pokemon_list,
        stats=stats,
        can_edit=can_edit,
        viewer=viewer,
        profile_user=profile_user,
    )

@app.route('/')
def home():
    auth = app.config.get("UNRESTRICTED_MODE", False) or is_logged_in()

    viewer = get_current_user()
    return render_tracker(profile_user=viewer, viewer=viewer)

@app.route("/u/<username>")
def public_profile(username):
    profile_user = get_user_by_login(username)
    if profile_user is None:
        return render_template("404.html"), 404 
    viewer = get_current_user()
    return render_tracker(profile_user=profile_user, viewer=viewer)

# Writes data to database based on user id
@app.route('/save', methods=['POST'])
def save_pokemon_data():
    # For saving, check if the user is authenticated 
    
    user = get_current_user()
    if not user:
        return jsonify({"error": "You are not allowed to write data."}), 403
    
    # Handle save request
    data = request.get_json()
    if not data or 'identifier' not in data:
        return jsonify({"error": "Pokemon identifier is required"}), 400
    
    pokemon_id = data['identifier']
   
    update_pokemon_progress(user.id, pokemon_id, data)
  
    return jsonify({"message": "Data saved"})

# Fetches your own saved data about pokemon
@app.route('/getPokemonData/<identifier>', methods=['GET'])
def get_pokemon_data(identifier):
   
    user = get_current_user()
    if not user:
        return jsonify({})

    pokemon = get_pokemon_progress(user.id, identifier)
    if not pokemon:
        return jsonify({"message": "Pokemon not found"})
    else:
        return jsonify(pokemon)

# Fetches saved data about pokemon based on any username
@app.route("/getPokemonData/<username>/<identifier>", methods=["GET"])
def get_pokemon_data_public(username, identifier):
    profile_user = get_user_by_login(username)
    if profile_user is None:
        return jsonify({"error": "User not found"}), 404
    pokemon = get_pokemon_progress(profile_user.id, identifier)
    return jsonify(pokemon or {})

# Get shiny encounter methods
@app.route('/huntMethods/<pokemon_name>', methods=['GET'])
def get_encounter_info(pokemon_name):
    if pokemon_name in pokemons:
        generation = int(pokemons[pokemon_name]["generation_id"])   
        shiny_methods = {}
        for gen in range(generation, max(generationShinyEncounterMethods.keys()) + 1):
            methods = generationShinyEncounterMethods.get(gen, [])
            shiny_methods[gen] = methods

        shiny_methods[0] = generationShinyEncounterMethods[0]
        return jsonify(shiny_methods)
    else:
        return jsonify({"error": "Pokemon not found"}), 404
    
# Download save file
@app.route('/downloadSave')
def download_save():
    user = get_current_user()
    if not user:
        return jsonify({"error": "You are not allowed to download data."}), 403
    save_data = get_progress_dict(user.id)
    return jsonify(save_data)

# Upload save file
@app.route('/uploadSave', methods=['POST'])
def upload_save():
    # For saving, check if the user is authenticated
   
    user = get_current_user()
    if not user:
        return jsonify({"error": "You are not allowed to write data."}), 403


    data = request.get_json()
    if not data:
        return jsonify({"error": "No data found"}), 400
   
    for pokemon_id, progress in data.items():
        update_pokemon_progress(user.id, pokemon_id, progress)

    return jsonify({"message": "Save data uploaded"})

@app.route("/logout")
def logout():
    """Logs out the user by removing the GitHub OAuth token from the session."""
    session.pop("github_oauth_token", None)  # Remove GitHub token
    return redirect(url_for("home"))  # Redirect to homepage


# -------- Stats utilities and route -------- #
def _parse_time_to_seconds(time_str):
    """Parses a HH:MM:SS duration string to total seconds. Returns 0 on invalid."""
    if not time_str or not isinstance(time_str, str):
        return 0
    parts = time_str.split(":")
    if len(parts) != 3:
        return 0
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = int(parts[2])
        total_seconds = hours * 3600 + minutes * 60 + seconds
        return max(total_seconds, 0)
    except Exception:
        return 0

def build_stats(user):
    method_to_entries = {}

    # user = get_current_user()
    save_data = get_progress_dict(user.id) if user else {}
    for identifier, data in save_data.items():
        method = data.get('huntMethod')
        if not method:
            continue
        # Raw values; allow frontend to filter zeros and dedupe on time
        attempts_value = 0
        time_seconds_value = 0
        try:
            attempts_value = int(data.get('attempts', 0) or 0)
        except Exception:
            attempts_value = 0
        time_seconds_value = _parse_time_to_seconds(data.get('time', None))

        entry = {
            'identifier': identifier,
            'attempts': attempts_value,
            'time_seconds': time_seconds_value,
            'catchGeneration': data.get('catchGeneration', None),
            'caught': data.get('caught', False),
            'processing': data.get('processing', False),
            'shinyLocked': data.get('shinyLocked', False),
        }

        if method not in method_to_entries:
            method_to_entries[method] = []
        method_to_entries[method].append(entry)
    return method_to_entries
    
def render_stats(profile_user, viewer):
    method_entries = build_stats(profile_user)
       
    return render_template(
        "stats.html",
        method_entries=method_entries,
        viewer=viewer,
        profile_user=profile_user,
        auth=app.config.get("UNRESTRICTED_MODE", False) or (github.authorized if 'github' in globals() else False)
    )

@app.route('/stats')

def stats_page():
    """Renders a stats page with per-method raw data for the frontend to analyze.

    We pass un-aggregated entries so the frontend can compute histograms, std dev,
    outliers, etc. Entries contain both attempts and time (seconds). Consumers can
    discard zeros per-dimension and deduplicate on time as needed.
    """
    
    # Render the page with raw JSON injected; frontend script will analyze
    viewer = get_current_user()
    if not viewer:
        return redirect(url_for("home"))  # or render empty / login prompt
    return render_stats(profile_user=viewer, viewer=viewer)

@app.route("/u/<username>/stats")
def public_stats(username):
    profile_user = get_user_by_login(username)
    if profile_user is None:
        return render_template("404.html"), 404
    viewer = get_current_user()
    return render_stats(profile_user=profile_user, viewer=viewer)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run the Pokedex Tracker app.')
    parser.add_argument('--unrestricted', action='store_true', help='Disable authentication restrictions for debug purposes')
    parser.add_argument('--port', type=int, default=80, help='Port to run the server on (default: 80)')
    parser.add_argument('--host', type=str, default='0.0.0.0', help='Host to bind (default: 0.0.0.0)')
    args = parser.parse_args()

    # CLI flag overrides env
    if args.unrestricted:
        app.config["UNRESTRICTED_MODE"] = True

    with app.app_context():
        db.create_all()

    serve(app, host=args.host, port=args.port)
    #app.run(host=args.host, port=args.port, debug=True)
