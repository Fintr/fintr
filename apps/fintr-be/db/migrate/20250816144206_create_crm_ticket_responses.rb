# frozen_string_literal: true

class CreateCrmTicketResponses < ActiveRecord::Migration[8.0]
  def change
    create_enum :crm_ticket_response_type, %w[
      user_reply
      admin_response
      system_update
    ]

    create_table :crm_ticket_responses, id: :uuid do |t|
      t.references :ticket, null: false, foreign_key: { to_table: :crm_tickets }, type: :uuid
      t.references :responder, null: true, foreign_key: { to_table: :users }, type: :uuid
      t.text :message, null: false
      t.enum :response_type, enum_type: :crm_ticket_response_type, null: false, default: 'user_reply'

      t.timestamps
    end

    add_index :crm_ticket_responses, :response_type unless index_exists?(:crm_ticket_responses, :response_type)
    add_index :crm_ticket_responses, :created_at unless index_exists?(:crm_ticket_responses, :created_at)
  end
end
