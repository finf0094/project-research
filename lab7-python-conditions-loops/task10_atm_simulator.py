# Task 10. ATM Simulator

balance = 100_000  # KZT

while True:
    print()
    print("===== ATM =====")
    print("1. Check balance")
    print("2. Deposit money")
    print("3. Withdraw money")
    print("4. Exit")
    choice = input("Choose an option: ")

    if choice == "1":
        print(f"Your balance: {balance:,.2f} KZT")

    elif choice == "2":
        amount = float(input("Deposit amount: "))
        if amount <= 0:
            print("Error: the amount must be greater than zero")
        else:
            balance += amount
            print(f"Deposited {amount:,.2f} KZT. New balance: {balance:,.2f} KZT")

    elif choice == "3":
        amount = float(input("Withdrawal amount: "))
        if amount <= 0:
            print("Error: the amount must be greater than zero")
        elif amount > balance:
            print("Error: insufficient funds")
        else:
            balance -= amount
            print(f"Withdrew {amount:,.2f} KZT. New balance: {balance:,.2f} KZT")

    elif choice == "4":
        print("Thank you for using our ATM. Goodbye!")
        break

    else:
        print("Error: invalid menu option, choose 1-4")
