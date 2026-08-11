# frozen_string_literal: true

require "json"
require "net/http"
require "set"
require "uri"

module Entities
  class MerchantImageFinder
    WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
    USER_AGENT = "Fintr/1.0 (merchant photo lookup; contact@fintr.app)"
    DEFAULT_LIMIT = 12
    SEARCH_QUERIES = [
      ->(name) { "#{name} logo" },
      ->(name) { "#{name} company" },
      ->(name) { name.to_s },
    ].freeze

    class << self
      def find(merchant_name:, search_hints: [])
        new(merchant_name:, search_hints:).find
      end

      def find_all(merchant_name:, search_hints: [], limit: DEFAULT_LIMIT)
        new(merchant_name:, search_hints:, limit:).find_all
      end

      def download_image(url)
        new(merchant_name: "download").send(:download_image, url)
      end
    end

    def initialize(merchant_name:, search_hints: [], limit: DEFAULT_LIMIT)
      @merchant_name = merchant_name.to_s.strip
      @search_hints = Array(search_hints).map(&:to_s).map(&:strip).reject(&:blank?)
      @limit = limit
    end

    def find
      return nil if @merchant_name.blank?

      find_all.each do |candidate|
        image = download_image(candidate[:thumbnail_url])
        return image if image
      end

      nil
    end

    def find_all
      return [] if @merchant_name.blank?

      seen_urls = Set.new
      candidates = []

      search_queries.each do |query|
        fetch_wikipedia_candidates(query).each do |candidate|
          url = candidate[:thumbnail_url]
          next if seen_urls.include?(url)

          seen_urls.add(url)
          candidates << candidate
          return candidates if candidates.size >= @limit
        end
      end

      candidates
    end

    private

    def search_queries
      queries = SEARCH_QUERIES.map { |query_builder| query_builder.call(@merchant_name) }

      @search_hints.each do |hint|
        queries << hint
        queries << "#{hint} logo"
      end

      queries.uniq
    end

    def fetch_wikipedia_candidates(query)
      uri = URI(WIKIPEDIA_API)
      uri.query = URI.encode_www_form(
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrnamespace: 0,
        gsrlimit: 5,
        prop: "pageimages|info",
        piprop: "thumbnail",
        pithumbsize: 512,
        inprop: "url",
        format: "json",
      )

      response = http_get(uri)
      return [] unless response

      body = JSON.parse(response.body)
      pages = body.dig("query", "pages") || {}

      pages.values.filter_map do |page|
        thumbnail = page.dig("thumbnail", "source")
        next if thumbnail.blank?

        {
          thumbnail_url: thumbnail,
          title: page["title"].to_s,
          source_url: page["fullurl"].presence || wikipedia_page_url(page["title"]),
        }
      end
    rescue JSON::ParserError, StandardError => e
      Rails.logger.warn("[MerchantImageFinder] Wikipedia lookup failed: #{e.message}")
      []
    end

    def wikipedia_page_url(title)
      encoded_title = URI.encode_www_form_component(title.to_s.tr(" ", "_"))
      "https://en.wikipedia.org/wiki/#{encoded_title}"
    end

    def download_image(url)
      uri = URI.parse(url)
      response = http_get(uri)
      return nil unless response
      return nil unless response.is_a?(Net::HTTPSuccess)

      content_type = response.content_type.to_s
      return nil unless content_type.start_with?("image/")

      extension = extension_for(content_type)
      {
        bytes: response.body,
        content_type:,
        filename: "merchant-photo.#{extension}",
      }
    rescue StandardError => e
      Rails.logger.warn("[MerchantImageFinder] Image download failed: #{e.message}")
      nil
    end

    def http_get(uri)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = 10
      http.read_timeout = 15

      request = Net::HTTP::Get.new(uri)
      request["User-Agent"] = USER_AGENT
      http.request(request)
    end

    def extension_for(content_type)
      case content_type
      when %r{image/png}i then "png"
      when %r{image/webp}i then "webp"
      when %r{image/gif}i then "gif"
      else "jpg"
      end
    end
  end
end
