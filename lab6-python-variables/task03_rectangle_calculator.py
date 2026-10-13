# Task 3. Rectangle Calculator

print("=== Rectangle Calculator ===")

width = float(input("Width: "))
height = float(input("Height: "))

area = width * height
perimeter = 2 * (width + height)

print()
print(f"Area: {area:.2f}")
print(f"Perimeter: {perimeter:.2f}")
