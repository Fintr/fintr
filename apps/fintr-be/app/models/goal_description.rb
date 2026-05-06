# frozen_string_literal: true

class GoalDescription < ApplicationRecord
  belongs_to :space, class_name: "Spaces::Space"
end
