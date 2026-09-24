SELECT
  'Transactions::Transfer' AS transactable_type,
  transfers.id AS transactable_id,
  transfers.space_id,
  transfers.date,
  transfers.amount_cents,
  transfers.amount_currency,
  transfers.description,
  to_accounts.name AS to_account_name,
  from_accounts.name AS from_account_name,
  NULL::bigint AS balance_cents,
  NULL::character varying AS balance_currency,
  NULL::character varying AS category_name,
  NULL::uuid AS category_id,
  transfers.transaction_cost_cents,
  transfers.transaction_cost_currency,
  transfers.balance_state,
  transfers.created_at,
  NULL::uuid AS loan_id,
  NULL::character varying AS entity_name,
  NULL::character varying AS loan_type
FROM transfers
JOIN spaces ON spaces.id = transfers.space_id
JOIN accounts AS to_accounts ON to_accounts.id = transfers.to_account_id
JOIN accounts AS from_accounts ON from_accounts.id = transfers.from_account_id

UNION ALL

SELECT
  transactions.type AS transactable_type,
  transactions.id AS transactable_id,
  transactions.space_id,
  transactions.date,
  transactions.amount_cents,
  transactions.amount_currency,
  transactions.description,
  CASE
    WHEN transactions.type = 'Transactions::Income' THEN accounts.name
    ELSE NULL
  END AS to_account_name,
  CASE
    WHEN transactions.type = 'Transactions::Expense' THEN accounts.name
    ELSE NULL
  END AS from_account_name,
  transactions.balance_cents,
  transactions.balance_currency,
  transactions_categories.name AS category_name,
  transactions_categories.id AS category_id,
  NULL::bigint AS transaction_cost_cents,
  NULL::character varying AS transaction_cost_currency,
  transactions.balance_state,
  transactions.created_at,
  NULL::uuid AS loan_id,
  entities.full_name AS entity_name,
  NULL::character varying AS loan_type
FROM transactions
JOIN accounts ON accounts.id = transactions.account_id
JOIN spaces ON spaces.id = transactions.space_id
JOIN transactions_categories ON transactions_categories.id = transactions.category_id
LEFT JOIN entities ON entities.id = transactions.entity_id
WHERE transactions.type IN ('Transactions::Income', 'Transactions::Expense')
  AND NOT EXISTS (
    SELECT 1
    FROM loan_payments
    WHERE loan_payments.transaction_id = transactions.id
  )

UNION ALL

SELECT
  'Transactions::Loan' AS transactable_type,
  loans.id AS transactable_id,
  loans.space_id,
  loans.date,
  loans.principal_amount_cents AS amount_cents,
  loans.currency AS amount_currency,
  COALESCE(loans.description, 'Loan — ' || entities.full_name) AS description,
  CASE
    WHEN loans.loan_type = 'borrowed' THEN accounts.name
    ELSE NULL
  END AS to_account_name,
  CASE
    WHEN loans.loan_type = 'lent' THEN accounts.name
    ELSE NULL
  END AS from_account_name,
  NULL::bigint AS balance_cents,
  NULL::character varying AS balance_currency,
  NULL::character varying AS category_name,
  NULL::uuid AS category_id,
  NULL::bigint AS transaction_cost_cents,
  NULL::character varying AS transaction_cost_currency,
  NULL::balance_state AS balance_state,
  loans.created_at,
  loans.id AS loan_id,
  entities.full_name AS entity_name,
  loans.loan_type
FROM loans
JOIN accounts ON accounts.id = loans.account_id
JOIN spaces ON spaces.id = loans.space_id
JOIN entities ON entities.id = loans.entity_id
WHERE loans.adjusts_account_balance = TRUE

UNION ALL

SELECT
  'Transactions::LoanPayment' AS transactable_type,
  loan_payments.id AS transactable_id,
  loans.space_id,
  loan_payments.date,
  loan_payments.total_payment_cents AS amount_cents,
  loan_payments.currency AS amount_currency,
  COALESCE(loan_payments.notes, 'Loan payment — ' || entities.full_name) AS description,
  CASE
    WHEN loans.loan_type = 'lent' THEN accounts.name
    ELSE NULL
  END AS to_account_name,
  CASE
    WHEN loans.loan_type = 'borrowed' THEN accounts.name
    ELSE NULL
  END AS from_account_name,
  NULL::bigint AS balance_cents,
  NULL::character varying AS balance_currency,
  NULL::character varying AS category_name,
  NULL::uuid AS category_id,
  NULL::bigint AS transaction_cost_cents,
  NULL::character varying AS transaction_cost_currency,
  NULL::balance_state AS balance_state,
  loan_payments.created_at,
  loans.id AS loan_id,
  entities.full_name AS entity_name,
  loans.loan_type
FROM loan_payments
JOIN loans ON loans.id = loan_payments.loan_id
JOIN accounts ON accounts.id = loan_payments.account_id
JOIN entities ON entities.id = loans.entity_id
WHERE loan_payments.adjusts_account_balance = TRUE
