# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class CategoriesController < ApiController
        def create
          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        private

        def create_params
          params.permit(:name, :category_type)
        end
      end
    end
  end
end
