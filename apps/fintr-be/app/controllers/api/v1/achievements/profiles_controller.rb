# frozen_string_literal: true

module Api
  module V1
    module Achievements
      class ProfilesController < ApiController
        def show
          operation = ::Achievements::Operations::ShowProfile.new.call(
            with_current_params,
          )
          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(
            data: ::Achievements::Serializers::ProfileSerializer.render_as_hash(
              operation.value!,
            ),
          )
        end
      end
    end
  end
end
