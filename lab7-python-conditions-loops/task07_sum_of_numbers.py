# Task 7. Sum of Numbers (while loop)

n = int(input("Enter a positive integer N: "))

if n <= 0:
    print("Error: N must be a positive integer")
else:
    total = 0
    i = 1
    while i <= n:
        total += i
        i += 1
    print(f"Sum of numbers from 1 to {n} = {total}")
