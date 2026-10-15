# Task 3. Student Grade Calculator

score = float(input("Final score (0-100): "))

if score < 0 or score > 100:
    print("Error: the score must be from 0 to 100")
elif score >= 90:
    print("Grade: A")
elif score >= 75:
    print("Grade: B")
elif score >= 50:
    print("Grade: C")
else:
    print("Grade: F")
