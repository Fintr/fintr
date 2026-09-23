# frozen_string_literal: true

require "cgi"
require "uri"

module Api
  module V1
    # Proxies attachment downloads from allowed storage URLs so the frontend can
    # trigger a real download (avoids CORS and cross-origin <a download>).
    class AttachmentsController < ApiController
      skip_before_action :authorize, only: [:download]
      skip_before_action :ensure_space_access!, only: [:download]

      ALLOWED_STORAGE_PREFIXES = [
        "https://storage.googleapis.com/fintr-production/",
        "https://storage.googleapis.com/fintr-staging/",
        "https://storage.googleapis.com/fintr-development/",
        "https://storage.googleapis.com/fintr-dev/"
      ].freeze

      def download
        url = params[:url].to_s.strip
        if url.blank?
          return render_bad_request(message: "Missing url parameter")
        end

        unless allowed_url?(url)
          return render_forbidden(
            message: "URL not allowed",
            details: "Only Fintr attachment URLs are allowed"
          )
        end

        key = object_key_from_url(url)
        if key.blank?
          return render_bad_request(message: "Invalid attachment url")
        end

        blob = ActiveStorage::Blob.find_by(key:)
        data = blob.present? ? blob.download : ActiveStorage::Blob.service.download(key)
        filename = blob&.filename&.to_s.presence || filename_from_url(url) || "attachment"
        content_type = blob&.content_type.presence || "application/octet-stream"

        send_data(
          data,
          filename:,
          type: content_type,
          disposition: "attachment"
        )
      rescue ActiveStorage::FileNotFoundError
        render_not_found(message: "Attachment not found")
      rescue StandardError => e
        Rails.logger.error("AttachmentsController#download error: #{e.message}")
        render_internal_server_error(
          message: "Download failed",
          details: e.message
        )
      end

      private

      def allowed_url?(url)
        return false if url.include?("\n") || url.include?("\r")

        ALLOWED_STORAGE_PREFIXES.any? { |prefix| url.start_with?(prefix) }
      end

      def object_key_from_url(url)
        uri = URI.parse(url)
        path = CGI.unescape(uri.path.to_s).delete_prefix("/")
        _bucket, key = path.split("/", 2)
        key.presence
      rescue URI::InvalidURIError
        nil
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
