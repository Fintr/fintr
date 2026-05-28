# frozen_string_literal: true

module Admin
  module Queries
    class SpacesForFreeSubscriptionQuery < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          optional(:search_query).maybe(:string)
          optional(:page)
          optional(:per_page)
        end
      end

      def initialize(relation: ::Spaces::Space.all, params: {})
        super(relation:, params:)
      end

      def call
        params = step validate
        params = step apply_defaults(params:)
        relation = step base_relation
        relation = step apply_search(relation, params:)
        relation = step order_by_transaction_count(relation)
        step paginate(relation, params)
      end

      private

      def validate
        contract = Contract.new.call(
          search_query: params[:search_query],
          page: params[:page],
          per_page: params[:per_page],
        )
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def apply_defaults(params:)
        raw_page = params[:page]
        page =
          if raw_page.blank?
            1
          else
            [raw_page.to_i, 1].max
          end

        raw_per = params[:per_page]
        per_page =
          if raw_per.blank?
            25
          else
            [[raw_per.to_i, 1].max, 100].min
          end

        Success(params.merge(page:, per_page:))
      end

      def base_relation
        Success(
          @relation.includes(:owner, :space_subscriptions),
        )
      end

      def apply_search(relation, params:)
        term = params[:search_query].to_s.strip
        return Success(relation) if term.blank?

        escaped = ActiveRecord::Base.sanitize_sql_like(term)
        pattern = "%#{escaped}%"

        filtered = relation
          .left_joins(:owner)
          .where(
            "spaces.name ILIKE :pattern OR spaces.code ILIKE :pattern OR " \
            "users.email ILIKE :pattern OR COALESCE(users.full_name, '') ILIKE :pattern",
            pattern:,
          )
          .distinct

        Success(filtered)
      end

      def order_by_transaction_count(relation)
        counts = ::Transactions::Transaction
          .group(:space_id)
          .select("space_id, COUNT(*)::integer AS transactions_count")

        ordered = relation
          .joins(
            "LEFT JOIN (#{counts.to_sql}) AS space_transaction_counts " \
            "ON space_transaction_counts.space_id = spaces.id",
          )
          .select(
            "spaces.*, COALESCE(space_transaction_counts.transactions_count, 0) AS transactions_count",
          )
          .order(Arel.sql("transactions_count DESC"), "spaces.created_at DESC")

        Success(ordered)
      end
    end
  end
end
