# Task 6. Salary Calculator

TAX_RATE = 0.10  # 10%

print("=== Salary Calculator ===")

name = input("Employee name: ")
hours_worked = float(input("Hours worked: "))
hourly_rate = float(input("Hourly rate: "))

gross_salary = hours_worked * hourly_rate
tax_amount = gross_salary * TAX_RATE
net_salary = gross_salary - tax_amount

print()
print(f"Employee: {name}")
print(f"Gross salary: {gross_salary:.2f}")
print(f"Tax ({TAX_RATE:.0%}): {tax_amount:.2f}")
print(f"Net salary: {net_salary:.2f}")
