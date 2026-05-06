# frozen_string_literal: true

class CreateCrmTickets < ActiveRecord::Migration[8.0]
  def change
    create_enum :crm_ticket_type, %w[
      bug_report
      feature_request
      general_feedback
      help_request
      billing_issue
      account_issue
      other
    ]

    create_enum :crm_priority, %w[
      low
      medium
      high
      urgent
    ]

    create_enum :crm_ticket_status, %w[
      open
      in_progress
      resolved
      dismissed
    ]

    create_table :crm_tickets, id: :uuid do |t|
      t.string :title, null: false
      t.text :description, null: false, default: ''
      t.enum :ticket_type, enum_type: :crm_ticket_type, null: false, default: 'bug_report'
      t.enum :priority, enum_type: :crm_priority, null: false, default: 'low'
      t.enum :status, enum_type: :crm_ticket_status, null: false, default: 'open'
      t.references :user, null: false, foreign_key: { to_table: :users }, type: :uuid
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid

      t.timestamps
    end

    add_index :crm_tickets, :ticket_type unless index_exists?(:crm_tickets, :ticket_type)
    add_index :crm_tickets, :status unless index_exists?(:crm_tickets, :status)
    add_index :crm_tickets, :priority unless index_exists?(:crm_tickets, :priority)
    add_index :crm_tickets, :created_at unless index_exists?(:crm_tickets, :created_at)
  end
end
