# frozen_string_literal: true

module Finance
  class SponsorCode < ApplicationRecord
    self.table_name = "finance_sponsor_codes"

    belongs_to :created_by, class_name: "Auth::User"
    has_many :user_sponsor_codes,
             class_name: "Finance::UserSponsorCode",
             dependent: :restrict_with_error
    has_many :users, through: :user_sponsor_codes
    has_many :space_subscriptions,
             class_name: "Finance::SpaceSubscription",
             dependent: :nullify

    validates :code, presence: true, uniqueness: true
    validates :name, presence: true
    validates :discount_percentage,
              numericality: { greater_than: 0, less_than_or_equal_to: 100 },
              allow_nil: true
    validates :discount_amount_cents,
              numericality: { greater_than_or_equal_to: 0 },
              allow_nil: true
    validates :max_uses,
              numericality: { greater_than: 0 },
              allow_nil: true
    validates :discount_months,
              numericality: { greater_than: 0 },
              allow_nil: true
    validates :current_uses, numericality: { greater_than_or_equal_to: 0 }
    validates :active, inclusion: { in: [true, false] }

    validate :discount_percentage_or_amount_present
    validate :code_format

    scope :active, -> { where(active: true) }
    scope :expired, -> { where("expires_at < ?", Time.current) }
    scope :not_expired, -> { where("expires_at IS NULL OR expires_at >= ?", Time.current) }
    scope :available, -> { active.not_expired }
    scope :with_duration, -> { where.not(discount_months: nil) }

    def percentage_discount?
      discount_percentage.present? && discount_percentage > 0
    end

    def amount_discount?
      discount_amount_cents.present? && discount_amount_cents > 0
    end

    def expired?
      expires_at.present? && expires_at < Time.current
    end

    def at_max_uses?
      return false if max_uses.nil?

      current_uses >= max_uses
    end

    def available?
      active? && !expired? && !at_max_uses?
    end

    def limited_duration?
      discount_months.present? && discount_months > 0
    end

    # Calculate the date when the promo discount should expire
    def promo_expiration_date(from_date = Time.current)
      return nil unless limited_duration?

      from_date + discount_months.months
    end

    def usage_count
      user_sponsor_codes.count
    end

    def calculate_discount(original_amount_cents)
      if percentage_discount?
        (original_amount_cents * discount_percentage / 100.0).round
      elsif amount_discount?
        [discount_amount_cents, original_amount_cents].min
      else
        0
      end
    end

    def record_usage!
      increment!(:current_uses)
    end

    private

    def discount_percentage_or_amount_present
      return if percentage_discount? || amount_discount?

      errors.add(:base, "Either discount percentage or discount amount must be present")
    end

    def code_format
      return if code.blank?

      errors.add(:code, "can only contain letters, numbers, and hyphens") unless code.match?(/\A[A-Za-z0-9-]+\z/)
    end
  end
end
