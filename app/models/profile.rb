# frozen_string_literal: true

class Profile < ApplicationRecord
  belongs_to :user

  validates :first_name, :last_name, presence: true,
                                     format: { with: /\A[a-zA-Z\-]+\z/, message: "must contain only letters and dashes" }
end
