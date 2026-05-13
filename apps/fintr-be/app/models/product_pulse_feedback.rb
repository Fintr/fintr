# frozen_string_literal: true

class ProductPulseFeedback < ApplicationRecord
  belongs_to :user,
               class_name: "Auth::User"

  belongs_to :space,
               class_name: "Spaces::Space"
end
