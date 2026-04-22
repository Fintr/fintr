# frozen_string_literal: true

module Finance
  class UserSponsorCode < ApplicationRecord
    self.table_name = "finance_user_sponsor_codes"

    belongs_to :sponsor_code, class_name: "Finance::SponsorCode"
    belongs_to :user, class_name: "Auth::User"
    belongs_to :space_subscription, class_name: "Finance::SpaceSubscription"

    validates :sponsor_code_id, uniqueness: { scope: :user_id, message: "has already been used by this user" }
    validates :discount_percentage_applied, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true
    validates :discount_amount_cents_applied, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

    delegate :code, :name, to: :sponsor_code, prefix: true

    def discount_details
      if discount_percentage_applied.present? && discount_percentage_applied > 0
        { type: :percentage, value: discount_percentage_applied }
      elsif discount_amount_cents_applied.present? && discount_amount_cents_applied > 0
        { type: :amount, value: discount_amount_cents_applied }
      else
        { type: :none, value: 0 }
      end
    end
  end
end
