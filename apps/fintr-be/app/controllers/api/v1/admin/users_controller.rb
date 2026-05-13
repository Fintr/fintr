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
            :email_query,
            :name_query,
            :page,
            :per_page
          )
          {
            email_query: p[:email_query].presence,
            name_query: p[:name_query].presence,
            page: p[:page],
            per_page: p[:per_page].presence,
            search_query: p[:search_query].presence
          }
        end
      end
    end
  end
end
