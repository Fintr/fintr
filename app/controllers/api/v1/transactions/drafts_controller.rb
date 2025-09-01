# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class DraftsController < ApiController
        def index
          query = ::Transactions::Queries::Drafts.call(params: with_current_params)
          serializer = ::Transactions::Serializers::TransactionSerializer.render_as_hash(query.value!)
          return render_internal_server_error(details: query.failure) unless query.success?

          render_success(data: serializer)
        end
      end
    end
  end
end
