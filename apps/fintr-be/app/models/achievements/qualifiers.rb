# frozen_string_literal: true

module Achievements
  # Shared unlock checks for live events and historical backfill.
  module Qualifiers
    module_function

    def met?(achievement:, user_id:, space_id: nil, space_ids: nil)
      threshold = achievement.unlock_threshold || {}
      resolved_space_ids = Array(space_ids).presence || Array(space_id).compact

      case achievement.unlock_event
      when "transaction_created"
        count = Transactions::Transaction.where(user_id:).count
        count >= (threshold["min_count"] || 1).to_i
      when "budget_created"
        return false if resolved_space_ids.blank?

        Budget.where(space_id: resolved_space_ids).exists?
      when "access_granted"
        Spaces::SpaceUser.where(invited_by_id: user_id).exists?
      when "loan_created"
        count = Transactions::Loan.where(user_id:).count
        count >= (threshold["min_count"] || 1).to_i
      when "loan_payment_created"
        count = Transactions::LoanPayment
                  .joins(:loan)
                  .where(loans: { user_id: })
                  .count
        count >= (threshold["min_count"] || 1).to_i
      when "transfer_created"
        count = Transactions::Transfer.where(user_id:).count
        count >= (threshold["min_count"] || 1).to_i
      else
        false
      end
    end
  end
end
