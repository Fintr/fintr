# frozen_string_literal: true

module Api
  module V1
    module Finance
      class ProAccessController < ApiController
        def show
          operation = ::Finance::Operations::Entitlements::ResolveProAccess.new.call(
            with_current_params,
          )
          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end
      end
    end
  end
end
