# API Notes

## Admin Regression Tests

These tests run against a live API instance (default: `http://localhost:8000`).

### Prerequisites

1. Start backend services:

```powershell
docker compose up -d --build db api
```

1. Ensure demo users exist (for auth-based tests):

```powershell
docker compose exec -T api python seed_demo.py
```

1. Install test runner dependencies in your interpreter (if needed):

```powershell
python -m pip install pytest httpx
```

### Run only admin regression tests

```powershell
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
python -m pytest apps/api/tests/test_admin_api_regression.py -q
```

### Optional environment variable overrides

- `API_BASE_URL` (default: `http://localhost:8000`)
- `API_ADMIN_EMAIL` (default: `admin@mdmcreation.com`)
- `API_ADMIN_PASSWORD` (default: `ChangeMe123!`)
- `API_OWNER_EMAIL` (default: `owner@mdmdemo.com`)
- `API_OWNER_PASSWORD` (default: `ChangeMe123!`)

Example:

```powershell
$env:API_BASE_URL='http://localhost:8000'
$env:API_ADMIN_EMAIL='admin@mdmcreation.com'
$env:API_ADMIN_PASSWORD='ChangeMe123!'
$env:API_OWNER_EMAIL='owner@mdmdemo.com'
$env:API_OWNER_PASSWORD='ChangeMe123!'
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'
python -m pytest apps/api/tests/test_admin_api_regression.py -q
```
