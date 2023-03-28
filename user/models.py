from urllib.parse import urlparse

from django.db import models
from django.contrib.auth.models import User
from encrypted_model_fields.fields import EncryptedCharField
# Create your models here.


class MastodonServer(models.Model):
    api_base_url = models.CharField(max_length=100)
    client_id = EncryptedCharField(max_length=500)
    client_secret = EncryptedCharField(max_length=500)


    @staticmethod
    def standardize_servername(server):
        # Parse server url
        if server.startswith("https://"):
            server = "https://" + urlparse(server).netloc
        else:
            server = "https://" + server
        return server


class MastodonUser(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="mastodon")
    username = models.CharField(max_length=100)
    userId = models.CharField(max_length=100, null=True)
    server = models.ForeignKey(
        MastodonServer, on_delete=models.CASCADE, null=True, related_name="users")
    token = EncryptedCharField(max_length=200)
    last_updated = models.DateTimeField(auto_now=True)
