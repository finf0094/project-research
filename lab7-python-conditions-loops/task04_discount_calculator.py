# Task 4. Discount Calculator (KZT)

amount = float(input("Purchase amount (KZT): "))

if amount < 10_000:
    discount_percent = 0
elif amount < 50_000:
    discount_percent = 5
elif amount < 100_000:
    discount_percent = 10
else:
    discount_percent = 15

final_amount = amount - amount * discount_percent / 100

print(f"Original amount: {amount:,.2f} KZT")
print(f"Discount: {discount_percent}%")
print(f"Final amount: {final_amount:,.2f} KZT")
