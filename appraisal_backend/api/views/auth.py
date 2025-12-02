from rest_framework.views import APIView
from rest_framework.response import Response

class LoginAPI(APIView):
    def post(self, request):
        username = request.data.get("username")
        role = request.data.get("role", "faculty")

        return Response({
            "message": "Login successful",
            "access": "DUMMY_ACCESS_TOKEN",
            "refresh": "DUMMY_REFRESH_TOKEN",
            "username": username,
            "role": role
        })
