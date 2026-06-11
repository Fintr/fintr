# frozen_string_literal: true

module Transactions
  module Operations
    class BulkRecordTransactionVersions < Dry::Operation
      BACKFILL_EXCLUDED_ATTRIBUTES = %w[id created_at updated_at].freeze

      def call(transactions:, event: "create", whodunnit: nil, cause: nil, operation: nil)
        records = Array(transactions).select do |transaction|
          transaction.is_a?(Transactions::Transaction) && transaction.id.present?
        end
        return 0 if records.empty?

        context = {
          cause: cause.presence || PaperTrail.request.controller_info&.dig(:cause),
          operation: operation.presence || PaperTrail.request.controller_info&.dig(:operation),
        }
        whodunnit = whodunnit.presence || PaperTrail.request.whodunnit

        rows = PaperTrail.request(whodunnit: whodunnit.to_s, controller_info: context) do
          records.filter_map do |transaction|
            build_insert_row(
              transaction:,
              event:,
              force_changes: force_changes_for(transaction:, event:)
            )
          end
        end

        Transactions::TransactionVersion.insert_all!(rows) if rows.any?

        rows.size
      end

      private

      def build_insert_row(transaction:, event:, force_changes:)
        version_data = build_version_event_data(
          transaction:,
          event:,
          force_changes:
        )
        return if version_data.blank?

        version = Transactions::TransactionVersion.new(version_data.except(:item))
        row = version.attributes.except("id")
        row.merge!(
          "item_id" => transaction.id,
          "item_type" => transaction.class.base_class.name,
          "whodunnit" => whodunnit_for(row:),
          "space_id" => transaction.space_id,
          "cause" => cause_for(row:),
          "operation" => operation_for(row:),
          "created_at" => row["created_at"] || Time.current
        )
        row
      end

      def whodunnit_for(row:)
        row["whodunnit"].presence || PaperTrail.request.whodunnit
      end

      def cause_for(row:)
        row["cause"].presence || PaperTrail.request.controller_info&.dig(:cause)
      end

      def operation_for(row:)
        row["operation"].presence || PaperTrail.request.controller_info&.dig(:operation)
      end

      def build_version_event_data(transaction:, event:, force_changes:)
        in_after_callback = true

        case event.to_s
        when "create"
          PaperTrail::Events::Create.new(transaction, in_after_callback).data
        when "update"
          PaperTrail::Events::Update.new(
            transaction,
            in_after_callback,
            false,
            force_changes
          ).data
        when "destroy"
          PaperTrail::Events::Destroy.new(transaction, in_after_callback).data
        end
      end

      def force_changes_for(transaction:, event:)
        return unless event.to_s == "update"

        transaction.attributes
          .except(*BACKFILL_EXCLUDED_ATTRIBUTES)
          .transform_values { |value| [nil, value] }
      end
    end
  end
end
