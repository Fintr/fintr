# frozen_string_literal: true

module Admin
  module Queries
    class DailyActiveUsersQuery < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          optional(:start_date).maybe(:date)
          optional(:end_date).maybe(:date)
          optional(:group_by).maybe(:string)
        end
      end

      def validate
        contract = Contract.new.call(
          start_date: params[:start_date],
          end_date: params[:end_date],
          group_by: params[:group_by]
        )
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def initialize(relation: UserActivity.all, params: {})
        super(relation:, params:)
      end

      def call
        params = step validate
        relation = step apply_date_range(@relation, params)
        relation = step apply_grouping(relation, params)
        relation
      end

      private

      def apply_date_range(relation, params)
        start_date = params[:start_date] || 30.days.ago.to_date
        end_date = params[:end_date] || Date.current

        Success(
          relation.for_date_range(start_date, end_date).active_users
        )
      end

      def apply_grouping(relation, params)
        case params[:group_by]
        when "day"
          Success(
            relation.group(:activity_date)
                    .count(:user_id)
                    .transform_keys(&:to_s)
          )
        when "week"
          Success(
            relation.group("DATE_TRUNC('week', activity_date)")
                    .count(:user_id)
                    .transform_keys { |date| date.to_date.to_s }
          )
        when "month"
          Success(
            relation.group("DATE_TRUNC('month', activity_date)")
                    .count(:user_id)
                    .transform_keys { |date| date.to_date.to_s }
          )
        else
          # Default: return daily counts
          Success(
            relation.group(:activity_date)
                    .count(:user_id)
                    .transform_keys(&:to_s)
          )
        end
      end
    end
  end
end
