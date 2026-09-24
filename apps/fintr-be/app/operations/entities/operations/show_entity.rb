# frozen_string_literal: true

module Entities
  module Operations
    class ShowEntity < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:id).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        entity = step find_entity(params:)
        transactions = step load_transactions(entity:)
        loans = step load_loans(entity:)
        loan_payments = step load_loan_payments(entity:)
        identifiers = step load_identifiers(entity:)

        {
          entity:,
          transactions:,
          loans:,
          loan_payments:,
          identifiers:,
        }
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def find_entity(params:)
        entity = Entities::Entity.find_by(
          id: params[:id],
          space_id: params[:space_id],
        )
        return Failure(id: "not found") unless entity

        Success(entity)
      end

      def load_transactions(entity:)
        relation = entity.transactions
                         .includes(:category, :subcategory, :account, :entity)
                         .order(date: :desc, created_at: :desc)

        Success(relation.to_a)
      end

      def load_loans(entity:)
        relation = entity.loans
                         .includes(:entity, :account)
                         .order(date: :desc, created_at: :desc)

        Success(relation.to_a)
      end

      def load_loan_payments(entity:)
        relation = Transactions::LoanPayment
                   .joins(:loan)
                   .where(loans: { entity_id: entity.id })
                   .includes(:account, :loan)
                   .order(date: :desc, created_at: :desc)

        Success(relation.to_a)
      end

      def load_identifiers(entity:)
        return Success([]) unless entity.entity_type == "transaction"

        relation = entity.merchant_aliases.order(created_at: :desc)
        Success(relation.to_a)
      end
    end
  end
end
