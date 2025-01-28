from flask import Flask, jsonify, render_template, request, redirect, url_for
import csv
import os
import shutil
import json

app = Flask(__name__)



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


save_data = load_or_create_save()

@app.route('/')
def home():
    pokemon_list = []
    with open('pokeapi/data/v2/csv/pokemon_species.csv', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if int(row['id']) < 10000:
                row['image_url'] = f"static/sprites/{row['id']}.png"

                # Get if caught
                if(row['identifier'] in save_data):
                    row['caught'] = save_data[row['identifier']]['caught']
                else:
                    row['caught'] = False

                pokemon_list.append(row)

        return render_template('index.html', pokemons=pokemon_list)

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


if __name__ == '__main__':
    app.run(debug=True)