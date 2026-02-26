# Generated manually for order field updates

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('medicine', '0002_alter_user_options_medicine_order_delivery_orderitem_and_more'),
    ]

    operations = [
        # Remove the old status field
        migrations.RemoveField(
            model_name='order',
            name='status',
        ),
        # Remove the old total_amount field
        migrations.RemoveField(
            model_name='order',
            name='total_amount',
        ),
        # Remove the old notes field
        migrations.RemoveField(
            model_name='order',
            name='notes',
        ),
        # Add new fields
        migrations.AddField(
            model_name='order',
            name='delivery_address',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_partner',
            field=models.ForeignKey(blank=True, limit_choices_to={'role': 'delivery'}, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='assigned_deliveries', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='order',
            name='delivery_required',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='order',
            name='medicine',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, to='medicine.medicine'),
        ),
        migrations.AddField(
            model_name='order',
            name='order_status',
            field=models.CharField(choices=[('pending_pharmacy_confirmation', 'Pending Pharmacy Confirmation'), ('pharmacy_accepted', 'Pharmacy Accepted'), ('pharmacy_rejected', 'Pharmacy Rejected'), ('out_for_delivery', 'Out for Delivery'), ('delivered', 'Delivered'), ('cancelled', 'Cancelled')], default='pending_pharmacy_confirmation', max_length=30),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_status',
            field=models.CharField(choices=[('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed'), ('refunded', 'Refunded')], default='pending', max_length=20),
        ),
        migrations.AddField(
            model_name='order',
            name='quantity',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='order',
            name='total_price',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        # Create Payment model
        migrations.CreateModel(
            name='Payment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('payment_method', models.CharField(choices=[('card', 'Credit/Debit Card'), ('upi', 'UPI'), ('wallet', 'Digital Wallet'), ('cod', 'Cash on Delivery')], default='card', max_length=20)),
                ('transaction_id', models.CharField(blank=True, max_length=100, unique=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed'), ('refunded', 'Refunded')], default='pending', max_length=20)),
                ('payment_date', models.DateTimeField(auto_now_add=True)),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='payment', to='medicine.order')),
            ],
            options={
                'verbose_name': 'Payment',
                'verbose_name_plural': 'Payments',
                'ordering': ['-payment_date'],
            },
        ),
        # Create DeliveryPartner model
        migrations.CreateModel(
            name='DeliveryPartner',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('vehicle_type', models.CharField(default='Bike', max_length=50)),
                ('vehicle_number', models.CharField(blank=True, max_length=20)),
                ('license_number', models.CharField(blank=True, max_length=50)),
                ('is_available', models.BooleanField(default=True)),
                ('current_location', models.TextField(blank=True)),
                ('rating', models.FloatField(default=5.0)),
                ('total_deliveries', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='delivery_partner', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Delivery Partner',
                'verbose_name_plural': 'Delivery Partners',
            },
        ),
    ]