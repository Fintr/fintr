# frozen_string_literal: true

require "cgi"
require "uri"

module Attachments
  module Operations
    class Download < Dry::Operation
      ALLOWED_STORAGE_PREFIXES = [
        "https://storage.googleapis.com/fintr-production/",
        "https://storage.googleapis.com/fintr-staging/",
        "https://storage.googleapis.com/fintr-development/",
        "https://storage.googleapis.com/fintr-dev/"
      ].freeze

      class Contract < Dry::Validation::Contract
        params do
          required(:url).filled(:string)
          required(:space_id).filled(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        key = step authorized_key(params:)
        step read_file(key:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def authorized_key(params:)
        return Failure(url: "not allowed") unless allowed_url?(params[:url])

        key = object_key_from_url(params[:url])
        return Failure(url: "invalid") if key.blank?
        return Failure(space_id: "forbidden") unless key.start_with?("spaces/#{params[:space_id]}/")

        Success(key)
      end

      def read_file(key:)
        blob = ActiveStorage::Blob.find_by(key:)
        data = blob.present? ? blob.download : ActiveStorage::Blob.service.download(key)

        Success(
          data:,
          filename: blob&.filename&.to_s.presence || filename_from_key(key) || "attachment",
          content_type: blob&.content_type.presence || "application/octet-stream"
        )
      rescue ActiveStorage::FileNotFoundError
        Failure(file: "not found")
      end

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

      def filename_from_key(key)
        base = File.basename(key.to_s)
        base.presence
      end
    end
  end
end
