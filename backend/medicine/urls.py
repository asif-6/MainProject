from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SignupView, LoginView, pharmacy_dashboard, delivery_dashboard,
    profile_view,
    UserViewSet, PharmacyViewSet, MedicineViewSet, PharmacyMedicineViewSet,
    OrderViewSet, DeliveryViewSet, RestockRequestViewSet, SupportTicketViewSet,
    create_order, process_payment, pharmacy_accept_order, delivery_accept_order,
    mark_delivery_complete, user_orders, pharmacy_orders, delivery_orders, assign_delivery_partner,
    get_pending_delivery_orders, get_delivery_notifications, get_user_notifications, accept_delivery_order, mark_notification_read,
    mark_notifications_read, delete_notification,
    create_razorpay_order, verify_razorpay_payment, manage_cart, cart_item_detail, clear_cart, checkout_cart,
    generate_delivery_otp, verify_delivery_otp, create_cart_razorpay_order, verify_cart_razorpay_payment, request_refund
)

router = DefaultRouter()
router.register(r'pharmacies', PharmacyViewSet)
router.register(r'medicines', MedicineViewSet)
router.register(r'pharmacy-medicines', PharmacyMedicineViewSet)
router.register(r'restock-requests', RestockRequestViewSet)
router.register(r'support-tickets', SupportTicketViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'deliveries', DeliveryViewSet)
router.register(r'users', UserViewSet)

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("pharmacy-dashboard/", pharmacy_dashboard, name="pharmacy_dashboard"),
    path("delivery-dashboard/", delivery_dashboard, name="delivery_dashboard"),
    path("profile/", profile_view, name="profile"),
    path("create-order/", create_order, name="create_order"),
    path("process-payment/<str:order_id>/", process_payment, name="process_payment"),
    path("create-razorpay-order/<str:order_id>/", create_razorpay_order, name="create_razorpay_order"),
    path("verify-razorpay-payment/<str:order_id>/", verify_razorpay_payment, name="verify_razorpay_payment"),
    path("cart/create-razorpay-order/", create_cart_razorpay_order, name="create_cart_razorpay_order"),
    path("cart/verify-razorpay-payment/", verify_cart_razorpay_payment, name="verify_cart_razorpay_payment"),
    path("pharmacy-accept-order/<str:order_id>/", pharmacy_accept_order, name="pharmacy_accept_order"),
    path("delivery-accept-order/<str:order_id>/", delivery_accept_order, name="delivery_accept_order"),
    path("mark-delivery-complete/<str:order_id>/", mark_delivery_complete, name="mark_delivery_complete"),
    path("generate-delivery-otp/<str:order_id>/", generate_delivery_otp, name="generate_delivery_otp"),
    path("verify-delivery-otp/<str:order_id>/", verify_delivery_otp, name="verify_delivery_otp"),
    path("user-orders/", user_orders, name="user_orders"),
    path("pharmacy-orders/", pharmacy_orders, name="pharmacy_orders"),
    path("delivery-orders/", delivery_orders, name="delivery_orders"),
    path("assign-delivery-partner/<str:order_id>/", assign_delivery_partner, name="assign_delivery_partner"),
    path("pending-delivery-orders/", get_pending_delivery_orders, name="pending_delivery_orders"),
    path("delivery-notifications/", get_delivery_notifications, name="delivery_notifications"),
    path("user-notifications/", get_user_notifications, name="user_notifications"),
    path("mark-notifications-read/", mark_notifications_read, name="mark_notifications_read"),
    path("delete-notification/<int:notification_id>/", delete_notification, name="delete_notification"),
    path("delete-notifications/", delete_notification, name="delete_notifications"),
    path("accept-delivery-order/<str:order_id>/", accept_delivery_order, name="accept_delivery_order"),
    path("mark-notification-read/<int:notification_id>/", mark_notification_read, name="mark_notification_read"),
    path("cart/", manage_cart, name="manage_cart"),
    path("cart-item/<int:cart_item_id>/", cart_item_detail, name="cart_item_detail"),
    path("cart/clear/", clear_cart, name="clear_cart"),
    path("cart/checkout/", checkout_cart, name="checkout_cart"),
    path("refund/<str:order_id>/", request_refund, name="request_refund"),
    path("", include(router.urls)),
]
