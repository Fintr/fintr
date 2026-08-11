# frozen_string_literal: true

module Loans
  module Broadcasts
    class LoanChange
      def self.stream_key(space_id:)
        Transactions::Broadcasts::TransactionChange.stream_key(space_id:)
      end

      def self.loan_created(loan:, actor: nil)
        new.loan_created(loan:, actor:)
      end

      def self.loan_updated(loan:, actor: nil)
        new.loan_updated(loan:, actor:)
      end

      def self.loan_deleted(loan_id:, space_id:, actor: nil)
        new.loan_deleted(loan_id:, space_id:, actor:)
      end

      def self.loan_payment_created(loan_payment:, actor: nil)
        new.loan_payment_created(loan_payment:, actor:)
      end

      def self.loan_payment_updated(loan_payment:, actor: nil)
        new.loan_payment_updated(loan_payment:, actor:)
      end

      def self.loan_payment_deleted(loan_payment_id:, loan_id:, space_id:, actor: nil)
        new.loan_payment_deleted(
          loan_payment_id:,
          loan_id:,
          space_id:,
          actor:,
        )
      end

      def loan_created(loan:, actor: nil)
        publish_entity(
          op: "loan.created",
          space_id: loan.space_id,
          payload: { loan: serialize_loan(loan:) },
          entity_id: loan.id,
          actor:,
        )
      end

      def loan_updated(loan:, actor: nil)
        publish_entity(
          op: "loan.updated",
          space_id: loan.space_id,
          payload: { loan: serialize_loan(loan:) },
          entity_id: loan.id,
          actor:,
        )
      end

      def loan_deleted(loan_id:, space_id:, actor: nil)
        publish_entity(
          op: "loan.deleted",
          space_id:,
          payload: { loan_id: loan_id.to_s },
          entity_id: loan_id,
          actor:,
        )
      end

      def loan_payment_created(loan_payment:, actor: nil)
        publish_entity(
          op: "loan_payment.created",
          space_id: loan_payment.loan.space_id,
          payload: { loan_payment: serialize_loan_payment(loan_payment:) },
          entity_id: loan_payment.id,
          actor:,
        )
      end

      def loan_payment_updated(loan_payment:, actor: nil)
        publish_entity(
          op: "loan_payment.updated",
          space_id: loan_payment.loan.space_id,
          payload: { loan_payment: serialize_loan_payment(loan_payment:) },
          entity_id: loan_payment.id,
          actor:,
        )
      end

      def loan_payment_deleted(loan_payment_id:, loan_id:, space_id:, actor: nil)
        publish_entity(
          op: "loan_payment.deleted",
          space_id:,
          payload: {
            loan_payment_id: loan_payment_id.to_s,
            loan_id: loan_id.to_s,
          },
          entity_id: loan_payment_id,
          actor:,
        )
      end

      private

      def publish_entity(op:, space_id:, payload:, entity_id:, actor:)
        Sync::Broadcasts::PublishChange.call(
          op:,
          space_id:,
          payload:,
          stream_key: self.class.stream_key(space_id:),
          actor:,
          entity_id:,
          logger_tag: "Loans::Broadcasts::LoanChange",
        )
      end

      def serialize_loan(loan:)
        ::Loans::Serializers::LoanSerializer.render_as_hash(loan)
      end

      def serialize_loan_payment(loan_payment:)
        ::Loans::Serializers::LoanPaymentSerializer.render_as_hash(loan_payment)
      end
    end
  end
end
