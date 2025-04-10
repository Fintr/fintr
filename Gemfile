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
gem "kamal", "~> 2.5"
gem "blueprinter", "~> 1.1"
gem "oj", "~> 3.16"
gem "jwt", "~> 2.7"
gem "auth0", "~> 5.12"
gem "omniauth", "~> 2.1"
gem "omniauth-auth0", "~> 3.1"
gem "omniauth-rails_csrf_protection", "~> 1.0"

group :development, :test do
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"
  gem "brakeman", require: false
  gem "rubocop-rails-omakase", require: false
  gem "rubocop-performance", require: false
  gem "rubocop-rspec", require: false
  gem "rspec-rails"
  gem "shoulda-matchers"
  gem "factory_bot_rails"
end
