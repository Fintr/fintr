# frozen_string_literal: true

require "net/http"
require "uri"

module Api
  module V1
    # Proxies attachment downloads from allowed S3 URLs so the frontend can
    # trigger a real download (avoids CORS and cross-origin <a download>).
    class AttachmentsController < ApiController
      skip_before_action :authorize, only: [:download]
      skip_before_action :ensure_space_access!, only: [:download]

      # Allowed S3 URL prefixes (bucket names may vary by env)
      ALLOWED_S3_PREFIXES = [
        "https://s3.ap-southeast-1.amazonaws.com/fintr-production/",
        "https://s3.ap-southeast-1.amazonaws.com/fintr-staging/",
        "https://s3.ap-southeast-1.amazonaws.com/fintr-development/"
      ].freeze

      def download
        url = params[:url].to_s.strip
        if url.blank?
          return render_unauthorized(message: "Missing url parameter")
        end

        unless allowed_url?(url)
          return render_unauthorized(
            message: "URL not allowed",
            details: "Only Fintr S3 attachment URLs are allowed"
          )
        end

        uri = URI(url)
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = (uri.scheme == "https")
        http.open_timeout = 10
        http.read_timeout = 15

        request = Net::HTTP::Get.new(uri)
        response = http.request(request)

        unless response.is_a?(Net::HTTPSuccess)
          return render_unauthorized(
            message: "Failed to fetch attachment",
            details: "Upstream returned #{response.code}"
          )
        end

        filename = filename_from_url(url) || "attachment"
        content_type = response["Content-Type"].presence || "application/octet-stream"

        send_data(
          response.body,
          filename: filename,
          type: content_type,
          disposition: "attachment"
        )
      rescue StandardError => e
        Rails.logger.error("AttachmentsController#download error: #{e.message}")
        render_unauthorized(
          message: "Download failed",
          details: e.message
        )
      end

      private

      def allowed_url?(url)
        return false if url.include?("\n") || url.include?("\r")
        ALLOWED_S3_PREFIXES.any? { |prefix| url.start_with?(prefix) }
      end

      def filename_from_url(url)
        path = URI(url).path
        return nil if path.blank?
        base = File.basename(path)
        base.presence
      end
    end
  end
end
