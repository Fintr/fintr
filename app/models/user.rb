# frozen_string_literal: true

class User < ApplicationRecord
  # Auth0 is now used for authentication
  # The auth0_id field is used to store the Auth0 user ID

  has_many :transactions, dependent: :destroy

  validates :email, presence: true, uniqueness: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email address" }

  before_validation :downcase_email

  private

  def downcase_email
    self.email = email.downcase if email.present?
  end
end
