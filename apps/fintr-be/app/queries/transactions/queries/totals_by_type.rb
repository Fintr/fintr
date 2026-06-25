# frozen_string_literal: true

module Transactions
  module Queries
    class TotalsByType < Transactions::Queries::BaseQuery
      include CombinedAccountJoinFilter
      include CombinedCategoryFilter

      def initialize(relation: Transactions::Combined.non_draft, params: {})
        super(relation:, params:)
      end

      def validate
        contract = Transactions::Queries::FilteredTransactions::Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Not found") if @space.blank?

        Success(contract.to_h)
      end

      def call
        params        = step validate
        relation      = step joins(@relation)
        relation      = step by_space(relation, params)
        relation      = step by_date(relation, params)
        relation      = step by_balance_state(relation, params)
        relation      = step by_amount(relation, params)
        relation      = step by_category(relation, params)
        relation      = step by_search_query(relation, params)
        relation      = step by_account(relation, params)
        totals        = step calculate_totals(relation)
        totals
      end

      private

      def joins(relation)
        relation = relation.joins(
          "INNER JOIN spaces ON spaces.id = combined_transactions.space_id"
        )
        Success(relation)
      rescue ActiveRecord::ActiveRecordError
        Failure(:join_error)
      end

      def by_category(relation, params)
        apply_combined_category_filters(relation, params)
      end

      def category_filter_blank?(params)
        combined_category_filter_blank?(params)
      end

      def by_account(relation, params)
        filter_combined_relation_by_account(relation, params)
      end

      def by_search_query(relation, params)
        search_query = params[:search_query]

        return Success(relation) if params[:search_query].blank?

        relation = relation.where(
          "combined_transactions.description ILIKE :query OR " \
          "combined_transactions.category_name ILIKE :query OR " \
          "combined_transactions.to_account_name ILIKE :query OR " \
          "combined_transactions.from_account_name ILIKE :query",
          query: "%#{search_query}%"
        )
        Success(relation)
      end

      def calculate_totals(relation)
        totals = { income: 0.0, expense: 0.0, transfer: 0.0 }

        relation = PreloadsCombinedTransactableAssociations.apply(relation)

        relation.each do |transaction|
          amount = if transaction.transactable.respond_to?(:amount_numeric_for_space_total)
                     transaction.transactable.amount_numeric_for_space_total
          else
                     transaction.amount.to_f
          end

          case transaction.transactable_type
          when "Transactions::Income"
            totals[:income] += amount
          when "Transactions::Expense"
            # amount_in_space_currency uses the expense sign (negative); totals expose magnitude.
            totals[:expense] += amount.abs
          when "Transactions::Transfer"
            totals[:transfer] += amount
          end
        end

        Success(totals)
      end
    end
  end
end
