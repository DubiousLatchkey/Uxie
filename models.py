from extensions import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    github_id = db.Column(db.Integer, unique=True, nullable=False)
    github_login = db.Column(db.String(80), unique=True, nullable=False)


class PokemonProgress(db.Model):
    __tablename__ = "pokemon_progress"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    pokemon_id = db.Column(db.String(80), nullable=False)  # "pikachu"

    caught = db.Column(db.Boolean, default=False)
    processing = db.Column(db.Boolean, default=False)
    shiny_locked = db.Column(db.Boolean, default=False)
    hunt_method = db.Column(db.String(120), default="")
    catch_generation = db.Column(db.String, default=0)
    attempts = db.Column(db.Integer, default=0)
    time = db.Column(db.String(20), default="00:00:00") 
    notes = db.Column(db.Text, default="")
    last_updated_caught = db.Column(db.String(20), nullable=True)
    last_updated_processing = db.Column(db.String(20), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("user_id", "pokemon_id", name="uq_user_pokemon"),
    )