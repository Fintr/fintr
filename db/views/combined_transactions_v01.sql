  SELECT 'Transactions::Transfer' as transactable_type, 
        transfers.id AS transactable_id, 
        transfers.space_id,
        transfers.date, 
        transfers.amount_cents, 
        transfers.amount_currency, 
        transfers.description, 
        to_accounts.name as to_account_name, 
        from_accounts.name as from_account_name,
        NULL as balance_cents,
        NULL as balance_currency, 
        NULL as category_name
  FROM transfers
  JOIN spaces ON spaces.id = transfers.space_id
  JOIN accounts as to_accounts ON to_accounts.id = transfers.to_account_id
  JOIN accounts as from_accounts ON from_accounts.id = transfers.from_account_id
UNION ALL
  SELECT transactions.type as transactable_type, 
       transactions.id AS transactable_id, 
       transactions.space_id,
       transactions.date, 
       transactions.amount_cents,
       transactions.amount_currency, 
       transactions.description, 
       CASE 
         WHEN transactions.type = 'Transactions::Income' THEN accounts.name
         ELSE NULL 
       END as to_account_name,
       CASE 
         WHEN transactions.type = 'Transactions::Expense' THEN accounts.name
         ELSE NULL 
       END as from_account_name,
       transactions.balance_cents,
       transactions.balance_currency,
       transactions_categories.name as category_name
  FROM transactions
  JOIN accounts ON accounts.id = transactions.account_id
  JOIN spaces ON spaces.id = transactions.space_id
  JOIN transactions_categories ON transactions_categories.id = transactions.category_id
