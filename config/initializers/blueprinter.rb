# frozen_string_literal: true

require "oj" # you can skip this if OJ has already been required.
require "transformers/lower_camel_keys"

Blueprinter.configure do |config|
  config.generator = Oj # default is JSON
  # config.default_transformers = [ Transformers::LowerCamelKeys ]
end
