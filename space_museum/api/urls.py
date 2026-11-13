from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health_check, name="health"),
    path("planets/", views.planets_list, name="planets-list"),
    path(
        "planets/<str:planet>/missions/",
        views.planet_missions,
        name="planet-missions"
    ),
    path(
        "missions/<str:mission_id>/",
        views.mission_details,
        name="mission-details"
    ),
    path("ai/ask/", views.ask_ai, name="ask-ai"),
]