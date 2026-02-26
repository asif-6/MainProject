#!/usr/bin/env python
import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from medicine.models import Order, Pharmacy

print("\n" + "="*60)
print("ORDER GROUPING TEST")
print("="*60 + "\n")

pharmacy = Pharmacy.objects.first()
if not pharmacy:
    print("No pharmacy found in database")
    exit()

orders = Order.objects.filter(pharmacy=pharmacy).order_by('-created_at')
print(f"Testing with pharmacy: {pharmacy.name}")
print(f"Total orders: {orders.count()}\n")

# Find orders with same order_id (multiple medicines)
order_ids = {}
for order in orders:
    if order.order_id not in order_ids:
        order_ids[order.order_id] = []
    order_ids[order.order_id].append(order)

grouped_count = 0
print("Orders with MULTIPLE medicines (same order_id):")
print("-" * 60)
for order_id, order_list in order_ids.items():
    if len(order_list) > 1:
        grouped_count += 1
        print(f"\nOrder #{order_id}")
        print(f"  Medicines: {len(order_list)}")
        total_price = 0
        for ord in order_list:
            print(f"    • {ord.medicine.name if ord.medicine else 'Unknown'} (Qty: {ord.quantity}, Price: ₹{ord.total_price})")
            total_price += ord.total_price
        print(f"  Total: ₹{total_price}")

if grouped_count == 0:
    print("\n  No grouped orders found!")
    print(f"\n  Creating test order...")
    import uuid
    test_order_id = f"TEST-{uuid.uuid4().hex[:8].upper()}"
    user = Order.objects.filter(pharmacy=pharmacy).first().user
    medicines = list(Order.objects.filter(pharmacy=pharmacy).values_list('medicine_id', flat=True).distinct()[:2])
    
    if len(medicines) >= 2:
        for i, med_id in enumerate(medicines):
            from medicine.models import Medicine
            med = Medicine.objects.get(id=med_id)
            Order.objects.create(
                user=user,
                pharmacy=pharmacy,
                medicine=med,
                quantity=i+1,
                total_price=(i+1)*10,
                delivery_required=False,
                order_status='pending_pharmacy_confirmation',
                order_id=test_order_id
            )
        print(f"  ✓ Created test order {test_order_id} with {len(medicines)} medicines")
else:
    print(f"\n✓ Found {grouped_count} grouped orders!")

print("\n" + "="*60 + "\n")
