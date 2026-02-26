from django.core.management.base import BaseCommand
from medicine.models import User


class Command(BaseCommand):
    help = 'Create an admin user'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Admin email')
        parser.add_argument('--password', type=str, help='Admin password')
        parser.add_argument('--name', type=str, help='Admin full name')

    def handle(self, *args, **options):
        email = options['email'] or input('Enter admin email: ')
        password = options['password'] or input('Enter admin password: ')
        full_name = options['name'] or input('Enter admin full name: ')

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.WARNING(f'Admin user with email {email} already exists'))
            return

        user = User.objects.create_superuser(
            email=email,
            full_name=full_name,
            password=password
        )

        self.stdout.write(self.style.SUCCESS(f'Admin user created successfully: {email}'))
