# Compatibility migration:
# The custom User model was already created in 0001_initial.
# Keeping 0002 as a no-op preserves the existing migration chain
# while allowing fresh databases and test databases to migrate cleanly.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('core', '0001_initial'),
    ]

    operations = []
