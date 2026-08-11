# frozen_string_literal: true

module Loans
  module Operations
    class UpdateLoan < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)
          required(:id).value(:string)
          optional(:entity_name).maybe(:string)
          optional(:description).maybe(:string)
        end

        rule(:entity_name, :description) do
          entity_present = values[:entity_name].present?
          description_present = values.key?(:description)

          next if entity_present || description_present

          key(:base).failure("at least one of entity_name or description must be provided")
        end
      end

      include FailureHandler

      def call(params)
        params = step validate(params:)
        loan = step find_loan(params:)
        entity = step maybe_resolve_entity(params:)
        loan = step persist_loan(loan:, params:, entity:)
        _ = step generate_embedding_async(loan:, params:)
        loan = loan.reload
        step broadcast_updated(loan:, params:)
      end

      private

      def broadcast_updated(loan:, params:)
        actor = Auth::User.find_by(id: params[:user_id]) || loan.user
        Transactions::Broadcasts::TransactionChange.updated(
          transaction: loan,
          actor:,
        )
        Loans::Broadcasts::LoanChange.loan_updated(loan:, actor:)
        Success(loan)
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def find_loan(params:)
        loan = Transactions::Loan.find_by(
          id: params[:id],
          space_id: params[:space_id]
        )
        return Failure(id: "not found") unless loan

        Success(loan)
      end

      def maybe_resolve_entity(params:)
        return Success(nil) unless params[:entity_name].present?

        resolve_entity(params:)
      end

      def resolve_entity(params:)
        entity = Entities::Entity.find_or_create_by!(
          space_id: params[:space_id],
          entity_type: "loan",
          full_name: params[:entity_name]
        )
        Success(entity)
      rescue ActiveRecord::RecordInvalid => e
        Failure(entity_name: "could not be created", error: e, expected: true)
      rescue StandardError => e
        Failure(entity_name: "could not be created", error: e, expected: true)
      end

      def persist_loan(loan:, params:, entity:)
        loan.entity = entity if entity.present?
        loan.description = params[:description] if params.key?(:description)

        loan.save!
        Success(loan)
      rescue ActiveRecord::RecordInvalid => e
        Failure(errors: loan.errors.to_hash, error: e, expected: true)
      rescue StandardError => e
        Failure(error: e, expected: true)
      end

      def generate_embedding_async(loan:, params:)
        return Success(loan) unless params.key?(:description)

        Ai::Embeddings::GenerateEmbeddingJob.perform_later(
          embeddable_id: loan.id,
          embeddable_type: loan.class.name,
          space_id: loan.space_id
        )
        Success(loan)
      end
    end
  end
end
