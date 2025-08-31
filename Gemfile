# frozen_string_literal: true

source "https://rubygems.org"

gem "rails", "~> 8.0.2"
gem "pg", "~> 1.6"
gem "puma", ">= 5.0"
gem "tzinfo-data", platforms: %i[ windows jruby ]
gem "solid_cache"
gem "solid_queue"
gem "solid_cable"
gem "pry-rails", "~> 0.3.11"
gem "bootsnap", require: false
gem "thruster", require: false
gem "rack-cors"
gem "dotenv-rails", "~> 3.1"
gem "kamal", "~> 2.7"
gem "aws-sdk-s3", "~> 1.198"
gem "csv", "~> 3.3"

# DRY Operations, Validation
gem "dry-operation", "~> 1.0"
gem "dry-validation", "~> 1.11"

# Serialization
gem "blueprinter", "~> 1.1"
gem "oj", "~> 3.16"

# Authentication
gem "jwt", "~> 2.7"
gem "auth0", "~> 5.12"

# Money
gem "money-rails", "~> 1.15"

# Roles
gem "rolify", "~> 7.0.0", github: "mikodagatan/rolify"

# Pagination
gem "kaminari", "~> 1.2"

# Bulk Import, Duplication
gem "amoeba", "~> 3.3"
gem "activerecord-import", "~> 2.2"

# DB Views
gem "scenic", "~> 1.9"

# Recurrence
gem "ice_cube", "~> 0.17.0"

# OCR and Image Processing
gem "rtesseract", "~> 3.1"
gem "mini_magick", "~> 5.3"
gem "ruby-vips", "~> 2.2"

# AI Processing
gem "ruby-openai", "~> 8.3"

# Errors
gem "sentry-ruby"
gem "sentry-rails"

# Soft deletes
gem "discard", "~> 1.4"

group :development, :test do
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"
  gem "brakeman", require: false
  gem "rubocop-rails-omakase", require: false
  gem "rubocop-performance", require: false
  gem "rubocop-rspec", require: false
  gem "rspec-rails"
  gem "shoulda-matchers"
  gem "factory_bot_rails"
  gem "simplecov", "~> 0.22.0"
  gem "parallel_tests", "~> 5.4"
end
