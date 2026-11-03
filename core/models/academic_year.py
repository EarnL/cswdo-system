from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class AcademicYear(models.Model):
    name = models.CharField(max_length=20, unique=True, help_text="Example: 2026-2027")
    start_year = models.PositiveIntegerField()
    end_year = models.PositiveIntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_year", "name"]

    def clean(self):
        if self.end_year != self.start_year + 1:
            raise ValidationError("Academic year must end one year after it starts.")
        if self.end_date <= self.start_date:
            raise ValidationError("Academic year end date must be after the start date.")

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = f"{self.start_year}-{self.end_year}"
        super().save(*args, **kwargs)
        if self.is_active:
            AcademicYear.objects.exclude(pk=self.pk).update(is_active=False)

    def __str__(self):
        return self.name

    @classmethod
    def get_current(cls):
        today = timezone.localdate()
        current = cls.objects.filter(start_date__lte=today, end_date__gte=today).order_by("-is_active").first()
        if current:
            return current
        active = cls.objects.filter(is_active=True).first()
        if active:
            return active

        start_year = today.year if today.month >= 6 else today.year - 1
        return cls.objects.create(
            name=f"{start_year}-{start_year + 1}",
            start_year=start_year,
            end_year=start_year + 1,
            start_date=timezone.datetime(start_year, 6, 1).date(),
            end_date=timezone.datetime(start_year + 1, 5, 31).date(),
            is_active=True,
        )
