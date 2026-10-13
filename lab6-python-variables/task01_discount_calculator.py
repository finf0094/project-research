# Task 1. Discount Calculator

print("=== Discount Calculator ===")

price = float(input("Product price: "))
quantity = int(input("Quantity: "))
discount_percent = float(input("Discount (%): "))

subtotal = price * quantity
discount_amount = subtotal * discount_percent / 100
final_price = subtotal - discount_amount

print()
print(f"Subtotal before discount: {subtotal:.2f}")
print(f"Discount amount ({discount_percent:g}%): {discount_amount:.2f}")
print(f"Final price after discount: {final_price:.2f}")
