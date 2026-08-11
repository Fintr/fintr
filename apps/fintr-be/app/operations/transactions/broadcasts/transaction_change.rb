# frozen_string_literal: true

module Transactions
  module Broadcasts
    class TransactionChange
      def self.stream_key(space_id:)
        "transactions:#{space_id}"
      end

      def self.created(
        transaction:,
        actor: nil,
        suppress_actor_toast: false,
        origin_client_mutation_id: nil
      )
        new.created(
          transaction:,
          actor:,
          suppress_actor_toast:,
          origin_client_mutation_id:,
        )
      end

      # One ActionCable message for many creates (repeat/installment expansion).
      def self.created_many(
        transactions:,
        actor: nil,
        suppress_actor_toast: false,
        origin_client_mutation_id: nil
      )
        new.created_many(
          transactions:,
          actor:,
          suppress_actor_toast:,
          origin_client_mutation_id:,
        )
      end

      def self.updated(transaction:, actor: nil)
        new.updated(transaction:, actor:)
      end

      def self.updated_many(transactions:, actor: nil)
        new.updated_many(transactions:, actor:)
      end

      def self.deleted(space_id:, transactions:, actor: nil)
        new.deleted(space_id:, transactions:, actor:)
      end

      def self.serialize_index_row(transaction:)
        new.serialize_index_row(transaction:)
      end

      def self.serialize_index_rows(transactions:)
        new.serialize_index_rows(transactions:)
      end

      def self.serialize_actor(user:)
        new.serialize_actor(user:)
      end

      def created(
        transaction:,
        actor: nil,
        suppress_actor_toast: false,
        origin_client_mutation_id: nil
      )
        return if transaction.blank?
        return if transaction.is_a?(Transactions::Draft)

        payload = serialize_index_row(transaction:)
        return if payload.blank?

        publish_sync_change(
          op: "transaction.created",
          space_id: transaction.space_id,
          payloads: [payload],
          actor:,
          suppress_actor_toast:,
          origin_client_mutation_id:,
        )
      end

      def created_many(
        transactions:,
        actor: nil,
        suppress_actor_toast: false,
        origin_client_mutation_id: nil
      )
        records = Array(transactions).compact
        return if records.empty?

        payloads = serialize_index_rows(transactions: records)
        return if payloads.empty?

        space_id = records.first.space_id
        return if space_id.blank?

        publish_sync_change(
          op: "transaction.created",
          space_id:,
          payloads:,
          actor:,
          suppress_actor_toast:,
          origin_client_mutation_id:,
        )
      end

      def updated(transaction:, actor: nil)
        return if transaction.blank?
        return if transaction.is_a?(Transactions::Draft)

        payload = serialize_index_row(transaction:)
        return if payload.blank?

        publish_sync_change(
          op: "transaction.updated",
          space_id: transaction.space_id,
          payloads: [payload],
          actor:,
        )
      end

      def updated_many(transactions:, actor: nil)
        records = Array(transactions).compact
        return if records.empty?

        payloads = serialize_index_rows(transactions: records)
        return if payloads.empty?

        space_id = records.first.space_id
        return if space_id.blank?

        publish_sync_change(
          op: "transaction.updated",
          space_id:,
          payloads:,
          actor:,
        )
      end

      # +transactions+ must already be index hashes (serialize before destroy —
      # Combined view rows disappear with the transactable).
      def deleted(space_id:, transactions:, actor: nil)
        return if space_id.blank?

        payloads = Array(transactions).compact
        return if payloads.empty?

        publish_sync_change(
          op: "transaction.deleted",
          space_id:,
          payloads:,
          actor:,
        )
      end

      def serialize_index_row(transaction:)
        serialize_index_rows(transactions: [transaction]).first
      end

      def serialize_index_rows(transactions:)
        records = Array(transactions).compact.reject do |transaction|
          transaction.blank? || transaction.is_a?(Transactions::Draft)
        end
        return [] if records.empty?

        combined_by_id = Transactions::Combined
          .where(transactable_id: records.map(&:id))
          .index_by { |combined| combined.transactable_id.to_s }

        records.filter_map do |transaction|
          combined = combined_by_id[transaction.id.to_s]
          payload =
            if combined
              Transactions::Serializers::FilteredCombinedSerializer.render_as_hash(
                combined,
              )
            else
              # Combined is a SQL view; freshly inserted fee expenses can lag a
              # moment behind the write. Fall back so transfer fees still broadcast.
              serialize_transactable_fallback(transaction:)
            end
          next if payload.blank?

          if transaction.respond_to?(:category_id)
            payload[:category_id] = transaction.category_id
          end
          if transaction.respond_to?(:subcategory_id)
            payload[:subcategory_id] = transaction.subcategory_id
          end
          payload
        end
      end

      def serialize_transactable_fallback(transaction:)
        type =
          case transaction
          when Transactions::Income then "income"
          when Transactions::Expense then "expense"
          when Transactions::Transfer then "transfer"
          when Transactions::Loan then "loan_disbursement"
          when Transactions::LoanPayment then "loan_payment"
          else
            return nil
          end

        amount_payload =
          if transaction.respond_to?(:amount_in_space_currency)
            transaction.amount_in_space_currency
          else
            {
              amount: transaction.try(:amount)&.amount,
              currency: transaction.try(:amount_currency),
            }
          end

        from_name =
          if transaction.respond_to?(:from_account)
            transaction.from_account&.name
          elsif transaction.respond_to?(:account)
            transaction.is_a?(Transactions::Expense) ? transaction.account&.name : nil
          end

        to_name =
          if transaction.respond_to?(:to_account)
            transaction.to_account&.name
          elsif transaction.respond_to?(:account)
            transaction.is_a?(Transactions::Income) ? transaction.account&.name : nil
          end

        payload = {
          id: transaction.id.to_s,
          date: transaction.try(:date),
          description: transaction.try(:description).to_s,
          amount: amount_payload[:amount],
          amount_currency: amount_payload[:currency],
          category_name: transaction.try(:category)&.name.to_s,
          from_account_name: from_name.to_s,
          to_account_name: to_name.to_s,
          type:,
          in_series: transaction.respond_to?(:in_series?) ? transaction.in_series? : false,
          has_image: transaction.respond_to?(:files) && transaction.files.attached?,
          has_loan_payment: false,
          calculated: transaction_calculated_for_index?(transaction:),
          created_at: transaction.try(:created_at),
          activitable_id: transaction.id.to_s,
        }

        case transaction
        when Transactions::Income, Transactions::Expense
          if transaction.entity_name.present?
            payload[:entity_name] = transaction.entity_name.to_s
          end
          if transaction.respond_to?(:tags)
            payload[:tags] =
              Transactions::Serializers::TagSerializer.render_as_hash(
                transaction.tags,
              )
          end
        when Transactions::Loan
          payload[:loan_id] = transaction.id.to_s
          payload[:entity_name] = transaction.entity_name.to_s if transaction.respond_to?(:entity_name)
          payload[:loan_type] = transaction.loan_type if transaction.respond_to?(:loan_type)
          payload[:is_loan_activity] = true
        when Transactions::LoanPayment
          payload[:loan_id] = transaction.loan_id.to_s if transaction.loan_id.present?
          payload[:is_loan_activity] = true
          if transaction.respond_to?(:loan) && transaction.loan.present?
            payload[:entity_name] = transaction.loan.entity_name.to_s
            payload[:loan_type] = transaction.loan.loan_type
          end
        end

        payload
      end

      def serialize_actor(user:)
        return if user.blank?

        # Reload so ActionCable doesn't serve a stale row missing photo_url.
        fresh_user = Auth::User.find_by(id: user.id) || user

        {
          user_id: fresh_user.id.to_s,
          auth_id: fresh_user.auth_id.to_s,
          full_name: fresh_user.full_name.presence || fresh_user.email.to_s,
          photo_url: fresh_user.photo_url,
        }
      end

      private

      def publish_sync_change(
        op:,
        space_id:,
        payloads:,
        actor: nil,
        suppress_actor_toast: false,
        origin_client_mutation_id: nil
      )
        records = Array(payloads).compact
        return if records.empty? || space_id.blank?

        log_payload =
          if op == "transaction.deleted" || records.length > 1
            { "transactions" => records.map { |row| stringify_payload(row) } }
          else
            { "transaction" => stringify_payload(records.first) }
          end

        Sync::Broadcasts::PublishChange.call(
          op:,
          space_id:,
          payload: log_payload,
          stream_key: self.class.stream_key(space_id:),
          actor:,
          entity_id: extract_entity_id(records.first),
          origin_client_mutation_id:,
          suppress_actor_toast:,
          logger_tag: "Transactions::Broadcasts::TransactionChange",
        )
      rescue StandardError => e
        Rails.logger.error(
          "[Transactions::Broadcasts::TransactionChange] Failed to publish sync_change: #{e.message}",
        )
      end

      def stringify_payload(value)
        Sync::Broadcasts::PayloadHelper.stringify(value)
      end

      def extract_entity_id(payload)
        Sync::Broadcasts::PayloadHelper.extract_entity_id(payload)
      end

      def transaction_calculated_for_index?(transaction:)
        return true if transaction.is_a?(Transactions::Loan) || transaction.is_a?(Transactions::LoanPayment)

        transaction.respond_to?(:balance_state) && transaction.balance_state == "calculated"
      end
    end
  end
end
