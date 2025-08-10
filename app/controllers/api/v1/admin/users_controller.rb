# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UsersController < ApiController
        skip_before_action :current_space

        def index
          query = ::Admin::Queries::UsersQuery.call(params: index_params)

          render_paginated(
            query.value!,
            serializer: ::Admin::Serializers::UserSerializer,
            key: :users
          )
        end

        private

        def index_params
          params.permit(:search_query, :page)
        end
      end
    end
  end
end
