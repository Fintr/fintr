# frozen_string_literal: true

FactoryBot.define do
  factory :product_pulse_feedback, class: "ProductPulseFeedback" do
    user
    space
    period_key { Time.zone.today.strftime("%G-W%V") }
    liked_areas { ["transactions"] }
    improve_areas { [] }
    notes { nil }
  end
end
