# frozen_string_literal: true

module Finance
  class RevenuecatCustomer < ApplicationRecord
    self.table_name = "finance_revenuecat_customers"

    belongs_to :user, class_name: "Auth::User"

    validates :app_user_id, presence: true
    validates :pro_active, inclusion: { in: [true, false] }

    def pro_current?
      return false unless pro_active?
      return true if pro_expires_at.nil?

      pro_expires_at.future?
    end
  end
end
