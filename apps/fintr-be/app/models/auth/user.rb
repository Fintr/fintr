# frozen_string_literal: true

module Auth
  class User < ApplicationRecord
    rolify :role_cname => "Auth::Role",
           :role_join_table_name => "users_roles",
           :role_table_name => "roles"

    has_one :onboarding, class_name: "Onboarding", dependent: :destroy
    has_many :transactions, class_name: "Transactions::Transaction", dependent: :destroy
    has_many :loans, class_name: "Transactions::Loan", dependent: :destroy
    has_many :tickets, class_name: "Crm::Ticket", dependent: :destroy
    has_many :space_users, class_name: "Spaces::SpaceUser", dependent: :destroy
    has_many :spaces, class_name: "Spaces::Space", through: :space_users
    has_many :personal_spaces,
            -> { where(type: "Spaces::PersonalSpace") },
            through: :space_users,
            source: :space,
            class_name: "Spaces::PersonalSpace"
    has_many :organization_spaces,
             -> { where(type: "Spaces::OrganizationSpace") },
             through: :space_users,
             source: :space,
             class_name: "Spaces::OrganizationSpace"
    has_many :user_activities, dependent: :destroy
    has_many :conversations, class_name: "Ai::Conversation", dependent: :destroy
    has_many :owned_spaces, class_name: "Spaces::Space", foreign_key: :owner_id, dependent: :nullify, inverse_of: :owner

    validates :email,
              presence: true,
              uniqueness: true,
              format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email address" }

    # Resolves a user from Auth0-style token claims. Prefer +auth_id+; if missing in DB, fall back to +email+.
    # When matched by email only, callers must not overwrite +auth_id+ (alternate login providers).
    #
    # @return [Hash] +:user+ (Auth::User or nil), +:matched_by+ (:auth_id, :email, or nil)
    def self.find_for_token(auth_id:, email: nil)
      user = find_by(auth_id: auth_id)
      return { user:, matched_by: :auth_id } if user.present?

      return { user: nil, matched_by: nil } if email.blank?

      normalized = normalize_email_for_lookup(email)
      return { user: nil, matched_by: nil } if normalized.blank?

      user = find_by(email: normalized)
      return { user: nil, matched_by: nil } unless user.present?

      { user:, matched_by: :email }
    end

    def self.normalize_email_for_lookup(email)
      email.to_s.downcase.strip
    end

    before_validation :downcase_email

    after_create :create_onboarding

    private

    def downcase_email
      self.email = email.downcase if email.present?
    end

    def create_onboarding
      Onboarding.create!(user: self, step: "currency")
    end
  end
end
