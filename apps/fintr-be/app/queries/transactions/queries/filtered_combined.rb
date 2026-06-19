# frozen_string_literal: true

module Transactions
  module Queries
    class FilteredCombined < Transactions::Queries::BaseQuery
      include CombinedAccountJoinFilter

      # Contract defined in app/queries/transactions/queries/filtered_transactions.rb

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
        relation      = step order(relation)
        relation      = step paginate(relation, params) if params[:paginate] != false
        relation      = step eager_load_transactable_associations(relation)
        relation
      end

      private

      def joins(relation)
        relation = relation.joins(
          "INNER JOIN spaces ON spaces.id = combined_transactions.space_id"
        )
        Success(relation)
      rescue StandardError
        Failure(:join_error)
      end

      def by_category(relation, params)
        return Success(relation) if category_filter_blank?(params)

        if params[:category_id].present?
          relation = relation.where(
            "combined_transactions.category_id = :category_id OR " \
            "combined_transactions.transactable_type IN (:non_category_types)",
            category_id: params[:category_id],
            non_category_types: [
              "Transactions::Transfer",
              "Transactions::Loan",
              "Transactions::LoanPayment"
            ]
          )

          if params[:subcategory_id].present?
            relation = relation.joins(
              "INNER JOIN transactions ON transactions.id = combined_transactions.transactable_id " \
              "AND combined_transactions.transactable_type IN " \
              "('Transactions::Income', 'Transactions::Expense')",
            )
              .where(transactions: { subcategory_id: params[:subcategory_id] })
          end

          return Success(relation)
        end

        relation = relation.where(category_name: params[:category_name])
        Success(relation)
      end

      def category_filter_blank?(params)
        ["all", "", nil].include?(params[:category_name]) &&
          params[:category_id].blank?
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

      def order(relation)
        relation = relation.order(
          date: :desc,
          created_at: :desc
        )
        Success(relation)
      end

      def eager_load_transactable_associations(relation)
        Success(PreloadsCombinedTransactableAssociations.apply(relation))
      end
    end
  end
end
