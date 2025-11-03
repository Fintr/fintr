# frozen_string_literal: true

module Api
  module V1
    class EntitiesController < ApiController
      def index
        params_hash = with_current_params(index_params)
        params_hash[:entity_type] ||= "loan"

        operation = ::Entities::Operations::ShowEntities.new.call(params_hash)

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        serializer = ::Entities::Serializers::EntitySerializer.render_as_hash(operation.value!)
        render_success(data: serializer)
      end

      def create
        operation = ::Entities::Operations::CreateEntity.new.call(with_current_params(create_params))

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        serializer = ::Entities::Serializers::EntitySerializer.render_as_hash(operation.value!)
        render_created(data: serializer)
      end

      private

      def index_params
        params.permit(:entity_type, :search).to_h
      end

      def create_params
        params.permit(:full_name, :entity_type)
      end
    end
  end
end
