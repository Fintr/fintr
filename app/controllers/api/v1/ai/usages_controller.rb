# frozen_string_literal: true

module Api
  module V1
    module Ai
      class UsagesController < ApiController
        def show
          operation = ::Ai::Operations::Usages::ShowUsage.new.call(with_current_params)
          return render_internal_server_error(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end
      end
    end
  end
end
