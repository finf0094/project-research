# Artificial Intelligence — Laboratory Works

Dataset topic: **Student performance** — predicting whether a student passes the final exam (`passed`, 1/0).
The same dataset (`student_performance.csv`, 55 records, 8 features + 1 target) is used in all labs.

| Lab | Folder | Contents |
|---|---|---|
| Lab 1. Creating a Dataset | [`lab1/`](lab1) | `student_performance.csv`, `student_performance.xlsx` (data + data dictionary), `lab1_creating_dataset.ipynb` |
| Lab 2. Preparing the ML Task | [`lab2/`](lab2) | `lab2_ml_task.ipynb` — X/y, train/test split, task type, model choice, data leakage check, ML pipeline |
| Labs 3–5. Comparative Analysis of ML Models | [`lab3-5/`](lab3-5) | `lab3-5_model_comparison.ipynb`, `model_comparison.csv`, `decision_tree.png`, `feature_importance.png`, `confusion_matrices.png`, `model_comparison.png` |

## Results of Labs 3–5 (test set, 11 students)

| Model | Accuracy | Precision | Recall | F1-score |
|---|---|---|---|---|
| **Logistic Regression** | **0.909** | **0.875** | **1.000** | **0.933** |
| Naive Bayes | 0.818 | 0.857 | 0.857 | 0.857 |
| K-Nearest Neighbors | 0.727 | 0.700 | 1.000 | 0.824 |
| Support Vector Machine | 0.727 | 0.700 | 1.000 | 0.824 |
| Random Forest | 0.727 | 0.833 | 0.714 | 0.769 |
| Decision Tree | 0.455 | 0.571 | 0.571 | 0.571 |

- Strongest model: **Logistic Regression**
- Most important feature (Random Forest): **`study_hours_per_week`**
- New student prediction: **passed** (probability ≈ 0.95)

## How to run

Open a notebook in Google Colab or Jupyter and upload `student_performance.csv` next to it
(every lab folder already contains a copy). Requirements: `pandas`, `scikit-learn`, `matplotlib`.
