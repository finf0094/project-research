# Task 5. Time Converter

print("=== Time Converter ===")

total_minutes = int(input("Total minutes: "))

hours = total_minutes // 60      # complete hours
minutes = total_minutes % 60     # remaining minutes

print()
print(f"{total_minutes} minutes = {hours} hours {minutes} minutes")
