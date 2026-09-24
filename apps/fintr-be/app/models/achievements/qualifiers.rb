# frozen_string_literal: true

module Achievements
  # Shared unlock checks for live events and historical backfill.
  # Counts the user's own rows and activity already in their spaces.
  module Qualifiers
    LOGGED_TRANSACTION_TYPES = %w[
      Transactions::Income
      Transactions::Expense
    ].freeze

    module_function

    def met?(achievement:, user_id:, space_id: nil, space_ids: nil)
      threshold = achievement.unlock_threshold || {}
      resolved_space_ids = Array(space_ids).presence || Array(space_id).compact
      minimum = (threshold["min_count"] || 1).to_i

      case achievement.unlock_event
      when "transaction_created"
        logged_transaction_count(user_id:, space_ids: resolved_space_ids) >= minimum
      when "budget_created"
        return false if resolved_space_ids.blank?

        Budget.where(space_id: resolved_space_ids).exists?
      when "access_granted"
        Spaces::SpaceUser.where(invited_by_id: user_id).exists?
      when "loan_created"
        loan_count(user_id:, space_ids: resolved_space_ids) >= minimum
      when "loan_payment_created"
        loan_payment_count(user_id:, space_ids: resolved_space_ids) >= minimum
      when "transfer_created"
        transfer_count(user_id:, space_ids: resolved_space_ids) >= minimum
      else
        false
      end
    end

    def logged_transaction_count(user_id:, space_ids:)
      count_matching(
        relation: Transactions::Transaction.where(type: LOGGED_TRANSACTION_TYPES),
        user_id:,
        space_ids:,
      )
    end

    def loan_count(user_id:, space_ids:)
      count_matching(
        relation: Transactions::Loan.all,
        user_id:,
        space_ids:,
      )
    end

    def transfer_count(user_id:, space_ids:)
      count_matching(
        relation: Transactions::Transfer.all,
        user_id:,
        space_ids:,
      )
    end

    def loan_payment_count(user_id:, space_ids:)
      loans = matching_relation(
        relation: Transactions::Loan.all,
        user_id:,
        space_ids:,
      )

      Transactions::LoanPayment.where(loan_id: loans.select(:id)).count
    end

    def count_matching(relation:, user_id:, space_ids:)
      matching_relation(relation:, user_id:, space_ids:).count
    end

    def matching_relation(relation:, user_id:, space_ids:)
      by_user = relation.where(user_id:)
      return by_user if space_ids.blank?

      by_user.or(relation.where(space_id: space_ids))
    end
  end
end
