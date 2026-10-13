# Practical Work No. 6 — Variables, Data Types, Input and Calculations

Язык: **Python 3**. Каждое задание — отдельная программа. Условия и циклы не используются, как и написано в задании.

## Запуск

```bash
cd lab6-python-variables
python3 task01_discount_calculator.py
```

(на Windows: `python task01_discount_calculator.py`)

## Программы

| # | Файл | Что делает | Типы данных |
|---|------|------------|-------------|
| 1 | `task01_discount_calculator.py` | сумма до скидки, размер скидки, итог | `float`, `int` |
| 2 | `task02_temperature_converter.py` | °C → °F | `float` |
| 3 | `task03_rectangle_calculator.py` | площадь и периметр прямоугольника | `float` |
| 4 | `task04_average_grade_calculator.py` | средняя из трёх оценок | `float` |
| 5 | `task05_time_converter.py` | минуты → часы и минуты (`//` и `%`) | `int` |
| 6 | `task06_salary_calculator.py` | зарплата до налога, налог 10%, на руки | `str`, `float`, константа `TAX_RATE` |
| 7 | `task07_bmi_calculator.py` | индекс массы тела | `float` |
| 8 | `task08_circle_calculator.py` | площадь и длина окружности (`math.pi`) | `float` |
| 9 | `task09_loan_calculator.py` | кредит по простым процентам: проценты, всего к выплате, платёж в месяц | `float`, `int` |
| 10 | `task10_shopping_cart_calculator.py` | чек покупки | `str`, `float`, `int` |

## Примеры работы

**Task 1. Discount Calculator**
```
=== Discount Calculator ===
Product price: 1500
Quantity: 3
Discount (%): 10

Subtotal before discount: 4500.00
Discount amount (10%): 450.00
Final price after discount: 4050.00
```

**Task 2. Temperature Converter**
```
=== Temperature Converter ===
Temperature in Celsius: 36.6

36.6 °C = 97.9 °F
```

**Task 3. Rectangle Calculator**
```
=== Rectangle Calculator ===
Width: 5
Height: 3.5

Area: 17.50
Perimeter: 17.00
```

**Task 4. Average Grade Calculator**
```
=== Average Grade Calculator ===
Grade 1: 85
Grade 2: 90
Grade 3: 78

Average grade: 84.33
```

**Task 5. Time Converter**
```
=== Time Converter ===
Total minutes: 135

135 minutes = 2 hours 15 minutes
```

**Task 6. Salary Calculator**
```
=== Salary Calculator ===
Employee name: Alex Smith
Hours worked: 160
Hourly rate: 12.5

Employee: Alex Smith
Gross salary: 2000.00
Tax (10%): 200.00
Net salary: 1800.00
```

**Task 7. BMI Calculator**
```
=== BMI Calculator ===
Weight (kg): 70
Height (m): 1.75

BMI: 22.9
```

**Task 8. Circle Calculator**
```
=== Circle Calculator ===
Radius: 5

Area: 78.54
Circumference: 31.42
```

**Task 9. Loan Calculator**
```
=== Loan Calculator ===
Loan amount: 10000
Annual interest rate (%): 12
Loan term (years): 3

Total interest: 3600.00
Total repayment: 13600.00
Monthly payment (approx.): 377.78
```

**Task 10. Shopping Cart Calculator**
```
=== Shopping Cart Calculator ===
Customer name: Alex Smith
Product name: Headphones
Price per item: 49.99
Quantity: 2
Discount (%): 15
Delivery cost: 5

============ RECEIPT ============
Customer:  Alex Smith
Product:   Headphones
Quantity:  2
---------------------------------
Subtotal:         99.98
Discount:         15.00
Delivery:          5.00
---------------------------------
TOTAL:            89.98
=================================
```

## Формулы

- Скидка: `subtotal = price × quantity`, `discount = subtotal × percent / 100`
- Температура: `F = C × 9/5 + 32`
- Прямоугольник: `S = a × b`, `P = 2 × (a + b)`
- BMI: `weight / height²`
- Круг: `S = π × r²`, `C = 2 × π × r`
- Простые проценты: `interest = amount × rate / 100 × years`, `monthly = (amount + interest) / (years × 12)`
