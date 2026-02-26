from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth import get_user_model
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
import razorpay
from .serializers import (
    SignupSerializer, UserSerializer, PharmacySerializer, MedicineSerializer,
    PharmacyMedicineSerializer, OrderSerializer, DeliverySerializer,
    RestockRequestSerializer, SupportTicketSerializer, PaymentSerializer, DeliveryPartnerSerializer,
    NotificationSerializer, UserNotificationSerializer,
)
from .models import Pharmacy, Medicine, PharmacyMedicine, Order, Delivery, RestockRequest, SupportTicket, Payment, DeliveryPartner, Notification, UserNotification

User = get_user_model()

# Initialize Razorpay client
razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        role = request.data.get("role")

        if not email or not password:
            return Response(
                {"message": "Email and password required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"message": "Invalid email or password"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password):
            return Response(
                {"message": "Invalid email or password"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if user.role != role:
            return Response(
                {"message": f"User is not registered as {role}"},
                status=status.HTTP_403_FORBIDDEN
            )

        token, _ = Token.objects.get_or_create(user=user)

        # If user is a pharmacy partner but has no Pharmacy record, create one automatically
        if user.role == 'pharmacy':
            try:
                # Check if Pharmacy already exists
                pharmacy = user.pharmacy
            except Pharmacy.DoesNotExist:
                try:
                    # Create a basic Pharmacy record tied to this user
                    license_num = f"AUTO-{user.id}-{int(timezone.now().timestamp())}"
                    pharmacy = Pharmacy.objects.create(
                        user=user,
                        name=getattr(user, 'full_name', '') or user.email,
                        address="",
                        phone="",
                        license_number=license_num,
                        is_verified=False,
                    )
                    print(f"[LOGIN] Created Pharmacy record for user {user.email}: {pharmacy.id}")
                except Exception as e:
                    print(f"[LOGIN ERROR] Failed to create Pharmacy for {user.email}: {str(e)}")
                    import traceback
                    traceback.print_exc()

        return Response({
            "token": token.key,
            "role": user.role,
            "email": user.email,
            "message": "Login successful"
        }, status=status.HTTP_200_OK)

class SignupView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                "message": "Signup successful",
                "token": token.key,
                "role": user.role,
                "email": user.email
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Pharmacy Dashboard Views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pharmacy_dashboard(request):
    """Get pharmacy dashboard data"""
    try:
        pharmacy = request.user.pharmacy
    except Pharmacy.DoesNotExist:
        return Response(
            {"error": "User is not a pharmacy"},
            status=status.HTTP_403_FORBIDDEN
        )

    # Calculate statistics
    total_medicines = pharmacy.medicines.count()
    low_stock_count = pharmacy.medicines.filter(status='low_stock').count()
    critical_stock_count = pharmacy.medicines.filter(status='out_of_stock').count()
    
    # Today's orders
    today = timezone.now().date()
    today_orders = pharmacy.orders.filter(created_at__date=today).count()
    
    # Revenue calculation
    today_revenue = pharmacy.orders.filter(created_at__date=today).aggregate(
        total=Sum('total_amount')
    )['total'] or 0

    stats = {
        "total_medicines": total_medicines,
        "low_stock_items": low_stock_count,
        "today_orders": today_orders,
        "revenue": str(today_revenue),
    }

    # Get medicines with low stock
    medicines = PharmacyMedicineSerializer(
        pharmacy.medicines.all().order_by('-updated_at')[:5],
        many=True
    ).data

    # Get recent orders
    recent_orders = OrderSerializer(
        pharmacy.orders.all()[:10],
        many=True
    ).data

    # Weekly sales data
    weekly_sales = []
    for i in range(7):
        date = today - timedelta(days=i)
        day_sales = pharmacy.orders.filter(
            created_at__date=date
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        weekly_sales.append({
            "day": date.strftime('%a'),
            "sales": float(day_sales)
        })
    weekly_sales.reverse()

    return Response({
        "stats": stats,
        "medicines": medicines,
        "recent_orders": recent_orders,
        "weekly_sales": weekly_sales,
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """Return current authenticated user's profile info."""
    user = request.user
    return Response({
        "id": getattr(user, "id", None),
        "email": getattr(user, "email", ""),
        "full_name": getattr(user, "full_name", "") if hasattr(user, "full_name") else "",
        "role": getattr(user, "role", ""),
    })
# Delivery Dashboard Views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def delivery_dashboard(request):
    """Get delivery dashboard data"""
    
    try:
        # Check if user is admin or delivery personnel
        if request.user.role not in ['admin', 'delivery']:
            return Response(
                {"error": "Unauthorized access"},
                status=status.HTTP_403_FORBIDDEN
            )

        today = timezone.now().date()
        
        # Calculate statistics
        active_deliveries = Delivery.objects.filter(
            status__in=['assigned', 'at_pickup', 'in_transit']
        ).count()
        
        completed_today = Delivery.objects.filter(
            status='delivered',
            created_at__date=today
        ).count()
        
        pending_deliveries = Delivery.objects.filter(status='pending').count()
        
        # Calculate average delivery time safely
        completed_count = Delivery.objects.filter(
            actual_time__isnull=False
        ).count()
        
        if completed_count > 0:
            avg_time_result = Delivery.objects.filter(
                actual_time__isnull=False
            ).aggregate(avg=Sum('actual_time'))['avg'] / completed_count
            avg_time = int(avg_time_result) if avg_time_result else 0
        else:
            avg_time = 0

        stats = {
            "active_deliveries": active_deliveries,
            "completed_today": completed_today,
            "pending_orders": pending_deliveries,
            "avg_delivery_time": f"{avg_time} min",
        }

        # Get active deliveries
        active = Delivery.objects.filter(
            status__in=['assigned', 'at_pickup', 'in_transit']
        ).select_related('order', 'driver')[:10]
        active_deliveries_data = DeliverySerializer(active, many=True).data

        # Performance metrics
        metrics = {
            "on_time_rate": "94.2%",
            "satisfaction": "4.8/5.0",
            "avg_order_value": "$42.50",
        }

        # Driver performance (if user is admin)
        driver_performance = []
        if request.user.role == 'admin':
            drivers = User.objects.filter(role='delivery')
            for driver in drivers:
                completed_by_driver = driver.deliveries.filter(
                    status='delivered'
                ).count()
                rating = 4.8  # Can be calculated from actual reviews
                driver_performance.append({
                    "driver": driver.full_name,
                    "deliveries": completed_by_driver,
                    "rating": rating,
                })

        return Response({
            "stats": stats,
            "active_deliveries": active_deliveries_data,
            "metrics": metrics,
            "driver_performance": driver_performance,
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        print(f"Error in delivery_dashboard: {str(e)}")
        return Response(
            {"error": f"Failed to fetch delivery dashboard data: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response({
        "stats": stats,
        "active_deliveries": active_deliveries_data,
        "metrics": metrics,
        "driver_performance": driver_performance,
    }, status=status.HTTP_200_OK)


# Viewsets for CRUD operations
class PharmacyViewSet(viewsets.ModelViewSet):
    queryset = Pharmacy.objects.all()
    serializer_class = PharmacySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Pharmacy.objects.all()
        elif self.request.user.role == 'pharmacy':
            # Pharmacy users should only see their own pharmacy
            return Pharmacy.objects.filter(user=self.request.user)
        # Regular users and delivery partners can see all pharmacies
        return Pharmacy.objects.all()


class MedicineViewSet(viewsets.ModelViewSet):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated]


class PharmacyMedicineViewSet(viewsets.ModelViewSet):
    queryset = PharmacyMedicine.objects.all()
    serializer_class = PharmacyMedicineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return PharmacyMedicine.objects.all()
        elif hasattr(self.request.user, 'pharmacy'):
            return PharmacyMedicine.objects.filter(pharmacy=self.request.user.pharmacy)
        return PharmacyMedicine.objects.none()

    def perform_create(self, serializer):
        # Ensure the requesting user is a pharmacy and set pharmacy automatically
        pharmacy = getattr(self.request.user, 'pharmacy', None)
        if pharmacy is None:
            raise PermissionDenied("User is not a pharmacy")

        stock = serializer.validated_data.get('stock', 0)
        # use model default threshold if not provided
        low_threshold = 20
        # determine status based on stock
        if stock <= 0:
            status = 'out_of_stock'
        elif stock <= low_threshold:
            status = 'low_stock'
        else:
            status = 'in_stock'

        serializer.save(pharmacy=pharmacy, status=status)

    def perform_update(self, serializer):
        # Ensure pharmacy stays tied to the user's pharmacy and update status if stock changes
        pharmacy = getattr(self.request.user, 'pharmacy', None)
        if pharmacy is None:
            raise PermissionDenied("User is not a pharmacy")

        stock = serializer.validated_data.get('stock', None)
        # If stock provided, adjust status accordingly
        if stock is not None:
            low_threshold = 20
            if stock <= 0:
                status = 'out_of_stock'
            elif stock <= low_threshold:
                status = 'low_stock'
            else:
                status = 'in_stock'
            serializer.save(pharmacy=pharmacy, status=status)
        else:
            # No stock change, ensure pharmacy remains set
            serializer.save(pharmacy=pharmacy)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Order.objects.all()
        elif hasattr(self.request.user, 'pharmacy'):
            return Order.objects.filter(pharmacy=self.request.user.pharmacy, payment_status='paid')
        return Order.objects.filter(user=self.request.user)


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.all()
    serializer_class = DeliverySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return Delivery.objects.all()
        elif self.request.user.role == 'delivery':
            return Delivery.objects.filter(driver=self.request.user)
        return Delivery.objects.none()


class RestockRequestViewSet(viewsets.ModelViewSet):
    queryset = RestockRequest.objects.all()
    serializer_class = RestockRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return RestockRequest.objects.all()
        elif hasattr(self.request.user, 'pharmacy'):
            return RestockRequest.objects.filter(pharmacy=self.request.user.pharmacy)
        return RestockRequest.objects.none()

    def perform_create(self, serializer):
        pharmacy = getattr(self.request.user, 'pharmacy', None)
        if pharmacy is None:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only pharmacy users can create restock requests")

        medicine_id = serializer.validated_data.get('medicine_id')
        try:
            medicine = Medicine.objects.get(id=medicine_id)
        except Medicine.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'medicine_id': 'Invalid medicine id'})

        serializer.save(pharmacy=pharmacy, medicine=medicine, requested_by=self.request.user)


class SupportTicketViewSet(viewsets.ModelViewSet):
    queryset = SupportTicket.objects.all()
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return SupportTicket.objects.all()
        return SupportTicket.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        pharmacy = getattr(self.request.user, 'pharmacy', None)
        serializer.save(user=self.request.user, pharmacy=pharmacy)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only admins can see all users
        if self.request.user.role == 'admin':
            # Filter by role if provided
            role = self.request.query_params.get('role', None)
            if role:
                return User.objects.filter(role=role)
            return User.objects.all()
        # Non-admin users can only see themselves
        return User.objects.filter(id=self.request.user.id)

    def create(self, request, *args, **kwargs):
        # Only admins can create users
        if request.user.role != 'admin':
            return Response({"error": "Only admins can create users"}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        # Only admins can delete users
        if request.user.role != 'admin':
            return Response({"error": "Only admins can delete users"}, status=status.HTTP_403_FORBIDDEN)
        
        # Prevent admins from deleting themselves
        user_to_delete = self.get_object()
        if user_to_delete.id == request.user.id:
            return Response({"error": "You cannot delete your own account"}, status=status.HTTP_400_BAD_REQUEST)
        
        return super().destroy(request, *args, **kwargs)


# Ordering Workflow APIs
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_order(request):
    """Create a new order"""
    if request.user.role != 'user':
        return Response({"error": "Only users can create orders"}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    medicine_id = data.get('medicine_id')
    pharmacy_id = data.get('pharmacy_id')
    quantity = data.get('quantity', 1)
    delivery_required = data.get('delivery_required', False)
    delivery_address = data.get('delivery_address', '')
    requested_order_id = data.get('order_id')

    try:
        medicine = Medicine.objects.get(id=medicine_id)
        pharmacy = Pharmacy.objects.get(id=pharmacy_id)
    except (Medicine.DoesNotExist, Pharmacy.DoesNotExist):
        return Response({"error": "Invalid medicine or pharmacy"}, status=status.HTTP_400_BAD_REQUEST)

    # Check if pharmacy has this medicine
    try:
        pharmacy_medicine = PharmacyMedicine.objects.get(pharmacy=pharmacy, medicine=medicine)
        if pharmacy_medicine.stock < quantity:
            return Response({"error": "Insufficient stock"}, status=status.HTTP_400_BAD_REQUEST)
        price = pharmacy_medicine.price
    except PharmacyMedicine.DoesNotExist:
        return Response({"error": "Medicine not available at this pharmacy"}, status=status.HTTP_400_BAD_REQUEST)

    total_price = price * quantity

    # Generate or reuse order ID (used by cart flow to group multiple medicines)
    import uuid
    order_id = requested_order_id if requested_order_id else f"ORD-{uuid.uuid4().hex[:8].upper()}"

    order = Order.objects.create(
        user=request.user,
        pharmacy=pharmacy,
        medicine=medicine,
        quantity=quantity,
        total_price=total_price,
        delivery_required=delivery_required,
        delivery_address=delivery_address,
        order_id=order_id
    )

    serializer = OrderSerializer(order)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_razorpay_order(request, order_id):
    """Create Razorpay order for payment"""
    try:
        order = Order.objects.get(order_id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    if order.payment_status == 'paid':
        return Response({"error": "Order already paid"}, status=status.HTTP_400_BAD_REQUEST)

    # Create Razorpay order
    amount_in_paise = int(float(order.total_price) * 100)  # Convert to paise
    
    razorpay_order_data = {
        'amount': amount_in_paise,
        'currency': 'INR',
        'receipt': order.order_id,
        'notes': {
            'order_id': order.order_id,
            'medicine': order.medicine.name if order.medicine else 'N/A',
            'pharmacy': order.pharmacy.name if order.pharmacy else 'N/A'
        }
    }

    try:
        razorpay_order = razorpay_client.order.create(data=razorpay_order_data)
        
        return Response({
            'razorpay_order_id': razorpay_order['id'],
            'razorpay_key_id': settings.RAZORPAY_KEY_ID,
            'amount': amount_in_paise,
            'currency': 'INR',
            'order_id': order.order_id,
            'order_details': OrderSerializer(order).data
        }, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({
            "error": f"Failed to create Razorpay order: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_cart_razorpay_order(request):
    """Create a single Razorpay order for multiple orders"""
    order_ids = request.data.get('order_ids', [])
    if not isinstance(order_ids, list) or not order_ids:
        return Response({"error": "order_ids list is required"}, status=status.HTTP_400_BAD_REQUEST)

    orders = Order.objects.filter(order_id__in=order_ids, user=request.user)
    if not orders.exists():
        return Response({"error": "No valid orders found"}, status=status.HTTP_404_NOT_FOUND)

    unpaid_orders = orders.filter(payment_status='pending')
    if not unpaid_orders.exists():
        return Response({"error": "All orders are already paid"}, status=status.HTTP_400_BAD_REQUEST)

    total_amount = sum(float(order.total_price) for order in unpaid_orders)
    amount_in_paise = int(total_amount * 100)

    receipt_id = f"CART-{int(timezone.now().timestamp())}"
    razorpay_order_data = {
        'amount': amount_in_paise,
        'currency': 'INR',
        'receipt': receipt_id,
        'notes': {
            'order_ids': ','.join([order.order_id for order in unpaid_orders])
        }
    }

    try:
        razorpay_order = razorpay_client.order.create(data=razorpay_order_data)

        return Response({
            'razorpay_order_id': razorpay_order['id'],
            'razorpay_key_id': settings.RAZORPAY_KEY_ID,
            'amount': amount_in_paise,
            'currency': 'INR',
            'order_ids': [order.order_id for order in unpaid_orders],
            'receipt': receipt_id
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            "error": f"Failed to create Razorpay order: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_razorpay_payment(request, order_id):
    """Verify Razorpay payment signature and update order"""
    try:
        order = Order.objects.get(order_id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    razorpay_order_id = request.data.get('razorpay_order_id')
    razorpay_payment_id = request.data.get('razorpay_payment_id')
    razorpay_signature = request.data.get('razorpay_signature')

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        return Response({
            "error": "Missing payment verification data"
        }, status=status.HTTP_400_BAD_REQUEST)

    # Verify signature
    try:
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }
        
        razorpay_client.utility.verify_payment_signature(params_dict)
        
        # Payment verified successfully - create payment record
        payment = Payment.objects.create(
            order=order,
            amount=order.total_price,
            payment_method='razorpay',
            transaction_id=razorpay_payment_id,
            status='paid'
        )

        # Update order status
        order.payment_status = 'paid'
        order.save()

        return Response({
            "message": "Payment verified successfully",
            "transaction_id": razorpay_payment_id,
            "order": OrderSerializer(order).data
        }, status=status.HTTP_200_OK)
    
    except razorpay.errors.SignatureVerificationError:
        # Payment verification failed
        Payment.objects.create(
            order=order,
            amount=order.total_price,
            payment_method='razorpay',
            transaction_id=razorpay_payment_id,
            status='failed'
        )
        
        order.payment_status = 'failed'
        order.save()
        
        return Response({
            "error": "Payment verification failed"
        }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        return Response({
            "error": f"Payment verification error: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_cart_razorpay_payment(request):
    """Verify Razorpay payment for multiple orders"""
    order_ids = request.data.get('order_ids', [])
    razorpay_order_id = request.data.get('razorpay_order_id')
    razorpay_payment_id = request.data.get('razorpay_payment_id')
    razorpay_signature = request.data.get('razorpay_signature')

    if not isinstance(order_ids, list) or not order_ids:
        return Response({"error": "order_ids list is required"}, status=status.HTTP_400_BAD_REQUEST)

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature]):
        return Response({
            "error": "Missing payment verification data"
        }, status=status.HTTP_400_BAD_REQUEST)

    orders = Order.objects.filter(order_id__in=order_ids, user=request.user)
    if not orders.exists():
        return Response({"error": "No valid orders found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        params_dict = {
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        }

        razorpay_client.utility.verify_payment_signature(params_dict)

        updated_orders = []
        for order in orders:
            if order.payment_status == 'paid':
                continue

            Payment.objects.create(
                order=order,
                amount=order.total_price,
                payment_method='razorpay',
                transaction_id=f"{razorpay_payment_id}:{order.order_id}",
                status='paid'
            )
            order.payment_status = 'paid'
            order.save()
            updated_orders.append(order.order_id)

        return Response({
            "message": "Payment verified successfully",
            "transaction_id": razorpay_payment_id,
            "orders": updated_orders
        }, status=status.HTTP_200_OK)

    except razorpay.errors.SignatureVerificationError:
        for order in orders:
            if order.payment_status != 'paid':
                Payment.objects.create(
                    order=order,
                    amount=order.total_price,
                    payment_method='razorpay',
                    transaction_id=f"{razorpay_payment_id}:{order.order_id}",
                    status='failed'
                )
                order.payment_status = 'failed'
                order.save()

        return Response({
            "error": "Payment verification failed"
        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response({
            "error": f"Payment verification error: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_payment(request, order_id):
    """Process payment for an order (Legacy - for non-Razorpay methods)"""
    try:
        order = Order.objects.get(order_id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    if order.payment_status == 'paid':
        return Response({"error": "Order already paid"}, status=status.HTTP_400_BAD_REQUEST)

    # Mock payment processing for COD or other methods
    payment_method = request.data.get('payment_method', 'card')
    transaction_id = f"TXN-{order_id}-{int(timezone.now().timestamp())}"

    # Create payment record
    payment = Payment.objects.create(
        order=order,
        amount=order.total_price,
        payment_method=payment_method,
        transaction_id=transaction_id,
        status='paid'
    )

    # Update order status
    order.payment_status = 'paid'
    order.save()

    return Response({
        "message": "Payment successful",
        "transaction_id": transaction_id,
        "order": OrderSerializer(order).data
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pharmacy_accept_order(request, order_id):
    """Pharmacy accepts or rejects all orders with the same order_id"""
    try:
        # Get pharmacy
        try:
            pharmacy = request.user.pharmacy
        except Pharmacy.DoesNotExist:
            return Response({"error": "User is not a pharmacy"}, status=status.HTTP_403_FORBIDDEN)
        
        # Get all orders with this order_id for this pharmacy
        orders = Order.objects.filter(order_id=order_id, pharmacy=pharmacy)
        
        if not orders.exists():
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        # Payment must be completed before pharmacy can act on order
        if orders.exclude(payment_status='paid').exists():
            return Response({
                "error": "Payment is not completed for this order"
            }, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get('action')  # 'accept' or 'reject'
        
        # Check if all orders are in pending state
        for order in orders:
            if order.order_status != 'pending_pharmacy_confirmation':
                return Response({
                    "error": f"Order {order_id} is not in pending state"
                }, status=status.HTTP_400_BAD_REQUEST)

        if action == 'accept':
            # First, check stock availability for all medicines
            stock_errors = []
            pharmacy_medicines_to_update = []
            
            for order in orders:
                if order.medicine:
                    try:
                        pharmacy_medicine = PharmacyMedicine.objects.get(
                            pharmacy=pharmacy,
                            medicine=order.medicine
                        )
                        
                        # Check if sufficient stock is available
                        if pharmacy_medicine.stock < order.quantity:
                            stock_errors.append({
                                'medicine': order.medicine.name,
                                'available': pharmacy_medicine.stock,
                                'required': order.quantity
                            })
                        else:
                            pharmacy_medicines_to_update.append({
                                'pharmacy_medicine': pharmacy_medicine,
                                'quantity': order.quantity
                            })
                    except PharmacyMedicine.DoesNotExist:
                        stock_errors.append({
                            'medicine': order.medicine.name if order.medicine else 'Unknown',
                            'error': 'Medicine not found in pharmacy inventory'
                        })
            
            # If any stock errors, return them all
            if stock_errors:
                error_messages = []
                for err in stock_errors:
                    if 'error' in err:
                        error_messages.append(f"{err['medicine']}: {err['error']}")
                    else:
                        error_messages.append(f"{err['medicine']}: Insufficient stock (Available: {err['available']}, Required: {err['required']})")
                
                return Response({
                    "error": "Cannot accept order due to stock issues",
                    "details": error_messages
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # All stock checks passed, now update stocks and order status
            for update_info in pharmacy_medicines_to_update:
                pm = update_info['pharmacy_medicine']
                qty = update_info['quantity']
                
                # Reduce stock
                pm.stock -= qty
                
                # Update stock status based on remaining quantity
                if pm.stock == 0:
                    pm.status = 'out_of_stock'
                elif pm.stock <= pm.low_stock_threshold:
                    pm.status = 'low_stock'
                else:
                    pm.status = 'in_stock'
                
                pm.save()
            
            # Update all orders status
            orders.update(order_status='pharmacy_accepted')
            
            # Get the first order to check delivery requirements
            first_order = orders.first()
            
            # If delivery required, create delivery record and notify all delivery partners
            if first_order.delivery_required:
                try:
                    # Check if delivery already exists
                    existing_delivery = Delivery.objects.filter(order=first_order).first()
                    
                    if not existing_delivery:
                        delivery = Delivery.objects.create(
                            order=first_order,
                            pickup_address=pharmacy.address,
                            delivery_address=first_order.delivery_address
                        )
                        
                        # Notify all delivery partners about the new delivery order
                        delivery_partners = User.objects.filter(role='delivery', is_active=True)
                        for partner in delivery_partners:
                            Notification.objects.create(
                                delivery_partner=partner,
                                order=first_order,
                                notification_type='new_delivery_order',
                                title='New Delivery Order Available',
                                message=f'New delivery order #{first_order.order_id} from {pharmacy.name} to {first_order.delivery_address[:50]}...'
                            )
                except Exception as delivery_error:
                    # Log delivery creation error but don't fail the order acceptance
                    print(f"Error creating delivery notification: {str(delivery_error)}")

            return Response({
                "message": f"Order accepted successfully ({orders.count()} items)",
                "order_id": order_id,
                "items_count": orders.count()
            })

        elif action == 'reject':
            # Reject all orders with this order_id
            orders.update(order_status='pharmacy_rejected')
            
            return Response({
                "message": f"Order rejected successfully ({orders.count()} items)",
                "order_id": order_id,
                "items_count": orders.count()
            })

        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        import traceback
        print(f"Error in pharmacy_accept_order: {str(e)}")
        print(traceback.format_exc())
        return Response({
            "error": f"Failed to process order: {str(e)}"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delivery_accept_order(request, order_id):
    """Delivery partner accepts or rejects delivery"""
    if request.user.role != 'delivery':
        return Response({"error": "Only delivery partners can accept deliveries"}, status=status.HTTP_403_FORBIDDEN)

    try:
        order = Order.objects.get(order_id=order_id, delivery_partner=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Order not found or not assigned to you"}, status=status.HTTP_404_NOT_FOUND)

    action = request.data.get('action')  # 'accept' or 'reject'

    if action == 'accept':
        order.order_status = 'out_for_delivery'
        order.save()

        # Update delivery status
        delivery = order.delivery
        delivery.status = 'assigned'
        delivery.driver = request.user
        delivery.save()

        return Response({"message": "Delivery accepted", "order": OrderSerializer(order).data})

    elif action == 'reject':
        # Remove delivery partner assignment
        order.delivery_partner = None
        order.save()
        return Response({"message": "Delivery rejected"})

    return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_delivery_complete(request, order_id):
    """Mark delivery as completed"""
    if request.user.role != 'delivery':
        return Response({"error": "Only delivery partners can complete deliveries"}, status=status.HTTP_403_FORBIDDEN)

    try:
        order = Order.objects.get(order_id=order_id, delivery_partner=request.user)
        delivery = order.delivery
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    order.order_status = 'delivered'
    delivery.status = 'delivered'
    delivery.actual_time = delivery.estimated_time  # Mock actual time
    order.save()
    delivery.save()

    return Response({"message": "Delivery completed", "order": OrderSerializer(order).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_delivery_otp(request, order_id):
    """Generate OTP for delivery verification - called by delivery partner"""
    import random
    import traceback
    
    # Debug logging
    print(f"Generate OTP called by user: {request.user.email}, role: {request.user.role}")
    
    # Allow both 'delivery' role and admin for testing/management
    if request.user.role not in ['delivery', 'admin']:
        return Response({
            "error": f"Only delivery partners can generate OTP. Your role is: {request.user.role}"
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        # First, try to get the order
        order = Order.objects.get(order_id=order_id)
        
        # Verify that the order is assigned to the current user (or user is admin)
        if order.delivery_partner != request.user and request.user.role != 'admin':
            return Response({
                "error": "This order is not assigned to you"
            }, status=status.HTTP_403_FORBIDDEN)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
    
    try:
        delivery = order.delivery
    except Exception as e:
        error_msg = f"Delivery record not found for this order. Error: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        return Response({"error": error_msg}, status=status.HTTP_404_NOT_FOUND)

    # Check if delivery status allows OTP generation
    if delivery.status not in ['assigned', 'at_pickup', 'in_transit', 'out_for_delivery']:
        return Response({"error": f"Cannot generate OTP for delivery with status: {delivery.status}"}, status=status.HTTP_400_BAD_REQUEST)

    # Check if OTP already exists and is still valid (not expired)
    if delivery.otp and delivery.otp_generated_at:
        time_diff = timezone.now() - delivery.otp_generated_at
        if time_diff.total_seconds() < 600:  # If less than 10 minutes have passed
            # OTP is still valid, return the existing one
            print(f"OTP already exists and is still valid for order {order_id}")
            return Response({
                "message": "OTP already sent to customer. Please ask them to check their dashboard.",
                "otp_sent": True,
                "existing_otp": True,
                "remaining_time": int(600 - time_diff.total_seconds())
            }, status=status.HTTP_200_OK)

    # Generate new 6-digit OTP
    otp = str(random.randint(100000, 999999))
    
    # Save OTP and timestamp
    delivery.otp = otp
    delivery.otp_generated_at = timezone.now()
    delivery.save()

    # Send OTP to customer via UserNotification
    try:
        from .models import UserNotification
        UserNotification.objects.create(
            user=order.user,
            order=order,
            notification_type='delivery_otp',
            title='Delivery OTP Verification',
            message=f'Your delivery partner has requested OTP verification. Please share this OTP: {otp}',
            otp=otp,
            is_read=False
        )
    except Exception as e:
        print(f"Error creating user notification: {e}")
        traceback.print_exc()

    return Response({
        "message": "OTP sent to customer successfully",
        "otp_sent": True,
        "existing_otp": False
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_delivery_otp(request, order_id):
    """Verify OTP and mark delivery as completed - called by delivery partner"""
    # Debug logging
    print(f"Verify OTP called by user: {request.user.email}, role: {request.user.role}")
    
    # Allow both 'delivery' role and admin for testing/management
    if request.user.role not in ['delivery', 'admin']:
        return Response({
            "error": f"Only delivery partners can verify OTP. Your role is: {request.user.role}"
        }, status=status.HTTP_403_FORBIDDEN)

    otp_entered = request.data.get('otp')
    if not otp_entered:
        return Response({"error": "OTP is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # First, try to get the order
        order = Order.objects.get(order_id=order_id)
        
        # Verify that the order is assigned to the current user (or user is admin)
        if order.delivery_partner != request.user and request.user.role != 'admin':
            return Response({
                "error": "This order is not assigned to you"
            }, status=status.HTTP_403_FORBIDDEN)
        
        delivery = order.delivery
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    # Check if OTP exists
    if not delivery.otp:
        return Response({"error": "No OTP generated for this delivery"}, status=status.HTTP_400_BAD_REQUEST)

    # Check OTP expiry (10 minutes)
    if delivery.otp_generated_at:
        time_diff = timezone.now() - delivery.otp_generated_at
        if time_diff.total_seconds() > 600:  # 10 minutes = 600 seconds
            return Response({"error": "OTP has expired. Please generate a new one."}, status=status.HTTP_400_BAD_REQUEST)

    # Verify OTP
    if delivery.otp != otp_entered:
        return Response({"error": "Invalid OTP. Please try again."}, status=status.HTTP_400_BAD_REQUEST)

    # OTP is valid - mark delivery as completed
    delivery.status = 'delivered'
    delivery.actual_time = delivery.estimated_time  # You can calculate actual time here
    order.order_status = 'delivered'
    
    # Clear OTP after successful verification
    delivery.otp = None
    delivery.otp_generated_at = None
    
    delivery.save()
    order.save()

    # Notify customer that delivery is completed
    try:
        Notification.objects.create(
            delivery_partner=order.user,
            order=order,
            notification_type='delivery_completed',
            title='Delivery Completed',
            message=f'Your order {order.order_id} has been successfully delivered!'
        )
    except Exception as e:
        print(f"Error sending delivery completion notification: {e}")

    return Response({
        "message": "Delivery completed successfully",
        "order": OrderSerializer(order).data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_orders(request):
    """Get user's order history"""
    orders = Order.objects.filter(user=request.user).order_by('-created_at')

    grouped_orders = {}
    for order in orders:
        if order.order_id not in grouped_orders:
            grouped_orders[order.order_id] = {
                'id': order.id,
                'order_id': order.order_id,
                'order_status': order.order_status,
                'payment_status': order.payment_status,
                'delivery_required': order.delivery_required,
                'delivery_address': order.delivery_address,
                'created_at': order.created_at.isoformat(),
                'updated_at': order.updated_at.isoformat(),
                'total_price': 0,
                'medicines': [],
                'pharmacies': set(),
            }

        grouped_orders[order.order_id]['medicines'].append({
            'id': order.id,
            'medicine_id': order.medicine.id if order.medicine else None,
            'medicine_name': order.medicine.name if order.medicine else 'Unknown',
            'medicine_dosage': order.medicine.dosage if order.medicine else '',
            'quantity': order.quantity,
            'price': float(order.total_price),
            'pharmacy_name': order.pharmacy.name if order.pharmacy else 'Unknown',
        })
        grouped_orders[order.order_id]['total_price'] += float(order.total_price)
        if order.pharmacy:
            grouped_orders[order.order_id]['pharmacies'].add(order.pharmacy.name)

    result = []
    for grouped in grouped_orders.values():
        grouped['pharmacy_name'] = ', '.join(sorted(grouped['pharmacies'])) if grouped['pharmacies'] else 'Unknown'
        del grouped['pharmacies']
        result.append(grouped)

    result.sort(key=lambda x: x['created_at'], reverse=True)
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pharmacy_orders(request):
    """Get pharmacy's orders grouped by order_id"""
    try:
        pharmacy = request.user.pharmacy
    except Pharmacy.DoesNotExist:
        return Response({"error": "User is not a pharmacy"}, status=status.HTTP_403_FORBIDDEN)

    # Get only paid orders for this pharmacy
    orders = Order.objects.filter(pharmacy=pharmacy, payment_status='paid').order_by('-created_at')
    
    # Group orders by order_id
    grouped_orders = {}
    for order in orders:
        if order.order_id not in grouped_orders:
            # First order with this order_id - create the group
            grouped_orders[order.order_id] = {
                'order_id': order.order_id,
                'user': order.user.email if order.user else None,
                'user_name': order.user.full_name if order.user else None,
                'order_status': order.order_status,
                'payment_status': order.payment_status,
                'delivery_required': order.delivery_required,
                'delivery_address': order.delivery_address,
                'created_at': order.created_at.isoformat(),
                'updated_at': order.updated_at.isoformat(),
                'total_price': 0,
                'medicines': []
            }
        
        # Add medicine details to the group
        grouped_orders[order.order_id]['medicines'].append({
            'id': order.id,
            'medicine_id': order.medicine.id if order.medicine else None,
            'medicine_name': order.medicine.name if order.medicine else 'Unknown',
            'medicine_dosage': order.medicine.dosage if order.medicine else '',
            'quantity': order.quantity,
            'price': float(order.total_price)
        })
        
        # Update total price for the group
        grouped_orders[order.order_id]['total_price'] += float(order.total_price)
    
    # Convert to list and sort by created_at
    result = list(grouped_orders.values())
    result.sort(key=lambda x: x['created_at'], reverse=True)
    
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def delivery_orders(request):
    """Get delivery partner's assigned orders"""
    if request.user.role != 'delivery':
        return Response({"error": "Only delivery partners can view delivery orders"}, status=status.HTTP_403_FORBIDDEN)

    orders = Order.objects.filter(delivery_partner=request.user).order_by('-created_at')
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pharmacy_dashboard(request):
    """Get pharmacy dashboard data"""
    try:
        pharmacy = request.user.pharmacy
    except Pharmacy.DoesNotExist:
        return Response({"error": "User is not a pharmacy"}, status=status.HTTP_403_FORBIDDEN)

    # Get pharmacy medicines
    pharmacy_medicines = PharmacyMedicine.objects.filter(pharmacy=pharmacy).select_related('medicine')
    medicines_data = []
    for pm in pharmacy_medicines:
        status = 'in_stock'
        if pm.stock == 0:
            status = 'out_of_stock'
        elif pm.stock < 10:  # Assuming low stock threshold
            status = 'low_stock'

        medicines_data.append({
            'id': pm.id,
            'medicine': {
                'id': pm.medicine.id,
                'name': pm.medicine.name,
                'dosage': pm.medicine.dosage,
            },
            'stock': pm.stock,
            'price': str(pm.price),
            'status': status
        })

    # Get recent paid orders
    recent_orders = Order.objects.filter(pharmacy=pharmacy, payment_status='paid').order_by('-created_at')[:10]
    orders_data = []
    for order in recent_orders:
        orders_data.append({
            'id': order.id,
            'order_id': order.order_id,
            'total_amount': str(order.total_price),
            'status': order.order_status,
            'items': [{'medicine': order.medicine.name, 'quantity': order.quantity}] if order.medicine else []
        })

    # Calculate stats
    total_medicines = pharmacy_medicines.count()
    low_stock_items = pharmacy_medicines.filter(stock__lt=10).count()
    today_orders = Order.objects.filter(
        pharmacy=pharmacy,
        payment_status='paid',
        created_at__date=timezone.now().date()
    ).count()
    total_revenue = Order.objects.filter(pharmacy=pharmacy, payment_status='paid', order_status='delivered').aggregate(
        total=Sum('total_price'))['total'] or 0

    # Weekly sales data (simplified)
    weekly_sales = []
    for i in range(7):
        date = timezone.now() - timedelta(days=i)
        sales = Order.objects.filter(
            pharmacy=pharmacy,
            payment_status='paid',
            created_at__date=date.date(),
            order_status='delivered'
        ).aggregate(total=Sum('total_price'))['total'] or 0
        weekly_sales.append({
            'day': date.strftime('%a'),
            'sales': float(sales)
        })

    return Response({
        'stats': {
            'total_medicines': total_medicines,
            'low_stock_items': low_stock_items,
            'today_orders': today_orders,
            'revenue': str(total_revenue)
        },
        'medicines': medicines_data,
        'recent_orders': orders_data,
        'weekly_sales': weekly_sales
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def delivery_dashboard(request):
    """Get delivery dashboard data"""
    if request.user.role != 'delivery':
        return Response({"error": "Only delivery partners can access this dashboard"}, status=status.HTTP_403_FORBIDDEN)

    # Get active deliveries using Delivery model, not Order model
    active_deliveries = Delivery.objects.filter(
        driver=request.user,
        status__in=['pending', 'assigned', 'at_pickup', 'in_transit', 'out_for_delivery']
    ).select_related('order', 'order__user', 'order__pharmacy', 'order__medicine').order_by('-created_at')

    deliveries_data = []
    for delivery in active_deliveries:
        deliveries_data.append({
            'id': delivery.id,
            'order': {
                'id': delivery.order.id,
                'order_id': delivery.order.order_id,
                'user': {
                    'full_name': delivery.order.user.full_name
                }
            },
            'pickup_address': delivery.pickup_address,
            'delivery_address': delivery.delivery_address,
            'status': delivery.status,  # Use Delivery status, not Order status
            'distance_km': delivery.distance_km,
            'estimated_time': delivery.estimated_time,
            'driver_name': request.user.full_name
        })

    # Calculate stats
    active_count = active_deliveries.count()
    completed_today = Delivery.objects.filter(
        driver=request.user,
        status='delivered',
        updated_at__date=timezone.now().date()
    ).count()
    pending_orders = Delivery.objects.filter(
        driver=request.user,
        status__in=['pending', 'assigned']
    ).count()

    # Calculate average delivery time (placeholder)
    avg_delivery_time = "25 min"

    return Response({
        'stats': {
            'active_deliveries': active_count,
            'completed_today': completed_today,
            'pending_orders': pending_orders,
            'avg_delivery_time': avg_delivery_time
        },
        'active_deliveries': deliveries_data,
        'metrics': {
            'on_time_rate': '95%',
            'satisfaction': '4.8/5.0',
            'avg_order_value': '$45'
        },
        'driver_performance': [{
            'driver': request.user.full_name,
            'deliveries': completed_today,
            'rating': '4.8'
        }]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign_delivery_partner(request, order_id):
    """Admin assigns delivery partner to order"""
    if request.user.role != 'admin':
        return Response({"error": "Only admins can assign delivery partners"}, status=status.HTTP_403_FORBIDDEN)

    delivery_partner_id = request.data.get('delivery_partner_id')

    try:
        order = Order.objects.get(order_id=order_id)
        delivery_partner = User.objects.get(id=delivery_partner_id, role='delivery')
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)
    except User.DoesNotExist:
        return Response({"error": "Delivery partner not found"}, status=status.HTTP_404_NOT_FOUND)

    order.delivery_partner = delivery_partner
    order.save()

    return Response({"message": "Delivery partner assigned", "order": OrderSerializer(order).data})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_pending_delivery_orders(request):
    """Get pending delivery orders for delivery partners"""
    try:
        # Check if user has delivery role
        user_role = getattr(request.user, 'role', None)
        if user_role != 'delivery':
            return Response({
                "error": "Only delivery partners can view pending orders",
                "user_role": user_role
            }, status=status.HTTP_403_FORBIDDEN)

        # Get all pending delivery orders (not yet assigned to any delivery partner)
        pending_orders = Order.objects.filter(
            delivery_required=True,
            payment_status='paid',
            order_status='pharmacy_accepted',
            delivery_partner__isnull=True
        ).select_related('pharmacy', 'medicine', 'user').order_by('-created_at')

        serializer = OrderSerializer(pending_orders, many=True)
        return Response(serializer.data)
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_delivery_notifications(request):
    """Get unread notifications for delivery partner"""
    try:
        # Check if user has delivery role
        user_role = getattr(request.user, 'role', None)
        if user_role != 'delivery':
            return Response({
                "error": "Only delivery partners can view notifications",
                "user_role": user_role
            }, status=status.HTTP_403_FORBIDDEN)

        notifications = Notification.objects.filter(
            delivery_partner=request.user
        ).order_by('-created_at')

        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data)
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_notifications(request):
    """Get notifications for regular users (customers)"""
    try:
        # Check if user is a regular user (customer)
        user_role = getattr(request.user, 'role', None)
        if user_role != 'user':
            return Response({
                "error": "This endpoint is for customers only",
                "user_role": user_role
            }, status=status.HTTP_403_FORBIDDEN)

        notifications = UserNotification.objects.filter(
            user=request.user
        ).order_by('-created_at')

        serializer = UserNotificationSerializer(notifications, many=True)
        return Response(serializer.data)
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notifications_read(request):
    """Mark user notifications as read"""
    try:
        notification_ids = request.data.get('notification_ids', [])
        
        if not notification_ids:
            return Response({
                "error": "notification_ids is required"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update notifications for the authenticated user
        updated_count = UserNotification.objects.filter(
            id__in=notification_ids,
            user=request.user
        ).update(is_read=True)

        return Response({
            "message": f"{updated_count} notifications marked as read",
            "updated_count": updated_count
        }, status=status.HTTP_200_OK)
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_notification(request, notification_id=None):
    """Delete user notification(s)"""
    try:
        if notification_id:
            # Delete single notification
            deleted, _ = UserNotification.objects.filter(
                id=notification_id,
                user=request.user
            ).delete()
            
            if not deleted:
                return Response({
                    "error": "Notification not found"
                }, status=status.HTTP_404_NOT_FOUND)
            
            return Response({
                "message": "Notification deleted successfully",
                "deleted_count": deleted
            }, status=status.HTTP_200_OK)
        else:
            # Delete multiple notifications
            notification_ids = request.data.get('notification_ids', [])
            
            if not notification_ids:
                return Response({
                    "error": "notification_ids is required"
                }, status=status.HTTP_400_BAD_REQUEST)

            deleted, _ = UserNotification.objects.filter(
                id__in=notification_ids,
                user=request.user
            ).delete()

            return Response({
                "message": f"{deleted} notifications deleted successfully",
                "deleted_count": deleted
            }, status=status.HTTP_200_OK)
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_delivery_order(request, order_id):
    """Accept a delivery order"""
    try:
        # Check if user has delivery role
        user_role = getattr(request.user, 'role', None)
        if user_role != 'delivery':
            return Response({
                "error": "Only delivery partners can accept orders",
                "user_role": user_role
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            order = Order.objects.get(order_id=order_id, delivery_required=True)
        except Order.DoesNotExist:
            return Response({"error": "Order not found or delivery not required"}, status=status.HTTP_404_NOT_FOUND)

        # Check if order is already assigned
        if order.delivery_partner is not None:
            return Response({"error": "Order already assigned to another delivery partner"}, status=status.HTTP_400_BAD_REQUEST)

        # Assign delivery partner
        order.delivery_partner = request.user
        order.order_status = 'out_for_delivery'
        order.save()

        # Update delivery status if it exists
        try:
            delivery = Delivery.objects.get(order=order)
            delivery.status = 'assigned'
            delivery.driver = request.user
            delivery.save()
        except Delivery.DoesNotExist:
            # Create delivery record if it doesn't exist
            delivery = Delivery.objects.create(
                order=order,
                pickup_address=order.pharmacy.address if order.pharmacy else "",
                delivery_address=order.delivery_address,
                status='assigned',
                driver=request.user
            )

        # Mark all notifications for this order as read for this user
        Notification.objects.filter(
            delivery_partner=request.user,
            order=order
        ).update(is_read=True)

        return Response({
            "message": "Delivery order accepted successfully",
            "order": OrderSerializer(order).data
        }, status=status.HTTP_200_OK)
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    """Mark a notification as read"""
    try:
        notification = Notification.objects.get(id=notification_id, delivery_partner=request.user)
        notification.is_read = True
        notification.save()
        return Response({"message": "Notification marked as read"}, status=status.HTTP_200_OK)
    except Notification.DoesNotExist:
        return Response({"error": "Notification not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Cart API Views
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_cart(request):
    """Get or add items to cart"""
    try:
        # Get or create cart for the user
        cart, created = Cart.objects.get_or_create(user=request.user)

        if request.method == 'GET':
            # Return cart contents
            serializer = CartSerializer(cart)
            return Response(serializer.data)

        elif request.method == 'POST':
            # Add item to cart
            medicine_id = request.data.get('medicine_id')
            pharmacy_id = request.data.get('pharmacy_id')
            quantity = request.data.get('quantity', 1)

            if not medicine_id or not pharmacy_id:
                return Response(
                    {"error": "medicine_id and pharmacy_id are required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                medicine = Medicine.objects.get(id=medicine_id)
                pharmacy = Pharmacy.objects.get(id=pharmacy_id)
            except (Medicine.DoesNotExist, Pharmacy.DoesNotExist):
                return Response(
                    {"error": "Medicine or Pharmacy not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Add or update cart item
            cart_item, created = CartItem.objects.get_or_create(
                cart=cart,
                medicine=medicine,
                pharmacy=pharmacy,
                defaults={'quantity': quantity}
            )

            if not created:
                cart_item.quantity += quantity
                cart_item.save()

            serializer = CartSerializer(cart)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def cart_item_detail(request, cart_item_id):
    """Update quantity or remove cart item"""
    try:
        cart_item = CartItem.objects.get(id=cart_item_id, cart__user=request.user)

        if request.method == 'PATCH':
            # Update quantity
            quantity = request.data.get('quantity')
            if quantity is not None:
                if quantity <= 0:
                    cart_item.delete()
                else:
                    cart_item.quantity = quantity
                    cart_item.save()
            
            cart = cart_item.cart
            serializer = CartSerializer(cart)
            return Response(serializer.data)

        elif request.method == 'DELETE':
            # Remove item from cart
            cart = cart_item.cart
            cart_item.delete()
            serializer = CartSerializer(cart)
            return Response(serializer.data)

    except CartItem.DoesNotExist:
        return Response(
            {"error": "Cart item not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clear_cart(request):
    """Clear all items from cart"""
    try:
        cart = Cart.objects.get(user=request.user)
        cart.items.all().delete()
        serializer = CartSerializer(cart)
        return Response(serializer.data)
    except Cart.DoesNotExist:
        return Response(
            {"error": "Cart not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def checkout_cart(request):
    """Checkout cart and create multiple orders grouped by pharmacy"""
    try:
        cart = Cart.objects.get(user=request.user)
        
        if not cart.items.exists():
            return Response(
                {"error": "Cart is empty"},
                status=status.HTTP_400_BAD_REQUEST
            )

        delivery_required = request.data.get('delivery_required', False)
        delivery_address = request.data.get('delivery_address', '')
        payment_method = request.data.get('payment_method', 'razorpay')

        # Group cart items by pharmacy
        pharmacy_groups = {}
        for cart_item in cart.items.all():
            pharmacy_id = cart_item.pharmacy.id
            if pharmacy_id not in pharmacy_groups:
                pharmacy_groups[pharmacy_id] = {
                    'pharmacy': cart_item.pharmacy,
                    'items': [],
                    'total': 0
                }
            pharmacy_groups[pharmacy_id]['items'].append(cart_item)
            pharmacy_groups[pharmacy_id]['total'] += cart_item.get_subtotal()

        orders = []
        total_amount = 0
        grouped_orders = {}  # Track orders by order_id for grouping response

        # Create orders grouped by pharmacy
        for pharmacy_id, group in pharmacy_groups.items():
            try:
                import uuid
                # Generate ONE order_id per pharmacy
                order_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"
                
                # Create one Order record for each medicine from this pharmacy
                # All will share the same order_id
                pharmacy_medicines = []
                for cart_item in group['items']:
                    order = Order.objects.create(
                        user=request.user,
                        medicine=cart_item.medicine,
                        pharmacy=group['pharmacy'],
                        quantity=cart_item.quantity,
                        total_price=cart_item.get_subtotal(),
                        delivery_required=delivery_required,
                        delivery_address=delivery_address if delivery_required else '',
                        order_status='pending_pharmacy_confirmation',
                        order_id=order_id  # Same order_id for all medicines in this pharmacy
                    )

                    # Create payment record
                    payment = Payment.objects.create(
                        order=order,
                        amount=order.total_price,
                        payment_method=payment_method,
                        status='pending'
                    )

                    pharmacy_medicines.append({
                        'medicine_name': order.medicine.name,
                        'quantity': order.quantity,
                        'price': float(order.total_price)
                    })

                    total_amount += order.total_price

                # Group response by order_id
                if order_id not in grouped_orders:
                    grouped_orders[order_id] = {
                        'order_id': order_id,
                        'pharmacy_name': group['pharmacy'].name,
                        'medicines': [],
                        'total_price': 0
                    }
                grouped_orders[order_id]['medicines'].extend(pharmacy_medicines)
                grouped_orders[order_id]['total_price'] = group['total']

            except Exception as e:
                import traceback
                return Response({
                    "error": f"Failed to create order for {group['pharmacy'].name}",
                    "details": str(e),
                    "traceback": traceback.format_exc()
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Convert grouped_orders to list
        orders = list(grouped_orders.values())

        # Clear cart after successful checkout
        cart.items.all().delete()

        return Response({
            "message": "Orders created successfully",
            "orders": orders,
            "total_amount": total_amount,
            "payment_method": payment_method
        }, status=status.HTTP_201_CREATED)

    except Cart.DoesNotExist:
        return Response(
            {"error": "Cart not found"},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        return Response({
            "error": str(e),
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_refund(request, order_id):
    """User requests a refund for an order (typically due to pharmacy rejection)"""
    try:
        order = Order.objects.get(order_id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        payment = order.payment
    except Payment.DoesNotExist:
        return Response({"error": "No payment record found for this order"}, status=status.HTTP_404_NOT_FOUND)

    # Check if order is in a refundable state
    if order.order_status not in ['pharmacy_rejected', 'cancelled', 'delivery_failed']:
        return Response({
            "error": "Order cannot be refunded in current status",
            "current_status": order.order_status
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check if payment was actually made
    if payment.status != 'paid':
        return Response({
            "error": "Only paid orders can be refunded"
        }, status=status.HTTP_400_BAD_REQUEST)

    # Check if already refunded
    if payment.refund_status != 'no_refund':
        return Response({
            "error": f"Refund already {payment.refund_status}",
            "refund_status": payment.refund_status
        }, status=status.HTTP_400_BAD_REQUEST)

    refund_reason = request.data.get('reason', 'Order cancelled by user')

    try:
        # Update payment refund status
        payment.refund_status = 'initiated'
        payment.refund_amount = payment.amount
        payment.refund_reason = refund_reason
        payment.refund_initiated_at = timezone.now()
        payment.save()

        # Call Razorpay refund API if payment was via Razorpay
        if payment.payment_method == 'razorpay' and payment.transaction_id:
            try:
                refund_response = razorpay_client.payment.refund(
                    payment.transaction_id,
                    {
                        'amount': int(float(payment.amount) * 100),  # Convert to paise
                        'notes': {
                            'order_id': order_id,
                            'reason': refund_reason
                        }
                    }
                )
                payment.refund_transaction_id = refund_response['id']
                payment.refund_status = 'processing'
                payment.save()
            except Exception as razorpay_error:
                print(f"Razorpay refund error: {str(razorpay_error)}")
                # Mark as pending manual processing if API fails
                payment.refund_status = 'pending'
                payment.save()

        # Create notification for user
        try:
            UserNotification.objects.create(
                user=request.user,
                order=order,
                notification_type='order_status',
                title='Refund Initiated',
                message=f'Your refund for order {order_id} has been initiated. Amount: ₹{payment.amount}. Check back for status updates.'
            )
        except Exception as notif_error:
            print(f"Notification creation error: {str(notif_error)}")

        return Response({
            "message": "Refund request processed successfully",
            "refund_status": payment.refund_status,
            "refund_amount": str(payment.amount),
            "refund_initiated_at": payment.refund_initiated_at.isoformat()
        }, status=status.HTTP_200_OK)

    except Exception as e:
        import traceback
        return Response({
            "error": f"Refund processing failed: {str(e)}",
            "traceback": traceback.format_exc()
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)