# Generated by Django 4.2.10 on 2024-03-16 14:05

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('user_management', '0020_organization_is_grafana_labels_enabled'),
        ('auth_token', '0004_alter_pluginauthtoken_organization'),
    ]

    operations = [
        migrations.CreateModel(
            name='GoogleOAuth2Token',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('access_token', models.CharField(max_length=500)),
                ('refresh_token', models.CharField(max_length=500)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='google_auth_token_set', to='user_management.user')),
            ],
        ),
    ]
