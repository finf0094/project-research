# Task 9. Password Verification
# Python has no do...while, so "while True" + break is used:
# the body always runs at least once, the check is at the end.

CORRECT_PASSWORD = "java123"

while True:
    password = input("Enter password: ")
    if password == CORRECT_PASSWORD:
        break
    print("Wrong password, try again.")

print("Access granted")
