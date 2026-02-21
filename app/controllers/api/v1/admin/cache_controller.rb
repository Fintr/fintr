# frozen_string_literal: true

module Api
  module V1
    module Admin
      class CacheController < ApiController
        skip_before_action :ensure_space_access!

        # GET /api/v1/admin/cache/version
        # Returns the current cache version
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

        # POST /api/v1/admin/cache/clear
        # Clears all caches and bumps the cache version
        # This forces all mobile apps to fetch fresh content
        def clear
          # Generate new cache version (timestamp)
          new_version = Time.now.to_i.to_s

          # Store the new version and timestamp (do not call Rails.cache.clear;
          # it would remove the version we just set)
          Rails.cache.write("capacitor_cache_version", new_version)
          Rails.cache.write("capacitor_cache_version_updated_at", Time.now.iso8601)

          # Broadcast to all connected clients via ActionCable
          # This triggers immediate cache refresh on open apps
          ActionCable.server.broadcast(
            "cache_updates",
            {
              action: "clear_cache",
              cache_version: new_version,
              timestamp: Time.now.iso8601
            }
          )

          render_success(
            message: "Cache cleared successfully. All mobile apps will refresh on next load.",
            data: {
              cache_version: new_version,
              updated_at: Time.now.iso8601
            }
          )
        end
      end
    end
  end
end
