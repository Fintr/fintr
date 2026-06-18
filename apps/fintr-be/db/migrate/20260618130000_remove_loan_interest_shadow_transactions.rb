# frozen_string_literal: true

# One-time cleanup of loan-linked interest expense/income rows in +transactions+.
#
# These were created by CreateLoanInterestTransaction as bookkeeping rows for budgets
# and reports. Cash impact is already recorded on +loan_payments+ via
# UpdateAccountBalanceForLoanPayment. The +loan_payments.transaction_id+ link is the
# authoritative signal that a transaction is a shadow row and must not revert account
# balances on deletion — regardless of +balance_state+ or +balance_cents+.
#
# Irreversible: deleted rows are not recreated.
class RemoveLoanInterestShadowTransactions < ActiveRecord::Migration[8.1]
  TRANSACTION_RECORD_TYPES = %w[
    Transactions::Transaction
    Transactions::Expense
    Transactions::Income
  ].freeze

  def up
    say_with_time "Removing loan-linked interest shadow transactions" do
      transaction_ids = select_values(<<~SQL.squish)
        SELECT transaction_id
        FROM loan_payments
        WHERE transaction_id IS NOT NULL
      SQL

      return 0 if transaction_ids.empty?

      say "Found #{transaction_ids.size} loan payment(s) with linked interest transaction(s)"

      execute <<~SQL.squish
        UPDATE loan_payments
        SET transaction_id = NULL
        WHERE transaction_id IN (#{quoted_ids(transaction_ids)})
      SQL

      delete_shadow_transactions(transaction_ids:)

      transaction_ids.size
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
          "Loan-linked interest shadow transactions were permanently removed"
  end

  private

  def delete_shadow_transactions(transaction_ids:)
    quoted = quoted_ids(transaction_ids)
    quoted_types = TRANSACTION_RECORD_TYPES.map { |type| connection.quote(type) }.join(", ")

    execute <<~SQL.squish
      DELETE FROM rag_embeddings
      WHERE embeddable_id IN (#{quoted})
    SQL

    if table_exists?(:transaction_versions)
      execute <<~SQL.squish
        DELETE FROM transaction_versions
        WHERE item_id IN (#{quoted})
      SQL
    end

    execute <<~SQL.squish
      DELETE FROM currency_conversions
      WHERE convertible_id IN (#{quoted})
    SQL

    execute <<~SQL.squish
      DELETE FROM active_storage_attachments
      WHERE record_id IN (#{quoted})
        AND record_type IN (#{quoted_types})
    SQL

    execute <<~SQL.squish
      DELETE FROM transactions
      WHERE id IN (#{quoted})
    SQL
  end

  def quoted_ids(ids)
    ids.map { |id| connection.quote(id) }.join(", ")
  end
end
