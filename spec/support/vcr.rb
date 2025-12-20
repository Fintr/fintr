# frozen_string_literal: true

require "vcr"

VCR.configure do |config|
  config.cassette_library_dir = "spec/fixtures/vcr_cassettes"
  config.hook_into :webmock
  config.configure_rspec_metadata!
  config.filter_sensitive_data("<XENDIT_API_KEY>") { ENV["XENDIT_API_KEY"] }
  config.filter_sensitive_data("<XENDIT_API_KEY>") { |interaction| interaction.request.headers["Authorization"]&.first }
  config.default_cassette_options = {
    record: :once,
    match_requests_on: [:method, :uri, :body]
  }
end
