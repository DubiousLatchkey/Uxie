# Whenever pokeapi is updated, run this script to update encounters and sprites

import csv
import os
import shutil
import json

# Update Sprites
def check_and_copy_sprites():
    source_folder = 'pokeapi/data/v2/sprites/sprites/pokemon/shiny'
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



# encounters_data = load_encounters()
# with open('static/encounters.json', 'w', encoding='utf-8') as jsonfile:
#     json.dump(encounters_data, jsonfile, ensure_ascii=False, indent=4)

check_and_copy_sprites()
