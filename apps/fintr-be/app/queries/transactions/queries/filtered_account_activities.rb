# frozen_string_literal: true

module Transactions
  module Queries
    class FilteredAccountActivities < Transactions::Queries::BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:account_id).value(:string)
          required(:space_id).value(:string)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          optional(:page).value(:integer)
          optional(:per_page).maybe(:integer)
          optional(:search_query).value(:string)
          optional(:category_name).maybe(:string)
          optional(:category_id).maybe(:string)
          optional(:subcategory_id).maybe(:string)
          optional(:min_amount).maybe(:integer, gteq?: 0)
          optional(:max_amount).maybe(:integer)
        end

        rule(:min_amount, :max_amount) do
          if values[:min_amount].is_a?(Integer) && values[:max_amount].is_a?(Integer)
            key.failure("should be less than max_amount") if values[:min_amount] > values[:max_amount]
          end
        end

        rule(:category_id, :subcategory_id) do
          if values[:subcategory_id].present? && values[:category_id].blank?
            key(:category_id).failure("is required when subcategory_id is provided")
          end
        end
      end

      def initialize(relation: Transactions::AccountActivity.all, params: {})
        super(relation:, params:)
      end

      def validate
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @account = Transactions::Account.kept.find_by(
          id: params[:account_id],
          space_id: params[:space_id]
        )
        return Failure(account_id: "not found") if @account.blank?

        if params[:category_id].present?
          assignment = Transactions::Operations::ResolveCategoryAssignment.new.call(
            space_id: params[:space_id],
            category_id: params[:category_id],
            subcategory_id: params[:subcategory_id]
          )
          return Failure(assignment.failure) if assignment.failure?
        end

        Success(contract.to_h)
      end

      def call
        params   = step validate
        relation = step by_account(@relation)
        relation = step by_date(relation, params)
        relation = step by_category(relation, params)
        relation = step by_amount(relation, params)
        relation = step by_search_query(relation, params)
        relation = step order(relation)
        relation = step paginate(relation, params)
        relation = step preload_associations(relation)
        relation
      end

      private

      def by_account(relation)
        Success(relation.where(account_id: @account.id))
      end

      def by_category(relation, params)
        return Success(relation) if category_filter_blank?(params)

        if params[:category_id].present?
          relation = relation.where(
            "account_activities.category_id = :category_id OR " \
            "account_activities.activity_kind IN (:non_category_kinds)",
            category_id: params[:category_id],
            non_category_kinds: %w[transfer loan_disbursement loan_payment]
          )

          if params[:subcategory_id].present?
            relation = relation
              .joins(<<~SQL.squish)
                INNER JOIN transactions activity_subcat_tx
                  ON activity_subcat_tx.id = account_activities.activitable_id
                 AND account_activities.activitable_type IN (
                   'Transactions::Income',
                   'Transactions::Expense'
                 )
              SQL
              .where(activity_subcat_tx: { subcategory_id: params[:subcategory_id] })
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

      def by_search_query(relation, params)
        return Success(relation) if params[:search_query].blank?

        search_query = params[:search_query]
        relation = relation.where(
          "account_activities.description ILIKE :query OR " \
          "account_activities.category_name ILIKE :query OR " \
          "account_activities.entity_name ILIKE :query OR " \
          "account_activities.to_account_name ILIKE :query OR " \
          "account_activities.from_account_name ILIKE :query",
          query: "%#{search_query}%"
        )
        Success(relation)
      rescue StandardError
        Failure(:search_query_error)
      end

      def order(relation)
        relation = relation.order(
          date: :desc,
          created_at: :desc
        )
        Success(relation)
      rescue StandardError
        Failure(:order_error)
      end

      def preload_associations(relation)
        Success(PreloadsAccountActivityAssociations.apply(relation))
      end
    end
  end
end
