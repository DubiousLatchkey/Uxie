from flask import Flask, render_template, request, redirect, url_for
import csv
import os
import shutil

app = Flask(__name__)


# Update sprites assets
def check_and_copy_sprites():
    source_folder = 'pokeapi/data/v2/sprites/sprites/pokemon'
    destination_folder = 'static/sprites'
    
    if not os.path.exists(destination_folder):
        os.makedirs(destination_folder)
    
    source_files = set(os.listdir(source_folder))
    destination_files = set(os.listdir(destination_folder))
    
    if source_files != destination_files:
        for file_name in source_files:
            full_file_name = os.path.join(source_folder, file_name)
            if os.path.isfile(full_file_name):
                shutil.copy(full_file_name, destination_folder)

check_and_copy_sprites()


@app.route('/')
def home():
    pokemon_list = []
    with open('pokeapi/data/v2/csv/pokemon.csv', newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if int(row['id']) < 10000:
                row['image_url'] = f"static/sprites/{row['id']}.png"
                pokemon_list.append(row)
        return render_template('index.html', pokemons=pokemon_list)

if __name__ == '__main__':
    app.run(debug=True)