# frozen_string_literal: true

FactoryBot.define do
  factory :crm_ticket, class: "Crm::Ticket" do
    title { "Test ticket" }
    description { "Test ticket description" }
    ticket_type { "general_feedback" }
    priority { "medium" }
    status { "open" }
    association :user, factory: :user
    association :space, factory: :space
  end
end
