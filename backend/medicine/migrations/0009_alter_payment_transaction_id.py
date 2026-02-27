from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('medicine', '0008_payment_refund_amount_payment_refund_completed_at_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payment',
            name='transaction_id',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
