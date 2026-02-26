from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, Pharmacy, Medicine, PharmacyMedicine, Order, Delivery, Payment, DeliveryPartner

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'full_name', 'role', 'is_active')
    list_filter = ('role', 'is_active', 'created_at')
    search_fields = ('email', 'full_name')
    ordering = ('email',)
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('full_name', 'role')}),
        ('Permissions', {'fields': ('is_active', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'created_at')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'password1', 'password2', 'role'),
        }),
    )
    
    filter_horizontal = ('groups', 'user_permissions')


@admin.register(Pharmacy)
class PharmacyAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'phone', 'is_verified', 'created_at')
    list_filter = ('is_verified', 'created_at')
    search_fields = ('name', 'user__email', 'license_number')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Basic Info', {'fields': ('user', 'name', 'phone')}),
        ('Address & License', {'fields': ('address', 'license_number')}),
        ('Status', {'fields': ('is_verified',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
    list_display = ('name', 'dosage', 'unit', 'created_at')
    list_filter = ('unit', 'created_at')
    search_fields = ('name', 'generic_name')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Medicine Info', {'fields': ('name', 'generic_name', 'dosage', 'unit')}),
        ('Details', {'fields': ('description',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(PharmacyMedicine)
class PharmacyMedicineAdmin(admin.ModelAdmin):
    list_display = ('pharmacy', 'medicine', 'stock', 'price', 'status')
    list_filter = ('status', 'pharmacy', 'updated_at')
    search_fields = ('pharmacy__name', 'medicine__name')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('References', {'fields': ('pharmacy', 'medicine')}),
        ('Stock & Price', {'fields': ('stock', 'price', 'status')}),
        ('Inventory', {'fields': ('low_stock_threshold',)}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'user', 'pharmacy', 'medicine', 'quantity', 'order_status', 'total_price', 'created_at')
    list_filter = ('order_status', 'payment_status', 'pharmacy', 'created_at')
    search_fields = ('order_id', 'user__email', 'pharmacy__name', 'medicine__name')
    readonly_fields = ('order_id', 'created_at', 'updated_at')
    fieldsets = (
        ('Order Info', {'fields': ('order_id', 'user', 'pharmacy', 'medicine', 'quantity', 'total_price')}),
        ('Status', {'fields': ('order_status', 'payment_status')}),
        ('Delivery', {'fields': ('delivery_required', 'delivery_address', 'delivery_partner')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('order', 'driver', 'status', 'distance_km', 'created_at')
    list_filter = ('status', 'driver', 'created_at')
    search_fields = ('order__order_id', 'driver__email')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Order & Driver', {'fields': ('order', 'driver')}),
        ('Status', {'fields': ('status',)}),
        ('Locations', {'fields': ('pickup_address', 'delivery_address')}),
        ('Delivery Info', {'fields': ('distance_km', 'estimated_time', 'actual_time')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('order', 'amount', 'payment_method', 'status', 'payment_date')
    list_filter = ('status', 'payment_method', 'payment_date')
    search_fields = ('order__order_id', 'transaction_id')
    readonly_fields = ('payment_date',)
    fieldsets = (
        ('Order Info', {'fields': ('order', 'amount')}),
        ('Payment Details', {'fields': ('payment_method', 'transaction_id', 'status')}),
        ('Timestamps', {'fields': ('payment_date',), 'classes': ('collapse',)}),
    )


@admin.register(DeliveryPartner)
class DeliveryPartnerAdmin(admin.ModelAdmin):
    list_display = ('user', 'vehicle_type', 'is_available', 'rating', 'total_deliveries')
    list_filter = ('is_available', 'vehicle_type', 'rating')
    search_fields = ('user__email', 'user__full_name', 'vehicle_number')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('User Info', {'fields': ('user',)}),
        ('Vehicle Info', {'fields': ('vehicle_type', 'vehicle_number', 'license_number')}),
        ('Status', {'fields': ('is_available', 'current_location')}),
        ('Performance', {'fields': ('rating', 'total_deliveries')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at'), 'classes': ('collapse',)}),
    )
