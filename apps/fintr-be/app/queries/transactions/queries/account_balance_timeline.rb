# frozen_string_literal: true

module Transactions
  module Queries
    class AccountBalanceTimeline < Transactions::Queries::BaseQuery
      DEFAULT_MAX_POINTS = 60
      MAX_POINTS_LIMIT = 200

      class Contract < Dry::Validation::Contract
        params do
          required(:account_id).value(:string)
          required(:space_id).value(:string)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          optional(:max_points).value(:integer, gteq?: 2)
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
          space_id: params[:space_id],
        )
        return Failure(account_id: "not found") if @account.blank?

        Success(contract.to_h)
      end

      def call
        params   = step validate
        relation = step by_account(@relation)
        relation = step by_date(relation, params)
        relation = step preload_associations(relation)
        points   = step build_points(relation:, params:)

        {
          points: downsample(points, max_points: normalized_max_points(params)),
          currency: @account.balance_currency.to_s,
        }
      end

      private

      def by_account(relation)
        Success(relation.where(account_id: @account.id))
      end

      def preload_associations(relation)
        Success(PreloadsAccountActivityAssociations.apply(relation))
      end

      def build_points(relation:, params:)
        activities = relation.order(date: :asc, created_at: :asc).to_a
        resolver = ::Transactions::Operations::Accounts::ResolveAccountActivitySignedBalanceEffect.new
        current_balance = BigDecimal(@account.balance.amount.to_s)

        if activities.empty?
          return Success(
            [
              {
                date: params[:start_date].to_date.iso8601,
                occurred_at: params[:start_date].to_time.beginning_of_day.iso8601(3),
                balance: current_balance.round(2).to_f,
                change: nil,
              },
            ],
          )
        end

        signed_effects = []
        total_effect = BigDecimal("0")

        activities.each do |activity|
          effect_result = resolver.call(activity:, account: @account)
          return effect_result unless effect_result.success?

          signed = BigDecimal(effect_result.value![:amount].to_s)
          signed_effects << signed
          total_effect += signed
        end

        opening_balance = current_balance - total_effect
        running = opening_balance
        points = []

        first_activity = activities.first
        opening_occurred_at = params[:start_date].to_time.beginning_of_day
        if opening_occurred_at >= first_activity.created_at
          opening_occurred_at = first_activity.created_at - 1.second
        end

        points << {
          date: params[:start_date].to_date.iso8601,
          occurred_at: opening_occurred_at.iso8601(3),
          balance: opening_balance.round(2).to_f,
          change: nil,
        }

        activities.each_with_index do |activity, index|
          signed = signed_effects[index]
          running += signed
          points << {
            date: activity.date.to_date.iso8601,
            occurred_at: activity.created_at.iso8601(3),
            balance: running.round(2).to_f,
            change: signed.round(2).to_f,
          }
        end

        Success(points)
      rescue StandardError => e
        Failure(error: e.message)
      end

      def normalized_max_points(params)
        requested = params[:max_points] || DEFAULT_MAX_POINTS
        [requested, MAX_POINTS_LIMIT].min
      end

      def downsample(points, max_points:)
        return points if points.size <= max_points

        indices = [0]
        if max_points > 2
          step_size = (points.size - 1).to_f / (max_points - 1)
          (1...(max_points - 1)).each do |i|
            indices << (i * step_size).round
          end
        end
        indices << points.size - 1

        indices
          .uniq
          .sort
          .map { |index| points[index] }
      end
    end
  end
end
