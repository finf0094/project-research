# Task 10. Shopping Cart Calculator

print("=== Shopping Cart Calculator ===")

customer_name = input("Customer name: ")
product_name = input("Product name: ")
price = float(input("Price per item: "))
quantity = int(input("Quantity: "))
discount_percent = float(input("Discount (%): "))
delivery_cost = float(input("Delivery cost: "))

subtotal = price * quantity
discount_amount = subtotal * discount_percent / 100
final_total = subtotal - discount_amount + delivery_cost

print()
print("============ RECEIPT ============")
print(f"Customer:  {customer_name}")
print(f"Product:   {product_name}")
print(f"Quantity:  {quantity}")
print("---------------------------------")
print(f"Subtotal:  {subtotal:>12.2f}")
print(f"Discount:  {discount_amount:>12.2f}")
print(f"Delivery:  {delivery_cost:>12.2f}")
print("---------------------------------")
print(f"TOTAL:     {final_total:>12.2f}")
print("=================================")
