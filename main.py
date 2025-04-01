from flask import Flask, jsonify, render_template, request, redirect, url_for, session
import csv
import os
import shutil
import json
from flask_dance.contrib.github import make_github_blueprint, github
from dotenv import load_dotenv
from flask_cors import CORS, cross_origin
from waitress import serve

load_dotenv() 

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "supersekrit")
app.config["GITHUB_OAUTH_CLIENT_ID"] = os.environ.get("GITHUB_OAUTH_CLIENT_ID")
app.config["GITHUB_OAUTH_CLIENT_SECRET"] = os.environ.get("GITHUB_OAUTH_CLIENT_SECRET")

github_blueprint = make_github_blueprint(client_id="Ov23liK6z1gyjZR9MY73", client_secret=app.secret_key)
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

def load_or_create_save():
    save_file = 'save.json'
    if os.path.exists(save_file):
        with open(save_file, 'r') as f:
            save_data = json.load(f)
    else:
        save_data = {}
        with open(save_file, 'w') as f:
            json.dump(save_data, f)
    return save_data

# def load_encounters():
#     encounters_file = 'static/encounters.json'
#     if os.path.exists(encounters_file):
#         with open(encounters_file, 'r') as f:
#             encounters_data = json.load(f)
#     else:
#         encounters_data = {}
#         with open(encounters_file, 'w') as f:
#             json.dump(encounters_data, f)
#     return encounters_data

def load_pokemon():
    pokemons = {}
    with open('pokeapi/data/v2/csv/pokemon_species.csv', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if int(row['id']) < 10000:
                pokemons[row['identifier']] = row
    
    return pokemons

# encounters_data = load_encounters()
save_data = load_or_create_save()
pokemons = load_pokemon()

@app.route('/')
def home():
    auth = False
    if(github.authorized):
        resp = github.get("/user")
        if not resp.ok:
            return "Failed to fetch user info from GitHub", 500
        
        github_info = resp.json()
        username = github_info.get("login")

        if(username == os.environ.get("AUTHORIZED_USER")):
            auth = True
        else:
            print(username, " not allowed to write")
    
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

        return render_template('index.html', pokemons=pokemon_list, stats=stats, auth=auth)

# Writes data to save.json
@app.route('/save', methods=['POST'])
def save_pokemon_data():

    # For saving, check if the user is authenticated and is you
    if not github.authorized:
        return jsonify({"error": "Unauthorized"}), 401

    resp = github.get("/user")
    if not resp.ok:
        return jsonify({"error": "Failed to fetch user info"}), 500

    username = resp.json().get("login")
    if username != os.environ.get("AUTHORIZED_USER"):
        return jsonify({"error": "You are not allowed to write data."}), 403
    
    # Handle save request
    data = request.get_json()
    if not data or 'identifier' not in data:
        return jsonify({"error": "Pokemon identifier is required"}), 400
    
    pokemon_id = data['identifier']
    
    if pokemon_id not in save_data:
        save_data[pokemon_id] = {}
    
    for key, value in data.items():
        if key != 'identifier':
            save_data[pokemon_id][key] = value
    
    with open('save.json', 'w') as f:
        json.dump(save_data, f)
    
    return jsonify({"message": "Data saved"})

# Fetches saved data about pokemon
@app.route('/getPokemonData/<identifier>', methods=['GET'])
def get_pokemon_data(identifier):
    if identifier in save_data:
        return jsonify(save_data[identifier])
    else:
        return jsonify({"message": "Pokemon not found"})

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
    return jsonify(save_data)

# Upload save file
@app.route('/uploadSave', methods=['POST'])
def upload_save():

    # For saving, check if the user is authenticated and is you
    if not github.authorized:
        return jsonify({"error": "Unauthorized"}), 401

    resp = github.get("/user")
    if not resp.ok:
        return jsonify({"error": "Failed to fetch user info"}), 500

    username = resp.json().get("login")
    if username != os.environ.get("AUTHORIZED_USER"):
        return jsonify({"error": "You are not allowed to write data."}), 403


    data = request.get_json()
    if not data:
        return jsonify({"error": "No data found"}), 400
    
    with open('save.json', 'w') as f:
        json.dump(data, f)

    global save_data
    save_data = load_or_create_save()

    return jsonify({"message": "Save data uploaded"})

@app.route("/logout")
def logout():
    """Logs out the user by removing the GitHub OAuth token from the session."""
    session.pop("github_oauth_token", None)  # Remove GitHub token
    return redirect(url_for("home"))  # Redirect to homepage


if __name__ == '__main__':
    serve(app, host="0.0.0.0", port=80)
    #app.run(host="0.0.0.0", port=80, debug=True)