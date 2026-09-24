# frozen_string_literal: true

module Transactions
  module Queries
    module CombinedEntryTypeFilter
      ENTRY_TYPE_TRANSACTABLE_TYPES = {
        "expense" => %w[Transactions::Expense],
        "income" => %w[Transactions::Income],
        "transfers" => %w[Transactions::Transfer],
        "loans" => %w[
          Transactions::Loan
          Transactions::LoanPayment
        ],
      }.freeze

      RECURRING_ENTRY_TYPE = "recurring"

      ENTRY_TYPE_VALUES = (ENTRY_TYPE_TRANSACTABLE_TYPES.keys + [RECURRING_ENTRY_TYPE]).freeze

      RECURRING_COMBINED_TRANSACTIONS_SQL = <<~SQL.squish
        (
          combined_transactions.transactable_type IN ('Transactions::Income', 'Transactions::Expense')
          AND EXISTS (
            SELECT 1
            FROM transactions recurring_tx
            WHERE recurring_tx.id = combined_transactions.transactable_id
              AND (
                recurring_tx.parent_id IS NOT NULL
                OR recurring_tx.schedule_type IN ('repeat', 'installment')
              )
          )
        )
        OR (
          combined_transactions.transactable_type = 'Transactions::Transfer'
          AND EXISTS (
            SELECT 1
            FROM transfers recurring_tr
            WHERE recurring_tr.id = combined_transactions.transactable_id
              AND (
                recurring_tr.parent_id IS NOT NULL
                OR recurring_tr.schedule_type IN ('repeat', 'installment')
              )
          )
        )
      SQL

      private

      def apply_combined_entry_type_filter(relation, params)
        entry_type = params[:entry_type].to_s.presence
        return Success(relation) if entry_type.blank?

        if entry_type == RECURRING_ENTRY_TYPE
          return Success(relation.where(RECURRING_COMBINED_TRANSACTIONS_SQL))
        end

        transactable_types = ENTRY_TYPE_TRANSACTABLE_TYPES[entry_type]
        return Success(relation) if transactable_types.blank?

        Success(relation.where(transactable_type: transactable_types))
      end
    end
  end
end
