# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UsersController < ApiController
        skip_before_action :ensure_space_access!

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
          p = params.permit(
            :search_query,
            :searchQuery,
            :email_query,
            :emailQuery,
            :name_query,
            :nameQuery,
            :page,
            :per_page,
            :perPage
          )
          {
            email_query: p[:email_query].presence || p[:emailQuery].presence,
            name_query: p[:name_query].presence || p[:nameQuery].presence,
            page: p[:page],
            per_page: p[:per_page].presence || p[:perPage].presence,
            search_query: p[:search_query].presence || p[:searchQuery].presence
          }
        end
      end
    end
  end
end
