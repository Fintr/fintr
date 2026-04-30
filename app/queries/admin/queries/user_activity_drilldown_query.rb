# frozen_string_literal: true

module Admin
  module Queries
    class UserActivityDrilldownQuery < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:start_date).value(:date)
          required(:end_date).value(:date)
        end
      end

      def initialize(params: {})
        super(relation: UserActivity.all, params:)
      end

      def call
        validated = step validate
        window = step build_window(validated:)
        step load_rows(window:)
      end

      private

      def validate
        contract = Contract.new.call(
          start_date: params[:start_date],
          end_date: params[:end_date]
        )
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def build_window(validated:)
        start_date = validated[:start_date]
        end_date = validated[:end_date]
        time_range = start_date.in_time_zone.beginning_of_day..end_date.in_time_zone.end_of_day

        Success(
          {
            start_date:,
            end_date:,
            time_range:
          }
        )
      end

      def load_rows(window:)
        start_date = window[:start_date]
        end_date = window[:end_date]
        time_range = window[:time_range]

        user_ids = UserActivity
          .for_date_range(start_date, end_date)
          .active_users
          .distinct
          .pluck(:user_id)

        return Success([]) if user_ids.empty?

        ua_sums = user_activity_sums(
          user_ids:,
          start_date:,
          end_date:
        )
        transaction_counts = transaction_counts(
          user_ids:,
          time_range:
        )
        standalone_tx_counts = standalone_transaction_counts(
          user_ids:,
          time_range:
        )
        transfer_leg_counts = transfer_leg_transaction_counts(
          user_ids:,
          time_range:
        )
        transfer_counts = transfer_counts(
          user_ids:,
          time_range:
        )
        receipt_counts = ai_usage_counts_by_user(
          user_ids:,
          time_range:,
          ai_type: :pure_ai_ocr
        )
        chat_counts = ai_usage_counts_by_user(
          user_ids:,
          time_range:,
          ai_type: :ai_chat
        )
        interaction_counts = ai_interaction_counts(
          user_ids:,
          time_range:
        )

        users_by_id = Auth::User.where(id: user_ids).index_by(&:id)

        rows = user_ids.filter_map do |user_id|
          user = users_by_id[user_id]
          next unless user

          ua = ua_sums[user_id] || { api: 0, dashboard: 0, total: 0 }

          build_row(
            user:,
            ua:,
            transactions_created: transaction_counts[user_id].to_i,
            standalone_transactions: standalone_tx_counts[user_id].to_i,
            transfer_leg_transactions: transfer_leg_counts[user_id].to_i,
            transfers_created: transfer_counts[user_id].to_i,
            receipt_scans: receipt_counts[user_id].to_i,
            ai_chat_usages: chat_counts[user_id].to_i,
            ai_interactions: interaction_counts[user_id].to_i
          )
        end

        rows.sort_by! { |r| -r[:total_requests] }

        Success(rows)
      end

      def user_activity_sums(user_ids:, start_date:, end_date:)
        sums = Hash.new { |h, k| h[k] = { api: 0, dashboard: 0, total: 0 } }

        UserActivity
          .where(user_id: user_ids, activity_date: start_date..end_date)
          .group(:user_id)
          .pluck(
            :user_id,
            Arel.sql("COALESCE(SUM(api_request_count), 0)"),
            Arel.sql("COALESCE(SUM(dashboard_viewed_count), 0)"),
            Arel.sql("COALESCE(SUM(total_requests), 0)")
          )
          .each do |user_id, api_sum, dash_sum, total_sum|
            sums[user_id] = {
              api: api_sum.to_i,
              dashboard: dash_sum.to_i,
              total: total_sum.to_i
            }
          end

        sums
      end

      def transaction_counts(user_ids:, time_range:)
        Transactions::Transaction
          .non_draft
          .where(user_id: user_ids, created_at: time_range)
          .group(:user_id)
          .count
      end

      def standalone_transaction_counts(user_ids:, time_range:)
        Transactions::Transaction
          .non_draft
          .where(user_id: user_ids, transfer_id: nil, created_at: time_range)
          .group(:user_id)
          .count
      end

      def transfer_leg_transaction_counts(user_ids:, time_range:)
        Transactions::Transaction
          .non_draft
          .where(user_id: user_ids, created_at: time_range)
          .where.not(transfer_id: nil)
          .group(:user_id)
          .count
      end

      def transfer_counts(user_ids:, time_range:)
        Transactions::Transfer
          .where(user_id: user_ids, created_at: time_range)
          .group(:user_id)
          .count
      end

      def ai_usage_counts_by_user(user_ids:, time_range:, ai_type:)
        Ai::Usage
          .where(user_id: user_ids, created_at: time_range, ai_type:)
          .group(:user_id)
          .count
      end

      def ai_interaction_counts(user_ids:, time_range:)
        Ai::Interaction
          .where(user_id: user_ids, created_at: time_range)
          .group(:user_id)
          .count
      end

      def build_row(
        user:,
        ua:,
        transactions_created:,
        standalone_transactions:,
        transfer_leg_transactions:,
        transfers_created:,
        receipt_scans:,
        ai_chat_usages:,
        ai_interactions:
      )
        {
          id: user.id,
          email: user.email,
          full_name: user.full_name.presence || "-",
          api_request_count: ua[:api],
          dashboard_viewed_count: ua[:dashboard],
          total_requests: ua[:total],
          transactions_created:,
          standalone_transactions:,
          transfer_leg_transactions:,
          transfers_created:,
          receipt_scans:,
          ai_chat_usages:,
          ai_interactions:
        }
      end
    end
  end
end
