from rest_framework import serializers
from .models import User, Pharmacy, Medicine, PharmacyMedicine, Order, Delivery, RestockRequest, SupportTicket, Payment, DeliveryPartner, Notification, UserNotification, Cart, CartItem

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'full_name', 'password', 'role']

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            full_name=validated_data['full_name'],
            password=validated_data['password'],
            role=validated_data.get('role', 'user')
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'is_active', 'created_at']


class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = ['id', 'name', 'generic_name', 'dosage', 'unit']
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make these fields optional/allow blank
        self.fields['generic_name'].required = False
        self.fields['generic_name'].allow_blank = True
        self.fields['dosage'].required = False
        self.fields['dosage'].allow_blank = True
        self.fields['unit'].required = False
        self.fields['unit'].allow_blank = True


class PharmacyMedicineSerializer(serializers.ModelSerializer):
    medicine = MedicineSerializer(read_only=True)
    medicine_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = PharmacyMedicine
        fields = ['id', 'medicine', 'medicine_id', 'stock', 'price', 'status']


class PharmacySerializer(serializers.ModelSerializer):
    medicines = PharmacyMedicineSerializer(many=True, read_only=True)

    class Meta:
        model = Pharmacy
        fields = ['id', 'name', 'address', 'phone', 'is_verified', 'medicines']


class OrderSerializer(serializers.ModelSerializer):
    pharmacy_name = serializers.CharField(source='pharmacy.name', read_only=True)
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    delivery_partner_name = serializers.CharField(source='delivery_partner.full_name', read_only=True, allow_null=True)

    class Meta:
        model = Order
        fields = [
            'id', 'order_id', 'user', 'pharmacy', 'pharmacy_name', 'delivery_partner', 'delivery_partner_name',
            'medicine', 'medicine_name', 'quantity', 'total_price', 'delivery_required', 'delivery_address',
            'payment_status', 'order_status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['order_id', 'created_at', 'updated_at']


class DeliverySerializer(serializers.ModelSerializer):
    order = OrderSerializer(read_only=True)
    driver_name = serializers.CharField(source='driver.full_name', read_only=True, allow_null=True)

    class Meta:
        model = Delivery
        fields = ['id', 'order', 'driver', 'driver_name', 'status', 'pickup_address', 'delivery_address', 'distance_km', 'estimated_time', 'actual_time', 'created_at']


class RestockRequestSerializer(serializers.ModelSerializer):
    medicine = MedicineSerializer(read_only=True)
    medicine_id = serializers.IntegerField(write_only=True)
    requested_by = serializers.CharField(source='requested_by.email', read_only=True)

    class Meta:
        model = RestockRequest
        fields = ['id', 'pharmacy', 'medicine', 'medicine_id', 'quantity', 'status', 'requested_by', 'notes', 'created_at']
        read_only_fields = ['pharmacy', 'status', 'requested_by', 'created_at']


class PaymentSerializer(serializers.ModelSerializer):
    order_id = serializers.CharField(source='order.order_id', read_only=True)

    class Meta:
        model = Payment
        fields = ['id', 'order', 'order_id', 'amount', 'payment_method', 'transaction_id', 'status', 'payment_date']
        read_only_fields = ['transaction_id', 'payment_date']


class DeliveryPartnerSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = DeliveryPartner
        fields = [
            'id', 'user', 'user_email', 'user_name', 'vehicle_type', 'vehicle_number',
            'license_number', 'is_available', 'current_location', 'rating', 'total_deliveries',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SupportTicketSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = SupportTicket
        fields = ['id', 'user', 'user_email', 'pharmacy', 'subject', 'message', 'status', 'created_at']
        read_only_fields = ['user', 'pharmacy', 'status', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    order_id = serializers.CharField(source='order.order_id', read_only=True)
    medicine_name = serializers.CharField(source='order.medicine.name', read_only=True)
    delivery_address = serializers.CharField(source='order.delivery_address', read_only=True)
    pharmacy_name = serializers.CharField(source='order.pharmacy.name', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'order', 'order_id', 'notification_type', 'title', 'message', 
            'is_read', 'medicine_name', 'delivery_address', 'pharmacy_name', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CartItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.name', read_only=True)
    medicine_price = serializers.FloatField(source='medicine.price', read_only=True)
    pharmacy_name = serializers.CharField(source='pharmacy.name', read_only=True)
    subtotal = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CartItem
        fields = [
            'id', 'medicine', 'medicine_name', 'medicine_price', 
            'pharmacy', 'pharmacy_name', 'quantity', 'subtotal', 'added_at'
        ]
        read_only_fields = ['id', 'added_at']

    def get_subtotal(self, obj):
        return obj.get_subtotal()


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField(read_only=True)
    item_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Cart
        fields = ['id', 'items', 'total_price', 'item_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_price(self, obj):
        return obj.get_total_price()

    def get_item_count(self, obj):
        return obj.get_item_count()


class UserNotificationSerializer(serializers.ModelSerializer):
    order_id = serializers.CharField(source='order.order_id', read_only=True)
    
    class Meta:
        model = UserNotification
        fields = ['id', 'order', 'order_id', 'notification_type', 'title', 'message', 'otp', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']
