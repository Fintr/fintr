# frozen_string_literal: true

module Transactions
  module Operations
    module Concerns
      module ResolvesTransactionEntity
        private

        def resolve_transaction_entity(params:)
          return Success(params) unless params.key?(:entity_name)

          resolved = params.dup
          name = resolved[:entity_name].to_s.strip

          if name.blank?
            resolved[:entity_id] = nil
          else
            entity = Entities::Entity.find_or_create_by!(
              space_id: resolved[:space_id],
              entity_type: "transaction",
              full_name: name,
            )
            resolved[:entity_id] = entity.id
          end

          resolved.delete(:entity_name)
          Success(resolved)
        rescue ActiveRecord::RecordInvalid => e
          Failure(entity_name: "could not be created", error: e, expected: true)
        rescue StandardError => e
          Failure(entity_name: "could not be created", error: e, expected: true)
        end
      end
    end
  end
end
