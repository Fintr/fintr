# frozen_string_literal: true

module Api
  module V1
    module Finance
      class ProGrantAcknowledgementsController < ApiController
        def create
          operation = ::Finance::Operations::ProGrants::Acknowledge.new.call(
            user_id: current_user.id,
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(message: "Thank-you noted")
        end
      end
    end
  end
end
