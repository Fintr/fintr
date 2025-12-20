# frozen_string_literal: true

class CreateImportRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :import_records, id: :uuid do |t|
      t.references :import, null: false, foreign_key: { to_table: :imports }, type: :uuid
      t.string :record_type # "Transactions::Transaction", "Transactions::Category", "Transactions::Account" (null if failed)
      t.uuid :record_id # null if record was not created (failed)
      t.integer :row_number, null: false # Row number from Excel file
      t.jsonb :original_data, default: {}
      t.jsonb :edited_data, default: {}
      t.string :status, null: false, default: "pending" # "pending", "success", "failed", "edited"
      t.jsonb :import_errors, default: []

      t.timestamps

      t.index [:import_id, :record_type]
      t.index [:import_id, :status]
      t.index [:record_type, :record_id]
    end
  end
end
