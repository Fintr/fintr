# frozen_string_literal: true

class User < ApplicationRecord
  # Include default devise modules. Others available are:
  #
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable,
         :confirmable, :lockable, :timeoutable, :trackable,
         :jwt_authenticatable, jwt_revocation_strategy: JwtDenylist

  # Remove omniauthable from the User model since we're not using it now
  # If you need OAuth, add it back and configure properly

  has_many :transactions, dependent: :destroy

  validates :email, presence: true, uniqueness: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP, message: "must be a valid email address" }
  validates :password, presence: true


  private

  def jwt_payload
    super.merge("foo" => "bar")
  end
end
