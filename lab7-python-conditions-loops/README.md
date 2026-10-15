# Practical Work No. 7 — Operators, Conditional Statements and Loops

Язык: **Python 3** (нужна версия 3.10 или новее из-за `match`). Каждое задание — отдельная программа.

## Запуск

```bash
cd lab7-python-conditions-loops
python3 task01_even_or_odd.py
```

(на Windows: `python task01_even_or_odd.py`)

## Программы и что в них используется

| # | Файл | Задание | Операторы / конструкции |
|---|------|---------|-------------------------|
| 1 | `task01_even_or_odd.py` | чётное или нечётное | `%`, `==`, `if / else` |
| 2 | `task02_exam_admission.py` | допуск к экзамену (посещаемость ≥ 70% и сдан проект) | `>=`, логическое `and`, `or` |
| 3 | `task03_student_grade.py` | оценка A / B / C / F, ошибка вне 0–100 | `if / elif / else`, `or` |
| 4 | `task04_discount_calculator.py` | скидка 0 / 5 / 10 / 15% по сумме в KZT | `if / elif / else`, `<` |
| 5 | `task05_day_of_week.py` | номер → день недели | `match / case` (аналог `switch`) |
| 6 | `task06_numbers_1_to_n.py` | числа от 1 до N | цикл `for` |
| 7 | `task07_sum_of_numbers.py` | сумма от 1 до N | цикл `while`, `+=` |
| 8 | `task08_multiplication_table.py` | таблица умножения от 1 до 10 | цикл `for` |
| 9 | `task09_password_verification.py` | ввод пароля, пока он не станет `java123` | аналог `do...while`: `while True` + `break` |
| 10 | `task10_atm_simulator.py` | банкомат: баланс, пополнение, снятие, выход | цикл с меню, `if / elif`, проверки сумм |

### Про `switch` и `do...while` в Python

- В Python нет `switch`, его аналог — `match / case` (с версии 3.10). `case _` работает как `default`.
- В Python нет `do...while`. Вместо него пишется `while True:`: тело выполняется хотя бы один раз, а условие выхода (`break`) проверяется в конце.

## Примеры работы

**Task 1. Even or Odd**
```
Enter an integer: 14
14 is an even number
```

**Task 2. Exam Admission**
```
Attendance (%): 85
Project completed? (yes/no): yes
Allowed to exam
```
```
Attendance (%): 95
Project completed? (yes/no): no
Not allowed
```

**Task 3. Student Grade Calculator**
```
Final score (0-100): 82
Grade: B
```
```
Final score (0-100): 105
Error: the score must be from 0 to 100
```

**Task 4. Discount Calculator**
```
Purchase amount (KZT): 50000
Original amount: 50,000.00 KZT
Discount: 10%
Final amount: 45,000.00 KZT
```

**Task 5. Day of the Week**
```
Enter a number from 1 to 7: 3
Wednesday
```
```
Enter a number from 1 to 7: 8
Invalid day number
```

**Task 6. Numbers from 1 to N**
```
Enter a positive integer N: 5
1, 2, 3, 4, 5
```

**Task 7. Sum of Numbers**
```
Enter a positive integer N: 100
Sum of numbers from 1 to 100 = 5050
```

**Task 8. Multiplication Table**
```
Enter an integer: 5
5 × 1 = 5
5 × 2 = 10
...
5 × 10 = 50
```

**Task 9. Password Verification**
```
Enter password: qwerty
Wrong password, try again.
Enter password: java123
Access granted
```

**Task 10. ATM Simulator** (сокращённо)
```
===== ATM =====
1. Check balance
2. Deposit money
3. Withdraw money
4. Exit
Choose an option: 1
Your balance: 100,000.00 KZT

Choose an option: 2
Deposit amount: 50000
Deposited 50,000.00 KZT. New balance: 150,000.00 KZT

Choose an option: 2
Deposit amount: -100
Error: the amount must be greater than zero

Choose an option: 3
Withdrawal amount: 200000
Error: insufficient funds

Choose an option: 3
Withdrawal amount: 30000
Withdrew 30,000.00 KZT. New balance: 120,000.00 KZT

Choose an option: 5
Error: invalid menu option, choose 1-4

Choose an option: 4
Thank you for using our ATM. Goodbye!
```
