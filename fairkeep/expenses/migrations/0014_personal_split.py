from django.db import migrations


def mark_personal(apps, schema_editor):
    Expense = apps.get_model('expenses', 'Expense')
    ExpenseSplit = apps.get_model('expenses', 'ExpenseSplit')

    personal_ids = []
    # personal if split_method equal AND only one split OR all other splits owed_amount == 0 and paid_amount==0
    for exp in Expense.objects.filter(split_method='equal'):
        splits = list(ExpenseSplit.objects.filter(expense=exp))
        if len(splits) == 1:
            personal_ids.append(exp.id)
            continue
        non_zero = [s for s in splits if (s.owed_amount or 0) != 0 or (s.paid_amount or 0) != 0]
        if len(non_zero) == 1:
            personal_ids.append(exp.id)
    if personal_ids:
        Expense.objects.filter(id__in=personal_ids).update(split_method='personal')


def mark_personal_reverse(apps, schema_editor):
    Expense = apps.get_model('expenses', 'Expense')
    Expense.objects.filter(split_method='personal').update(split_method='equal')


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0013_useravatar'),
    ]

    operations = [
        migrations.RunPython(mark_personal, mark_personal_reverse),
    ]
