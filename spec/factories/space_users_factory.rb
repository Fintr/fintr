# frozen_string_literal: true

FactoryBot.define do
  factory :space_user, class: "Spaces::SpaceUser" do
    association :user
    association :space
  end
end
