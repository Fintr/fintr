# frozen_string_literal: true

module Auth
  class User < ApplicationRecord
    rolify :role_cname => "Auth::Role",
           :role_join_table_name => "users_roles",
           :role_table_name => "roles"

    has_many :transactions, class_name: "Transactions::Transaction", dependent: :destroy
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

    validates :email,
              presence: true,
              uniqueness: true,
              format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email address" }

    before_validation :downcase_email

    private

    def downcase_email
      self.email = email.downcase if email.present?
    end
  end
end
