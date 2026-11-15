from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .services import (
    get_all_planets,
    get_missions_by_planet,
    get_mission_by_id,
)
from .serializers import AIQuestionSerializer


@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def planets_list(request):
    return Response(get_all_planets())


@api_view(["GET"])
def planet_missions(request, planet):
    missions = get_missions_by_planet(planet)

    if not missions:
        return Response(
            {"error": "Planet not found or has no missions."},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response(missions)


@api_view(["GET"])
def mission_details(request, mission_id):
    mission = get_mission_by_id(mission_id)

    if mission is None:
        return Response(
            {"error": "Mission not found."},
            status=status.HTTP_404_NOT_FOUND
        )

    return Response(mission)


@api_view(["POST"])
def ask_ai(request):
    serializer = AIQuestionSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response(
        {"error": "AI integration is not configured yet."},
        status=status.HTTP_503_SERVICE_UNAVAILABLE
    )