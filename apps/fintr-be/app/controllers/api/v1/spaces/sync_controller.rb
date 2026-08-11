# frozen_string_literal: true

module Api
  module V1
    module Spaces
      class SyncController < ApiController
        def bootstrap
          result = ::Sync::Operations::BootstrapSpace.new.call(
            space_id: current_space.id.to_s,
            current_user_id: current_user&.id&.to_s,
          )

          if result.failure?
            failure = result.failure
            return render_unprocessable_content(
              message: failure.is_a?(Hash) ? failure[:message] || "Bootstrap failed" : "Bootstrap failed",
              details: failure.is_a?(Hash) ? failure.except(:message) : nil,
            )
          end

          render_success(data: result.value!)
        end

        def changes
          pull_params = {
            space_id: current_space.id.to_s,
            since: params[:since].to_i,
          }
          pull_params[:limit] = params[:limit].to_i if params[:limit].present?

          result = ::Sync::Operations::PullChanges.new.call(pull_params)

          if result.failure?
            failure = result.failure
            if failure.is_a?(Hash) && failure[:bootstrap_required]
              return render_error(
                message: failure[:message],
                status: :gone,
                details: {
                  bootstrap_required: true,
                  oldest_available_seq: failure[:oldest_available_seq],
                },
              )
            end

            return render_unprocessable_content(
              message: failure.is_a?(Hash) ? failure[:message] : "Sync failed",
              details: failure.is_a?(Hash) ? failure.except(:message) : nil,
            )
          end

          value = result.value!
          render_success(
            data: {
              space_id: current_space.id,
              since: value[:since],
              latest_seq: value[:latest_seq],
              oldest_available_seq: value[:oldest_available_seq],
              has_more: value[:has_more],
              changes: value[:changes].map { |entry| serialize_change_log_entry(entry) },
            },
          )
        end

        private

        def serialize_change_log_entry(entry)
          {
            seq: entry.seq,
            op: entry.op,
            occurred_at: entry.created_at.iso8601(3),
            payload: entry.payload,
            origin_client_mutation_id: entry.origin_client_mutation_id,
          }.compact
        end
      end
    end
  end
end
