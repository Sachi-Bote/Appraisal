# Generated manually for additive optional reference_link field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_appraisal_appraisals_faculty_89fe62_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='reference_link',
            field=models.TextField(blank=True, null=True),
        ),
    ]
