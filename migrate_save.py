from main import app, db
from db_helpers import get_or_create_user, update_pokemon_progress
import json

with app.app_context():
    user = get_or_create_user(6687923, "DubiousLatchkey")
    save_file = 'save.json'
    with open(save_file, 'r') as f:
        save_data = json.load(f)
    for pkm_id in save_data:
        update_pokemon_progress(user.id, pkm_id, save_data[pkm_id])