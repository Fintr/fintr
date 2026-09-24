# frozen_string_literal: true

module Sync
  module Operations
    class AllocateSpaceSeq < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step allocate(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def allocate(params:)
        seq = nil

        ActiveRecord::Base.transaction do
          counter = Sync::SpaceSequence.lock.find_or_create_by!(space_id: params[:space_id]) do |row|
            row.last_seq = 0
          end

          counter.increment!(:last_seq)
          seq = counter.last_seq
        end

        Success(seq)
      end
    end
  end
end
