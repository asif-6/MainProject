from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin

class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None, role="user"):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)

        user = self.model(
            email=email,
            full_name=full_name,
            role=role
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None):
        user = self.create_user(
            email=email,
            full_name=full_name,
            password=password,
            role="admin"
        )
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("user", "User"),
        ("pharmacy", "Pharmacy"),
        ("delivery", "Delivery"),
    ]

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    groups = models.ManyToManyField(
        'auth.Group',
        related_name='medicine_user_groups',
        blank=True
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='medicine_user_permissions',
        blank=True
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return f"{self.email} ({self.role})"

class Pharmacy(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='pharmacy')
    name = models.CharField(max_length=255)
    address = models.TextField()
    phone = models.CharField(max_length=20)
    license_number = models.CharField(max_length=100, unique=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pharmacy"
        verbose_name_plural = "Pharmacies"

    def __str__(self):
        return self.name


class Medicine(models.Model):
    name = models.CharField(max_length=255)
    generic_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100)
    unit = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Medicine"
        verbose_name_plural = "Medicines"
        unique_together = ('name', 'dosage')

    def __str__(self):
        return f"{self.name} ({self.dosage})"


class PharmacyMedicine(models.Model):
    STOCK_STATUS = [
        ("in_stock", "In Stock"),
        ("low_stock", "Low Stock"),
        ("out_of_stock", "Out of Stock"),
    ]

    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='medicines')
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE)
    stock = models.PositiveIntegerField(default=0)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=20, choices=STOCK_STATUS, default='in_stock')
    low_stock_threshold = models.PositiveIntegerField(default=20)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pharmacy Medicine"
        verbose_name_plural = "Pharmacy Medicines"
        unique_together = ('pharmacy', 'medicine')

    def __str__(self):
        return f"{self.pharmacy.name} - {self.medicine.name}"


class RestockRequest(models.Model):
    STATUS_CHOICES = [
        ("requested", "Requested"),
        ("approved", "Approved"),
        ("fulfilled", "Fulfilled"),
        ("rejected", "Rejected"),
    ]

    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE, related_name='restock_requests')
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='restock_requests')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Restock Request"
        verbose_name_plural = "Restock Requests"
        ordering = ['-created_at']

    def __str__(self):
        return f"Restock {self.medicine.name} x{self.quantity} for {self.pharmacy.name}"


class SupportTicket(models.Model):
    STATUS_CHOICES = [
        ("open", "Open"),
        ("closed", "Closed"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets')
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Support Ticket"
        verbose_name_plural = "Support Tickets"
        ordering = ['-created_at']

    def __str__(self):
        return f"Ticket {self.id} by {self.user.email} - {self.subject}"


class Order(models.Model):
    ORDER_STATUS = [
        ("pending_pharmacy_confirmation", "Pending Pharmacy Confirmation"),
        ("pharmacy_accepted", "Pharmacy Accepted"),
        ("pharmacy_rejected", "Pharmacy Rejected"),
        ("out_for_delivery", "Out for Delivery"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]

    PAYMENT_STATUS = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.SET_NULL, null=True, related_name='orders')
    delivery_partner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_deliveries', limit_choices_to={'role': 'delivery'})
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, null=True, default=1)
    quantity = models.PositiveIntegerField(default=1)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    delivery_required = models.BooleanField(default=False)
    delivery_address = models.TextField(blank=True)
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS, default='pending')
    order_status = models.CharField(max_length=30, choices=ORDER_STATUS, default='pending_pharmacy_confirmation')
    order_id = models.CharField(max_length=20, default='TEMP')  # Removed unique=True to allow grouping multiple medicines
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Order"
        verbose_name_plural = "Orders"
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {self.order_id}"


class Payment(models.Model):
    PAYMENT_METHODS = [
        ("card", "Credit/Debit Card"),
        ("upi", "UPI"),
        ("wallet", "Digital Wallet"),
        ("cod", "Cash on Delivery"),
    ]

    REFUND_STATUS = [
        ("no_refund", "No Refund"),
        ("pending", "Pending"),
        ("initiated", "Initiated"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='card')
    transaction_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Order.PAYMENT_STATUS, default='pending')
    payment_date = models.DateTimeField(auto_now_add=True)
    
    # Refund fields
    refund_status = models.CharField(max_length=20, choices=REFUND_STATUS, default='no_refund')
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    refund_transaction_id = models.CharField(max_length=100, blank=True, null=True)
    refund_reason = models.TextField(blank=True, null=True)
    refund_initiated_at = models.DateTimeField(blank=True, null=True)
    refund_completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        verbose_name = "Payment"
        verbose_name_plural = "Payments"
        ordering = ['-payment_date']

    def __str__(self):
        return f"Payment for {self.order.order_id}"


class DeliveryPartner(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='delivery_partner')
    vehicle_type = models.CharField(max_length=50, default="Bike")
    vehicle_number = models.CharField(max_length=20, blank=True)
    license_number = models.CharField(max_length=50, blank=True)
    is_available = models.BooleanField(default=True)
    current_location = models.TextField(blank=True)
    rating = models.FloatField(default=5.0)
    total_deliveries = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Delivery Partner"
        verbose_name_plural = "Delivery Partners"

    def __str__(self):
        return f"{self.user.full_name} - {self.vehicle_type}"


class Delivery(models.Model):
    DELIVERY_STATUS = [
        ("pending", "Pending"),
        ("assigned", "Assigned"),
        ("at_pickup", "At Pickup"),
        ("in_transit", "In Transit"),
        ("delivered", "Delivered"),
        ("failed", "Failed"),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='delivery')
    driver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='deliveries', limit_choices_to={'role': 'delivery'})
    status = models.CharField(max_length=20, choices=DELIVERY_STATUS, default='pending')
    pickup_address = models.TextField()
    delivery_address = models.TextField()
    distance_km = models.FloatField(default=0)
    estimated_time = models.PositiveIntegerField(help_text="Estimated time in minutes", default=30)
    actual_time = models.PositiveIntegerField(null=True, blank=True, help_text="Actual delivery time in minutes")
    otp = models.CharField(max_length=6, blank=True, null=True, help_text="OTP for delivery verification")
    otp_generated_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when OTP was generated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Delivery"
        verbose_name_plural = "Deliveries"
        ordering = ['-created_at']

    def __str__(self):
        return f"Delivery for {self.order.order_id}"


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ("new_delivery_order", "New Delivery Order"),
        ("order_accepted", "Order Accepted"),
        ("order_rejected", "Order Rejected"),
        ("delivery_assigned", "Delivery Assigned"),
        ("delivery_completed", "Delivery Completed"),
    ]

    delivery_partner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', limit_choices_to={'role': 'delivery'})
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES, default='new_delivery_order')
    title = models.CharField(max_length=255)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.delivery_partner.email} - {self.notification_type}"


class UserNotification(models.Model):
    """Notifications for customers (users)"""
    NOTIFICATION_TYPES = [
        ("delivery_otp", "Delivery OTP"),
        ("order_status", "Order Status Update"),
        ("delivery_completed", "Delivery Completed"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_notifications')
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='user_notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES, default='order_status')
    title = models.CharField(max_length=255)
    message = models.TextField()
    otp = models.CharField(max_length=6, blank=True, null=True, help_text="OTP for delivery verification")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Notification"
        verbose_name_plural = "User Notifications"
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.email} - {self.notification_type}"


class Cart(models.Model):
    """Shopping cart for users to add multiple medicines before checkout"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Cart"
        verbose_name_plural = "Carts"

    def __str__(self):
        return f"Cart for {self.user.email}"

    def get_total_price(self):
        """Calculate total price of all items in cart"""
        return sum(item.get_subtotal() for item in self.items.all())

    def get_item_count(self):
        """Get total number of items in cart"""
        return sum(item.quantity for item in self.items.all())


class CartItem(models.Model):
    """Individual item in a shopping cart"""
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE)
    pharmacy = models.ForeignKey(Pharmacy, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('cart', 'medicine', 'pharmacy')
        verbose_name = "Cart Item"
        verbose_name_plural = "Cart Items"

    def __str__(self):
        return f"{self.medicine.name} in {self.pharmacy.name}"

    def get_subtotal(self):
        """Calculate subtotal for this cart item"""
        try:
            pharmacy_medicine = PharmacyMedicine.objects.get(
                pharmacy=self.pharmacy,
                medicine=self.medicine
            )
            return pharmacy_medicine.price * self.quantity
        except PharmacyMedicine.DoesNotExist:
            return 0