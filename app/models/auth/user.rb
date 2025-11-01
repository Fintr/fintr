# frozen_string_literal: true

module Auth
  class User < ApplicationRecord
    rolify :role_cname => "Auth::Role",
           :role_join_table_name => "users_roles",
           :role_table_name => "roles"

    has_one :onboarding, class_name: "Onboarding", dependent: :destroy
    has_many :transactions, class_name: "Transactions::Transaction", dependent: :destroy
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

    validates :email,
              presence: true,
              uniqueness: true,
              format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email address" }

    before_validation :downcase_email

    after_create :create_onboarding

    private

    def downcase_email
      self.email = email.downcase if email.present?
    end

    def create_onboarding
      Onboarding.create!(user: self, step: "income")
    end
  end
end
