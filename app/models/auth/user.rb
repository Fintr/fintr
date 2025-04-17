# frozen_string_literal: true

module Auth
  class User < ApplicationRecord
    rolify :role_cname => "Auth::Role"

    has_and_belongs_to_many :roles, class_name: "Auth::Role", join_table: :users_roles
    has_many :transactions, class_name: "Transactions::Transaction", dependent: :destroy
    has_many :space_users, class_name: "Spaces::SpaceUser", dependent: :destroy
    has_many :spaces, class_name: "Spaces::Space", through: :space_users

    validates :email, presence: true, uniqueness: true,
                      format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email address" }

    before_validation :downcase_email

    private

    def downcase_email
      self.email = email.downcase if email.present?
    end
  end
end
