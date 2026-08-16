# Unsaved bank account drawer close guard

- Verified URL: `http://localhost:3101/finance-tax/company-bank-accounts?dialog=new`
- Viewport: `1440 x 1000`
- Changed field: account number last four digits, from empty to `5678`
- Observed preview: `Stored mask preview: •••• 5678`
- Action: selected the drawer close control before submitting
- Result: the browser opened a native `confirm` dialog and did not close the drawer or navigate until the operator chose whether to discard the edit
- Capture limitation: the in-app browser blocks screenshots while a native JavaScript dialog is active, so the dirty drawer state is retained in `03-add-drawer-last4-preview-1440x1000.jpg` and this record documents the confirmed dialog behavior

No create, update, approval, archive, or cleanup mutation was submitted during this check.
