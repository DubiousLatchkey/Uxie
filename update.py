# Whenever pokeapi is updated, run this script to update encounters and sprites

import csv
import os
import shutil
import json
from PIL import Image, UnidentifiedImageError, ImageFile
import base64
import io

# Update Sprites
def check_and_copy_sprites():
    source_folder = 'pokeapi/data/v2/sprites/sprites/pokemon/shiny'
    destination_folder = 'static/spritesPreProcessed'
    
    if not os.path.exists(destination_folder):
        os.makedirs(destination_folder)
    
    source_files = set(os.listdir(source_folder))
    destination_files = set(os.listdir(destination_folder))
    
    if source_files != destination_files:
        for file_name in source_files:
            full_file_name = os.path.join(source_folder, file_name)
            if os.path.isfile(full_file_name):
                shutil.copy(full_file_name, destination_folder)


# DEPRECATED: Encounters have not been updated by pokeapi
# Update Encounters (process table and make pokemon indexable json)
def load_encounters():
    encounters_file = 'pokeapi/data/v2/csv/encounters.csv'
    versions_file = 'pokeapi/data/v2/csv/version_names.csv'
    locations_file = 'pokeapi/data/v2/csv/location_names.csv'
    location_areas_file = 'pokeapi/data/v2/csv/location_areas.csv'
    pokemon_file = 'pokeapi/data/v2/csv/pokemon_species.csv'
    encounters = []

    pokemonToEncounters = {} # pokemon name -> game -> location list

    with open(encounters_file, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            encounters.append(row)

    versions = {}
    with open(versions_file, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if(row['local_language_id'] == '9'):
                versions[row['version_id']] = row['name']

    # Location + Area are combined
    locations = {}
    with open(locations_file, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if(row['local_language_id'] == '9'):
                locations[row['location_id']] = row['name']

    location_areas = {}
    with open(location_areas_file, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            if(row['location_id'] in locations):
                if(len(row['identifier']) > 0):
                    location_areas[row['id']] = locations[row['location_id']] + " " + row['identifier']
                else:
                    location_areas[row['id']] = locations[row['location_id']]
            else:
                location_areas[row['id']] = row['identifier']

    pokemons = {}
    with open(pokemon_file, newline='') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            pokemons[row['id']] = row['identifier']


    # Make Dict
    for pokemon in pokemons.items():
        pokemonToEncounters[pokemon[1]] = {}

    
        for encounter in encounters:
            if encounter['pokemon_id'] == pokemon[0]:
                game = versions[encounter['version_id']]
                location = location_areas[encounter['location_area_id']]

                if game not in pokemonToEncounters[pokemon[1]]:
                    pokemonToEncounters[pokemon[1]][game] = set()

                pokemonToEncounters[pokemon[1]][game].add(location)

        for game in pokemonToEncounters[pokemon[1]]:
            pokemonToEncounters[pokemon[1]][game] = list(pokemonToEncounters[pokemon[1]][game])
        #print(pokemonToEncounters[pokemon[1]])

    
    return pokemonToEncounters

# No good sprite generator?  Fine, I'll do it myself
def make_spritesheet():
    css = ""
    sprites = []
    spritesFolder = os.path.join('static', 'spritesPreProcessed')

    # load sprites from static/spritesPreProcessed
    for file in os.listdir(spritesFolder):
        numbersInFilename = ''.join([i for i in filter(str.isdigit, file)])
        if(len(numbersInFilename) == 0):
            numbersInFilename = 0
        else:
            numbersInFilename = int(numbersInFilename)
        if file.endswith('.png') and numbersInFilename < 10000:
            try:
                sprite = Image.open(os.path.join(spritesFolder, file))
                sprites.append((sprite, file[:-4]))
            except UnidentifiedImageError:
                print(f"error: PIL could not open {file}, attempting to load truncated")

                ImageFile.LOAD_TRUNCATED_IMAGES = True
                with open(os.path.join(spritesFolder, file), "rb") as image_file:
                    encoded_string = base64.b64encode(image_file.read())
                    image_data = base64.b64decode(encoded_string)
                    sprite = Image.open(io.BytesIO(image_data)).convert('RGBA')
                
                sprites.append((sprite, file[:-4]))
                ImageFile.LOAD_TRUNCATED_IMAGES = False
                


    # sort sprites by size from biggest to smallest
    sprites.sort(key=lambda x: x[0].size[0] * x[0].size[1], reverse=True)

    # create spritesheet
    sheet_width = 4096
    sheet_height = 4096
    spritesheet = Image.new('RGBA', (sheet_width, sheet_height))
    x_offset = 0
    y_offset = 0
    max_height_in_row = 0

    for sprite, name in sprites:
        sprite = sprite.resize((96, 96), Image.NEAREST)

        sprite_width, sprite_height = sprite.size

        if x_offset + sprite_width > sheet_width:
            x_offset = 0
            y_offset += max_height_in_row
            max_height_in_row = 0

        if y_offset + sprite_height > sheet_height:
            print("error: spritesheet too small")
            break  # No more space on the spritesheet

        spritesheet.paste(sprite, (x_offset, y_offset))
        css += f".sprite-{name} {{ background: url('spritesheet.png') -{x_offset}px -{y_offset}px; width: {sprite_width}px; height: {sprite_height}px; }}\n"
        x_offset += sprite_width
        max_height_in_row = max(max_height_in_row, sprite_height)

    spritesheet.save('static/spritesheet.png')

    # write css to file
    with open('static/spritesheet.css', 'w') as f:
        f.write(css)
    



# encounters_data = load_encounters()
# with open('static/encounters.json', 'w', encoding='utf-8') as jsonfile:
#     json.dump(encounters_data, jsonfile, ensure_ascii=False, indent=4)

check_and_copy_sprites()
make_spritesheet()