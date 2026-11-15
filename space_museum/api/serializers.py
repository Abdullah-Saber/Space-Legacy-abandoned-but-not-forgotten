from rest_framework import serializers


class AIQuestionSerializer(serializers.Serializer):
    artifact_id = serializers.CharField(max_length=100)
    chapter_id = serializers.CharField(max_length=100)
    question = serializers.CharField(
        max_length=1000,
        trim_whitespace=True
    )
    history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )

    def validate_question(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Question cannot be empty."
            )
        return value