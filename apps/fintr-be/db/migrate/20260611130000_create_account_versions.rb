# frozen_string_literal: true

class CreateAccountVersions < ActiveRecord::Migration[8.1]
  TEXT_BYTES = 1_073_741_823

  def up
    create_table :account_versions, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
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

    add_index :account_versions, %i[item_type item_id]
    add_index :account_versions, :space_id
    add_index :account_versions, :created_at

    backfill_existing_account_versions
  end

  def down
    drop_table :account_versions
  end

  private

  def backfill_existing_account_versions
    say_with_time "Backfilling account_versions for existing accounts" do
      count = 0

      Transactions::Account.find_in_batches(batch_size: 500) do |batch|
        rows = batch.filter_map do |account|
          version_data = build_backfill_version_data(account:)
          next if version_data.blank?

          version = Transactions::AccountVersion.new(version_data.except(:item))
          row = version.attributes.except("id")
          row.merge!(
            "item_id" => account.id,
            "item_type" => account.class.name,
            "space_id" => account.space_id,
            "cause" => "backfill",
            "operation" => "db:migrate:create_account_versions",
            "created_at" => account.updated_at || account.created_at
          )
          row
        end

        next if rows.empty?

        Transactions::AccountVersion.insert_all!(rows)
        count += rows.size
      end

      count
    end
  end

  def build_backfill_version_data(account:)
    force_changes = account.attributes
      .except("id", "created_at", "updated_at")
      .transform_values { |value| [nil, value] }

    PaperTrail.request(
      controller_info: {
        cause: "backfill",
        operation: "db:migrate:create_account_versions"
      }
    ) do
      PaperTrail::Events::Update.new(account, true, false, force_changes).data
    end
  end
end
