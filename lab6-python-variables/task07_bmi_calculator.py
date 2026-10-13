# Task 7. BMI Calculator

print("=== BMI Calculator ===")

weight = float(input("Weight (kg): "))
height = float(input("Height (m): "))

bmi = weight / height ** 2

print()
print(f"BMI: {bmi:.1f}")
