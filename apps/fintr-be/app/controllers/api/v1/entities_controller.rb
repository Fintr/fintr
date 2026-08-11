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

      def show
        operation = ::Entities::Operations::ShowEntity.new.call(with_current_params(show_params))

        return render_not_found(details: operation.failure) if operation.failure? && operation.failure[:id]

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        serializer = ::Entities::Serializers::EntityDetailSerializer.render_as_hash(operation.value!)
        render_success(data: serializer)
      end

      def create
        operation = ::Entities::Operations::CreateEntity.new.call(with_current_params(create_params))

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        serializer = ::Entities::Serializers::EntitySerializer.render_as_hash(operation.value!)
        render_created(data: serializer)
      end

      def update
        operation = ::Entities::Operations::UpdateEntity.new.call(with_current_params(update_params))

        return render_not_found(details: operation.failure) if operation.failure? && operation.failure[:id]

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        serializer = ::Entities::Serializers::EntitySerializer.render_as_hash(operation.value!)
        render_success(data: serializer)
      end

      def search_photos
        operation = ::Entities::Operations::SearchEntityPhotos.new.call(
          with_current_params(search_photos_params),
        )

        return render_not_found(details: operation.failure) if operation.failure? && operation.failure[:id]

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_success(data: operation.value!)
      end

      def generate_photo
        operation = ::Entities::Operations::GenerateEntityPhoto.new.call(
          with_current_params(generate_photo_params),
        )

        return render_not_found(details: operation.failure) if operation.failure? && operation.failure[:id]

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        payload = operation.value!
        serializer = ::Entities::Serializers::EntitySerializer.render_as_hash(payload[:entity])
        render_success(
          data: {
            entity: serializer,
            photo_source: payload[:photo_source],
          },
        )
      end

      private

      def index_params
        params.permit(:entity_type, :search).to_h
      end

      def show_params
        params.permit(:id).to_h
      end

      def create_params
        params.permit(:full_name, :entity_type, :photo)
      end

      def update_params
        params.permit(:id, :full_name, :photo, :remove_photo)
      end

      def search_photos_params
        params.permit(:id, :full_name, :prompt).to_h
      end

      def generate_photo_params
        params.permit(:id, :full_name, :prompt, :image_url, :force_generate).to_h
      end
    end
  end
end
