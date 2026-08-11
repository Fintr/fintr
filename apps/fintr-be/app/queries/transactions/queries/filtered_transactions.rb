# frozen_string_literal: true

module Transactions
  module Queries
    class FilteredTransactions < BaseQuery
      include TransactionTagFilter

      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
          optional(:category_name).maybe(:string)
          optional(:category_id).maybe(:string)
          optional(:subcategory_id).maybe(:string)
          optional(:category_filters).array(:string)
          optional(:account_name).maybe(:string)
          optional(:account_id).maybe(:string)
          optional(:account_names).array(:string)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          optional(:page).value(:integer)
          optional(:min_amount).maybe(:integer, gteq?: 0)
          optional(:max_amount).maybe(:integer)
          optional(:per_page).maybe(:integer)
          optional(:balance_state).value(:string)
          optional(:paginate).value(:bool)
          optional(:search_query).value(:string)
          optional(:transaction_type).value(:string)
          optional(:entry_type).value(:string)
          optional(:tag_ids).array(:string)

          optional(:without_initial_balance).value(:bool)
        end

        rule(:min_amount, :max_amount) do
          if values[:min_amount].is_a?(Integer) && values[:max_amount].is_a?(Integer)
            key.failure("should be less than max_amount") if values[:min_amount] > values[:max_amount]
          end
        end

        rule(:balance_state) do
          if value
            key.failure("should be one of #{Transactions::Transaction.balance_states.values}") unless Transactions::Transaction.balance_states.values.include?(value)
          end
        end

        rule(:transaction_type) do
          if value
            valid_types = ["Transactions::Income", "Transactions::Expense"]
            key.failure("should be one of #{valid_types}") unless valid_types.include?(value)
          end
        end

        rule(:entry_type) do
          if value
            valid_types = Transactions::Queries::CombinedEntryTypeFilter::ENTRY_TYPE_VALUES
            key.failure("should be one of #{valid_types}") unless valid_types.include?(value)
          end
        end

        rule(:category_id, :subcategory_id) do
          if values[:subcategory_id].present? && values[:category_id].blank?
            key(:category_id).failure("is required when subcategory_id is provided")
          end
        end
      end

      attr_reader :space

      def validate
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @space = Spaces::Space.find_by(code: params[:space_code])
        return Failure({ space_code: "Not found" }) if @space.blank?

        if params[:category_id].present?
          assignment = Transactions::Operations::ResolveCategoryAssignment.new.call(
            space_id: space.id,
            category_id: params[:category_id],
            subcategory_id: params[:subcategory_id]
          )
          return Failure(assignment.failure) if assignment.failure?
        end

        Success(contract.to_h)
      end

      def call
        params   = step validate
        relation = step joins(@relation)
        relation = step by_space(relation, params)
        relation = step by_balance_state(relation, params)
        relation = step by_date(relation, params)
        relation = step by_category(relation, params)
        relation = step by_tag(relation, params)
        relation = step without_initial_balance(relation, params)
        relation = step by_amount(relation, params)
        relation = step by_search_query(relation, params)
        relation = step by_transaction_type(relation, params)
        relation = step select(relation)
        relation = step order(relation)
        relation = step paginate(relation, params) if params[:paginate] != false
        relation
      end

      def joins(relation)
        relation = relation.joins(
          "INNER JOIN accounts ON accounts.id = transactions.account_id",
          "INNER JOIN spaces ON spaces.id = transactions.space_id",
          "INNER JOIN transactions_categories ON transactions_categories.id = transactions.category_id",
          "LEFT JOIN transactions_categories subcategories ON subcategories.id = transactions.subcategory_id"
        )
        Success(relation)
      rescue StandardError
        Failure(:join_error)
      end

      def select(relation)
        relation = relation.select(
          "id",
          "transactions.space_id as space_id",
          "date",
          "amount_cents",
          "amount_currency",
          "transactions.balance_cents as balance_cents",
          "transactions.balance_currency as balance_currency",
          "description",
          "transactions.type as type",
          "NULL as from_account_name",
          "accounts.name as to_account_name",
          "transactions_categories.name as category_name",
          "transactions.category_id as category_id",
          "transactions.subcategory_id as subcategory_id",
          "subcategories.name as subcategory_name"
        )
        Success(relation)
      rescue StandardError
        Failure(:select_error)
      end

      def by_category(relation, params)
        return Success(relation) if category_filter_blank?(params)

        if params[:category_id].present?
          relation = relation.where(category_id: params[:category_id])
          if params[:subcategory_id].present?
            relation = relation.where(subcategory_id: params[:subcategory_id])
          end
          return Success(relation)
        end

        relation = relation.where(transactions_categories: { name: params[:category_name] })
        Success(relation)
      end

      def by_tag(relation, params)
        apply_transaction_tag_filters(relation, params)
      end

      def category_filter_blank?(params)
        ["all", "", nil].include?(params[:category_name]) &&
          params[:category_id].blank?
      end

      def by_search_query(relation, params)
        return Success(relation) if params[:search_query].blank?

        search_query = params[:search_query]
        relation = relation.where(
          "transactions.description ILIKE :query OR " \
          "transactions_categories.name ILIKE :query OR " \
          "accounts.name ILIKE :query",
          query: "%#{search_query}%"
        )
        Success(relation)
      rescue StandardError
        Failure(:search_query_error)
      end

      def without_initial_balance(relation, params)
        return Success(relation) unless params[:without_initial_balance]

        relation = relation.where.not(transactions_categories: { name: "Initial Balance" })
        Success(relation)
      end

      def by_transaction_type(relation, params)
        return Success(relation) unless params[:transaction_type]

        relation = relation.where(type: params[:transaction_type])
        Success(relation)
      end

      def order(relation)
        relation =  relation.order(
                      date: :desc,
                      type: :desc,
                      amount_currency: :asc,
                      amount_cents: :desc
                    )
        Success(relation)
      rescue StandardError
        Failure(:order_error)
      end
    end
  end
end
