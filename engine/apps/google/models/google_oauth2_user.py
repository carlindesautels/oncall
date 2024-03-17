from django.db import models
from mirage import fields as mirage_fields


class GoogleOAuth2User(models.Model):

    id = models.AutoField(primary_key=True)
    user = models.OneToOneField(to="user_management.User", null=False, blank=False,
                                related_name="google_oauth2_user", on_delete=models.CASCADE)
    google_user_id = models.CharField(max_length=100)
    access_token = mirage_fields.EncryptedCharField(max_length=300)
    refresh_token = mirage_fields.EncryptedCharField(max_length=300)
    oauth_scope = models.TextField(max_length=30000)
    created_at = models.DateTimeField(auto_now_add=True)
