from extensions import db
from models import User, PokemonProgress

MAP = {
    "caught": "caught",
    "processing": "processing",
    "shinyLocked": "shiny_locked",
    "huntMethod": "hunt_method",
    "catchGeneration": "catch_generation",
    "attempts": "attempts",
    "time": "time",
    "notes": "notes",
    "lastUpdatedCaught": "last_updated_caught",
    "lastUpdatedProcessing": "last_updated_processing",
}

def progress_row_to_dict(row):
    return {api_key: getattr(row, attr) for api_key, attr in MAP.items()}

def get_user_by_login(github_login):
    return User.query.filter(
        db.func.lower(User.github_login) == github_login.lower()
    ).first()

#gets or creates a user, if the login changes, update it
def get_or_create_user(github_id, github_login):
    user = User.query.filter_by(github_id=github_id).first()
    if user is None:
        user = User(github_id=github_id, github_login=github_login)
        db.session.add(user)
    elif user.github_login != github_login:
        user.github_login = github_login
    db.session.commit()
    return user

#return entire save file
def get_progress_dict(user_id):
    rows = PokemonProgress.query.filter_by(user_id=user_id).all()
    return {row.pokemon_id: progress_row_to_dict(row) for row in rows}

#return a single pokemon's progress
def get_pokemon_progress(user_id, pokemon_id):
    row = PokemonProgress.query.filter_by(
        user_id=user_id,
        pokemon_id=pokemon_id
    ).first()
    if row is None:
        return None
    return progress_row_to_dict(row)

def update_pokemon_progress(user_id, pokemon_id, data):
    row = PokemonProgress.query.filter_by(
        user_id=user_id,
        pokemon_id=pokemon_id
    ).first()
    if row is None:
        row = PokemonProgress(user_id=user_id, pokemon_id=pokemon_id)
        db.session.add(row)
    for key, value in data.items():
        if key != 'identifier':
            attr = MAP.get(key)
            if attr is not None:
                setattr(row, attr, value)
    db.session.commit()
