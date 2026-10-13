# Task 8. Circle Calculator

import math

print("=== Circle Calculator ===")

radius = float(input("Radius: "))

area = math.pi * radius ** 2
circumference = 2 * math.pi * radius

print()
print(f"Area: {area:.2f}")
print(f"Circumference: {circumference:.2f}")
