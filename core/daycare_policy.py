"""Daycare cohort: Pre-K1 (3–3y11m) and Pre-K2 (4–4y11m).

Source: bundled LRP No. 1, pages 3–4. Ages use the academic-year
start date, consistently with Child.age_for_academic_year.
"""
DAYCARE_MIN_AGE = 3
DAYCARE_MAX_AGE = 4


def is_daycare_age(age):
    try:
        value = float(age)
        return DAYCARE_MIN_AGE <= value < DAYCARE_MAX_AGE + 1
    except (TypeError, ValueError, OverflowError):
        return False
