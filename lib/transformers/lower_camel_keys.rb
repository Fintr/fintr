# frozen_string_literal: true

module Transformers
  class LowerCamelKeys
    # Class method to initiate the transformation
    def self.transform(value)
      transform_keys_recursively(value)
    end

    private

    # Recursive helper method (made private class method)
    def self.transform_keys_recursively(value)
      case value
      when Array
        # If it's an array, map over its elements and transform each one
        value.map { |item| transform_keys_recursively(item) }
      when Hash
        # If it's a hash, transform its keys and recursively transform its values
        value.each_with_object({}) do |(key, val), memo|
          new_key = key.to_s.camelize(:lower).to_sym
          memo[new_key] = transform_keys_recursively(val)
        end
      else
        # If it's neither an Array nor a Hash, return the value itself
        value
      end
    end

    # Prevent instantiation if it's meant to be used via class methods only
    private_class_method :new
  end
end
