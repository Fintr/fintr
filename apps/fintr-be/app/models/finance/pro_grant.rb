# frozen_string_literal: true

module Finance
  class ProGrant < ApplicationRecord
    self.table_name = "finance_pro_grants"

    belongs_to :user, class_name: "Auth::User"
    belongs_to :granted_by, class_name: "Auth::User"

    validates :expires_at, presence: true

    scope :recent, -> { order(updated_at: :desc) }

    def current?
      expires_at.present? && expires_at.future?
    end

    def pending_notice?
      current? && acknowledged_at.nil?
    end
  end
end
