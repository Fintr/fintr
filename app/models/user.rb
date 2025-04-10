# frozen_string_literal: true

class User < ApplicationRecord
  # Auth0 is now used for authentication
  # The auth0_id field is used to store the Auth0 user ID

  has_many :transactions, dependent: :destroy

  validates :email, presence: true, uniqueness: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email address" }

  # Create or update user from Auth0 profile
  def self.from_auth0(auth0_user_info)
    user = find_or_initialize_by(auth0_id: auth0_user_info["sub"])

    user.email = auth0_user_info["email"]
    user.name = auth0_user_info["name"]
    user.picture = auth0_user_info["picture"]
    user.save!

    user
  end
end
