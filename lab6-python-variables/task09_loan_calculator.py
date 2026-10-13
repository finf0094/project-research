# Task 9. Loan Calculator (simple interest)

print("=== Loan Calculator ===")

loan_amount = float(input("Loan amount: "))
annual_rate = float(input("Annual interest rate (%): "))
years = int(input("Loan term (years): "))

total_interest = loan_amount * annual_rate / 100 * years
total_repayment = loan_amount + total_interest
monthly_payment = total_repayment / (years * 12)

print()
print(f"Total interest: {total_interest:.2f}")
print(f"Total repayment: {total_repayment:.2f}")
print(f"Monthly payment (approx.): {monthly_payment:.2f}")
