# frozen_string_literal: true

class CreateTransactionVersions < ActiveRecord::Migration[8.1]
  TEXT_BYTES = 1_073_741_823

  def up
    create_table :transaction_versions, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.string :item_type, null: false
      t.uuid :item_id, null: false
      t.string :event, null: false
      t.string :whodunnit
      t.text :object, limit: TEXT_BYTES
      t.text :object_changes, limit: TEXT_BYTES
      t.uuid :space_id
      t.string :cause
      t.string :operation
      t.datetime :created_at
    end

    add_index :transaction_versions, %i[item_type item_id]
    add_index :transaction_versions, :space_id
    add_index :transaction_versions, :created_at

    backfill_existing_transaction_versions
  end

  def down
    drop_table :transaction_versions
  end

  private

  def backfill_existing_transaction_versions
    say_with_time "Backfilling transaction_versions for existing transactions" do
      count = 0

      Transactions::Transaction.find_in_batches(batch_size: 500) do |batch|
        rows = batch.filter_map do |transaction|
          version_data = build_backfill_version_data(transaction:)
          next if version_data.blank?

          version = Transactions::TransactionVersion.new(version_data.except(:item))
          row = version.attributes.except("id")
          row.merge!(
            "item_id" => transaction.id,
            "item_type" => transaction.class.base_class.name,
            "whodunnit" => transaction.user_id,
            "space_id" => transaction.space_id,
            "cause" => "backfill",
            "operation" => "db:migrate:create_transaction_versions",
            "created_at" => transaction.updated_at || transaction.created_at
          )
          row
        end

        next if rows.empty?

        Transactions::TransactionVersion.insert_all!(rows)
        count += rows.size
      end

      count
    end
  end

  def build_backfill_version_data(transaction:)
    force_changes = transaction.attributes
      .except("id", "created_at", "updated_at")
      .transform_values { |value| [nil, value] }

    PaperTrail.request(
      whodunnit: transaction.user_id,
      controller_info: {
        cause: "backfill",
        operation: "db:migrate:create_transaction_versions"
      }
    ) do
      PaperTrail::Events::Update.new(transaction, true, false, force_changes).data
    end
  end
end
