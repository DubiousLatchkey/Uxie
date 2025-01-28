from flask import Flask, jsonify, render_template, request, redirect, url_for
import csv
import os
import shutil
import json

app = Flask(__name__)

generationShinyEncounterMethods = {
    1: [],
    2: ["Coin Case Glitch"],
    3: ["Gen 3 Wild RNG", "Gen 3 Stationary RNG", "Glitzer Popping"],
    4: ["Gen 4 Wild RNG", "Gen 4 Stationary RNG", "Gen 4 Egg RNG", "Cute Charm"],
    5: ["Gen 5 Wild RNG", "Gen 5 Stationary RNG", "Gen 5 Egg RNG"],
    6: [],
    7: ["Gen 7 Wild RNG", "Gen 7 Stationary/Gift RNG", "Gen 7 Egg RNG"],
    8: ["Raid RNG", "Dynamax Adventure", "Full Odds"],
    9: ["Masuda Method", "Mass Outbreak", "Sandwich (No Outbreak)"]
}

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
    pokemon_list = []
    with open('pokeapi/data/v2/csv/pokemon_species.csv', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if int(row['id']) < 10000:
                row['image_url'] = f"static/sprites/{row['id']}.png"

                # Get if caught
                if(row['identifier'] in save_data and 'caught' in save_data[row['identifier']]):
                    row['caught'] = save_data[row['identifier']]['caught']
                else:
                    row['caught'] = False

                pokemon_list.append(row)

        return render_template('index.html', pokemons=pokemon_list)

# Writes data to save.json
@app.route('/save', methods=['POST'])
def save_pokemon_data():
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
    
    return redirect(url_for('home'))

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
        return jsonify(shiny_methods)
    else:
        return jsonify({"error": "Pokemon not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)