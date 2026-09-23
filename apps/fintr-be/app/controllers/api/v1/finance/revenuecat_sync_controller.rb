# frozen_string_literal: true

module Api
  module V1
    module Finance
      class RevenuecatSyncController < ApiController
        def create
          operation = ::Finance::Operations::Revenuecat::SyncCustomer.new.call(
            user_id: current_user.id,
          )
          return render_unprocessable_content(details: operation.failure) unless operation.success?

          access = ::Finance::Operations::Entitlements::ResolveProAccess.new.call(
            with_current_params,
          )
          return render_unprocessable_content(details: access.failure) unless access.success?

          render_success(data: access.value!, message: "Pro access refreshed")
        end
      end
    end
  end
end
