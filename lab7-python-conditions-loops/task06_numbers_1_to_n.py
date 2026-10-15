# Task 6. Numbers from 1 to N (for loop)

n = int(input("Enter a positive integer N: "))

if n <= 0:
    print("Error: N must be a positive integer")
else:
    for i in range(1, n + 1):
        if i < n:
            print(i, end=", ")
        else:
            print(i)
