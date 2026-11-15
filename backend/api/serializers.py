from rest_framework import serializers


class ChatHistorySerializer(serializers.Serializer):
    role = serializers.ChoiceField(
        choices=["user", "assistant"]
    )
    # `text` is the frontend contract; `content` remains accepted for clients
    # built against the original FastAPI RAG test wrapper.
    text = serializers.CharField(max_length=500, trim_whitespace=True, required=False)
    content = serializers.CharField(max_length=500, trim_whitespace=True, required=False)

    def validate(self, attrs):
        value = attrs.get("text") or attrs.get("content")
        if value is None:
            raise serializers.ValidationError("Provide either text or content.")
        attrs["content"] = value
        return attrs


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
