# frozen_string_literal: true

class CreateTransferLoanAndLoanPaymentVersions < ActiveRecord::Migration[8.1]
  TEXT_BYTES = 1_073_741_823

  def up
    create_version_table(:transfer_versions)
    create_version_table(:loan_versions)
    create_version_table(:loan_payment_versions)

    backfill_versions(
      model_class: Transactions::Transfer,
      version_class: Transactions::TransferVersion,
      operation: "db:migrate:create_transfer_loan_and_loan_payment_versions",
    )

    backfill_versions(
      model_class: Transactions::Loan,
      version_class: Transactions::LoanVersion,
      operation: "db:migrate:create_transfer_loan_and_loan_payment_versions",
    )

    backfill_versions(
      model_class: Transactions::LoanPayment,
      version_class: Transactions::LoanPaymentVersion,
      operation: "db:migrate:create_transfer_loan_and_loan_payment_versions",
      space_id_for: ->(record) { record.loan&.space_id },
      whodunnit_for: ->(record) { record.loan&.user_id },
    )
  end

  def down
    drop_table :loan_payment_versions
    drop_table :loan_versions
    drop_table :transfer_versions
  end

  private

  def create_version_table(table_name)
    if table_exists?(table_name)
      say "Table #{table_name} already exists, skipping create"
      return
    end

    create_table table_name, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
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

    add_index table_name, %i[item_type item_id]
    add_index table_name, :space_id
    add_index table_name, :created_at
  end

  def backfill_versions(model_class:, version_class:, operation:, space_id_for: nil, whodunnit_for: nil)
    if version_class.exists?
      say "Skipping backfill for #{version_class.table_name} (#{version_class.count} row(s) already present)"
      return 0
    end

    say_with_time "Backfilling #{version_class.table_name} for existing #{model_class.name} rows" do
      count = 0

      model_class.find_in_batches(batch_size: 500) do |batch|
        rows = batch.filter_map do |record|
          version_data = build_backfill_version_data(record:)
          next if version_data.blank?

          space_id = space_id_for ? space_id_for.call(record) : record.space_id
          whodunnit = whodunnit_for ? whodunnit_for.call(record) : record.try(:user_id)

          row = version_class.new(version_data.except(:item)).attributes.except("id")
          row.merge!(
            "item_id" => record.id,
            "item_type" => record.class.base_class.name,
            "whodunnit" => whodunnit,
            "space_id" => space_id,
            "cause" => "backfill",
            "operation" => operation,
            "created_at" => record.updated_at || record.created_at,
          )
          row
        end

        next if rows.empty?

        version_class.insert_all!(rows)
        count += rows.size
      end

      count
    end
  end

  def build_backfill_version_data(record:)
    force_changes = record.attributes
      .except("id", "created_at", "updated_at")
      .transform_values { |value| [nil, value] }

    PaperTrail.request(
      whodunnit: record.try(:user_id),
      controller_info: {
        cause: "backfill",
        operation: "db:migrate:create_transfer_loan_and_loan_payment_versions",
      },
    ) do
      PaperTrail::Events::Update.new(record, true, false, force_changes).data
    end
  end
end
