# API Endpoints Documentation

This document provides an overview of all available API endpoints in the Fintr Backend application.

## Base URL
All API endpoints are prefixed with `/api/v1`

## Authentication
- All endpoints require authentication via JWT token
- Most endpoints require a valid `X-Space-Code` header to specify the workspace

---

## Authentication Endpoints

| METHOD | PATH | Description |
|--------|------|-------------|
| GET | `/api/v1/auth/private` | Get user's personal and organization spaces |
| GET | `/api/v1/auth/private_scoped` | Test scoped access with read:messages permission |

---

## Dashboard Endpoints

| METHOD | PATH | Description |
|--------|------|-------------|
| GET | `/api/v1/dashboard` | Get dashboard data including account balances and summaries |

---

## Transaction Endpoints

| METHOD | PATH | Description |
|--------|------|-------------|
| GET | `/api/v1/transactions` | List all transactions with filtering and pagination |
| POST | `/api/v1/transactions` | Create a new transaction (income/expense) |
| GET | `/api/v1/transactions/:id` | Get details of a specific transaction |
| PATCH/PUT | `/api/v1/transactions/:id` | Update an existing transaction |
| DELETE | `/api/v1/transactions/:id` | Delete a transaction (with scope options) |

### Transaction Query Parameters
- `start_date` - Filter by start date
- `end_date` - Filter by end date  
- `category_name` - Filter by category
- `min_amount` / `max_amount` - Filter by amount range
- `page` - Pagination

### Transaction Scope Parameters
- `update_scope` - Update scope: "this_only", "this_and_future", "all_in_series"
- `delete_scope` - Delete scope: "this_only", "this_and_future", "all_in_series"

---

## Account Endpoints

| METHOD | PATH | Description |
|--------|------|-------------|
| GET | `/api/v1/transactions/accounts` | List all accounts with category options |
| POST | `/api/v1/transactions/accounts` | Create a new account |
| PATCH/PUT | `/api/v1/transactions/accounts/:id` | Update account details |
| DELETE | `/api/v1/transactions/accounts/:id` | Soft delete an account |

### Account Parameters
- `name` - Account name
- `balance` - Initial balance
- `account_category` - Type: cash, savings, debit, credit_card, e_wallet, loan, investment

---

## Category Endpoints

| METHOD | PATH | Description |
|--------|------|-------------|
| GET | `/api/v1/transactions/categories` | List all transaction categories |
| POST | `/api/v1/transactions/categories` | Create a new category |
| PATCH/PUT | `/api/v1/transactions/categories/:id` | Update category details |
| DELETE | `/api/v1/transactions/categories/:id` | Delete a category |

### Category Parameters
- `name` - Category name
- `category_type` - Type: "income" or "expense"

---

## Transfer Endpoints

| METHOD | PATH | Description |
|--------|------|-------------|
| POST | `/api/v1/transactions/transfers` | Create a money transfer between accounts |
| GET | `/api/v1/transactions/transfers/:id` | Get details of a specific transfer |
| PATCH/PUT | `/api/v1/transactions/transfers/:id` | Update transfer details |
| DELETE | `/api/v1/transactions/transfers/:id` | Delete a transfer |

### Transfer Parameters
- `amount` - Transfer amount
- `transaction_cost` - Transfer fee
- `date` - Transfer date
- `description` - Transfer description
- `from_account_name` - Source account
- `to_account_name` - Destination account
- `schedule_type` - Schedule type for recurring transfers
- `repeat_interval` - Recurrence interval
- `repeat_count` - Number of repetitions

---

## Budget Endpoints

| METHOD | PATH | Description |
|--------|------|-------------|
| GET | `/api/v1/budgets` | Get monthly budget report |
| POST | `/api/v1/budgets` | Create a new budget |
| PATCH/PUT | `/api/v1/budgets/:id` | Update budget amount |
| DELETE | `/api/v1/budgets/:id` | Delete a budget |

### Budget Parameters
- `category_name` - Category to budget for
- `amount` - Budget amount
- `date` - Budget month/year

### Budget Query Parameters
- `space_code` - Workspace code
- `date` - Month/year for budget report

---

## Insights Endpoints

| METHOD | PATH | Description |
|--------|------|-------------|
| GET | `/api/v1/insights` | Get financial insights and analytics |

### Insights Query Parameters
- `category_name` - Filter insights by category
- `start_date` - Start date for insights
- `end_date` - End date for insights

---

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "details": { ... }
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "transactions": [...],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_count": 120
    }
  }
}
```

---

## Headers Required

| Header | Description | Required |
|--------|-------------|----------|
| `Authorization` | Bearer JWT token | Yes |
| `X-Space-Code` | Current workspace code | Yes (except auth endpoints) |
| `Content-Type` | application/json | For POST/PUT requests |

---

## Notes

- All amounts are handled in cents (multiply by 100)
- Dates should be in ISO 8601 format (YYYY-MM-DD)
- Soft deletes are used for accounts (can be restored)
- Hard deletes are used for transactions and transfers
- Recurring transactions/transfers support various intervals
- File uploads are supported for transaction attachments 
