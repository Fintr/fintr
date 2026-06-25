# frozen_string_literal: true

module Transactions
  module Queries
    class AccountActivityTotalsByType < Transactions::Queries::BaseQuery
      include AccountActivityCategoryFilter
      include CategoryFilterValidation

      Contract = FilteredAccountActivities::Contract

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

        category_filter_failure = validate_category_filter_tokens(
          params:,
          space: @account.space,
        )
        return Failure(category_filter_failure) if category_filter_failure.present?

        Success(contract.to_h)
      end

      def call
        params   = step validate
        relation = step by_account(@relation)
        relation = step by_date(relation, params)
        relation = step by_category(relation, params)
        relation = step by_amount(relation, params)
        relation = step by_search_query(relation, params)
        relation = step preload_associations(relation)
        step calculate_totals(relation)
      end

      private

      def by_account(relation)
        Success(relation.where(account_id: @account.id))
      end

      def by_category(relation, params)
        apply_account_activity_category_filters(relation, params)
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

      def preload_associations(relation)
        Success(PreloadsAccountActivityAssociations.apply(relation))
      end

      def calculate_totals(relation)
        totals = { income: 0.0, expense: 0.0, transfer: 0.0 }

        relation.find_each do |activity|
          amount = activity_amount_for_total(activity)

          case activity.activity_kind
          when "income"
            totals[:income] += amount
          when "expense"
            totals[:expense] += amount.abs
          when "transfer"
            totals[:transfer] += amount
          end
        end

        Success(totals)
      end

      def activity_amount_for_total(activity)
        transactable = activity.activitable

        if transactable.respond_to?(:amount_numeric_for_space_total)
          return transactable.amount_numeric_for_space_total
        end

        if transactable.respond_to?(:amount_in_space_currency)
          return transactable.amount_in_space_currency[:amount].to_f
        end

        activity.amount.to_f
      end
    end
  end
end
