# frozen_string_literal: true

module Api
  module V1
    # Public endpoint for mobile apps to check current cache version (no auth).
    # Used so iOS/Android can clear local cache and reload when admin bumps version.
    class CacheVersionController < ApplicationController
      skip_before_action :authorize

      # GET /api/v1/cache_version
      def show
        cache_version = Rails.cache.fetch("capacitor_cache_version") do
          Time.now.to_i.to_s
        end

        render_success(
          data: {
            cache_version: cache_version,
            updated_at: Rails.cache.read("capacitor_cache_version_updated_at")
          }
        )
      end
    end
  end
end
