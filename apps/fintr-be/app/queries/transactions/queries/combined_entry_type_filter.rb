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

      ENTRY_TYPE_VALUES = ENTRY_TYPE_TRANSACTABLE_TYPES.keys.freeze

      private

      def apply_combined_entry_type_filter(relation, params)
        entry_type = params[:entry_type].to_s.presence
        return Success(relation) if entry_type.blank?

        transactable_types = ENTRY_TYPE_TRANSACTABLE_TYPES[entry_type]
        return Success(relation) if transactable_types.blank?

        Success(relation.where(transactable_type: transactable_types))
      end
    end
  end
end
