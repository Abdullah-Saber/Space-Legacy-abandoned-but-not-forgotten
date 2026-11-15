from rest_framework import serializers


class ChatHistorySerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=["user", "assistant"]
    )
    content = serializers.CharField(
        max_length=500,
        trim_whitespace=True
    )


class AIQuestionSerializer(serializers.Serializer):
    artifact_id = serializers.CharField(
        max_length=100,
        trim_whitespace=True
    )

    chapter_id = serializers.CharField(
        max_length=100,
        trim_whitespace=True
    )

    question = serializers.CharField(
        max_length=1000,
        trim_whitespace=True
    )

    history = ChatHistorySerializer(
        many=True,
        required=False,
        default=list
    )

    def validate_question(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Question cannot be empty."
            )
        return value
