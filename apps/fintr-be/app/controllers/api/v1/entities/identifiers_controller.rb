# frozen_string_literal: true

module Api
  module V1
    module Entities
      class IdentifiersController < ApiController
        def create
          operation = ::Entities::Operations::CreateMerchantAlias.new.call(
            with_current_params(create_params),
          )

          if operation.failure? && operation.failure[:entity_id]
            return render_not_found(details: operation.failure)
          end

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          serializer = ::Entities::Serializers::MerchantAliasSerializer.render_as_hash(
            operation.value!,
          )
          render_created(data: serializer)
        end

        def destroy
          operation = ::Entities::Operations::DeleteMerchantAlias.new.call(
            with_current_params(destroy_params),
          )

          return render_not_found(details: operation.failure) if operation.failure? && operation.failure[:id]

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(message: "Identifier removed")
        end

        private

        def create_params
          params.permit(:entity_id, :label).to_h
        end

        def destroy_params
          params.permit(:entity_id, :id).to_h
        end
      end
    end
  end
end
