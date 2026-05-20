# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class CategoriesController < ApiController
        def index
          operation = ::Transactions::Operations::Categories::ShowAllCategories.new.call(with_current_params)

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        def create
          operation = ::Transactions::Operations::Categories::CreateCategory.new.call(with_current_params(create_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        def update
          operation = ::Transactions::Operations::Categories::UpdateCategory.new.call(with_current_params(update_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(data: { id: operation.value!.id, name: operation.value!.name }, message: "Category updated successfully")
        end

        def destroy
          operation = ::Transactions::Operations::Categories::DeleteCategory.new.call(with_current_params(destroy_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(message: "Category deleted successfully")
        end

        def preview_conversion
          operation = ::Transactions::Operations::Categories::PreviewCategoryConversion.new.call(
            with_current_params(conversion_params)
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        def convert
          operation = ::Transactions::Operations::Categories::ConvertCategoryHierarchy.new.call(
            with_current_params(conversion_params)
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          result = operation.value!
          render_success(
            data: {
              id: result[:category].id,
              name: result[:category].name,
              parent_id: result[:category].parent_id,
              redirect_parent_id: result[:redirect_parent_id]
            },
            message: "Category updated successfully"
          )
        end

        private

        def create_params
          params.permit(:name, :category_type, :parent_id)
        end

        def update_params
          params.permit(:id, :name)
        end

        def destroy_params
          params.permit(:id)
        end

        def conversion_params
          params.permit(:id, :conversion_type, :new_parent_id)
        end
      end
    end
  end
end
