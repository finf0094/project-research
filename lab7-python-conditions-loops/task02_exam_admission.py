# Task 2. Exam Admission

attendance = float(input("Attendance (%): "))
project_answer = input("Project completed? (yes/no): ").strip().lower()

project_done = project_answer == "yes" or project_answer == "y"

if attendance >= 70 and project_done:
    print("Allowed to exam")
else:
    print("Not allowed")
