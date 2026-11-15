import json

from django.conf import settings


def load_missions_data():
    file_path = settings.BASE_DIR / "data" / "missions.json"

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


def get_all_planets():
    data = load_missions_data()
    return data["planets"]


def get_missions_by_planet(planet_id):
    data = load_missions_data()

    return [
        mission
        for mission in data["missions"]
        if mission["planet"] == planet_id
    ]


def get_mission_by_id(mission_id):
    data = load_missions_data()

    for mission in data["missions"]:
        if mission["id"] == mission_id:
            return mission

    return None