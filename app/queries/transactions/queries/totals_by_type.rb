# frozen_string_literal: true

module Transactions
  module Queries
    class TotalsByType < Transactions::Queries::BaseQuery
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
        return Success(relation) if ["all", "", nil].include?(params[:category_name])

        relation = relation.where(category_name: params[:category_name])
        Success(relation)
      end

      def by_account(relation, params)
        return Success(relation) if ["all", "", nil].include?(params[:account_name])

        relation = relation.where(to_account_name: params[:account_name])
                           .or(relation.where(from_account_name: params[:account_name]))
        Success(relation)
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

        relation.includes(:transactable).each do |transaction|
          amount = if transaction.transactable.respond_to?(:amount_in_space_currency)
                     transaction.transactable.amount_in_space_currency[:amount]
          else
                     transaction.amount.to_f
          end

          case transaction.transactable_type
          when "Transactions::Income"
            totals[:income] += amount
          when "Transactions::Expense"
            totals[:expense] += amount
          when "Transactions::Transfer"
            totals[:transfer] += amount
          end
        end

        Success(totals)
      end
    end
  end
end
