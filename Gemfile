# frozen_string_literal: true

source "https://rubygems.org"

gem "rails", "~> 8.0.2"
gem "pg", "~> 1.1"
gem "puma", ">= 5.0"
gem "tzinfo-data", platforms: %i[ windows jruby ]
gem "solid_cache"
gem "solid_queue"
gem "solid_cable"
gem "bootsnap", require: false
gem "thruster", require: false
gem "rack-cors"
gem "dotenv-rails", "~> 3.1"
gem "kamal", "~> 2.6"
gem "aws-sdk-s3", "~> 1.183"

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
gem "activerecord-import", "~> 2.1"

# DB Views
gem "scenic", "~> 1.8"

# Recurrence
gem "ice_cube", "~> 0.17.0"

# Errors
gem "sentry-ruby"
gem "sentry-rails"

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
  gem "parallel_tests", "~> 5.2"
end
