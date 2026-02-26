from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from medicine.models import Pharmacy
import uuid

User = get_user_model()

class Command(BaseCommand):
    help = 'Add a Pharmacy record to a pharmacy user'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Email of the pharmacy user')
        parser.add_argument('--name', type=str, help='Pharmacy name (defaults to user full_name or email)')
        parser.add_argument('--address', type=str, help='Pharmacy address', default='')
        parser.add_argument('--phone', type=str, help='Pharmacy phone', default='')

    def handle(self, *args, **options):
        email = options['email']
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User with email {email} not found'))
            return

        if user.role != 'pharmacy':
            self.stdout.write(self.style.ERROR(f'User {email} is not a pharmacy partner (role: {user.role})'))
            return

        # Check if pharmacy already exists
        if hasattr(user, 'pharmacy') and user.pharmacy:
            self.stdout.write(self.style.WARNING(f'Pharmacy already exists for {email}'))
            return

        # Create pharmacy
        pharmacy_name = options.get('name') or getattr(user, 'full_name', '') or user.email
        address = options.get('address', '')
        phone = options.get('phone', '')
        license_num = f"LICENSE-{user.id}-{uuid.uuid4().hex[:8].upper()}"

        try:
            pharmacy = Pharmacy.objects.create(
                user=user,
                name=pharmacy_name,
                address=address,
                phone=phone,
                license_number=license_num,
                is_verified=False,
            )
            self.stdout.write(self.style.SUCCESS(
                f'✓ Pharmacy created successfully for {email}\n'
                f'  ID: {pharmacy.id}\n'
                f'  Name: {pharmacy.name}\n'
                f'  License: {pharmacy.license_number}'
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error creating pharmacy: {str(e)}'))
