# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class TagsController < ApiController
        def index
          operation = ::Transactions::Operations::Tags::ShowAllTags.new.call(with_current_params)

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(
            data: ::Transactions::Serializers::TagSerializer.render_as_hash(operation.value!)
          )
        end

        def create
          operation = ::Transactions::Operations::Tags::CreateTag.new.call(with_current_params(create_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        def update
          operation = ::Transactions::Operations::Tags::UpdateTag.new.call(with_current_params(update_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(
            data: {
              id: operation.value!.id,
              name: operation.value!.name,
              color: operation.value!.color,
            },
            message: "Tag updated successfully"
          )
        end

        def destroy
          operation = ::Transactions::Operations::Tags::DeleteTag.new.call(with_current_params(destroy_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(message: "Tag deleted successfully")
        end

        def toggle_default
          operation = ::Transactions::Operations::Tags::ToggleDefaultTag.new.call(
            with_current_params(toggle_default_params),
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(
            data: ::Transactions::Serializers::TagSerializer.render_as_hash(operation.value!),
            message: operation.value!.is_default? ? "Default tag set" : "Default tag unset",
          )
        end

        def generate_style_image
          processing_params = with_current_params(generate_style_image_params)

          operation = ::Ai::Operations::Usages::CreateUsage.new.call(
            processing_params.merge(
              ai_type: "tag_style_image",
              tokens_used: 5,
            ),
          ) do
            ::Transactions::Operations::Tags::GenerateTagStyleImage.new.call(processing_params)
          end

          unless operation.success?
            message = operation.failure.is_a?(String) ? operation.failure : "Could not generate tag style"
            return render_unprocessable_content(message: message, details: operation.failure)
          end

          render_success(
            data: ::Transactions::Serializers::TagSerializer.render_as_hash(operation.value!),
            message: "Tag style generated",
          )
        end

        private

        def create_params
          params.permit(:name, :color)
        end

        def update_params
          params.permit(:id, :name, :color)
        end

        def destroy_params
          params.permit(:id)
        end

        def toggle_default_params
          params.permit(:id)
        end

        def generate_style_image_params
          params.permit(:id, :prompt)
        end
      end
    end
  end
end
