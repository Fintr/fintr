# frozen_string_literal: true

FactoryBot.define do
  factory :crm_ticket_response, class: "Crm::TicketResponse" do
    message { "Test response message" }
    response_type { "admin_response" }
    association :ticket, factory: :crm_ticket
    association :responder, factory: :user
  end
end
