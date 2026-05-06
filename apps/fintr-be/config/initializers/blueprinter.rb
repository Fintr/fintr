# frozen_string_literal: true

require "oj"

unless Rails.env.production?
  Oj::Rails.mimic_JSON
end

Blueprinter.configure do |config|
  config.generator = Oj
end
