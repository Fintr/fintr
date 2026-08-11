# frozen_string_literal: true

module Sync
  module Operations
    class AppendChangeLog < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:op).value(:string)
          required(:payload).value(:hash)
          optional(:entity_type).value(:string)
          optional(:entity_id).value(:string)
          optional(:actor_user_id).value(:string)
          optional(:origin_client_mutation_id).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        seq = step Sync::Operations::AllocateSpaceSeq.new.call(space_id: params[:space_id])
        step persist(params:, seq:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def persist(params:, seq:)
        entry = Sync::ChangeLogEntry.create!(
          space_id: params[:space_id],
          seq:,
          op: params[:op],
          entity_type: params[:entity_type],
          entity_id: params[:entity_id],
          payload: params[:payload],
          actor_user_id: params[:actor_user_id],
          origin_client_mutation_id: params[:origin_client_mutation_id],
        )
        Success(entry)
      rescue ActiveRecord::RecordInvalid => e
        Failure(message: e.message)
      end
    end
  end
end
