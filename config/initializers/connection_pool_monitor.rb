# frozen_string_literal: true

# Connection Pool Monitor
# Logs connection pool statistics to help diagnose connection exhaustion issues
# Only runs in production and staging to avoid noise in development

if Rails.env.production? || Rails.env.staging?
  ActiveSupport::Notifications.subscribe("connection_pool.active_record") do |name, start, finish, id, payload|
    pool = payload[:connection_pool]
    next unless pool

    # Log warning if pool is getting full (>80% utilization)
    pool_size = pool.size
    checked_out = pool.checked_out.size
    available = pool.available_count
    utilization = (checked_out.to_f / pool_size) * 100

    if utilization > 80
      Rails.logger.warn(
        "[ConnectionPool] High utilization detected: " \
        "#{checked_out}/#{pool_size} connections checked out (#{utilization.round(1)}% utilization). " \
        "#{available} available. " \
        "Database: #{pool.spec.name}"
      )
    end

    # Log error if pool is exhausted
    if available == 0 && checked_out == pool_size
      Rails.logger.error(
        "[ConnectionPool] Pool exhausted! " \
        "All #{pool_size} connections are checked out. " \
        "Database: #{pool.spec.name}. " \
        "This may cause 'too many clients already' errors."
      )
    end
  end

  # Periodic connection pool health check (every 30 seconds)
  if defined?(Rails::Server)
    Thread.new do
      loop do
        sleep 30

        ActiveRecord::Base.connection_handler.connection_pool_list.each do |pool|
          pool_size = pool.size
          checked_out = pool.checked_out.size
          available = pool.available_count
          utilization = (checked_out.to_f / pool_size) * 100

          if utilization > 90
            Rails.logger.error(
              "[ConnectionPool] Critical: Pool #{pool.spec.name} at #{utilization.round(1)}% utilization " \
              "(#{checked_out}/#{pool_size} checked out, #{available} available)"
            )
          end
        end
      rescue => e
        Rails.logger.error("[ConnectionPool] Monitor error: #{e.message}")
      end
    end
  end
end
